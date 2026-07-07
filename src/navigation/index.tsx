// 앱 네비게이션 설정
//
// 인증 상태에 따라 두 가지 흐름으로 분기:
//
// ① 비로그인          → AuthScreen → FamilySetup
// ② 로그인 + 가족 없음 → FamilySetup
// ③ 로그인 완료        → MainTabs (하단 탭)
//
// Supabase onAuthStateChange가 세션 변경을 감지 → 자동 화면 전환

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking, Platform } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import type { Session } from '@supabase/supabase-js';

import DashboardScreen from '../screens/DashboardScreen';
import FridgeScreen from '../screens/FridgeScreen';
import SuppliesScreen from '../screens/SuppliesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddFridgeItemScreen from '../screens/AddFridgeItemScreen';
import AddSupplyScreen from '../screens/AddSupplyScreen';
import ShoppingScreen from '../screens/ShoppingScreen';
import AddShoppingItemScreen from '../screens/AddShoppingItemScreen';
import ReceiptScanScreen from '../screens/ReceiptScanScreen';
import NotesScreen from '../screens/NotesScreen';
import NoteDetailScreen from '../screens/NoteDetailScreen';
import AuthScreen from '../screens/auth/AuthScreen';
import FamilySetupScreen from '../screens/auth/FamilySetupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import DesktopSidebar from '../components/desktop/DesktopSidebar';
import { withDesktopPanel } from '../components/desktop/withDesktopPanel';
import { useIsDesktopWeb, SIDEBAR_WIDTH } from '../hooks/useIsDesktopWeb';

// 데스크톱 웹에서 가운데 모달 카드로 뜨는 화면들 (모바일/앱은 원래대로)
const SettingsPanel        = withDesktopPanel(SettingsScreen);
const AddFridgeItemPanel   = withDesktopPanel(AddFridgeItemScreen);
const AddSupplyPanel       = withDesktopPanel(AddSupplyScreen);
const AddShoppingItemPanel = withDesktopPanel(AddShoppingItemScreen);
const ReceiptScanPanel     = withDesktopPanel(ReceiptScanScreen);
const NoteDetailPanel      = withDesktopPanel(NoteDetailScreen);

// ---- 타입 ----

export type RootTabParamList = {
  Home: undefined;
  Fridge: undefined;
  Supplies: undefined;
  Shopping: undefined;
  Notes: undefined;
};

export type RootStackParamList = {
  // 인증 플로우
  Auth: undefined;
  FamilySetup: { userId: string };
  ForgotPassword: undefined;
  ResetPassword: undefined;
  // 메인 플로우
  MainTabs: undefined;
  Settings: undefined;
  AddFridgeItem: { familyId?: string; itemId?: string };
  AddSupply: { familyId?: string; supplyId?: string };
  AddShoppingItem: { familyId?: string; itemId?: string };
  ReceiptScan: undefined;
  NoteDetail: { noteId: string };
};

// ---- 탭 아이콘 / 라벨 ----

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

type IconProps = { color: string; size: number };

function TabIcon({ name, color }: { name: string; color: string }) {
  const s = { width: 22, height: 22, stroke: color, strokeWidth: 1.6 } as const;
  if (name === 'home')
    return <Svg {...s} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"><Path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
  if (name === 'fridge')
    return <Svg {...s} viewBox="0 0 24 24" fill="none"><Rect x="6" y="3" width="12" height="18" rx="2" stroke={color} strokeWidth={1.6} fill="none"/><Path d="M6 10h12M9 7v1M9 14v2" stroke={color} strokeWidth={1.6} strokeLinecap="round"/></Svg>;
  if (name === 'basket')
    return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.7h-7a2 2 0 0 1-2-1.7z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/><Path d="M9 8V6a3 3 0 0 1 6 0v2M9 12v5M15 12v5" stroke={color} strokeWidth={1.6} strokeLinecap="round"/></Svg>;
  if (name === 'wallet')
    return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M3 7a2 2 0 0 1 2-2h14v4H5a2 2 0 0 0-2 2z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/><Path d="M3 7v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9H5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/><Circle cx="16" cy="14" r="1.3" fill={color}/></Svg>;
  if (name === 'cart')
    return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M3 4h2l2.4 12.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/><Circle cx="9.5" cy="20.5" r="1.3" fill={color}/><Circle cx="16.5" cy="20.5" r="1.3" fill={color}/></Svg>;
  if (name === 'note')
    return <Svg {...s} viewBox="0 0 24 24" fill="none"><Path d="M5 4h11l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"/><Path d="M15 4v5h5M8 13h8M8 17h5" stroke={color} strokeWidth={1.6} strokeLinecap="round"/></Svg>;
  return null;
}

const TAB_ICON_NAMES: Partial<Record<keyof RootTabParamList, string>> = {
  Home: 'home', Fridge: 'fridge', Supplies: 'basket', Shopping: 'cart', Notes: 'note',
};

const TAB_LABELS: Partial<Record<keyof RootTabParamList, string>> = {
  Home: '홈', Fridge: '음식', Supplies: '생필품', Shopping: '장보기', Notes: '메모',
};

// ---- 하단 탭 ----

function MainTabs() {
  // 데스크톱 웹: 하단 탭바 대신 좌측 사이드바
  const isDesktop = useIsDesktopWeb();
  return (
    <Tab.Navigator
      tabBar={isDesktop ? (props) => <DesktopSidebar {...props} /> : undefined}
      screenOptions={({ route }) => ({
        sceneStyle: isDesktop ? { paddingLeft: SIDEBAR_WIDTH } : undefined,
        tabBarIcon: ({ color }) => {
          const name = TAB_ICON_NAMES[route.name as keyof RootTabParamList];
          return name ? <TabIcon name={name} color={color} /> : null;
        },
        tabBarLabel: TAB_LABELS[route.name as keyof RootTabParamList] ?? '',
        tabBarActiveTintColor: '#8B5E3C',
        tabBarInactiveTintColor: '#C49A6C',
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.97)',
          borderTopWidth: 0.5,
          borderTopColor: '#DEC8A8',
          // 하단 28px은 폰 홈 인디케이터 공간 — 웹에는 없으므로 줄임
          height: Platform.OS === 'web' ? 60 : 84,
          paddingBottom: Platform.OS === 'web' ? 6 : 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Fridge"   component={FridgeScreen} />
      <Tab.Screen name="Supplies" component={SuppliesScreen} />
      <Tab.Screen name="Shopping" component={ShoppingScreen} />
      <Tab.Screen name="Notes"    component={NotesScreen} />
    </Tab.Navigator>
  );
}

// ---- 로딩 스피너 ----

const LoadingScreen = () => (
  <View style={loadingStyles.container}>
    <ActivityIndicator size="large" color="#8B5E3C" />
  </View>
);
const loadingStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6EC' },
});

// 웹 브라우저 탭 제목 고정 (라우트명 노출 방지)
const DOC_TITLE = { formatter: (): string => '도토리' };

// 데스크톱 웹 모달 카드용 스택 옵션: 뒤 화면이 비치게 투명 + 페이드
const desktopModalOptions = {
  presentation: 'transparentModal' as const,
  animation: 'fade' as const,
  contentStyle: { backgroundColor: 'transparent' },
};

// ---- 루트 네비게이터 ----

interface AppNavigatorProps {
  navigationRef?: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
}

export default function AppNavigator({ navigationRef }: AppNavigatorProps) {
  const isDesktop = useIsDesktopWeb(); // 데스크톱 웹: 추가/설정 화면을 모달 카드로
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined); // undefined = 로딩 중
  const [initializing, setInitializing] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // 프로필 조회
  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data ?? null);
    setInitializing(false);
  };

  useEffect(() => {
    // 앱 시작 시 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setInitializing(false);
      }
    });

    // 로그인/로그아웃/토큰갱신 시 자동 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // 이메일 링크 클릭 → 비밀번호 재설정 화면 표시
        setIsPasswordRecovery(true);
        setInitializing(false);
        return;
      }
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setIsPasswordRecovery(false);
        setProfile(null);
        setInitializing(false);
      }
    });

    // 딥링크 처리 (앱이 백그라운드에 있다가 링크로 열릴 때)
    const handleDeepLink = async (url: string) => {
      try {
        const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
        if (!fragment) return;
        const params = new URLSearchParams(fragment);
        const type = params.get('type');
        const code = params.get('code');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (code) {
          // PKCE flow: onAuthStateChange('PASSWORD_RECOVERY')가 자동으로 발생
          await supabase.auth.exchangeCodeForSession(code);
        } else if (accessToken && refreshToken) {
          // Implicit flow (auth-callback.html 경유)
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (type === 'recovery') {
            // setSession은 항상 SIGNED_IN을 발생시키므로 수동으로 recovery 상태 설정
            setIsPasswordRecovery(true);
            setInitializing(false);
          }
        }
      } catch (e) {
        console.error('Deep link handling error:', e);
      }
    };

    // 앱이 닫혀있다가 딥링크로 열릴 때
    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url); });

    // 앱이 백그라운드에서 포그라운드로
    const linkingSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    return () => {
      subscription.unsubscribe();
      linkingSub.remove();
    };
  }, []);

  // 앱 초기 로딩 중
  if (initializing) {
    return (
      <NavigationContainer ref={navigationRef} documentTitle={DOC_TITLE}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={LoadingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} documentTitle={DOC_TITLE}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isPasswordRecovery ? (
          // ── 비밀번호 재설정 (이메일 링크 클릭 후) ──────
          <Stack.Screen name="ResetPassword">
            {() => <ResetPasswordScreen onDone={() => setIsPasswordRecovery(false)} />}
          </Stack.Screen>
        ) : !session ? (
          // ── 비로그인: 인증 플로우 ──────────────────────
          <>
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="FamilySetup" component={FamilySetupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : !profile?.family_id ? (
          // ── 로그인 + 가족 미완성 ────────────────────────
          <Stack.Screen name="FamilySetup" component={FamilySetupScreen} />
        ) : (
          // ── 로그인 완료: 메인 앱 ───────────────────────
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Settings" component={SettingsPanel} options={isDesktop ? desktopModalOptions : { presentation: 'modal' }} />
            <Stack.Screen name="AddFridgeItem" component={AddFridgeItemPanel} options={isDesktop ? desktopModalOptions : { contentStyle: { backgroundColor: '#FFFFFF' } }} />
            <Stack.Screen name="AddSupply" component={AddSupplyPanel} options={isDesktop ? desktopModalOptions : { contentStyle: { backgroundColor: '#FFFFFF' } }} />
            <Stack.Screen name="AddShoppingItem" component={AddShoppingItemPanel} options={isDesktop ? desktopModalOptions : { contentStyle: { backgroundColor: '#FFFFFF' } }} />
            <Stack.Screen name="ReceiptScan" component={ReceiptScanPanel} options={isDesktop ? desktopModalOptions : { contentStyle: { backgroundColor: '#FFFFFF' } }} />
            <Stack.Screen name="NoteDetail" component={NoteDetailPanel} options={isDesktop ? desktopModalOptions : undefined} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
