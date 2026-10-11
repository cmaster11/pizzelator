#!/usr/bin/env bash
# Publishes web/dist as the only commit on the gh-pages branch. Runs in CI
# (.github/workflows/pages.yml) with GH_TOKEN, GITHUB_REPOSITORY and
# GITHUB_SHA set by GitHub Actions.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dist="$root/web/dist"
[[ -f "$dist/index.html" ]] || {
  echo "no build in $dist; run mise run build first" >&2
  exit 1
}

site="$(mktemp -d)"
cp -R "$dist/." "$site/"
# Serve files as built: no Jekyll processing.
touch "$site/.nojekyll"

cd "$site"
git init -q -b gh-pages
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -A
git commit -q -m "Publish ${GITHUB_SHA}"
auth="$(printf 'x-access-token:%s' "$GH_TOKEN" | base64 -w0)"
git -c "http.extraheader=AUTHORIZATION: basic $auth" \
  push --force "https://github.com/${GITHUB_REPOSITORY}.git" gh-pages
