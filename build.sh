#!/bin/sh
# Beatsqare — static frontend (public/) + API Worker (src/worker.js) on Cloudflare's free plan.
#   ./build.sh dev       local dev server at http://localhost:8790 (local D1 + KV)
#   ./build.sh deploy    apply D1 migrations and publish to https://beatsqare.rennko.tech
#   ./build.sh check     syntax-check every JS file
set -e
cd "$(dirname "$0")"
W="npx -y wrangler@4"
check() { for f in src/*.js public/js/*.js; do node --check "$f" || exit 1; done; echo "JS OK"; }
case "$1" in
  dev)
    check
    $W d1 migrations apply beatsqare --local
    $W dev --port 8790 ;;
  deploy)
    check
    $W d1 migrations apply beatsqare --remote
    $W deploy ;;
  check) check ;;
  *) echo "usage: ./build.sh dev | deploy | check"; exit 1 ;;
esac
