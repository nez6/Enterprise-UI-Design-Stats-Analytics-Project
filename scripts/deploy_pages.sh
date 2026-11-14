#!/usr/bin/env bash
# Publish both sites to GitHub Pages from your machine, no repository settings needed:
#   https://<user>.github.io/<repo>/            SNOW Stats Lab
#   https://<user>.github.io/<repo>/streamlit/  Streamlit lab (runs in the browser via stlite)
# It builds site/ and force-pushes the result to the gh-pages branch. GitHub serves that
# branch automatically. To connect the shared Supabase database, export VITE_SUPABASE_URL and
# VITE_SUPABASE_ANON_KEY before running; without them the site runs in demo mode.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/site"
npm ci --no-audit --no-fund
npm test
npm run build
touch dist/.nojekyll
TMP="$(mktemp -d)"
cp -R dist/. "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$ROOT" config user.name)" -c user.email="$(git -C "$ROOT" config user.email || echo deploy@localhost)" \
  commit -q -m "Deploy sites from $(git -C "$ROOT" rev-parse --short HEAD)"
git push -q -f "$(git -C "$ROOT" remote get-url origin)" gh-pages
echo "Pushed to gh-pages. Live in a few minutes at the repository's github.io address."
