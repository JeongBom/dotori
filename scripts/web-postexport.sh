#!/bin/bash
# 웹 export 후 처리 — 홈 화면 아이콘 + PWA 매니페스트 + iOS 시작 이미지 주입
# 사용: npx expo export -p web && bash scripts/web-postexport.sh && npx eas-cli deploy --prod
set -e

# 앱 아이콘에서 홈 화면용 크기 생성 (sips = macOS 내장)
sips -z 180 180 assets/icon.png --out dist/apple-touch-icon.png > /dev/null
sips -z 192 192 assets/icon.png --out dist/icon-192.png > /dev/null
sips -z 512 512 assets/icon.png --out dist/icon-512.png > /dev/null

cp scripts/web-manifest.json dist/manifest.json

# iOS 시작 이미지(apple-touch-startup-image) 생성 + index.html <head> 주입
# 이게 없으면 iOS가 "배경색 + 앱 아이콘" 실행 화면을 자동 생성해서 아이콘이 먼저 보임.
# 스플래시 배경색(#FDF6EC) 단색 이미지를 기기 해상도별로 만들어 바로 스플래시로 이어지게 한다.
python3 - <<EOF
import os, zlib, struct

BG = (253, 246, 236)  # #FDF6EC — SplashScreen 배경색과 동일

def solid_png(w, h, rgb):
    """단색 PNG 바이트 생성 (외부 라이브러리 불필요)"""
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    row = b'\x00' + bytes(rgb) * w
    idat = chunk(b'IDAT', zlib.compress(row * h, 9))
    return sig + ihdr + idat + chunk(b'IEND', b'')

# (논리 가로, 논리 세로, 배율) — iPhone/iPad 주요 기기
DEVICES = [
    (320, 568, 2),   # iPhone SE 1세대
    (375, 667, 2),   # iPhone 6/7/8, SE 2/3
    (414, 736, 3),   # iPhone 8 Plus
    (375, 812, 3),   # iPhone X/XS/11 Pro, 12/13 mini
    (414, 896, 2),   # iPhone XR/11
    (414, 896, 3),   # iPhone XS Max/11 Pro Max
    (390, 844, 3),   # iPhone 12/13/14
    (428, 926, 3),   # iPhone 12/13 Pro Max, 14 Plus
    (393, 852, 3),   # iPhone 14 Pro, 15, 16
    (430, 932, 3),   # iPhone 14 Pro Max, 15 Plus/Pro Max, 16 Plus
    (402, 874, 3),   # iPhone 16 Pro
    (440, 956, 3),   # iPhone 16 Pro Max
    (768, 1024, 2),  # iPad 9.7"
    (810, 1080, 2),  # iPad 10.2"
    (820, 1180, 2),  # iPad Air 10.9"/11"
    (834, 1194, 2),  # iPad Pro 11"
    (834, 1210, 2),  # iPad Pro 11" (M4)
    (744, 1133, 2),  # iPad mini 6
    (1024, 1366, 2), # iPad Pro 12.9"
    (1032, 1376, 2), # iPad Pro 13" (M4)
]

os.makedirs('dist/splash', exist_ok=True)
links = []
made = {}  # 같은 픽셀 크기는 한 번만 생성
for lw, lh, scale in DEVICES:
    for orient in ('portrait', 'landscape'):
        pw, ph = (lw * scale, lh * scale) if orient == 'portrait' else (lh * scale, lw * scale)
        fname = f'{pw}x{ph}.png'
        if fname not in made:
            with open(f'dist/splash/{fname}', 'wb') as f:
                f.write(solid_png(pw, ph, BG))
            made[fname] = True
        links.append(
            f'<link rel="apple-touch-startup-image" media="(device-width: {lw}px) and (device-height: {lh}px) '
            f'and (-webkit-device-pixel-ratio: {scale}) and (orientation: {orient})" href="/splash/{fname}"/>'
        )

html = open('dist/index.html').read()
inject = (
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"/>'
    '<link rel="manifest" href="/manifest.json"/>'
    '<meta name="apple-mobile-web-app-capable" content="yes"/>'
    '<meta name="apple-mobile-web-app-status-bar-style" content="default"/>'
    '<meta name="apple-mobile-web-app-title" content="도토리"/>'
    '<meta name="dotori-build" content="${EXPO_PUBLIC_BUILD_TIME:-unknown}"/>'
    + ''.join(links)
)
if 'apple-touch-icon' not in html:
    html = html.replace('</head>', inject + '</head>')
    open('dist/index.html', 'w').write(html)
    print(f'index.html: 아이콘/버전 메타/시작 이미지 {len(made)}개 주입 완료')
else:
    print('index.html: 이미 주입돼 있음')
EOF
