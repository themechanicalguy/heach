# Data model: Transactional domain writes and their audit entries

No stored data is added or changed. No table, column, index, function, Redis key or browser
storage.

## New audit action values

Written by `NotesRepository` through `AuditService.record` into the existing `audit.entry.action`
column (class Internal, Step 2 data table). Code constants; never user input.

| Action                    | When                                                                                 | Entity ID                 |
| ------------------------- | ------------------------------------------------------------------------------------ | ------------------------- |
| `sample_note.read.failed` | The owner's note was found but could not be returned (for example decryption failed) | The note ID (opaque UUID) |
| `sample_note.list.failed` | The owner's list was selected but could not be returned                              | None                      |

Existing values are unchanged: `sample_note.create`, `.read`, `.read.denied`, `.list`,
`access.denied.role`.

## Transaction scope

| Operation          | Statements in one transaction                                   | Outside it                       |
| ------------------ | --------------------------------------------------------------- | -------------------------------- |
| Create note        | `INSERT INTO app.patient_note`, then `SELECT audit.append(...)` | Encryption of the body (before)  |
| Read or list notes | None (no transaction)                                           | Select, decrypt, then append     |
| Add data key       | `UPDATE app.data_key` (retire), `INSERT INTO app.data_key`      | Key wrapping (before, unchanged) |
