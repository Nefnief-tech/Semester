import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

/// Client-side encryption for synced data (Flutter mirror of
/// `src/lib/crypto/e2ee.ts` — same wire format, so a row sealed on the web
/// opens on the phone and vice versa).
///
/// Wire format: `enc:v1:` + base64(nonce[12] || ciphertext || mac[16]).
/// AES-256-GCM; the 32-byte data key is wrapped by PBKDF2(password) and by a
/// one-time recovery key, both stored as ciphertext in the account prefs.

const String _prefix = 'enc:v1:';
const int _nonceBytes = 12;
const int _saltBytes = 16;
const int _keyBytes = 32;
const int _macBytes = 16;
const int _recoveryBytes = 32;

/// OWASP-recommended PBKDF2-HMAC-SHA256 work factor; matches the web client.
const int pbkdf2Iterations = 600000;

bool isSealed(Object? value) =>
    value is String && value.startsWith(_prefix);

Uint8List randomBytes(int length) {
  final random = Random.secure();
  return Uint8List.fromList(
    List<int>.generate(length, (_) => random.nextInt(256)),
  );
}

Future<SecretKey> derivePasswordKey(
  String password,
  Uint8List salt, [
  int iterations = pbkdf2Iterations,
]) {
  final pbkdf2 = Pbkdf2(
    macAlgorithm: Hmac.sha256(),
    iterations: iterations,
    bits: _keyBytes * 8,
  );
  return pbkdf2.deriveKey(
    secretKey: SecretKey(utf8.encode(password)),
    nonce: salt,
  );
}

String _pack(SecretBox box) {
  final out = BytesBuilder(copy: false)
    ..add(box.nonce)
    ..add(box.cipherText)
    ..add(box.mac.bytes);
  return _prefix + base64Encode(out.toBytes());
}

SecretBox _unpack(String value) {
  final bytes = base64Decode(value.substring(_prefix.length));
  final macStart = bytes.length - _macBytes;
  return SecretBox(
    bytes.sublist(_nonceBytes, macStart),
    nonce: bytes.sublist(0, _nonceBytes),
    mac: Mac(bytes.sublist(macStart)),
  );
}

/// seal a string; already-sealed input passes through untouched
Future<String> seal(SecretKey key, String plaintext) async {
  if (isSealed(plaintext)) return plaintext;
  final box = await AesGcm.with256bits().encrypt(
    utf8.encode(plaintext),
    secretKey: key,
  );
  return _pack(box);
}

/// open a sealed string; plaintext (pre-encryption rows) passes through
Future<String> open(SecretKey key, String value) async {
  if (!isSealed(value)) return value;
  final clear = await AesGcm.with256bits().decrypt(
    _unpack(value),
    secretKey: key,
  );
  return utf8.decode(clear);
}

Future<String> wrapBytes(SecretKey key, Uint8List raw) async {
  final box = await AesGcm.with256bits().encrypt(raw, secretKey: key);
  return _pack(box);
}

Future<Uint8List> unwrapBytes(SecretKey key, String value) async {
  if (!isSealed(value)) throw const FormatException('not a wrapped key');
  final clear = await AesGcm.with256bits().decrypt(
    _unpack(value),
    secretKey: key,
  );
  return Uint8List.fromList(clear);
}

Uint8List newSalt() => randomBytes(_saltBytes);

/* ---------------- recovery key (Crockford base32) ----------------
 * No I, L, O, U — survives handwriting and the usual 0/O, 1/I/L mixups.
 * 32 random bytes → 52 characters, shown in groups of five. */

const String _crockford = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

String encodeRecoveryKey(Uint8List raw) {
  var bits = 0;
  var value = 0;
  final out = StringBuffer();
  for (final byte in raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out.write(_crockford[(value >> (bits - 5)) & 31]);
      bits -= 5;
    }
  }
  if (bits > 0) out.write(_crockford[(value << (5 - bits)) & 31]);
  return out.toString();
}

Uint8List decodeRecoveryKey(String code) {
  final clean = code
      .toUpperCase()
      .replaceAll(RegExp(r'[^0-9A-Z]'), '')
      .replaceAll('I', '1')
      .replaceAll('L', '1')
      .replaceAll('O', '0');
  var bits = 0;
  var value = 0;
  final out = <int>[];
  for (final char in clean.split('')) {
    final index = _crockford.indexOf(char);
    if (index < 0) throw const FormatException('invalid recovery key');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.add((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  if (out.length != _recoveryBytes) {
    throw const FormatException('invalid recovery key');
  }
  return Uint8List.fromList(out);
}

/// group in fives for reading aloud / copying
String formatRecoveryKey(Uint8List raw) {
  final code = encodeRecoveryKey(raw);
  return code.replaceAllMapped(
    RegExp(r'.{5}'),
    (match) => '${match.group(0)} ',
  ).trim();
}

String generateRecoveryCode() => formatRecoveryKey(randomBytes(_recoveryBytes));
