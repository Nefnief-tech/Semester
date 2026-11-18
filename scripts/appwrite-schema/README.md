# Appwrite schema export — database `semester`

One JSON file per collection/table, strictly in this format:

```json
{
  "name": "Notes", "id": "notes",
  "attributes": [
    { "key": "title", "type": "string", "required": true, "size": 200 },
    { "key": "views", "type": "integer", "default": 0 },
    { "key": "status", "type": "enum", "elements": ["draft", "published"] }
  ],
  "documents": []
}
```

Endpoint `https://ow.nief.dev/v1` · project `lnffdpvylaNuLhMhmNUH` · database `semester`.
Sources: `scripts/appwrite-setup.mjs`, `scripts/appwrite-structured-schema.mjs`, `scripts/appwrite-migrate-documents-to-rows.mjs`.

## Files

- Structured tables (TablesDB): `subjects`, `todos`, `homeworks`, `grades`, `events`, `timetable_entries`, `chat_messages`, `decks`, `flashcards`, `study_selection`, `portal_entries`, `portal_courses`
- Legacy collections (Databases API): `snapshots`, `chats`, `decks-legacy.json` — the legacy deck collection's real id is also `decks`; only the filename is suffixed. Skip these three on import unless restoring the pre-migration API surface.

## Not expressible in the format (recreate on import)

The export files intentionally carry only `name`, `id`, `attributes`, `documents`. Everything else the live backend has must be recreated by the import tooling:

- **Indexes:** every structured table has `userId_idx` (key type, on `userId`); `snapshots` has `user_key` (key type, on `userId` + `key`).
- **Permissions/security:** structured tables: `permissions: ["create(\"users\")"]`, row security on. `snapshots`: users-level permissions with document security on. Legacy `chats`/`decks`: document security on.
- **Sealed column sizes:** string attributes that the client encrypts (`subjects.name`, todo/homework/event text, chat content, flashcard faces, portal entries, …) are sized for `enc:v1:` base64 ciphertext — worst case ≈4/3×(4×chars+28)+7 characters, because UTF-8 text (umlauts, emoji) is up to 4 bytes per character. Keep them at least that large when recreating a table; `scripts/appwrite-structured-schema.mjs` widens older tables.
- **Integer/float ranges:** `timetable_entries.period` 0–200 and all timestamps (`createdAt`, `updatedAt`, `sentAt`) 0–9,000,000,000,000. `grades.points`/`grades.weight` are strings because they hold sealed ciphertext; recreate them as strings, not numbers.
- **Enum types:** none of the attributes are Appwrite enums — constrained strings like `priority`, `type`, `role`, `day` are plain `string` attributes in the backend.

## Documents

`documents` is empty in every file: documents are user data and need a live export with a server API key (`APPWRITE_PROJECT_ID` + `APPWRITE_API_KEY`). Rows carry per-user permissions of the shape `["read(\"user:<userId>\")", "write(\"user:<userId>\")"]`. Storage bucket `study-files` also needs manual recreation on import.

Legacy `chats`/`decks` sizes are inferred placeholders (not defined in the repo), and `snapshots.data` may have fallen back below 1,000,000 (setup script tries 1,000,000 → 400,000 → 100,000 → 16,000) — verify in the console before re-importing those.
