// 웹앱 자동 업데이트 감지 (웹 전용)
// 홈 화면 웹앱은 첫 화면을 캐시해서 배포 후에도 구버전을 보여줄 수 있다.
// 실행 시 + 포그라운드 복귀 시 서버의 최신 버전과 비교해서, 다르면
// 캐시를 우회하는 주소(쿼리 버스팅)로 새로고침을 안내한다.

import { Alert, Platform } from 'react-native';

declare const window: {
  location: { replace(url: string): void };
};
declare const document: {
  querySelector(selector: string): { getAttribute(name: string): string | null } | null;
  addEventListener(type: string, listener: () => void): void;
  visibilityState: string;
};

// 같은 버전으로 두 번 묻지 않기 (한 세션 내 무한 팝업 방지)
let promptedBuild: string | null = null;

// 지금 실행 중인 페이지의 빌드 버전 — 번들에 굽지 않고 DOM 메타태그에서 읽는다
// (번들에 구우면 Metro 캐시 때문에 옛 값이 남아 무한 업데이트 루프가 생김)
export function getCurrentBuild(): string | null {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  return document.querySelector('meta[name="dotori-build"]')?.getAttribute('content') ?? null;
}

export async function checkForWebUpdate(): Promise<void> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  // current가 null/unknown이면 버전 태그가 없던 구버전 페이지 —
  // 그래도 서버에 정상 버전이 있으면 갱신을 안내해서 캐시에서 빠져나오게 한다
  const current = getCurrentBuild();
  try {
    // 쿼리로 캐시 우회해서 서버의 최신 첫 화면을 읽고, 심어둔 버전 메타를 비교
    const res = await fetch(`/?vchk=${Date.now()}`);
    if (!res.ok) return;
    const html = await res.text();
    const build = html.match(/dotori-build" content="([^"]+)"/)?.[1];
    if (!build || build === 'unknown') return;
    if (build === current || build === promptedBuild) return;
    promptedBuild = build;

    Alert.alert('업데이트', `새 버전(${build})이 있어요.\n지금 적용할까요?`, [
      { text: '나중에', style: 'cancel' },
      // 쿼리가 붙은 주소는 캐시 키가 달라져서 무조건 새 첫 화면을 받아온다
      { text: '지금 적용', onPress: () => window.location.replace(`/?v=${encodeURIComponent(build)}`) },
    ]);
  } catch {
    // 오프라인 등 — 조용히 무시
  }
}

// 시작 시 1회 + 웹앱이 포그라운드로 돌아올 때마다 재확인
// (홈 화면 웹앱은 다시 열어도 재시작이 아니라서 시작 시 체크만으론 놓친다)
export function watchForWebUpdate(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  checkForWebUpdate();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForWebUpdate();
  });
}
