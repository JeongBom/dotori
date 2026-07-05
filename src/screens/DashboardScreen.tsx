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
import { RootTabParamList, RootStackParamList } from '../navigation';
import { STORAGE_KEY_FAMILY_NAME, STORAGE_KEY_NICKNAME, STORAGE_KEY_NOTIFY_DAYS } from './SettingsScreen';
import { theme } from '../theme';
import { fetchDashboard, DashboardData, UrgentItem, StockItem, ActivityItem } from '../lib/dashboard';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

const REALTIME_TABLES = ['fridge_items', 'supplies', 'shopping_items', 'notes'] as const;

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

// ── 서브 컴포넌트들 ───────────────────────────

// 도토리 로고 (SVG)
function AcornMark({ size = 26, color = theme.colors.brand }: { size?: number; color?: string }) {
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
  const isExpired = item.type === 'expired';
  const isLow     = item.type === 'lowstock';
  const isDanger  = isExpired || isLow;
  const bg    = isDanger ? theme.colors.alert.dangerBg : theme.colors.alert.warnBg;
  const fg    = isDanger ? theme.colors.status.danger  : theme.colors.alert.warnFg;
  const dotBg = isDanger ? theme.colors.status.danger  : theme.colors.status.warn;

  return (
    <View style={[pillStyles.wrap, { backgroundColor: bg }]}>
      <View style={[pillStyles.dot, { backgroundColor: dotBg }]}>
        <Text style={pillStyles.dotIcon}>{isDanger ? '!' : '~'}</Text>
      </View>
      <View>
        <Text style={[pillStyles.name, { color: fg }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[pillStyles.sub, { color: fg }]}>
          {isExpired ? '기한 초과' : isLow ? '재고 부족' : item.dday}
        </Text>
      </View>
    </View>
  );
}
const pillStyles = StyleSheet.create({
  wrap:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 5, paddingRight: 10, paddingVertical: 5, borderRadius: 20, marginRight: 8 },
  dot:     { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dotIcon: { color: '#fff', fontSize: 11, fontWeight: '700' },
  name:    { fontSize: 11, fontWeight: '700', lineHeight: 14 },
  sub:     { fontSize: 9, fontWeight: '500', opacity: 0.75 },
});

// 미니 위젯 (음식, 생필품 등)
function MiniWidget({
  accentColor, title, icon, children, bodyStyle,
}: {
  accentColor: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  bodyStyle?: object;   // 직사각형 위젯 등 높이/여백 변형용
}) {
  return (
    <View style={widgetStyles.card}>
      <View style={[widgetStyles.header, { backgroundColor: accentColor }]}>
        {icon}
        <Text style={widgetStyles.headerTitle}>{title}</Text>
      </View>
      <View style={[widgetStyles.body, bodyStyle]}>{children}</View>
    </View>
  );
}
const widgetStyles = StyleSheet.create({
  card:        { backgroundColor: theme.colors.warm.ivory, borderRadius: 14, overflow: 'hidden', flex: 1, shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
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
    <View style={{ marginBottom: 9 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 13, color: theme.colors.warm.dark, fontWeight: '600', lineHeight: 18, flex: 1 }} numberOfLines={1}>{item.name}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: critical ? theme.colors.status.danger : theme.colors.warm.oak }}>
          {item.qty === 0 ? '0' : `${item.qty}`}
        </Text>
      </View>
      <View style={{ height: 4, backgroundColor: `${theme.colors.warm.edge}88`, borderRadius: 2 }}>
        <View style={{ width: `${Math.max(level * 100, 4)}%`, height: 4, backgroundColor: critical ? theme.colors.status.danger : theme.colors.status.warn, borderRadius: 2 }} />
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
  card:      { marginHorizontal: 16, marginTop: 10, backgroundColor: theme.colors.warm.ivory, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: `${theme.colors.warm.edge}55`, shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title:     { fontSize: 12, fontWeight: '700', color: theme.colors.warm.dark },
  empty:     { fontSize: 12, color: theme.colors.warm.lightOak, fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${theme.colors.warm.edge}88` },
  emoji:     { fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 },
  name:      { fontSize: 12, fontWeight: '600', color: theme.colors.warm.dark, flex: 1 },
  right:     { alignItems: 'flex-end', flexShrink: 0 },
  action:    { fontSize: 11, fontWeight: '600', color: theme.colors.warm.oak },
  time:      { fontSize: 10, color: theme.colors.warm.lightOak, marginTop: 1 },
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
  useRealtimeRefresh(REALTIME_TABLES, loadData); // 가족이 바꾸면 즉시 갱신

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const now = new Date();
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = `${now.getMonth() + 1}월 ${now.getDate()}일 ${DOW[now.getDay()]}요일`;

  const urgentCount = data?.urgentItems.length ?? 0;

  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={s.centered}>
        <TriangleAlert color={theme.colors.brand} size={48} strokeWidth={1.5} />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.brand} />}
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
              <Settings color={theme.colors.warm.oak} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
            {/* 아바타 클러스터 */}
            <View style={s.avatarCluster}>
              {(data?.members ?? []).slice(0, 3).map((m, i) => (
                <View
                  key={m.id}
                  style={[s.avatar, { backgroundColor: i === 1 ? theme.colors.purple : theme.colors.brand, marginLeft: i > 0 ? -10 : 0, borderWidth: i > 0 ? 2 : 0 }]}
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
            <Text style={{ color: theme.colors.brand }}>{urgentCount}개</Text> 있어요
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

        {/* ── 위젯 ── */}
        <View style={s.widgetRow}>
          {/* 음식 */}
          <TouchableOpacity style={s.squareWidget} onPress={() => navigation.navigate('Fridge')} activeOpacity={0.85}>
            <MiniWidget accentColor={theme.colors.brand} title="음식" icon={<Text style={{ fontSize: 13 }}>🥬</Text>}>
              <Text style={s.widgetBigNum}>{data?.fridgeTotal ?? 0}</Text>
              <View style={s.widgetRow2}>
                <Text style={s.widgetStatLabel}>임박</Text>
                <Text style={[s.widgetStatVal, (data?.fridgeExpiring ?? 0) > 0 && { color: theme.colors.status.warn }]}>{data?.fridgeExpiring ?? 0}개</Text>
              </View>
              <View style={s.widgetRow2}>
                <Text style={s.widgetStatLabel}>초과</Text>
                <Text style={[s.widgetStatVal, (data?.fridgeExpired ?? 0) > 0 && { color: theme.colors.status.danger }]}>{data?.fridgeExpired ?? 0}개</Text>
              </View>
            </MiniWidget>
          </TouchableOpacity>

          {/* 장보기 (정사각형) */}
          <TouchableOpacity style={s.squareWidget} onPress={() => navigation.navigate('Shopping')} activeOpacity={0.85}>
            <MiniWidget accentColor={theme.colors.warm.honey} title="장보기" icon={<Text style={{ fontSize: 13 }}>🛒</Text>}>
              {(data?.shoppingTodo.length ?? 0) === 0 ? (
                <Text style={s.widgetEmpty}>살 것 없음</Text>
              ) : (
                <>
                  {data!.shoppingTodo.map(item => (
                    <View key={item.id} style={s.noteRow}>
                      <Text style={s.noteEmoji}>🛒</Text>
                      <Text style={s.noteTitle} numberOfLines={1}>{item.name}</Text>
                      {item.store_tag ? <Text style={s.shopTag}>{item.store_tag}</Text> : null}
                    </View>
                  ))}
                  {data!.shoppingTodoCount > data!.shoppingTodo.length && (
                    <Text style={s.shopMore}>외 {data!.shoppingTodoCount - data!.shoppingTodo.length}개 더 있어요</Text>
                  )}
                </>
              )}
            </MiniWidget>
          </TouchableOpacity>
        </View>

        {/* ── 생필품 (직사각형, 메모 위) ── */}
        <View style={[s.widgetRow, { marginTop: 10 }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Supplies')} activeOpacity={0.85}>
            <MiniWidget accentColor={theme.colors.warm.deep} title="생필품" icon={<Text style={{ fontSize: 13 }}>🧴</Text>} bodyStyle={s.rectBody}>
              {(data?.stockItems.length ?? 0) === 0 ? (
                <Text style={s.widgetEmpty}>항목 없음</Text>
              ) : (
                data!.stockItems.slice(0, 3).map((item, i) => <StockBar key={i} item={item} />)
              )}
            </MiniWidget>
          </TouchableOpacity>
        </View>

        <View style={[s.widgetRow, { marginTop: 10 }]}>
          {/* 메모 */}
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Notes')} activeOpacity={0.85}>
            <MiniWidget accentColor={theme.colors.warm.oak} title="메모" icon={<Text style={{ fontSize: 13 }}>📝</Text>} bodyStyle={s.rectBody}>
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
              <View style={sheet.iconBox}><Users color={theme.colors.brand} size={20} strokeWidth={1.5} /></View>
              <View>
                <Text style={sheet.rowLabel}>속한 가족</Text>
                <Text style={sheet.rowVal}>{familyName}</Text>
              </View>
            </View>
            <View style={sheet.row}>
              <View style={sheet.iconBox}><CircleUser color={theme.colors.brand} size={20} strokeWidth={1.5} /></View>
              <View>
                <Text style={sheet.rowLabel}>닉네임</Text>
                <Text style={sheet.rowVal}>{nickname || '미설정'}</Text>
              </View>
            </View>
            <View style={sheet.divider} />
            <TouchableOpacity style={sheet.settingsBtn} onPress={() => { setShowSheet(false); navigation.navigate('Settings'); }}>
              <Settings color={theme.colors.brand} size={18} strokeWidth={1.5} />
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
  safe:      { flex: 1, backgroundColor: theme.colors.warm.cream },
  centered:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.warm.cream },
  errorText: { fontSize: 14, color: theme.colors.brand, textAlign: 'center', marginTop: 12, marginBottom: 20 },
  retryBtn:  { backgroundColor: theme.colors.brand, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  // 헤더
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerRight:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appName:        { fontSize: 20, fontWeight: '700', color: theme.colors.warm.dark, letterSpacing: -0.5 },
  familyChip:     { backgroundColor: theme.colors.warm.ivory, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: `${theme.colors.warm.edge}66` },
  familyChipText: { fontSize: 10, fontWeight: '600', color: theme.colors.warm.lightOak },
  avatarCluster:  { flexDirection: 'row', alignItems: 'center' },
  avatar:         { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderColor: '#fff' },
  avatarText:     { color: '#fff', fontSize: 11, fontWeight: '700' },

  // 인사말
  greeting:     { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 },
  greetingDate: { fontSize: 11, color: theme.colors.warm.lightOak, fontWeight: '600' },
  greetingMain: { fontSize: 20, fontWeight: '700', color: theme.colors.warm.dark, marginTop: 2, letterSpacing: -0.4 },

  // 긴급 strip
  focusStrip: { paddingHorizontal: 16, paddingBottom: 10 },

  // 위젯
  widgetRow:       { flexDirection: 'row', paddingHorizontal: 16, gap: 10 },
  squareWidget:    { flex: 1, aspectRatio: 1 },
  widgetBigNum:    { fontSize: 24, fontWeight: '700', color: theme.colors.warm.dark, lineHeight: 28, marginBottom: 8 },
  widgetRow2:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  widgetStatLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.warm.oak, lineHeight: 18 },
  widgetStatVal:   { fontSize: 15, fontWeight: '700', color: theme.colors.warm.dark, lineHeight: 20 },
  widgetEmpty:     { fontSize: 11, color: theme.colors.warm.lightOak, fontStyle: 'italic', marginTop: 4 },

  // 직사각형 위젯 (장보기·메모) — 높이 키우고 행간 여유
  rectBody:  { minHeight: 104, paddingVertical: 14, paddingHorizontal: 14 },

  // 메모 위젯
  noteRow:   { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  noteEmoji: { fontSize: 13 },
  noteTitle: { fontSize: 13, color: theme.colors.warm.dark, fontWeight: '600', lineHeight: 19, flex: 1 },
  notePinned:{ fontSize: 8 },

  // 장보기 위젯
  shopTag:  { fontSize: 10, fontWeight: '400', color: theme.colors.warm.lightOak, flexShrink: 0 },
  shopMore: { fontSize: 11, color: theme.colors.warm.lightOak, lineHeight: 16, marginTop: 2 },

  // 인사이트 카드
  insightCard: { marginHorizontal: 16, marginTop: 10, backgroundColor: theme.colors.warm.sand, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.colors.warm.edge, borderStyle: 'dashed' },
  insightIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.warm.ivory, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  insightText: { flex: 1, fontSize: 11, color: theme.colors.warm.dark, lineHeight: 16 },
});

const sheet = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  body:            { backgroundColor: theme.colors.warm.ivory, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  handle:          { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.warm.edge, alignSelf: 'center', marginBottom: 24 },
  row:             { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  iconBox:         { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.warm.cream, alignItems: 'center', justifyContent: 'center' },
  rowLabel:        { fontSize: 11, color: theme.colors.brand, fontWeight: '600', marginBottom: 2 },
  rowVal:          { fontSize: 17, color: theme.colors.warm.dark, fontWeight: '700' },
  divider:         { height: 1, backgroundColor: theme.colors.warm.edge, marginBottom: 18 },
  settingsBtn:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  settingsBtnText: { fontSize: 15, color: theme.colors.brand, fontWeight: '600' },
});

export default DashboardScreen;
