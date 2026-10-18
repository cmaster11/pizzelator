#!/usr/bin/env bash
# Publishes web/dist as the only commit on the gh-pages branch of <owner/repo>.
# Runs in the KiCI publish job (.kici/workflows/ci.ts) from the checkout,
# inside the job's write window, which supplies the push credential.
#
# Usage: scripts/publish-pages.sh <owner/repo> <published commit sha>
set -euo pipefail

repo="${1:?usage: publish-pages.sh <owner/repo> <sha>}"
sha="${2:?usage: publish-pages.sh <owner/repo> <sha>}"

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

# Build the commit in the checkout's object store from a scratch index, so the
# checkout's own index and working tree stay untouched.
cd "$root"
GIT_INDEX_FILE="$(mktemp -d)/index"
export GIT_INDEX_FILE
git --work-tree="$site" add -A
tree="$(git write-tree)"
commit="$(
  GIT_AUTHOR_NAME="KiCI" GIT_AUTHOR_EMAIL="noreply@kici.dev" \
    GIT_COMMITTER_NAME="KiCI" GIT_COMMITTER_EMAIL="noreply@kici.dev" \
    git commit-tree "$tree" -m "Publish ${sha}"
)"
git push --force "git@github.com:${repo}.git" "${commit}:refs/heads/gh-pages"
