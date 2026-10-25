# Environments

Dev only, on AWS free credits ([ADR 0008](adr/0008-lean-single-host-on-credits.md),
[ADR 0009](adr/0009-aws-credits-and-restricted-pilot.md)). No staging and no preview deployments;
production is replaced by a restricted pilot later (playbook Track P).

| Environment | Where | Data | URL |
| --- | --- | --- | --- |
| Local | Docker Compose on your machine (`pnpm dev:up`) | Synthetic | `http://localhost:3000` (web), `:5173` (admin), `:3001` (API) |
| Dev | One `t4g.small` in Mumbai, account 667291759252 | Synthetic only (SO-07) | `https://15.252.65.98` (web), `/api/…` (API); admin through Session Manager |

## How a deploy works

A merge to `main` runs **CI**; when it passes, **Deploy dev** builds the three ARM images (tag =
12-character commit SHA), blocks on HIGH or CRITICAL ECR scan findings, deploys through SSM Run
Command (no SSH), smoke-tests `/healthz`, `/api/healthz` and `/api/readyz`, and redeploys the
previous tag if the deploy or smoke test fails. Details and the settings made by hand:
[cloud setup](cloud-setup.md#5-turn-on-deploys). Run it by hand: Actions → Deploy dev → Run
workflow (from `main` only; the AWS role trusts nothing else).

## Rolling back

Automatic: a failed deploy or smoke test redeploys the previous tag. By hand, to any tag still in
ECR (the 5 newest per repository):

```sh
export AWS_PROFILE=saurav-heach-admin AWS_REGION=ap-south-1
aws ecr describe-images --repository-name heach/api \
  --query 'sort_by(imageDetails,&imagePushedAt)[].imageTags[0]' --output text   # pick a tag
ID=$(aws ec2 describe-instances --filters Name=tag:Environment,Values=dev \
  Name=instance-state-name,Values=running --query 'Reservations[0].Instances[0].InstanceId' --output text)
scripts/ssm-run.sh "$ID" "manual rollback" \
  "$(scripts/deploy-params.sh 667291759252.dkr.ecr.ap-south-1.amazonaws.com <tag>)"
scripts/smoke-test.sh 15.252.65.98
```

A bad change on `main` should also be reverted in git, or the next merge deploys it again.

## Sleep and wake dev

`scripts/dev-sleep` and `scripts/dev-wake`; deploys fail while dev sleeps. What still costs while
asleep: [credit expiry plan](credit-expiry-plan.md#sleep-and-wake-dev).

## Admin panel

The admin panel has no public port (SE-04). Tunnel to it through Session Manager (needs
`brew install --cask session-manager-plugin` once):

```sh
aws ssm start-session --profile saurav-heach-admin --region ap-south-1 --target <instance-id> \
  --document-name AWS-StartPortForwardingSession --parameters portNumber=8443,localPortNumber=8443
# then open https://localhost:8443
```

Test sign-in as a synthetic user works only through the loopback entry on port 9443; the public
address answers it with 404 (SE-07.23, [spec 007](../specs/007-security-review-fixes/spec.md)):

```sh
aws ssm start-session --profile saurav-heach-admin --region ap-south-1 --target <instance-id> \
  --document-name AWS-StartPortForwardingSession --parameters portNumber=9443,localPortNumber=9443
# then open https://localhost:9443 (web and API; Caddy adds the test sign-in key)
```

## Branch protection on main

**Proposed, not applied (owner decision).** On 17 October 2026 GitHub refused branch protection on
the private Free repository (HTTP 403, [ADR 0004](adr/0004-github-free-no-branch-protection.md)).
The repository is now public, and on 22 October the API answered `Branch not protected`
(HTTP 404), so protection is available at no cost. Until the owner applies it, `main` is
protected by process: pull requests only, merged when every CI job passes, and the local
pre-push hook.

Proposed settings for a sole maintainer:

| Setting | Value | Why |
| --- | --- | --- |
| Required status checks | All nine PR checks, `strict` (branch up to date) | Constitution VII: merge only when every CI job passes. A job skipped by its label (`no-status-change`) counts as passed |
| Include administrators (`enforce_admins`) | `true` | Otherwise the only account can merge past a red check; to bypass in an emergency, the owner turns protection off and back on, which is visible |
| Pull request before merging | Required, 0 approvals | Stops direct pushes to `main`; one approval cannot be given by a sole maintainer on their own PR. Raise to 1 when a second reviewer joins |
| Conversation resolution | Required | Review comments are answered before merge |
| Linear history | Required | Matches the squash merges used so far |
| Force pushes, deletions | Blocked | |
| Signed commits | Required | Squash merges made on GitHub are signed by GitHub (the last 20 on `main` are verified); local commits on branches need no change |

Run (after `gh auth refresh -s admin:repo_hook` if asked):

```sh
gh api -X PUT repos/themechanicalguy/heach/branches/main/protection \
  -H "Accept: application/vnd.github+json" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Checks", "E2E smoke", "API image", "Deploy bundle", "Infra (fmt, validate)",
                 "Secret scan", "Static analysis and scanner fixtures",
                 "Implementation status updated", "Spec linked"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "dismiss_stale_reviews": true },
  "required_conversation_resolution": true,
  "required_linear_history": true,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
gh api -X POST repos/themechanicalguy/heach/branches/main/protection/required_signatures
gh api repos/themechanicalguy/heach/branches/main/protection --jq '.required_status_checks.contexts'
```

Applying it should go with an ADR that supersedes ADR 0004 (the repository is no longer private).
