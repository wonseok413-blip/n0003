#!/bin/bash
# Noteracker n0003 - Cloudflare Workers 배포 스크립트
export PATH="/c/Program Files/nodejs:/c/Users/amyis/AppData/Roaming/npm:$PATH"
export CLOUDFLARE_API_TOKEN="wAk3kDGVK6_RCIwuV8715u2S_XS8V0MBPnhQmIde"
cd "$(dirname "$0")"
npx wrangler deploy
