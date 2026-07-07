import React, { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { NavigationContainerRef } from '@react-navigation/native';
import AppNavigator from './src/navigation';
import SplashScreen from './src/screens/SplashScreen';
import { rescheduleAllNotifications } from './src/lib/notifications';
import { setupWebAlert } from './src/lib/webAlert';
import { RootStackParamList } from './src/navigation';

// 웹: Alert.alert을 브라우저 confirm/alert으로 매핑 (미적용 시 웹에서 팝업 무동작)
setupWebAlert();

// 네이티브 스플래시를 수동으로 제어
ExpoSplashScreen.preventAutoHideAsync();

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // 네이티브 스플래시 즉시 숨기고 커스텀 스플래시로 전환
    ExpoSplashScreen.hideAsync();

    rescheduleAllNotifications();

    // 알림 탭 리스너 — 웹은 expo-notifications 미지원이라 스킵
    if (Platform.OS === 'web') return;

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const itemId = response.notification.request.content.data?.itemId as string | undefined;
      if (itemId && navigationRef.current) {
        navigationRef.current.navigate('Main' as never);
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <AppNavigator navigationRef={navigationRef} />
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}
    </GestureHandlerRootView>
  );
}
