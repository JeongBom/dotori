// 웹에서 Alert.alert을 브라우저 표준 alert/confirm으로 매핑
// react-native-web의 Alert는 무동작(no-op)이라, 패치 없이는
// 삭제 확인·에러 팝업이 웹에서 전부 조용히 사라진다.

import { Alert, AlertButton, Platform } from 'react-native';

// RN 타입 환경에는 DOM 타입이 없어서 필요한 부분만 선언
declare const window: {
  alert(message?: string): void;
  confirm(message?: string): boolean;
};

export function setupWebAlert(): void {
  if (Platform.OS !== 'web') return;

  Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const text = message ? `${title}\n\n${message}` : title;

    // 버튼 0~1개: 단순 알림
    if (!buttons || buttons.length <= 1) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }

    // 버튼 2개 이상: 확인(취소 아닌 것) / 취소 로 매핑
    const confirmBtn = buttons.find(b => b.style !== 'cancel');
    const cancelBtn = buttons.find(b => b.style === 'cancel');
    if (window.confirm(text)) {
      confirmBtn?.onPress?.();
    } else {
      cancelBtn?.onPress?.();
    }
  };
}
