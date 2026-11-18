import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../appwrite/client.dart';
import '../stores/registry.dart';
import 'e2ee.dart';

/// Data-key lifecycle for encrypted sync (phone mirror of
/// `src/lib/crypto/keyring.ts`).
///
/// A random per-user key seals every synced text field. Two wrapped copies
/// live in the account prefs — under PBKDF2(password) and under a one-time
/// recovery key — so a new device can recover the key while the server only
/// ever holds ciphertext.
///
/// The unwrapped key is cached in SharedPreferences so background sync keeps
/// working without a password prompt; that cache protects the cloud copy, not
/// a device that is already unlocked and compromised.
enum E2eeStatus { idle, locked, unlocked }

class E2ee extends ChangeNotifier {
  E2ee._();

  static final E2ee instance = E2ee._();

  E2eeStatus status = E2eeStatus.idle;

  /// freshly created recovery code — shown once, then cleared
  String? pendingRecoveryKey;
  String? error;

  String? _userId;
  SecretKey? _key;

  bool get unlocked => _key != null;

  SecretKey? get key => _key;

  String _cacheKey(String userId) => 'semester.e2ee.$userId';

  Future<Uint8List?> _cached(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_cacheKey(userId));
    if (stored == null) return null;
    try {
      return base64Decode(stored);
    } catch (_) {
      return null;
    }
  }

  Future<void> _cache(String userId, Uint8List raw) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cacheKey(userId), base64Encode(raw));
  }

  /// The account prefs. A failed read must throw: treating it as "no key yet"
  /// would create a second key on top of data sealed with the first one, which
  /// nothing could ever open again.
  Future<Map<String, dynamic>> _prefs() async {
    final prefs = await account.getPrefs();
    return Map<String, dynamic>.from(prefs.data);
  }

  Future<void> _finish(String userId, Uint8List raw) async {
    _userId = userId;
    _key = SecretKey(raw);
    await _cache(userId, raw);
    status = E2eeStatus.unlocked;
    error = null;
    notifyListeners();
  }

  /// the key could not be set up — surface the unlock dialog so the user can
  /// retry instead of leaving sync silently paused
  void markLocked() => _lock();

  void _lock([String? message]) {
    _key = null;
    status = E2eeStatus.locked;
    error = message;
    notifyListeners();
  }

  /// Called after sign-in. Creates the key on the first password sign-in,
  /// otherwise opens the cached or password-unwrapped key.
  Future<void> bootstrap(String userId, {String? password}) async {
    if (_userId != null && _userId != userId) {
      _key = null;
      pendingRecoveryKey = null;
    }
    _userId = userId;

    if (_key != null) return;

    final cached = await _cached(userId);
    if (cached != null) {
      await _finish(userId, cached);
      return;
    }

    final prefs = await _prefs();
    final existing = prefs['e2ee'];

    if (existing is Map) {
      if (password == null) {
        _lock();
        return;
      }
      try {
        final salt = base64Decode(existing['salt'] as String);
        final iterations =
            (existing['iter'] as num?)?.toInt() ?? pbkdf2Iterations;
        final kek = await derivePasswordKey(password, salt, iterations);
        final raw = await unwrapBytes(kek, existing['wrapped'] as String);
        await _finish(userId, raw);
      } catch (_) {
        _lock('Could not unlock your data key.');
      }
      return;
    }

    if (password == null) {
      // no key yet and no password in hand (MFA / restored session)
      _lock();
      return;
    }

    final raw = randomBytes(32);
    final salt = newSalt();
    final kek = await derivePasswordKey(password, salt);
    final recoveryRaw = randomBytes(32);
    final recoveryKey = SecretKey(recoveryRaw);

    await account.updatePrefs(
      prefs: {
        ...prefs,
        'e2ee': {
          'v': 1,
          'salt': base64Encode(salt),
          'iter': pbkdf2Iterations,
          'wrapped': await wrapBytes(kek, raw),
          'recovery': await wrapBytes(recoveryKey, raw),
        },
      },
    );

    await _finish(userId, raw);
    pendingRecoveryKey = formatRecoveryKey(recoveryRaw);
    notifyListeners();
    // rows already synced are plaintext in the cloud — forget the digests so
    // the next sync pushes every one of them back sealed
    Stores.I.syncMeta.clearRowDigests();
  }

  Future<void> unlockWithPassword(String password) async {
    final userId = _userId;
    if (userId == null) throw StateError('Not signed in');
    final prefs = await _prefs();
    final existing = prefs['e2ee'];
    if (existing is! Map) return bootstrap(userId, password: password);
    try {
      final salt = base64Decode(existing['salt'] as String);
      final iterations =
          (existing['iter'] as num?)?.toInt() ?? pbkdf2Iterations;
      final kek = await derivePasswordKey(password, salt, iterations);
      final raw = await unwrapBytes(kek, existing['wrapped'] as String);
      await _finish(userId, raw);
    } catch (_) {
      _lock('That password does not open the data key.');
      throw Exception('That password does not open the data key.');
    }
  }

  Future<void> unlockWithRecoveryKey(String code) async {
    final userId = _userId;
    if (userId == null) throw StateError('Not signed in');
    final prefs = await _prefs();
    final existing = prefs['e2ee'];
    if (existing is! Map) {
      throw Exception('This account has no encrypted data yet.');
    }
    try {
      final key = SecretKey(decodeRecoveryKey(code));
      final raw = await unwrapBytes(key, existing['recovery'] as String);
      await _finish(userId, raw);
    } catch (_) {
      _lock('That recovery key is not valid.');
      throw Exception('That recovery key is not valid.');
    }
  }

  /// returns the one-time recovery code (if a key was just created) and clears it
  String? takeRecoveryKey() {
    final code = pendingRecoveryKey;
    pendingRecoveryKey = null;
    return code;
  }

  /// drop the in-memory + device copy (sign-out, account switch)
  Future<void> lock() async {
    final userId = _userId;
    _userId = null;
    _key = null;
    pendingRecoveryKey = null;
    status = E2eeStatus.idle;
    error = null;
    if (userId != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_cacheKey(userId));
    }
    notifyListeners();
  }
}
