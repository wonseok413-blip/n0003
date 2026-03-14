#!/bin/bash
# Noteracker n0003 - Cloudflare Workers 배포 스크립트
export PATH="/c/Program Files/nodejs:/c/Users/amyis/AppData/Roaming/npm:$PATH"
export CLOUDFLARE_API_TOKEN="ezONXUr64gYHuanmdMln4NL7Eda5rybngwEAiBx2"
cd "$(dirname "$0")"
npx wrangler deploy
