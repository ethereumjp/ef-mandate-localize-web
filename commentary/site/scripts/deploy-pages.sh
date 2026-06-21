#!/usr/bin/env bash
# Publish the built site to a GitHub Pages "Deploy from a branch" target.
#
# Builds commentary/site, then force-pushes the static output (dist/) as a
# single-commit, output-only branch (default: gh-pages) on a remote (default:
# fork). No GitHub Actions workflow and nothing outside commentary/ is involved —
# the publish branch holds build output only and never merges into your work.
#
# One-time GitHub setup: repo Settings → Pages → Build and deployment →
#   Source: "Deploy from a branch" → Branch: gh-pages / (root).
#
# Real (on-chain) comments need the schema UID at build time. Put it in
# commentary/site/.env (gitignored) as PUBLIC_EAS_ANNO_SCHEMA_UID=0x… or export
# it before running. Astro bakes PUBLIC_* into the static build.
#
# Usage:   pnpm --filter @commentary/site deploy:pages
# Config:  PAGES_REMOTE (default: fork)   PAGES_BRANCH (default: gh-pages)
set -euo pipefail

SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${PAGES_REMOTE:-fork}"
BRANCH="${PAGES_BRANCH:-gh-pages}"
DIST="$SITE_DIR/dist"

REMOTE_URL="$(git -C "$SITE_DIR" remote get-url "$REMOTE")"

echo "▸ Building site…"
(cd "$SITE_DIR" && pnpm build)
touch "$DIST/.nojekyll" # stop GitHub Pages from running Jekyll (it hides _astro/)

echo "▸ Publishing dist/ → $BRANCH on $REMOTE ($REMOTE_URL)…"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R "$DIST"/. "$TMP"/
git -C "$TMP" init -q
git -C "$TMP" checkout -q -b "$BRANCH"
git -C "$TMP" add -A
git -C "$TMP" commit -q -m "deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
# Output-only branch: a single commit, force-pushed each deploy (no history kept).
git -C "$TMP" push -f "$REMOTE_URL" "$BRANCH"

echo "✓ Published. Pages serves it at the project URL once enabled in Settings → Pages."
