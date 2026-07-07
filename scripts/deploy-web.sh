#!/bin/bash
# 웹 배포 원커맨드: 빌드 버전 주입 → export → 아이콘/매니페스트 주입 → EAS 배포
# 사용: bash scripts/deploy-web.sh
set -e

export EXPO_PUBLIC_BUILD_TIME="$(date +%m%d-%H%M)"
echo "빌드 버전: $EXPO_PUBLIC_BUILD_TIME"

npx expo export --platform web
bash scripts/web-postexport.sh
npx eas-cli deploy --prod --non-interactive
