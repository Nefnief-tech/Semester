import 'e2ee.dart';
import 'keyring.dart';

/// Which row columns are sealed before they leave the device — mirrors
/// `src/lib/crypto/rows.ts`. Grade numbers (points, weight) are sealed too;
/// other structural values (ids, dates, flags) stay readable for syncing.
const Map<String, List<String>> sealedFields = {
  'subjects': ['name'],
  'todos': ['title', 'notes'],
  'homeworks': ['title', 'notes'],
  'grades': ['title'],
  'events': ['title', 'notes'],
  'timetable_entries': ['subject', 'teacher', 'room', 'time'],
  'chat_messages': ['content', 'sources'],
  'decks': ['title'],
  'flashcards': ['front', 'back'],
  'portal_entries': ['course', 'courseOld', 'substitute', 'room', 'info'],
  'portal_courses': ['course'],
};

/// numeric columns stored as sealed strings (their cloud attribute is a string)
const Map<String, List<String>> sealedNumbers = {
  'grades': ['points', 'weight'],
};

/// seal the text/number fields of a row (copy; already-sealed values pass through)
Future<Map<String, dynamic>> sealRow(
  String table,
  Map<String, dynamic> row,
) async {
  final fields = sealedFields[table] ?? const <String>[];
  final numbers = sealedNumbers[table] ?? const <String>[];
  if (fields.isEmpty && numbers.isEmpty) return row;
  final key = E2ee.instance.key;
  if (key == null) throw StateError('encryption is locked');
  final out = Map<String, dynamic>.from(row);
  for (final field in fields) {
    final value = out[field];
    if (value is String && value.isNotEmpty) {
      out[field] = await seal(key, value);
    }
  }
  for (final field in numbers) {
    final value = out[field];
    if (value is num) out[field] = await seal(key, value.toString());
  }
  return out;
}

/// open the text fields of a row; plaintext rows (pre-encryption) pass through
Future<Map<String, dynamic>> openRow(
  String table,
  Map<String, dynamic> row,
) async {
  final fields = sealedFields[table] ?? const <String>[];
  final numbers = sealedNumbers[table] ?? const <String>[];
  if (fields.isEmpty && numbers.isEmpty) return row;
  final key = E2ee.instance.key;
  if (key == null) throw StateError('encryption is locked');
  final out = Map<String, dynamic>.from(row);
  for (final field in fields) {
    final value = out[field];
    if (isSealed(value)) out[field] = await open(key, value as String);
  }
  for (final field in numbers) {
    final value = out[field];
    if (!isSealed(value)) continue;
    final plain = num.tryParse(await open(key, value as String));
    if (plain == null) throw StateError('invalid sealed number in $table.$field');
    out[field] = plain;
  }
  return out;
}

/// True when a row still carries plaintext in a sealed column — a row written
/// before encryption was switched on. The pull uses this to re-push it sealed.
bool needsSealing(String table, Map<String, dynamic> row) {
  for (final field in sealedFields[table] ?? const <String>[]) {
    final value = row[field];
    if (value is String && value.isNotEmpty && !isSealed(value)) return true;
  }
  for (final field in sealedNumbers[table] ?? const <String>[]) {
    if (row[field] is num) return true;
  }
  return false;
}
