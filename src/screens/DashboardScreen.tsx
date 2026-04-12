// 홈 대시보드 화면
// 4가지 기능(냉장고, 가계부, 루틴, 생필품)의 요약 정보를 한눈에 보여줌

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Refrigerator,
  Wallet,
  Calendar,
  ShoppingCart,
  CircleUser,
  TriangleAlert,
  Users,
  Settings,
  Sprout,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import SummaryCard from '../components/SummaryCard';
import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { DashboardSummary } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';
import { STORAGE_KEY_FAMILY_NAME, STORAGE_KEY_NICKNAME, STORAGE_KEY_NOTIFY_DAYS, STORAGE_KEY_ENABLED_FEATURES, ALL_FEATURES } from './SettingsScreen';

type DashboardNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ============================================================
// 헬퍼
// ============================================================

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function daysLater(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

// ============================================================
// Supabase 데이터 패치
// ============================================================

async function fetchDashboardSummary(
  familyId: string,
  notifyDaysBefore: number,  // user_settings 기반 임박 기준일
): Promise<DashboardSummary> {
  const [fridgeRes, expiringSoonRes, expiredRes, expenseRes, incomeRes, pendingChoresRes, overdueChoresRes, lowStockRes] =
    await Promise.all([
      supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_consumed', false),
      supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_consumed', false).gte('expiry_date', today()).lte('expiry_date', daysLater(notifyDaysBefore)),
      supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_consumed', false).lt('expiry_date', today()),
      supabase.from('transactions').select('amount').eq('family_id', familyId).eq('type', 'expense').gte('transaction_date', firstDayOfMonth()),
      supabase.from('transactions').select('amount').eq('family_id', familyId).eq('type', 'income').gte('transaction_date', firstDayOfMonth()),
      supabase.from('chores').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_completed', false),
      supabase.from('chores').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_completed', false).lt('due_date', today()).not('due_date', 'is', null),
      supabase.from('supplies').select('quantity, low_stock_threshold').eq('family_id', familyId),
    ]);

  const totalExpense = (expenseRes.data ?? []).reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = (incomeRes.data ?? []).reduce((sum, t) => sum + t.amount, 0);
  const lowStockCount = (lowStockRes.data ?? []).filter(s => s.quantity <= s.low_stock_threshold).length;

  return {
    fridge: { totalItems: fridgeRes.count ?? 0, expiringCount: expiringSoonRes.count ?? 0, expiredCount: expiredRes.count ?? 0 },
    finance: { thisMonthExpense: totalExpense, thisMonthIncome: totalIncome },
    chores: { pendingCount: pendingChoresRes.count ?? 0, overdueCount: overdueChoresRes.count ?? 0 },
    supplies: { lowStockCount },
  };
}

// ============================================================
// 컴포넌트
// ============================================================

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const isFocused = useIsFocused();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [familyName, setFamilyName]   = useState<string>('우리 가족');
  const [nickname, setNickname]       = useState<string>('');
  const [notifyDays, setNotifyDays]   = useState<number>(3);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([...ALL_FEATURES]);

  const loadLocalSettings = useCallback(async () => {
    const storedName     = await AsyncStorage.getItem(STORAGE_KEY_FAMILY_NAME);
    const storedNickname = await AsyncStorage.getItem(STORAGE_KEY_NICKNAME);
    const storedDays     = await AsyncStorage.getItem(STORAGE_KEY_NOTIFY_DAYS);
    const storedFeatures = await AsyncStorage.getItem(STORAGE_KEY_ENABLED_FEATURES);
    if (storedNickname) setNickname(storedNickname);
    if (storedDays) setNotifyDays(parseInt(storedDays));
    setEnabledFeatures(storedFeatures ? JSON.parse(storedFeatures) : ALL_FEATURES);
    return storedName;
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const localName = await loadLocalSettings();

      // AsyncStorage에서 notify_days 읽기 (최신값 반영)
      const storedDays = await AsyncStorage.getItem(STORAGE_KEY_NOTIFY_DAYS);
      const days = storedDays ? parseInt(storedDays) : 3;
      setNotifyDays(days);

      const familyId = await getOrCreateFamilyId();

      if (!familyId) {
        setSummary({
          fridge: { totalItems: 0, expiringCount: 0, expiredCount: 0 },
          finance: { thisMonthExpense: 0, thisMonthIncome: 0 },
          chores: { pendingCount: 0, overdueCount: 0 },
          supplies: { lowStockCount: 0 },
        });
        if (localName) setFamilyName(localName);
        return;
      }

      const { data: families } = await supabase
        .from('families').select('name').eq('id', familyId).single();
      if (families) {
        setFamilyName(families.name);
        await AsyncStorage.setItem(STORAGE_KEY_FAMILY_NAME, families.name);
      }
      const data = await fetchDashboardSummary(familyId, days);
      setSummary(data);
    } catch (e) {
      setError('데이터를 불러오지 못했어요. 인터넷 연결을 확인해주세요.');
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadLocalSettings]);

  useEffect(() => { loadData(); }, [loadData]);

  // 설정에서 돌아올 때 이름·닉네임 갱신
  useEffect(() => {
    if (isFocused) {
      loadLocalSettings().then(localName => {
        if (localName) setFamilyName(localName);
      });
    }
  }, [isFocused, loadLocalSettings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const todayStr = new Date().toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short',
  });

  // ---- 로딩 ----
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#8B5E3C" />
        <Text style={styles.loadingText}>불러오는 중...</Text>
      </SafeAreaView>
    );
  }

  // ---- 에러 ----
  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <TriangleAlert color="#8B5E3C" size={48} strokeWidth={1.5} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ---- 정상 렌더링 ----
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5E3C" />}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          {/* 앱 이름 */}
          <View style={styles.appNameRow}>
            <Sprout color="#8B5E3C" size={26} strokeWidth={2} />
            <Text style={styles.appName}>도토리</Text>
          </View>

          {/* 날짜 + 계정 */}
          <View style={styles.headerRight}>
            <View style={styles.dateBox}>
              <Text style={styles.dateText}>{todayStr}</Text>
            </View>
            {/* 가족명 + 계정 아이콘 → 탭하면 계정 시트 */}
            <TouchableOpacity
              style={styles.accountButton}
              onPress={() => setShowAccountSheet(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.nickname}>{familyName}</Text>
              <CircleUser color="#8B5E3C" size={28} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 알림 배너 */}
        {summary && (summary.fridge.expiredCount > 0 || summary.supplies.lowStockCount > 0) && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertText}>
              {[
                summary.fridge.expiredCount > 0 ? `유통기한 지난 식품 ${summary.fridge.expiredCount}개` : null,
                summary.supplies.lowStockCount > 0 ? `재고 부족 ${summary.supplies.lowStockCount}개` : null,
              ].filter(Boolean).join(' · ')}
            </Text>
            <TriangleAlert color="#7A4F2E" size={18} strokeWidth={2} />
          </View>
        )}

        {/* 섹션 제목 */}
        <Text style={styles.sectionTitle}>오늘의 현황</Text>

        {/* 기능 그리드 (활성화된 기능만 표시) */}
        <View style={styles.grid}>
          {enabledFeatures.includes('Fridge') && (
            <SummaryCard
              style={styles.gridCard}
              title="음식"
              icon={<Refrigerator color="#FFFFFF" size={18} strokeWidth={1.8} />}
              color="#8B5E3C"
              onPress={() => navigation.navigate('Fridge')}
              primaryStat={{ label: '보관 중인 식품', value: `${summary?.fridge.totalItems ?? 0}개` }}
              secondaryStats={[
                { label: `유통기한 임박 (D-${notifyDays})`, value: `${summary?.fridge.expiringCount ?? 0}개`, highlight: (summary?.fridge.expiringCount ?? 0) > 0 },
                { label: '유통기한 초과', value: `${summary?.fridge.expiredCount ?? 0}개`, highlight: (summary?.fridge.expiredCount ?? 0) > 0 },
              ]}
            />
          )}
          {enabledFeatures.includes('Supplies') && (
            <SummaryCard
              style={styles.gridCard}
              title="생필품"
              icon={<ShoppingCart color="#FFFFFF" size={18} strokeWidth={1.8} />}
              color="#6B4226"
              onPress={() => navigation.navigate('Supplies')}
              primaryStat={{ label: '재고 부족 항목', value: `${summary?.supplies.lowStockCount ?? 0}개`, highlight: (summary?.supplies.lowStockCount ?? 0) > 0 }}
            />
          )}
          {enabledFeatures.includes('Finance') && (
            <SummaryCard
              style={styles.gridCard}
              title="자산"
              icon={<Wallet color="#FFFFFF" size={18} strokeWidth={1.8} />}
              color="#7A4F2E"
              onPress={() => navigation.navigate('Finance')}
              primaryStat={{ label: '이번달 지출', value: formatKRW(summary?.finance.thisMonthExpense ?? 0) }}
              secondaryStats={[
                { label: '수입', value: formatKRW(summary?.finance.thisMonthIncome ?? 0) },
                {
                  label: '수지',
                  value: formatKRW((summary?.finance.thisMonthIncome ?? 0) - (summary?.finance.thisMonthExpense ?? 0)),
                  highlight: (summary?.finance.thisMonthIncome ?? 0) - (summary?.finance.thisMonthExpense ?? 0) < 0,
                },
              ]}
            />
          )}
          {enabledFeatures.includes('Chores') && (
            <SummaryCard
              style={styles.gridCard}
              title="루틴"
              icon={<Calendar color="#FFFFFF" size={18} strokeWidth={1.8} />}
              color="#A87850"
              onPress={() => navigation.navigate('Chores')}
              primaryStat={{ label: '해야 할 일', value: `${summary?.chores.pendingCount ?? 0}개` }}
              secondaryStats={[
                { label: '기한 초과', value: `${summary?.chores.overdueCount ?? 0}개`, highlight: (summary?.chores.overdueCount ?? 0) > 0 },
              ]}
            />
          )}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      {/* 계정 시트 */}
      <Modal visible={showAccountSheet} transparent animationType="slide">
        <Pressable style={sheetStyles.overlay} onPress={() => setShowAccountSheet(false)}>
          <Pressable style={sheetStyles.sheet} onPress={() => {}}>
            {/* 핸들 바 */}
            <View style={sheetStyles.handle} />

            {/* 가족 */}
            <View style={sheetStyles.row}>
              <View style={sheetStyles.iconBox}>
                <Users color="#8B5E3C" size={20} strokeWidth={1.8} />
              </View>
              <View>
                <Text style={sheetStyles.rowLabel}>속한 가족</Text>
                <Text style={sheetStyles.rowValue}>{familyName}</Text>
              </View>
            </View>

            {/* 닉네임 */}
            <View style={sheetStyles.row}>
              <View style={sheetStyles.iconBox}>
                <CircleUser color="#8B5E3C" size={20} strokeWidth={1.8} />
              </View>
              <View>
                <Text style={sheetStyles.rowLabel}>닉네임</Text>
                <Text style={sheetStyles.rowValue}>
                  {nickname || '닉네임 미설정'}
                </Text>
              </View>
            </View>

            <View style={sheetStyles.divider} />

            {/* 설정으로 이동 */}
            <TouchableOpacity
              style={sheetStyles.settingsBtn}
              onPress={() => { setShowAccountSheet(false); navigation.navigate('Settings'); }}
              activeOpacity={0.7}
            >
              <Settings color="#8B5E3C" size={18} strokeWidth={1.8} />
              <Text style={sheetStyles.settingsBtnText}>설정</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FDF6EC',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 24 },

  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  headerRight: { alignItems: 'flex-end', gap: 8 },

  appNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#5C3D1E',
    letterSpacing: -0.5,
  },
  dateBox: {
    backgroundColor: '#8B5E3C',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  dateText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  accountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  nickname: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C3D1E',
  },

  // 알림 배너
  alertBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EDD9C0',
    borderWidth: 1,
    borderColor: '#D4B896',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  alertText: {
    fontSize: 13,
    color: '#5C3D1E',
    fontWeight: '600',
    flex: 1,
  },

  // 기능 그리드 (flex-wrap)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: '47%',
  },

  // 섹션 제목
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5C3D1E',
    marginBottom: 14,
  },

  // 로딩 / 에러
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDF6EC',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#8B5E3C',
  },
  errorText: {
    fontSize: 14,
    color: '#8B5E3C',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: '#8B5E3C',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});

// ── 계정 시트 스타일 ──────────────────────────

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF8F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DEC8A8',
    alignSelf: 'center',
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FDF6EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 11,
    color: '#8B5E3C',
    fontWeight: '600',
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 17,
    color: '#5C3D1E',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#DEC8A8',
    marginBottom: 18,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  settingsBtnText: {
    fontSize: 15,
    color: '#8B5E3C',
    fontWeight: '600',
  },
});

export default DashboardScreen;
