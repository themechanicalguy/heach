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

```sh
scripts/dev-sleep   # stop the host; prints what still costs (about $10 a month)
scripts/dev-wake    # start it; waits until the smoke test passes
```

Deploys fail while dev sleeps. More in the [credit expiry plan](credit-expiry-plan.md).

## Admin panel

The admin panel has no public port (SE-04). Tunnel to it through Session Manager (needs
`brew install --cask session-manager-plugin` once):

```sh
aws ssm start-session --profile saurav-heach-admin --region ap-south-1 --target <instance-id> \
  --document-name AWS-StartPortForwardingSession --parameters portNumber=8443,localPortNumber=8443
# then open https://localhost:8443
```

## Branch protection on main

GitHub refuses branch protection on a private repository on the Free plan (HTTP 403, checked
17 October 2026; [ADR 0004](adr/0004-github-free-no-branch-protection.md)). Until the account
moves to GitHub Pro or the repository becomes public, `main` is protected by process: pull
requests only, merged when every CI job passes, and the local pre-push hook. Once available, run
(after `gh auth refresh -s admin:repo_hook` if asked):

```sh
gh api -X PUT repos/themechanicalguy/heach/branches/main/protection \
  -H "Accept: application/vnd.github+json" --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Checks", "E2E smoke", "API image", "Deploy bundle", "Infra (fmt, validate)",
                 "Secret scan", "Implementation status updated"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1, "dismiss_stale_reviews": true },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
gh api -X POST repos/themechanicalguy/heach/branches/main/protection/required_signatures
```

`enforce_admins` is false so a sole maintainer can still merge; set it to true when a second
reviewer joins. Signed commits require every contributor to sign (`git config commit.gpgsign true`
with an SSH or GPG key registered on GitHub).
