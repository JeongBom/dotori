// 푸시 알림 헬퍼
// expo-notifications를 사용해 유통기한 알림을 스케줄링함

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getOrCreateFamilyId } from './supabase';
import { STORAGE_KEY_NOTIFY_DAYS } from '../screens/SettingsScreen';

// 알림이 포그라운드에서도 표시되도록 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 권한 요청 (앱 최초 실행 시 또는 알림 기능 첫 사용 시 호출)
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('expiry', {
      name: '유통기한 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// 유통기한 알림 스케줄링
// itemId를 identifier로 사용해 나중에 취소할 수 있음
export async function scheduleExpiryNotification(
  itemId: string,
  itemName: string,
  expiryDate: string,   // "YYYY-MM-DD"
  daysBefore: number,   // user_settings.notify_days_before
): Promise<void> {
  try {
    // 기존 알림이 있으면 취소하고 새로 스케줄
    await Notifications.cancelScheduledNotificationAsync(itemId).catch(() => {});

    const expiry = new Date(expiryDate);
    const triggerDate = new Date(expiry);
    triggerDate.setDate(triggerDate.getDate() - daysBefore);
    triggerDate.setHours(9, 0, 0, 0); // 오전 9시에 알림

    if (triggerDate <= new Date()) return; // 이미 지난 날짜면 스킵

    await Notifications.scheduleNotificationAsync({
      identifier: itemId,
      content: {
        title: '🔔 유통기한 임박',
        body: `${itemName}의 유통기한이 ${daysBefore}일 후입니다. 확인해 주세요.`,
        data: { itemId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
  } catch (e) {
    console.warn('알림 스케줄 실패:', e);
  }
}

// 재고 부족 즉시 알림 (수량이 임계값 이하로 떨어질 때)
export async function sendLowStockNotification(
  supplyId: string,
  supplyName: string,
  quantity: number,
): Promise<void> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    // 기존 알림이 있으면 덮어씀
    await Notifications.cancelScheduledNotificationAsync(`low_stock_${supplyId}`).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: `low_stock_${supplyId}`,
      content: {
        title: '🛒 재고 부족',
        body: `${supplyName} 재고가 ${quantity}개 남았어요. 구매가 필요합니다.`,
        data: { supplyId },
      },
      trigger: null, // 즉시 발송
    });
  } catch (e) {
    console.warn('재고 부족 알림 실패:', e);
  }
}

// 알림 취소 (아이템 삭제 또는 다먹음 처리 시)
export async function cancelExpiryNotification(itemId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(itemId);
  } catch (e) {
    // 등록된 알림이 없으면 무시
  }
}

// 앱 시작 시 호출: 아직 먹지 않은 음식의 알림을 전부 재등록
// (앱 재설치, 알림 초기화 상황에 대비)
export async function rescheduleAllNotifications(): Promise<void> {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;

    const fid = await getOrCreateFamilyId();
    if (!fid) return;

    const notifyDays = parseInt(
      (await AsyncStorage.getItem(STORAGE_KEY_NOTIFY_DAYS)) ?? '3'
    );

    const { data: items } = await supabase
      .from('fridge_items')
      .select('id, name, expiry_date')
      .eq('family_id', fid)
      .eq('is_consumed', false)
      .not('expiry_date', 'is', null);

    if (!items) return;

    for (const item of items) {
      await scheduleExpiryNotification(item.id, item.name, item.expiry_date, notifyDays);
    }
  } catch (e) {
    console.warn('알림 재등록 실패:', e);
  }
}
