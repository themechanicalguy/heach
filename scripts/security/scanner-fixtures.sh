#!/bin/bash
# SO-03.1: proves each scanner fails the build on a high finding. Fixtures are made at run time
# in a temp folder, so nothing vulnerable or secret-looking is ever committed.
# Usage: scanner-fixtures.sh <semgrep-image> <trivy-image> <gitleaks-image>
set -euo pipefail
SEMGREP="$1" TRIVY="$2" GITLEAKS="$3"
dir=$(mktemp -d)
expect_fail() { # <name> <command...>: the scanner must exit non-zero
  local name="$1"; shift
  if "$@" >"$dir/$name.log" 2>&1; then
    echo "::error::$name did not block its fixture"; tail -20 "$dir/$name.log"; exit 1
  fi
  echo "$name blocks its fixture"
}

# Static analysis: SQL built by interpolation and an XSS sink.
mkdir -p "$dir/sast"
cat > "$dir/sast/bad.tsx" <<'TS'
export async function find(db: { query: (q: string) => Promise<unknown> }, id: string) {
  return db.query(`SELECT * FROM app.note WHERE id = '${id}'`);
}
export const Bad = ({ html }: { html: string }) => <div dangerouslySetInnerHTML={{ __html: html }} />;
TS
cp security/semgrep/heach.yml "$dir/sast/"
expect_fail semgrep docker run --rm -v "$dir/sast:/src" -w /src "$SEMGREP" \
  semgrep scan --metrics=off --config heach.yml --severity ERROR --error --quiet bad.tsx

# Dependency scan: a version with a published high advisory.
mkdir -p "$dir/deps"
echo '{"name":"fixture","version":"0.0.0","private":true,"dependencies":{"lodash":"4.17.15"}}' > "$dir/deps/package.json"
(cd "$dir/deps" && pnpm install --lockfile-only --ignore-workspace >/dev/null 2>&1)
expect_fail pnpm-audit pnpm --dir "$dir/deps" audit --prod --audit-level high --ignore-workspace

# Container scan: an end-of-life base image with known high CVEs.
expect_fail trivy docker run --rm "$TRIVY" image --quiet --severity HIGH,CRITICAL --ignore-unfixed \
  --exit-code 1 node:14.0.0-alpine3.11

# Secret scan: a credential-shaped string built here, never stored in the repository.
mkdir -p "$dir/secret"
# Random each run: matches gitleaks' GitHub token rule but is no one's credential.
token="ghp_$(openssl rand -hex 18)"
(cd "$dir/secret" && git init -q && echo "GITHUB_TOKEN=$token" > creds.env \
  && git add . && git -c user.email=ci@example.invalid -c user.name=ci commit -qm fixture)
expect_fail gitleaks docker run --rm -v "$dir/secret:/repo:ro" --entrypoint sh "$GITLEAKS" \
  -c 'git config --global --add safe.directory /repo && gitleaks git --redact --no-banner --exit-code 1 /repo'
