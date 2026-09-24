#!/bin/sh
# Run every check in docs/measurement.md inside Linux containers.
#
#   sh devtools/linux-run.sh > media/captures/linux-run.txt
#
# The repository is mounted read-only and copied. One python:3.12 container
# runs the measurement script and serves the entrypoints; one Playwright
# container drives the Time Tracker in headless Chromium.

set -eu

REPO=$(cd "$(dirname "$0")/.." && pwd)
PY=python:3.12-slim-bookworm
PW=mcr.microsoft.com/playwright:v1.55.0-noble

docker pull -q "$PY" >/dev/null
docker pull -q "$PW" >/dev/null

docker run --rm -v "$REPO":/repo:ro "$PY" sh -c '
set -u
section() { printf "\n=== %s\n" "$*"; }
apt-get -qq update >/dev/null 2>&1 && apt-get -qq install -y git curl >/dev/null 2>&1
cp -r /repo /tmp/pt && cd /tmp/pt
git config --global --add safe.directory /tmp/pt

section "environment"
uname -srm
python3 --version

section "devtools/measure_docs.py"
python3 devtools/measure_docs.py

section "quick start: python3 -m http.server, every entrypoint"
python3 -m http.server 8765 >/dev/null 2>&1 &
sleep 1
for p in index.html $(ls -d tools/*/ | sed "s|$|index.html|"); do
    printf "%-40s %s\n" "$p" "$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8765/$p)"
done
'

docker run --rm --ipc=host -v "$REPO":/repo:ro "$PW" sh -c '
set -u
section() { printf "\n=== %s\n" "$*"; }
cp -r /repo /tmp/pt && cd /tmp/pt
npm install -s --no-save --no-audit --no-fund playwright@1.55.0 >/dev/null 2>&1

section "devtools/timer-check.mjs (headless Chromium, fake clock)"
node devtools/timer-check.mjs
'
