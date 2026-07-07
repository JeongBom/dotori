// 데스크톱 웹 레이아웃 분기 훅
// 1024px 이상 웹 = 데스크톱 레이아웃 (사이드바), 미만 = 모바일 레이아웃 유지
import { Platform, useWindowDimensions } from 'react-native';

export const DESKTOP_BREAKPOINT = 1024;
export const SIDEBAR_WIDTH = 220;

export function useIsDesktopWeb(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;
}
