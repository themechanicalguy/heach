# Infrastructure

OpenTofu (MPL-2.0, Terraform-compatible HCL) for HEACH on AWS. All data and state stay in India
(PR-06): primary region `ap-south-1` (Mumbai); `ap-south-2` (Hyderabad) only for disaster
recovery, if ever needed.

Every `provider "aws"` block sets `region = "ap-south-1"` as a literal. There is no `region`
variable, so a flag, `.tfvars` file or `AWS_REGION` cannot move a stack. Modules take the region
from the provider (`data "aws_region"`), and `naming` fails the plan for any region outside India.
A future DR stack declares its own provider explicitly:
`provider "aws" { alias = "dr"  region = "ap-south-2" }`.
Background: [ADR 0005](../docs/adr/0005-aws-dev-environment.md),
[ADR 0006](../docs/adr/0006-infra-layout-and-state.md). First-time account setup:
[`docs/cloud-setup.md`](../docs/cloud-setup.md).

## Layout

```
bootstrap/       state bucket only; local state; applied once per account by a human
github-oidc/     GitHub Actions deploy role and the monthly budget (account-wide)
modules/
  naming/        names and tags; validates environment and region
  network/       VPC, public subnet, security groups
  registry/      ECR repositories
  kms-keys/      one key per data domain, yearly rotation
  private-bucket/ private, versioned, SSE-KMS bucket (uploads)
  snapshots/     nightly EBS snapshots of tagged instances
  app-host/      EC2 host, its IAM role, Elastic IP
envs/
  dev/           one host (ADR 0005)
  staging/       empty until a later step
  production/    empty until a later step
```

## State

One S3 bucket, `heach-shared-tofu-state-<account-id>`, created by `bootstrap/`: versioned,
AES256-encrypted, private, TLS-only, protected from destroy; replaced versions expire after 90
days. Locking uses S3 lock files (`use_lockfile`), so no DynamoDB table.

| Stack          | State                                                    |
| -------------- | -------------------------------------------------------- |
| `bootstrap/`   | local `terraform.tfstate`, git-ignored; keep a safe copy |
| `github-oidc/` | `shared/github-oidc/terraform.tfstate`                   |
| `envs/<env>/`  | `envs/<env>/terraform.tfstate`                           |

Staging and production move to their own accounts and buckets before real patient data.

## Naming and tags

Names are `heach-<environment>[-<component>]`, for example `heach-dev-host`. Account-wide
resources use `shared`. ECR repositories are `heach/<app>`; SSM parameters live under
`/heach/<environment>/`. Every resource carries these tags through `default_tags`:

| Tag           | Value                                      |
| ------------- | ------------------------------------------ |
| `Project`     | `heach`                                    |
| `Environment` | `dev`, `staging`, `production` or `shared` |
| `ManagedBy`   | `opentofu`                                 |
| `Owner`       | `themechanicalguy`                         |

## Versions

OpenTofu `~> 1.13.0`; providers pinned to exact versions in each `versions.tf`. Lock files
(`.terraform.lock.hcl`, checksums for macOS arm64 and Linux amd64) are committed. To upgrade a
provider, change the version everywhere, then in each stack:
`tofu init -upgrade -backend=false && tofu providers lock -platform=darwin_arm64 -platform=linux_amd64`.

## Plan and apply

Order for a new account: `bootstrap` → `github-oidc` → `envs/dev`. Always apply a saved plan, so
what you reviewed is exactly what runs.

```sh
# bootstrap (local state)
cd infra/bootstrap
tofu init
tofu plan -out plan.tfplan
tofu apply plan.tfplan

# any other stack
cd infra/envs/dev                      # or github-oidc, envs/staging, envs/production
cp ../../backend.hcl.example backend.hcl   # set bucket to the bootstrap's state_bucket output
tofu init -backend-config=backend.hcl
tofu plan -out plan.tfplan
tofu apply plan.tfplan
```

Use your own AWS profile, signed in as an IAM or Identity Center user with MFA, never root (`AWS_PROFILE=<your-profile>`); never long-lived keys in files or chat.
CI runs `tofu fmt -check` and `tofu validate` on every stack without AWS access.

## Who may apply

| Stack                        | Who                                                     | How                                              |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| `bootstrap/`, `github-oidc/` | Account owner                                           | By hand, after the change is merged              |
| `envs/dev`                   | Any maintainer; GitHub Actions deploys app images only  | From a branch is allowed for dev                 |
| `envs/staging`               | Maintainer, after a second person reviews the plan      | Only from `main`, after the PR is merged         |
| `envs/production`            | Maintainer, after a second person reviews the plan; MFA | Only from `main`, during an agreed change window |

Paste the plan summary (not the full output if it shows secrets) into the PR for any staging or
production change.

## Recovering state

Every state write is a new S3 object version. To roll back, restore the previous version of
`<key>` in the bucket (console, or `aws s3api list-object-versions` and `copy-object`), then run
`tofu plan` to see the difference. A stale lock after a crash: `tofu force-unlock <id>`, only when
you are sure no one else is applying.
