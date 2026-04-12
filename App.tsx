// App.tsx: 앱의 진입점 (entry point)
// index.ts에서 이 파일을 import해서 앱을 시작함
//
// GestureHandlerRootView: React Navigation의 제스처(스와이프 등)가 동작하려면 필요
// StatusBar: 상단 시스템 바(시간, 배터리) 스타일 설정

import React, { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation';
import { rescheduleAllNotifications } from './src/lib/notifications';
import { RootStackParamList } from './src/navigation';

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    // 앱 시작 시 알림 권한 요청 + 기존 음식 알림 재등록
    rescheduleAllNotifications();

    // 알림을 탭했을 때 음식 화면으로 이동
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const itemId = response.notification.request.content.data?.itemId as string | undefined;
      if (itemId && navigationRef.current) {
        // 탭 바의 음식(Fridge) 탭으로 이동
        navigationRef.current.navigate('Main' as never);
      }
    });

    return () => sub.remove();
  }, []);

  return (
    // style={{ flex: 1 }}: 화면 전체를 채우도록 설정
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppNavigator navigationRef={navigationRef} />
    </GestureHandlerRootView>
  );
}
