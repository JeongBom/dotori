// 홈 대시보드 — 새 디자인 (도토리 v2)
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Settings, Users, CircleUser, TriangleAlert } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Chore } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';
import { generateOccurrences } from '../lib/choreUtils';
import { STORAGE_KEY_FAMILY_NAME, STORAGE_KEY_NICKNAME, STORAGE_KEY_NOTIFY_DAYS } from './SettingsScreen';

// ── 디자인 토큰 ───────────────────────────────
const C = {
  brown:    '#8B5E3C',
  warmOak:  '#A87850',
  lightOak: '#C49A6C',
  ivory:    '#FFF8F0',
  cream:    '#FDF6EC',
  edge:     '#DEC8A8',
  dark:     '#5C3D1E',
  deep:     '#6B4226',
  danger:   '#D95F4B',
  warn:     '#E09B4B',
  purple:   '#9478C9',
};

type DashboardNav = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ── 날짜/시간 헬퍼 ────────────────────────────
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  return `${day}일 전`;
}

function localDate(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── 데이터 타입 ───────────────────────────────
interface Member { id: string; nickname: string }
interface UrgentItem { name: string; type: 'expired' | 'expiring' | 'lowstock' | 'chore'; dday?: string }
interface StockItem { name: string; qty: number; min_qty: number }
interface NoteItem { id: string; title: string }
interface ActivityItem {
  id: string;
  type: 'food' | 'chore' | 'supply' | 'note';
  action: string;
  name: string;
  timestamp: string;
  emoji: string;
}

interface DashboardData {
  // 음식
  fridgeTotal: number;
  fridgeExpiring: number;
  fridgeExpired: number;
  // 일정
  todayChores: { title: string; assignee: string | null }[];
  todayDone: number;
  todayTotal: number;
  // 생필품
  stockItems: StockItem[];
  lowStockCount: number;
  // 메모
  recentNotes: NoteItem[];
  // 긴급 알림
  urgentItems: UrgentItem[];
  // 구성원
  members: Member[];
  // 최근 활동
  activities: ActivityItem[];
}

// ── 데이터 패치 ───────────────────────────────
async function fetchDashboard(familyId: string, notifyDays: number): Promise<DashboardData> {
  const today = localDate();
  const sooner = localDate(notifyDays);

  const [
    fridgeTotalRes, fridgeExpiringRes, fridgeExpiredRes, fridgeExpItemsRes,
    choresRes, suppliesRes, notesRes, membersRes,
    recentFridgeRes,
  ] = await Promise.all([
    supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_consumed', false),
    supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_consumed', false).gte('expiry_date', today).lte('expiry_date', sooner),
    supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_consumed', false).lt('expiry_date', today),
    supabase.from('fridge_items').select('food_name, expiry_date').eq('family_id', familyId).eq('is_consumed', false).lte('expiry_date', sooner).order('expiry_date').limit(5),
    supabase.from('chores').select('*, assignee:user_profiles(id, nickname)').eq('family_id', familyId).eq('is_active', true),
    supabase.from('supplies').select('id, name, quantity, low_stock_threshold, created_at').eq('family_id', familyId).eq('is_active', true).limit(6),
    supabase.from('notes').select('id, title, updated_at').eq('family_id', familyId).order('updated_at', { ascending: false }).limit(4),
    supabase.from('user_profiles').select('id, nickname').eq('family_id', familyId).limit(4),
    supabase.from('fridge_items').select('id, food_name, created_at').eq('family_id', familyId).eq('is_consumed', false).order('created_at', { ascending: false }).limit(4),
  ]);

  // 일정 오늘 발생
  const choreList = ((choresRes.data ?? []) as Chore[]).filter(c => c.created_at);
  const todayOccs = generateOccurrences(choreList, today, today);
  const todayChores = todayOccs.map(o => ({
    title: o.chore.title,
    assignee: (o.chore as any).assignee?.nickname ?? null,
  }));
  const todayDone = todayOccs.filter(o => o.isDone).length;

  // 생필품
  const stockItems: StockItem[] = (suppliesRes.data ?? []).map(s => ({
    name: s.name,
    qty: s.quantity,
    min_qty: s.low_stock_threshold ?? 1,
  }));
  const lowStockCount = stockItems.filter(s => s.qty <= s.min_qty).length;

  // 메모
  const recentNotes: NoteItem[] = (notesRes.data ?? []).map(n => ({
    id: n.id,
    title: n.title ?? '(제목 없음)',
  }));

  // 구성원
  const members: Member[] = (membersRes.data ?? []).map(m => ({
    id: m.id,
    nickname: m.nickname ?? '?',
  }));

  // 긴급 항목
  const urgentItems: UrgentItem[] = [];
  for (const item of (fridgeExpItemsRes.data ?? [])) {
    const diff = Math.ceil((new Date(item.expiry_date).getTime() - new Date(today).getTime()) / 86400000);
    if (diff < 0) urgentItems.push({ name: item.food_name, type: 'expired', dday: `D+${Math.abs(diff)}` });
    else urgentItems.push({ name: item.food_name, type: 'expiring', dday: diff === 0 ? 'D-day' : `D-${diff}` });
  }
  for (const s of stockItems.filter(s => s.qty <= s.min_qty).slice(0, 3)) {
    urgentItems.push({ name: s.name, type: 'lowstock' });
  }
  for (const o of todayOccs.filter(o => !o.isDone).slice(0, 2)) {
    urgentItems.push({ name: o.chore.title, type: 'chore' });
  }

  // ── 최근 활동 피드 생성 ─────────────────────
  const allActivities: ActivityItem[] = [];

  // 음식 (최근 추가)
  for (const f of (recentFridgeRes.data ?? []) as any[]) {
    allActivities.push({ id: f.id, type: 'food', action: '추가됨', name: f.food_name, timestamp: f.created_at, emoji: '🥬' });
  }

  // 일정 (최근 추가, choreList에서)
  const sortedChores = [...choreList]
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
    .slice(0, 4);
  for (const c of sortedChores) {
    allActivities.push({ id: c.id, type: 'chore', action: '추가됨', name: c.title, timestamp: c.created_at!, emoji: '📅' });
  }

  // 생필품 (최근 추가)
  const sortedSupplies = [...(suppliesRes.data ?? [] as any[])]
    .filter((s: any) => s.created_at)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);
  for (const s of sortedSupplies) {
    allActivities.push({ id: s.id ?? s.name, type: 'supply', action: '추가됨', name: s.name, timestamp: s.created_at, emoji: '🧴' });
  }

  // 메모 (최근 작성/수정)
  for (const n of (notesRes.data ?? [] as any[])) {
    if (n.updated_at) {
      allActivities.push({ id: n.id, type: 'note', action: '작성/수정됨', name: n.title ?? '(제목 없음)', timestamp: n.updated_at, emoji: '📝' });
    }
  }

  const activities = allActivities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  return {
    fridgeTotal: fridgeTotalRes.count ?? 0,
    fridgeExpiring: fridgeExpiringRes.count ?? 0,
    fridgeExpired: fridgeExpiredRes.count ?? 0,
    todayChores, todayDone, todayTotal: todayOccs.length,
    stockItems, lowStockCount,
    recentNotes, urgentItems, members, activities,
  };
}

// ── 서브 컴포넌트들 ───────────────────────────

// 도토리 로고 (SVG)
function AcornMark({ size = 26, color = C.brown }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path d="M5 11c0-1 1-2 2-2h14c1 0 2 1 2 2 0 1-1 2-2 2H7c-1 0-2-1-2-2z" fill={color} />
      <Path d="M7 13h14c0 5-3 11-7 11s-7-6-7-11z" fill={color} fillOpacity={0.55} />
      <Path d="M14 4v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

// 긴급 알림 pill
function FocusPill({ item }: { item: UrgentItem }) {
  const isExpired  = item.type === 'expired';
  const isLow      = item.type === 'lowstock';
  const isDanger   = isExpired || isLow;
  const isChore    = item.type === 'chore';
  const bg    = isDanger ? '#FDECEA' : isChore ? '#F3E7D2' : '#FCF2E0';
  const fg    = isDanger ? C.danger  : isChore ? C.deep    : '#B67628';
  const dotBg = isDanger ? C.danger  : isChore ? C.brown   : C.warn;

  return (
    <View style={[pillStyles.wrap, { backgroundColor: bg }]}>
      <View style={[pillStyles.dot, { backgroundColor: dotBg }]}>
        <Text style={pillStyles.dotIcon}>{isDanger ? '!' : isChore ? '✓' : '~'}</Text>
      </View>
      <View>
        <Text style={[pillStyles.name, { color: fg }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[pillStyles.sub, { color: fg }]}>
          {isExpired ? '기한 초과' : isLow ? '재고 부족' : isChore ? '오늘' : item.dday}
        </Text>
      </View>
    </View>
  );
}
const pillStyles = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 5, paddingRight: 10, paddingVertical: 5, borderRadius: 20, marginRight: 8 },
  dot:     { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dotIcon: { color: '#fff', fontSize: 11, fontWeight: '800' },
  name:    { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  sub:     { fontSize: 9, fontWeight: '500', opacity: 0.75 },
});

// 미니 위젯 (음식, 생필품 등)
function MiniWidget({
  accentColor, title, icon, children,
}: {
  accentColor: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={widgetStyles.card}>
      <View style={[widgetStyles.header, { backgroundColor: accentColor }]}>
        {icon}
        <Text style={widgetStyles.headerTitle}>{title}</Text>
      </View>
      <View style={widgetStyles.body}>{children}</View>
    </View>
  );
}
const widgetStyles = StyleSheet.create({
  card:        { backgroundColor: C.ivory, borderRadius: 14, overflow: 'hidden', flex: 1, shadowColor: C.brown, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 7 },
  headerTitle: { fontSize: 11, fontWeight: '700', color: '#fff', flex: 1 },
  body:        { padding: 10, minHeight: 68 },
});

// 재고 바
function StockBar({ item }: { item: StockItem }) {
  const maxLevel = Math.max(item.min_qty * 3, 1);
  const level = Math.min(item.qty / maxLevel, 1);
  const critical = item.qty <= item.min_qty;
  return (
    <View style={{ marginBottom: 5 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ fontSize: 10, color: C.dark, fontWeight: '500' }} numberOfLines={1}>{item.name}</Text>
        <Text style={{ fontSize: 10, fontWeight: '700', color: critical ? C.danger : C.warmOak }}>
          {item.qty === 0 ? '0' : `${item.qty}`}
        </Text>
      </View>
      <View style={{ height: 3, backgroundColor: C.edge + '88', borderRadius: 2 }}>
        <View style={{ width: `${Math.max(level * 100, 4)}%`, height: 3, backgroundColor: critical ? C.danger : C.warn, borderRadius: 2 }} />
      </View>
    </View>
  );
}

// ── 최근 활동 섹션 ────────────────────────────
function RecentActivitySection({ items }: { items: ActivityItem[] }) {
  return (
    <View style={actStyles.card}>
      <View style={actStyles.header}>
        <AcornMark size={16} />
        <Text style={actStyles.title}>최근 활동</Text>
      </View>
      {items.length === 0 ? (
        <Text style={actStyles.empty}>최근 변경 내역이 없어요</Text>
      ) : (
        items.map((item, i) => (
          <View key={`${item.type}-${item.id}-${i}`} style={[actStyles.row, i > 0 && actStyles.rowBorder]}>
            <Text style={actStyles.emoji}>{item.emoji}</Text>
            <Text style={actStyles.name} numberOfLines={1}>{item.name}</Text>
            <View style={actStyles.right}>
              <Text style={actStyles.action}>{item.action}</Text>
              <Text style={actStyles.time}>{relativeTime(item.timestamp)}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const actStyles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 10, backgroundColor: C.ivory, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.edge + '55', shadowColor: C.brown, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { fontSize: 12, fontWeight: '700', color: C.dark },
  empty: { fontSize: 12, color: C.lightOak, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.edge + '88' },
  emoji: { fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 },
  name: { fontSize: 12, fontWeight: '600', color: C.dark, flex: 1 },
  right: { alignItems: 'flex-end', flexShrink: 0 },
  action: { fontSize: 11, fontWeight: '600', color: C.warmOak },
  time: { fontSize: 10, color: C.lightOak, marginTop: 1 },
});

// ── 메인 화면 ─────────────────────────────────

const DashboardScreen: React.FC = () => {
  const navigation = useNavigation<DashboardNav>();
  const isFocused = useIsFocused();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState('우리 가족');
  const [nickname, setNickname] = useState('');
  const [notifyDays, setNotifyDays] = useState(3);
  const [showSheet, setShowSheet] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [storedName, storedNick, storedDays] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_FAMILY_NAME),
        AsyncStorage.getItem(STORAGE_KEY_NICKNAME),
        AsyncStorage.getItem(STORAGE_KEY_NOTIFY_DAYS),
      ]);
      const days = storedDays ? parseInt(storedDays) : 3;
      setNotifyDays(days);
      if (storedNick) setNickname(storedNick);

      const familyId = await getOrCreateFamilyId();
      if (!familyId) { setLoading(false); setRefreshing(false); return; }

      // 가족명 + 내 닉네임 동기화
      const [familyRes, userRes] = await Promise.all([
        supabase.from('families').select('name').eq('id', familyId).single(),
        supabase.auth.getUser(),
      ]);
      if (familyRes.data) {
        setFamilyName(familyRes.data.name);
        await AsyncStorage.setItem(STORAGE_KEY_FAMILY_NAME, familyRes.data.name);
      } else if (storedName) {
        setFamilyName(storedName);
      }
      if (userRes.data.user) {
        const { data: prof } = await supabase.from('user_profiles').select('nickname').eq('id', userRes.data.user.id).single();
        if (prof?.nickname) {
          setNickname(prof.nickname);
          await AsyncStorage.setItem(STORAGE_KEY_NICKNAME, prof.nickname);
        }
      }

      const result = await fetchDashboard(familyId, days);
      setData(result);
    } catch (e) {
      setError('데이터를 불러오지 못했어요.');
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { if (isFocused) loadData(); }, [isFocused, loadData]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  // ── 날짜 텍스트 ──
  const now = new Date();
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = `${now.getMonth() + 1}월 ${now.getDate()}일 ${DOW[now.getDay()]}요일`;

  const urgentCount = data?.urgentItems.length ?? 0;

  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator size="large" color={C.brown} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.centered}>
        <TriangleAlert color={C.brown} size={48} strokeWidth={1.5} />
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={loadData}>
          <Text style={s.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brown} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── 헤더 ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <AcornMark size={24} />
            <Text style={s.appName}>도토리</Text>
            <View style={s.familyChip}>
              <Text style={s.familyChipText}>{familyName}</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Settings color={C.warmOak} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
            {/* 아바타 클러스터 */}
            <View style={s.avatarCluster}>
              {(data?.members ?? []).slice(0, 3).map((m, i) => (
                <View
                  key={m.id}
                  style={[s.avatar, { backgroundColor: i === 1 ? C.purple : C.brown, marginLeft: i > 0 ? -10 : 0, borderWidth: i > 0 ? 2 : 0 }]}
                >
                  <Text style={s.avatarText}>{m.nickname.charAt(0)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── 인사말 ── */}
        <View style={s.greeting}>
          <Text style={s.greetingDate}>{dateLabel}</Text>
          <Text style={s.greetingMain}>
            {nickname ? `${nickname}님, ` : ''}오늘 살펴볼 게{' '}
            <Text style={{ color: C.brown }}>{urgentCount}개</Text> 있어요
          </Text>
        </View>

        {/* ── 긴급 알림 strip ── */}
        {(data?.urgentItems.length ?? 0) > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.focusStrip}
          >
            {data!.urgentItems.map((item, i) => <FocusPill key={i} item={item} />)}
          </ScrollView>
        )}

        {/* ── 위젯 2x2 ── */}
        <View style={s.widgetRow}>
          {/* 음식 */}
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Fridge')} activeOpacity={0.85}>
            <MiniWidget accentColor={C.brown} title="음식" icon={<Text style={{ fontSize: 13 }}>🥬</Text>}>
              <Text style={s.widgetBigNum}>{data?.fridgeTotal ?? 0}</Text>
              <View style={s.widgetRow2}>
                <Text style={s.widgetStatLabel}>임박</Text>
                <Text style={[s.widgetStatVal, (data?.fridgeExpiring ?? 0) > 0 && { color: C.warn }]}>{data?.fridgeExpiring ?? 0}개</Text>
              </View>
              <View style={s.widgetRow2}>
                <Text style={s.widgetStatLabel}>초과</Text>
                <Text style={[s.widgetStatVal, (data?.fridgeExpired ?? 0) > 0 && { color: C.danger }]}>{data?.fridgeExpired ?? 0}개</Text>
              </View>
            </MiniWidget>
          </TouchableOpacity>

          {/* 일정 */}
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Chores')} activeOpacity={0.85}>
            <MiniWidget accentColor={C.warmOak} title="오늘 일정" icon={<Text style={{ fontSize: 13 }}>📅</Text>}>
              {(data?.todayChores.length ?? 0) === 0 ? (
                <Text style={s.widgetEmpty}>할 일 없음</Text>
              ) : (
                data!.todayChores.slice(0, 3).map((c, i) => (
                  <View key={i} style={s.choreRow}>
                    <View style={s.choreDot} />
                    <Text style={s.choreTitle} numberOfLines={1}>{c.title}</Text>
                    {c.assignee && (
                      <View style={[s.choreAvatar, { backgroundColor: i % 2 === 1 ? C.purple : C.brown }]}>
                        <Text style={s.choreAvatarText}>{c.assignee.charAt(0)}</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </MiniWidget>
          </TouchableOpacity>
        </View>

        <View style={[s.widgetRow, { marginTop: 10 }]}>
          {/* 생필품 */}
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Supplies')} activeOpacity={0.85}>
            <MiniWidget accentColor={C.deep} title="생필품" icon={<Text style={{ fontSize: 13 }}>🧴</Text>}>
              {(data?.stockItems.length ?? 0) === 0 ? (
                <Text style={s.widgetEmpty}>항목 없음</Text>
              ) : (
                data!.stockItems.slice(0, 3).map((item, i) => <StockBar key={i} item={item} />)
              )}
            </MiniWidget>
          </TouchableOpacity>

          {/* 메모 */}
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Notes')} activeOpacity={0.85}>
            <MiniWidget accentColor="#A07A5C" title="메모" icon={<Text style={{ fontSize: 13 }}>📝</Text>}>
              {(data?.recentNotes.length ?? 0) === 0 ? (
                <Text style={s.widgetEmpty}>메모 없음</Text>
              ) : (
                data!.recentNotes.map((n, i) => (
                  <View key={n.id} style={s.noteRow}>
                    <Text style={s.noteEmoji}>📝</Text>
                    <Text style={s.noteTitle} numberOfLines={1}>{n.title || '(제목 없음)'}</Text>
                  </View>
                ))
              )}
            </MiniWidget>
          </TouchableOpacity>
        </View>

        {/* ── 최근 활동 피드 ── */}
        <RecentActivitySection items={data?.activities ?? []} />
      </ScrollView>

      {/* ── 계정 시트 ── */}
      <Modal visible={showSheet} transparent animationType="slide">
        <Pressable style={sheet.overlay} onPress={() => setShowSheet(false)}>
          <Pressable style={sheet.body} onPress={() => {}}>
            <View style={sheet.handle} />
            <View style={sheet.row}>
              <View style={sheet.iconBox}><Users color={C.brown} size={20} strokeWidth={1.5} /></View>
              <View>
                <Text style={sheet.rowLabel}>속한 가족</Text>
                <Text style={sheet.rowVal}>{familyName}</Text>
              </View>
            </View>
            <View style={sheet.row}>
              <View style={sheet.iconBox}><CircleUser color={C.brown} size={20} strokeWidth={1.5} /></View>
              <View>
                <Text style={sheet.rowLabel}>닉네임</Text>
                <Text style={sheet.rowVal}>{nickname || '미설정'}</Text>
              </View>
            </View>
            <View style={sheet.divider} />
            <TouchableOpacity style={sheet.settingsBtn} onPress={() => { setShowSheet(false); navigation.navigate('Settings'); }}>
              <Settings color={C.brown} size={18} strokeWidth={1.5} />
              <Text style={sheet.settingsBtnText}>설정</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

// ── 스타일 ────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.cream },
  centered:{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream },
  errorText: { fontSize: 14, color: C.brown, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  retryBtn:  { backgroundColor: C.brown, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // 헤더
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appName:     { fontSize: 20, fontWeight: '800', color: C.dark, letterSpacing: -0.5 },
  familyChip:  { backgroundColor: C.ivory, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: C.edge + '66' },
  familyChipText: { fontSize: 10, fontWeight: '600', color: C.lightOak },
  avatarCluster: { flexDirection: 'row', alignItems: 'center' },
  avatar:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderColor: '#fff' },
  avatarText:  { color: '#fff', fontSize: 11, fontWeight: '700' },

  // 인사말
  greeting:     { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 },
  greetingDate: { fontSize: 11, color: C.lightOak, fontWeight: '600' },
  greetingMain: { fontSize: 20, fontWeight: '800', color: C.dark, marginTop: 2, letterSpacing: -0.4 },

  // 긴급 strip
  focusStrip: { paddingHorizontal: 16, paddingBottom: 10 },

  // 위젯
  widgetRow:    { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  widgetBigNum: { fontSize: 20, fontWeight: '800', color: C.dark, lineHeight: 22, marginBottom: 4 },
  widgetRow2:   { flexDirection: 'row', justifyContent: 'space-between' },
  widgetStatLabel: { fontSize: 10, color: C.warmOak },
  widgetStatVal:   { fontSize: 10, fontWeight: '700', color: C.dark },
  widgetEmpty:  { fontSize: 11, color: C.lightOak, fontStyle: 'italic', marginTop: 4 },

  // 일정 위젯
  choreRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  choreDot:      { width: 10, height: 10, borderRadius: 3, borderWidth: 1.5, borderColor: C.lightOak },
  choreTitle:    { fontSize: 11, color: C.dark, fontWeight: '500', flex: 1 },
  choreAvatar:   { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  choreAvatarText: { color: '#fff', fontSize: 8, fontWeight: '700' },

  // 메모 위젯
  noteRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  noteEmoji: { fontSize: 11 },
  noteTitle: { fontSize: 11, color: C.dark, fontWeight: '500', flex: 1 },
  notePinned:{ fontSize: 8 },

  // 인사이트 카드
  insightCard: { marginHorizontal: 16, marginTop: 10, backgroundColor: '#F3E7D2', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.edge, borderStyle: 'dashed' },
  insightIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.ivory, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  insightText: { flex: 1, fontSize: 11, color: C.dark, lineHeight: 16 },
});

const sheet = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  body:       { backgroundColor: C.ivory, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  handle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: C.edge, alignSelf: 'center', marginBottom: 24 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  iconBox:    { width: 40, height: 40, borderRadius: 20, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  rowLabel:   { fontSize: 11, color: C.brown, fontWeight: '600', marginBottom: 2 },
  rowVal:     { fontSize: 17, color: C.dark, fontWeight: '700' },
  divider:    { height: 1, backgroundColor: C.edge, marginBottom: 18 },
  settingsBtn:{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  settingsBtnText: { fontSize: 15, color: C.brown, fontWeight: '600' },
});

export default DashboardScreen;
