# 0012. Decide how backups are recovered without the AWS account

- **Status:** Proposed (owner decision needed; nothing here is built)
- **Date:** 2026-10-24
- **Requirements:** EN-04, EN-06, EN-10, SO-10; Step 2 spec decision D1; [ADR 0010](0010-step-2-backups-secrets-waf.md)

## Context

ADR 0010 keeps backups in one Region plus a weekly encrypted copy on the owner's computer, so that
losing the AWS account does not lose the data. Checked on 24 October 2026:

- The copy itself works without AWS: `pg/2026-10-24T1609Z.dump`, pulled by `scripts/backup-pull.sh`,
  decrypts with the Keychain passphrase alone and is byte-identical to the S3 object (SHA-256
  prefix `9813ed2e5d478b57` on both). The schema, audit chain and every Internal or Confidential
  column restore from it.
- **Restricted fields do not.** Each value is encrypted with a data key, and each data key is
  stored in `app.data_key.wrapped_key` wrapped by one of the dev KMS keys (`alias/heach-dev-<domain>`,
  origin AWS_KMS, not exportable). Without the account those keys are gone, and so is every
  Restricted value in every copy, on or off the account.
- The weekly pull depends on the owner remembering it. It ran on 18 October and again on
  24 October (by Claude Code on the owner's computer); nothing reminds anyone or checks it.
- The off-account copy is only as recoverable as its passphrase. The passphrase exists only in the
  login Keychain (item `heach-backup-passphrase`, created 18 October). Whether it is also in a
  password manager has not been confirmed.

Today every row is synthetic, so nothing real can be lost yet. The question has to be settled
before the first real record (pilot gate, ADR 0009).

## Decision

Proposed; the owner chooses. Recommended:

1. **Restricted fields (R1):** accept the gap for dev while all data is synthetic, and before the
   pilot add an offline escrow wrap (option B below) through its own feature spec. Record the
   choice here; if the owner prefers to accept the risk at the pilot as well, say so explicitly.
2. **Weekly copy (R2):** keep the pull manual on the owner's computer (it needs an MFA-backed
   `aws login` session, so it cannot run unattended without long-lived keys, which we refuse) and
   add a recurring weekly calendar reminder. The owner records each pull date in the backup
   runbook's record table.
3. **Passphrase (R3):** the owner copies the Keychain item into their password manager and proves
   it with a test decryption that reads the passphrase from the password manager, not the
   Keychain (procedure below). Then records the date of the test.

## Options considered

### R1: Restricted fields without the AWS account

| Option | For | Against |
| --- | --- | --- |
| A. Accept the gap | No work; correct while data is synthetic | Before real data it means a lost account is lost health records; EN-10's purpose fails for the very data that matters |
| B. Offline escrow wrap (recommended before the pilot) | Each data key is also wrapped with an RSA-OAEP (SHA-256) public key whose private key the owner keeps offline (password manager plus a paper copy). Recovery: unwrap the data keys with the private key, then decrypt fields as today. `node:crypto` only, no new dependency, no AWS cost. Data keys only, not every value, so the escrow covers all copies | A new secret the owner must keep safe for years; the escrow private key can read everything, so its custody needs a written procedure and a recovery drill (SO-10). Needs a spec, a migration (`escrow_wrapped_key` column, Confidential) and tests |
| C. KMS keys with imported key material | Owner holds the key material | Does not help: a KMS ciphertext can be decrypted only by the same KMS key in AWS; the material cannot decrypt it outside AWS. Imported keys also lose automatic yearly rotation (EN-05.2) |
| D. A second AWS project holding a copy key | Survives losing one project | Not available offline; depends on AWS again; cross-project grants are subject to the managed SCPs and cost $1 a month a key; contradicts the one-project, lean design (ADR 0008) |

### R2: Weekly off-account copy

| Option | For | Against |
| --- | --- | --- |
| Manual pull plus a weekly calendar reminder (recommended) | No new credentials or code; uses the existing MFA session | Still depends on the owner; a missed week is found only by reading the record |
| `launchd` job on the owner's computer | Runs by itself | Fails whenever the `aws login` session has expired (most weeks), unless long-lived access keys are stored on the laptop, which EN-12 and the account rules forbid |
| Scheduled GitHub workflow that opens a reminder issue | Visible, auditable | New workflow code; cannot see whether the pull happened |

### R3: Passphrase recovery

Test procedure, on the owner's computer, with the passphrase typed from the password manager (never
the Keychain):

```sh
cd ~/HEACH-backups
shasum -a 256 -c <name>.dump.enc.sha256
read -rs HEACH_BACKUP_PASS; export HEACH_BACKUP_PASS     # paste from the password manager
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:HEACH_BACKUP_PASS -in <name>.dump.enc | pg_restore --list | head -3
unset HEACH_BACKUP_PASS
```

A table of contents means the passphrase in the password manager is the right one.

## Consequences

- Until R1 is decided, the status page keeps EN-10 Partial with "Restricted fields not recoverable
  without the AWS account" as a stated gap, and the pilot cannot start.
- Option B, if chosen, becomes a feature spec (EN-10, EN-04) before the pilot, with an SO-10
  recovery drill: restore an off-account copy on a machine with no AWS credentials and decrypt a
  synthetic note with the escrow key.
- R2 and R3 are owner actions with no code. Revisit R2 if a second operator joins, or when a
  managed backup service is adopted at the pilot (ADR 0010).
