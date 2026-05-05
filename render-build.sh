#!/usr/bin/env bash
set -o errexit

npm install
npm run build

PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR

# Always install Chrome fresh into the persistent cache path
npx puppeteer browsers install chrome