#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies (without running postinstall scripts that download Chrome)
npm install

# Build your NestJS app
npm run build

# Set the Puppeteer cache directory to a path Render persists
PUPPETEER_CACHE_DIR=/opt/render/.cache/puppeteer
mkdir -p $PUPPETEER_CACHE_DIR

# Install Chrome into that directory
npx puppeteer browsers install chrome

# Sync cache to/from build cache dir
if [[ ! -d /opt/render/project/src/.cache/puppeteer/chrome ]]; then
  echo "...Storing Puppeteer Cache in Build Cache"
  mkdir -p /opt/render/project/src/.cache/puppeteer
  cp -R $PUPPETEER_CACHE_DIR /opt/render/project/src/.cache/puppeteer/chrome/
else
  echo "...Copying Puppeteer Cache from Build Cache"
  cp -R /opt/render/project/src/.cache/puppeteer/chrome/ $PUPPETEER_CACHE_DIR
fi