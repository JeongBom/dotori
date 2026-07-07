#!/bin/bash
# 웹 export 후 처리 — 홈 화면 아이콘 + PWA 매니페스트 주입
# 사용: npx expo export -p web && bash scripts/web-postexport.sh && npx eas-cli deploy --prod
set -e

# 앱 아이콘에서 홈 화면용 크기 생성 (sips = macOS 내장)
sips -z 180 180 assets/icon.png --out dist/apple-touch-icon.png > /dev/null
sips -z 192 192 assets/icon.png --out dist/icon-192.png > /dev/null
sips -z 512 512 assets/icon.png --out dist/icon-512.png > /dev/null

cp scripts/web-manifest.json dist/manifest.json

# index.html <head>에 아이콘/매니페스트 링크 + 빌드 버전 메타 주입
python3 - <<EOF
html = open('dist/index.html').read()
inject = (
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>'
    '<link rel="manifest" href="/manifest.json"/>'
    '<meta name="apple-mobile-web-app-capable" content="yes"/>'
    '<meta name="apple-mobile-web-app-status-bar-style" content="default"/>'
    '<meta name="apple-mobile-web-app-title" content="도토리"/>'
    '<meta name="dotori-build" content="${EXPO_PUBLIC_BUILD_TIME:-unknown}"/>'
)
if 'apple-touch-icon' not in html:
    html = html.replace('</head>', inject + '</head>')
    open('dist/index.html', 'w').write(html)
    print('index.html: 아이콘/버전 메타 주입 완료')
else:
    print('index.html: 이미 주입돼 있음')
EOF
