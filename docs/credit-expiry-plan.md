# Credit expiry plan

The AWS account (667291759252, Mumbai) runs on the **Free plan** until it ends, then upgrades to
the Paid plan (decision of 17 October 2026, playbook section 6). The plan ends at the first of:
the credits run out, or **17 April 2027**. Then the account closes; you have 90 days to reopen it
by upgrading, and resources may be lost. Upgrade no later than the **Act** level.

## Where to look

| What | Where |
| --- | --- |
| Credits left, plan end date | Billing and Cost Management → **Credits** (and Free Tier) |
| Same, from the terminal | `AWS_PROFILE=saurav-heach-admin scripts/credit-status` |
| Our alert history | GitHub issues labelled `credit-alert` |
| Daily check | Actions → **Credit watch** (09:00 IST) |
| Budgets (usage before credits) | Billing → Budgets: `heach-monthly`, `heach-free-credits` |

`docs/credit-baseline.json` holds the sign-up date, the credits granted so far and the plan end
date. Update `creditsGranted` there (and `credit_pool_usd` in `infra/github-oidc`) when AWS grants
more credits.

## Alert levels

A level is reached when either trigger is met.

| Level | Trigger | What you do |
| --- | --- | --- |
| Watch | 50% of credits left, or 60 days left | Review spend with `scripts/credit-status`; put the upgrade date in your calendar |
| Plan | 25% left, or 30 days left | Confirm the payment card works for international recurring payments; take the backup below; check the B6 budgets plan (`infra/paid-plan-budgets`) |
| Act | 10% left, or 15 days left | Upgrade now (playbook part B6). The latest safe moment |
| Emergency | 5% left, or 7 days left | Upgrade today; run `scripts/dev-sleep` |

Also raised: a **burn-rate warning** (at the current daily usage, credits run out before the plan
ends), a **plan status** other than `ACTIVE`, and a **failed check**.

## Who tells you

| Source | When |
| --- | --- |
| AWS (email to the account contact) | 50, 25 and 10% of credits left; 15, 7 and 2 days left; after the plan ends |
| Credit watch (GitHub issue and email via SNS) | When our level rises, the plan is not ACTIVE, or the check fails |
| `heach-free-credits` budget (email) | Usage before credits passes 50, 80, 90% of the pool, or is forecast to pass 100% |
| Expiry reminders (email via SNS) | 18 March and 10 April 2027, 09:00 IST |
| Your calendar (set by hand) | 60, 30, 15 and 7 days before 17 April 2027: "check scripts/credit-status" |

To test the alerts: Actions → Credit watch → Run workflow, with `simulate` set to, for example,
`remaining=55,daysLeft=50` (Watch), `remaining=25,daysLeft=50` (Plan), `remaining=10,daysLeft=50`
(Act), `remaining=5,daysLeft=50` (Emergency). Simulated alerts use their own issue, titled
"Credit alert (simulated)".

## Sleep and wake dev

```sh
export AWS_PROFILE=saurav-heach-admin
scripts/dev-sleep   # stops the host; prints what keeps costing (IP, disk, KMS keys, snapshots)
scripts/dev-wake    # starts it and waits until /healthz and /api/readyz answer
```

Asleep, dev still costs about $10 a month (Elastic IP $3.65, disk $1.82, KMS keys $4,
snapshots); compute (about $8.18) stops. Deploys fail while it sleeps.

## Encrypted backup outside the account

Take one at the **Plan** level and before the upgrade. The copy must leave AWS: if the account
closes, snapshots and buckets inside it go with it.

```sh
export AWS_PROFILE=saurav-heach-admin
ID=$(aws ec2 describe-instances --region ap-south-1 --filters Name=tag:Environment,Values=dev \
  Name=instance-state-name,Values=running --query 'Reservations[0].Instances[0].InstanceId' --output text)

# 1. Database dump, encrypted on the host with a passphrase you keep in your password manager,
#    then copied to your Mac through the uploads bucket (deleted from it afterwards).
#    Run on the host (Session Manager: aws ssm start-session --target $ID):
#      cd /opt/heach && docker compose exec -T postgres pg_dumpall -U heach \
#        | gzip | openssl enc -aes-256-cbc -pbkdf2 -salt -out /tmp/db.sql.gz.enc
#      aws s3 cp /tmp/db.sql.gz.enc s3://heach-dev-uploads-667291759252/backup/ && rm /tmp/db.sql.gz.enc
aws s3 cp s3://heach-dev-uploads-667291759252/backup/db.sql.gz.enc ~/heach-backup/
aws s3 rm s3://heach-dev-uploads-667291759252/backup/db.sql.gz.enc

# 2. Uploads (decrypted by S3 on download), then encrypted locally.
aws s3 sync s3://heach-dev-uploads-667291759252 ~/heach-backup/uploads --exclude 'backup/*'
tar -czf - -C ~/heach-backup uploads | openssl enc -aes-256-cbc -pbkdf2 -salt -out ~/heach-backup/uploads.tar.gz.enc
rm -rf ~/heach-backup/uploads
```

Keep `~/heach-backup` on an encrypted disk or encrypted cloud storage outside AWS. Dev holds
synthetic data only (SO-07); this is practice for the pilot. Restore: decrypt with
`openssl enc -d -aes-256-cbc -pbkdf2`, then `psql -U heach < db.sql` inside the postgres container
and `aws s3 sync` the uploads back.

## If the window was missed

If the plan ended before the upgrade: the account is closed and resources may be shut down.
Upgrade within **90 days** from the Billing console to reopen it, then run `scripts/credit-status`,
`scripts/dev-wake`, and apply `infra/paid-plan-budgets` the same day. After 90 days the account
and its data are gone; restore from the backup above into a new account.
