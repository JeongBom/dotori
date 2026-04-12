// 앱 네비게이션 설정
//
// 인증 상태에 따라 두 가지 흐름으로 분기:
//
// ① 비로그인  → AuthScreen
// ② 로그인 + 프로필 미완성 → ProfileSetup → FamilySetup
// ③ 로그인 + 프로필 완성  → MainTabs (하단 탭)
//
// Supabase onAuthStateChange가 세션 변경을 감지 → 자동 화면 전환

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { NavigationContainer, NavigationContainerRef, useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Refrigerator, Wallet, Calendar, ShoppingCart } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { STORAGE_KEY_ENABLED_FEATURES, ALL_FEATURES } from '../screens/SettingsScreen';

import DashboardScreen from '../screens/DashboardScreen';
import FridgeScreen from '../screens/FridgeScreen';
import FinanceScreen from '../screens/FinanceScreen';
import ChoresScreen from '../screens/ChoresScreen';
import SuppliesScreen from '../screens/SuppliesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AddFridgeItemScreen from '../screens/AddFridgeItemScreen';
import AddSupplyScreen from '../screens/AddSupplyScreen';
import AddChoreScreen from '../screens/AddChoreScreen';
import FamilyFoodsScreen from '../screens/FamilyFoodsScreen';
import AssetHistoryScreen from '../screens/AssetHistoryScreen';
import AuthScreen from '../screens/auth/AuthScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';
import FamilySetupScreen from '../screens/auth/FamilySetupScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';

import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

// ---- 타입 ----

export type RootTabParamList = {
  Home: undefined;
  Fridge: undefined;
  Finance: undefined;
  Chores: undefined;
  Supplies: undefined;
};

export type RootStackParamList = {
  // 인증 플로우
  Auth: undefined;
  ProfileSetup: { userId: string; email: string };
  FamilySetup: { userId: string };
  ForgotPassword: undefined;
  ResetPassword: undefined;
  // 메인 플로우
  MainTabs: undefined;
  Settings: undefined;
  AddFridgeItem: { familyId?: string; itemId?: string };
  AddSupply: { familyId?: string; supplyId?: string };
  AddChore: { familyId?: string; choreId?: string };
  FamilyFoods: undefined;
  AssetHistory: undefined;
};

// ---- 탭 아이콘 / 라벨 ----

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

type IconProps = { color: string; size: number };

const TAB_ICONS: Record<keyof RootTabParamList, React.FC<IconProps>> = {
  Home:     ({ color, size }) => <Home color={color} size={size} strokeWidth={1.5} />,
  Fridge:   ({ color, size }) => <Refrigerator color={color} size={size} strokeWidth={1.5} />,
  Finance:  ({ color, size }) => <Wallet color={color} size={size} strokeWidth={1.5} />,
  Chores:   ({ color, size }) => <Calendar color={color} size={size} strokeWidth={1.5} />,
  Supplies: ({ color, size }) => <ShoppingCart color={color} size={size} strokeWidth={1.5} />,
};

const TAB_LABELS: Record<keyof RootTabParamList, string> = {
  Home: '홈', Fridge: '음식', Finance: '자산', Chores: '루틴', Supplies: '생필품',
};

// ---- 하단 탭 ----

function MainTabs() {
  const isFocused = useIsFocused();
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([...ALL_FEATURES]);

  useEffect(() => {
    const load = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY_ENABLED_FEATURES);
      setEnabledFeatures(stored ? JSON.parse(stored) : [...ALL_FEATURES]);
    };
    load();
  }, [isFocused]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          const Icon = TAB_ICONS[route.name as keyof RootTabParamList];
          return <Icon color={color} size={24} />;
        },
        tabBarLabel: TAB_LABELS[route.name as keyof RootTabParamList],
        tabBarActiveTintColor: '#8B5E3C',
        tabBarInactiveTintColor: '#C49A6C',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EDD9C0',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen
        name="Fridge"
        component={FridgeScreen}
        options={{ tabBarButton: enabledFeatures.includes('Fridge') ? undefined : () => null }}
      />
      <Tab.Screen
        name="Supplies"
        component={SuppliesScreen}
        options={{ tabBarButton: enabledFeatures.includes('Supplies') ? undefined : () => null }}
      />
      <Tab.Screen
        name="Finance"
        component={FinanceScreen}
        options={{ tabBarButton: enabledFeatures.includes('Finance') ? undefined : () => null }}
      />
      <Tab.Screen
        name="Chores"
        component={ChoresScreen}
        options={{ tabBarButton: enabledFeatures.includes('Chores') ? undefined : () => null }}
      />
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

// ---- 루트 네비게이터 ----

interface AppNavigatorProps {
  navigationRef?: React.RefObject<NavigationContainerRef<RootStackParamList> | null>;
}

export default function AppNavigator({ navigationRef }: AppNavigatorProps) {
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
        // dotori://#access_token=...&type=recovery 형태 처리
        const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
        if (!fragment) return;
        const params = new URLSearchParams(fragment);
        const type = params.get('type');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken && (type === 'recovery' || type === 'signup')) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          // setSession 후 onAuthStateChange가 SIGNED_IN / PASSWORD_RECOVERY 이벤트 발생
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
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={LoadingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
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
            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
            <Stack.Screen name="FamilySetup" component={FamilySetupScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : !profile?.family_id ? (
          // ── 로그인 + 프로필/가족 미완성 ────────────────
          // family_id가 없으면 온보딩 플로우 계속
          <>
            {!profile
              ? <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
              : <Stack.Screen name="FamilySetup" component={FamilySetupScreen} />
            }
          </>
        ) : (
          // ── 로그인 완료: 메인 앱 ───────��────────────────
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AddFridgeItem" component={AddFridgeItemScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AddSupply" component={AddSupplyScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AddChore" component={AddChoreScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="FamilyFoods" component={FamilyFoodsScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="AssetHistory" component={AssetHistoryScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
