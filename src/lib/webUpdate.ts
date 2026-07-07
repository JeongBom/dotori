// 웹앱 자동 업데이트 감지 (웹 전용)
// 홈 화면 웹앱은 첫 화면을 캐시해서 배포 후에도 구버전을 보여줄 수 있다.
// 실행 시 서버의 version.json과 내장 빌드 버전을 비교해서, 다르면
// 캐시를 우회하는 주소(쿼리 버스팅)로 새로고침을 안내한다.

import { Alert, Platform } from 'react-native';

declare const window: {
  location: { replace(url: string): void };
};

const BUILT_VERSION = process.env.EXPO_PUBLIC_BUILD_TIME ?? '';

export async function checkForWebUpdate(): Promise<void> {
  if (Platform.OS !== 'web' || !BUILT_VERSION) return;
  try {
    // 쿼리로 캐시 우회해서 항상 서버의 최신 버전 파일을 읽음
    const res = await fetch(`/version.json?t=${Date.now()}`);
    if (!res.ok) return;
    const { build } = (await res.json()) as { build?: string };
    if (!build || build === 'unknown' || build === BUILT_VERSION) return;

    Alert.alert('업데이트', `새 버전(${build})이 있어요.\n지금 적용할까요?`, [
      { text: '나중에', style: 'cancel' },
      // 쿼리가 붙은 주소는 캐시 키가 달라져서 무조건 새 첫 화면을 받아온다
      { text: '지금 적용', onPress: () => window.location.replace(`/?v=${encodeURIComponent(build)}`) },
    ]);
  } catch {
    // 오프라인 등 — 조용히 무시
  }
}
