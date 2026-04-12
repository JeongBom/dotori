// Supabase 클라이언트 초기화
// MySQL에서 mysql.createConnection()하는 것과 같은 역할
// 앱 전체에서 이 파일 하나만 import해서 사용 (싱글톤 패턴)

import 'react-native-url-polyfill/auto'; // Supabase가 내부적으로 URL 객체를 사용하는데, React Native에는 없어서 폴리필 필요
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// process.env.EXPO_PUBLIC_* → .env 파일에서 자동으로 읽어옴
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 로그인 토큰을 AsyncStorage에 저장 (앱 재시작 시에도 로그인 유지)
    // 웹에서는 localStorage에 저장하는 것과 같은 역할
    storage: AsyncStorage,
    autoRefreshToken: true,  // 토큰 만료 전에 자동 갱신
    persistSession: true,    // 세션 유지 (앱 껐다 켜도 로그인 상태 유지)
    detectSessionInUrl: false, // React Native는 URL 기반 OAuth 콜백을 쓰지 않으므로 false
  },
});

// 현재 로그인한 유저의 family_id를 반환
// 1순위: user_profiles.family_id (인증 도입 후)
// 2순위: families 테이블 첫 번째 row (인증 없는 구버전 호환)
export async function getOrCreateFamilyId(): Promise<string | null> {
  // 로그인된 유저가 있으면 프로필에서 family_id 조회
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('family_id')
      .eq('id', user.id)
      .single();
    if (profile?.family_id) return profile.family_id;
  }

  // 인증 없는 환경: 기존 방식 (개발/테스트용)
  const { data: existing } = await supabase
    .from('families')
    .select('id')
    .limit(1)
    .single();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('families')
    .insert({ name: '우리 가족' })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create family:', error);
    return null;
  }
  return created.id;
}

// 현재 유저 프로필 조회
export async function getUserProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  return data;
}

// 프로필 리로드 트리거
// FamilySetupScreen 등에서 가족/프로필 변경 후 네비게이터에 갱신 요청할 때 사용
type ReloadFn = () => void;
let _reloadProfile: ReloadFn | null = null;
export const registerProfileReload = (fn: ReloadFn) => { _reloadProfile = fn; };
export const triggerProfileReload = () => { _reloadProfile?.(); };

// 가족 합류: 내 기존 데이터 숨김(is_active=false) + family_id 변경
// newFamilyId: 합류할 가족 ID
export async function joinFamily(userId: string, currentFamilyId: string, newFamilyId: string) {
  // 1. 내 기존 데이터 소프트 삭제
  await supabase.from('fridge_items').update({ is_active: false }).eq('family_id', currentFamilyId);
  await supabase.from('assets').update({ is_active: false }).eq('user_id', userId);
  await supabase.from('goals').update({ is_active: false }).eq('family_id', currentFamilyId);

  // 2. 프로필 업데이트: 기존 family_id는 personal_family_id에 저장 (나가기 시 복구용)
  const { error } = await supabase
    .from('user_profiles')
    .update({ family_id: newFamilyId, personal_family_id: currentFamilyId, role: 'member' })
    .eq('id', userId);

  return error;
}

// 가족 나가기: 내 기존 데이터 복구(is_active=true) + 원래 family_id로 복귀
export async function leaveFamily(userId: string, personalFamilyId: string) {
  // 1. 내 기존 데이터 복구
  await supabase.from('fridge_items').update({ is_active: true }).eq('family_id', personalFamilyId);
  await supabase.from('assets').update({ is_active: true }).eq('user_id', userId);
  await supabase.from('goals').update({ is_active: true }).eq('family_id', personalFamilyId);

  // 2. 원래 가족으로 복귀
  const { error } = await supabase
    .from('user_profiles')
    .update({ family_id: personalFamilyId, personal_family_id: null, role: 'owner' })
    .eq('id', userId);

  return error;
}
