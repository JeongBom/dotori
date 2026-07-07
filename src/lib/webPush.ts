// 웹 푸시 구독 관리 (웹 전용)
// - enableWebPush(): 알림 권한 요청 → 구독 발급 → DB 저장
// - disableWebPush(): 구독 해지 + DB 삭제
// - getWebPushStatus(): 현재 기기의 구독 여부
//
// VAPID 공개키는 .env의 EXPO_PUBLIC_VAPID_PUBLIC_KEY 에서 읽는다.

import { Platform } from 'react-native';
import { supabase, getOrCreateFamilyId } from './supabase';

// RN 타입 환경에는 DOM 타입이 없어서 필요한 부분만 선언
interface PushSubscriptionLike {
  endpoint: string;
  toJSON(): { keys?: { p256dh?: string; auth?: string } };
  unsubscribe(): Promise<boolean>;
}
interface SWRegistrationLike {
  pushManager: {
    getSubscription(): Promise<PushSubscriptionLike | null>;
    subscribe(opts: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }): Promise<PushSubscriptionLike>;
  };
}
declare const navigator: {
  serviceWorker?: {
    register(url: string): Promise<SWRegistrationLike>;
    ready: Promise<SWRegistrationLike>;
  };
};
declare const window: {
  Notification?: { requestPermission(): Promise<string>; permission: string };
  PushManager?: unknown;
  atob(encoded: string): string;
};

const VAPID_PUBLIC_KEY = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export function isWebPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    !!VAPID_PUBLIC_KEY &&
    typeof navigator !== 'undefined' && !!navigator.serviceWorker &&
    typeof window !== 'undefined' && !!window.PushManager && !!window.Notification
  );
}

// VAPID 키를 subscribe()가 요구하는 바이너리로 변환
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

// 알림 켜기: true = 성공, false = 권한 거부/미지원
export async function enableWebPush(): Promise<boolean> {
  if (!isWebPushSupported()) return false;

  const permission = await window.Notification!.requestPermission();
  if (permission !== 'granted') return false;

  const registration = await navigator.serviceWorker!.register('/sw.js');
  // 준비될 때까지 대기 (첫 등록 직후 subscribe 실패 방지)
  const ready = await navigator.serviceWorker!.ready;

  const existing = await ready.pushManager.getSubscription();
  const subscription = existing ?? await ready.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys?.auth) return false;

  const { data: { user } } = await supabase.auth.getUser();
  const familyId = await getOrCreateFamilyId();
  if (!user || !familyId) return false;

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      family_id: familyId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    console.error('push subscription save error:', error);
    return false;
  }
  return true;
}

// 알림 끄기: 이 기기의 구독 해지 + DB에서 제거
export async function disableWebPush(): Promise<void> {
  if (!isWebPushSupported()) return;
  try {
    const ready = await navigator.serviceWorker!.ready;
    const subscription = await ready.pushManager.getSubscription();
    if (!subscription) return;
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  } catch (e) {
    console.error('push unsubscribe error:', e);
  }
}

// 현재 기기가 구독 중인지
export async function getWebPushStatus(): Promise<boolean> {
  if (!isWebPushSupported()) return false;
  if (window.Notification!.permission !== 'granted') return false;
  try {
    const ready = await navigator.serviceWorker!.ready;
    const subscription = await ready.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
}

// ── 가족에게 푸시 발송 (Edge Function 경유) ─────
// 실패해도 호출부 동작(수량 변경 등)을 막지 않는다.
export async function notifyFamily(title: string, body: string): Promise<void> {
  try {
    const familyId = await getOrCreateFamilyId();
    if (!familyId) return;
    await supabase.functions.invoke('send-push', {
      body: { familyId, title, body },
    });
  } catch (e) {
    console.warn('notifyFamily error:', e);
  }
}
