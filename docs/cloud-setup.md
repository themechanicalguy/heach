# Cloud setup (AWS, dev only)

Step 1 runs one **dev** environment on AWS in Mumbai (`ap-south-1`) with **synthetic data only**.
Staging, production, managed databases and the Hyderabad backup region come later
([ADR 0005](adr/0005-aws-dev-environment.md)). Infrastructure is code in [`infra/`](../infra/),
written for [OpenTofu](https://opentofu.org).

Nothing here is created until you run `tofu apply` yourself.

## What it creates and what it costs

| Resource | Why | Cost |
| --- | --- | --- |
| S3 bucket for OpenTofu state | Versioned, encrypted, TLS-only, private | A few cents a month |
| GitHub OIDC provider and deploy role | CI deploys without stored AWS keys (EN-12) | Free |
| Monthly usage budget (alerts at US$10, 20, 30) and a credit-pool budget (50, 80, 90% of US$100) | Both count usage before credits, so they fire while credits pay | Free (first two budgets) |
| Email reminders 30 and 7 days before the credits expire (EventBridge Scheduler, SNS) | Upgrade to the paid plan before the account closes | Free |
| VPC, one public subnet, no NAT gateway | Avoids NAT's ~US$32/month | Free |
| `t4g.small` ARM instance, 20 GB encrypted disk | Runs Caddy, web, admin, API, PostgreSQL, Redis | ~US$12–13/month |
| Elastic IP | Stable address | ~US$3.60/month |
| 3 ECR repositories, scan on push | Private images, last 10 kept | Free up to 500 MB |
| 2 SSM SecureString parameters | Generated database and Redis passwords | Free |

Roughly **US$16–18 a month**, paid from the new-account credits while they last. AWS changed its
free tier in July 2025: new accounts get credits (about US$100, up to US$200) for 6 months on the
Free plan instead of 12 months of free instances. Check the current terms when signing up.
To stop almost all charges: `tofu destroy` in `infra/envs/dev`. The state bucket stays (cents a month).

## Security in this setup

- Data stays in India (PR-06). Disks, state and images are encrypted at rest (EN-02).
- TLS on every port (EN-01): Caddy's internal CA until a domain exists, so browsers warn.
- No SSH and no open admin ports: access through **Session Manager** (SO-06).
- The admin panel (port 8443) is closed unless you list your IP in `admin_allowed_cidrs` (SE-04).
- PostgreSQL and Redis are not reachable from outside the host.
- Instance metadata v2 only. Least-privilege roles for the host and for GitHub.
- Generated passwords live in SSM Parameter Store and in the OpenTofu state, never in git.

## One-time setup

### 1. AWS account (in the browser)

1. Sign up at https://aws.amazon.com and choose the Free plan.
2. **Turn on MFA for the root user** right away; then stop using the root user.
3. Create an IAM Identity Center user (or an IAM user) for yourself with
   `AdministratorAccess` and MFA. Use only this user from now on.

### 2. Tools on your machine

```sh
brew install opentofu awscli
aws login --region ap-south-1 --profile <your-profile>   # IAM user with MFA, not root
export AWS_PROFILE=<your-profile>
aws sts get-caller-identity
```

Never paste AWS keys into chat, code, `.env.example` or an issue.

### 3. Bootstrap (state bucket)

```sh
cd infra/bootstrap
tofu init
tofu plan -out plan.tfplan
tofu apply plan.tfplan
tofu output state_bucket
```

Keep `infra/bootstrap/terraform.tfstate` safe and out of git (it is git-ignored); it is needed
to change the bootstrap later. The bucket is protected from `tofu destroy`.

### 4. Deploy role, budget and dev environment

```sh
cp infra/backend.hcl.example infra/github-oidc/backend.hcl   # set bucket from step 3
cp infra/backend.hcl.example infra/envs/dev/backend.hcl

cd infra/github-oidc
tofu init -backend-config=backend.hcl
tofu plan -out plan.tfplan -var budget_email=you@example.com
tofu apply plan.tfplan
tofu output github_deploy_role_arn

cd ../envs/dev
tofu init -backend-config=backend.hcl
tofu plan -out plan.tfplan -var 'admin_allowed_cidrs=["<your-ip>/32"]'   # omit to keep admin closed
tofu apply plan.tfplan
tofu output
```

Confirm the budget email AWS sends you. More on each stack and who may apply it:
[`infra/README.md`](../infra/README.md).

### 5. Turn on deploys

In GitHub: **Settings → Secrets and variables → Actions → Variables**, add
`AWS_DEPLOY_ROLE_ARN` = the `github_deploy_role_arn` output from step 4.

From then on, every merge to `main` that passes CI deploys to dev (workflow **Deploy dev**).
You can also run it by hand from the Actions tab.

## Using dev

| What | Where |
| --- | --- |
| Web | `https://<host_ip>` |
| API | `https://<host_ip>:9443/healthz`, `/readyz` |
| Admin | `https://<host_ip>:8443` (only from allow-listed IPs) |
| Shell on the host | `aws ssm start-session --target <instance_id>` |

`/docs` (OpenAPI) is off in this environment because it runs with `NODE_ENV=production`.

## What this does not do yet

- No domain or publicly trusted certificate; no staging; no preview deployments per PR.
- No managed PostgreSQL or Redis, no backups to Hyderabad, no KMS customer keys, no WAF.
  All of these are required before real patient data and are planned for later steps.
