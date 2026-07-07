// 음식 화면 — 새 디자인 (도토리 v2)
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity, Pressable,
  ActivityIndicator, Alert, ScrollView, TextInput, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import { Plus, ReceiptText, ListChecks } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { FridgeItem } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';
import { cancelExpiryNotification } from '../lib/notifications';
import { autoAddToShopping } from '../lib/shopping';
import IconBtn from '../components/IconBtn';
import SectionLabel from '../components/SectionLabel';
import SwipeDeleteAction from '../components/SwipeDeleteAction';
import SelectionBar from '../components/SelectionBar';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useIsDesktopWeb } from '../hooks/useIsDesktopWeb';
import { chunkPairs } from '../lib/utils';

const REALTIME_TABLES = ['fridge_items'] as const;
import { theme } from '../theme';

type FridgeNav = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Fridge'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type FilterType = '전체' | '냉장' | '냉동' | '실온' | '먹은 음식';
type SortType   = '유통기한' | '이름' | '구입날짜';
type SectionKey = '기한 지남' | '임박' | '여유' | '기한없음' | '먹은 음식';

// ── D-day 계산 ────────────────────────────────
function getDDay(expiryDate: string | null): { label: string; color: string; status: 'expired' | 'soon' | 'ok' | 'none' } {
  if (!expiryDate) return { label: '기한없음', color: theme.colors.warm.lightOak, status: 'none' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
  const diff = Math.round((expiry.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, color: theme.colors.status.danger, status: 'expired' };
  if (diff === 0) return { label: 'D-day', color: theme.colors.status.danger, status: 'soon' };
  if (diff <= 3)  return { label: `D-${diff}`,  color: theme.colors.status.danger, status: 'soon' };
  if (diff <= 7)  return { label: `D-${diff}`,  color: theme.colors.status.warn,   status: 'soon' };
  return { label: `D-${diff}`, color: theme.colors.brand, status: 'ok' };
}

function sortItems(items: FridgeItem[], sort: SortType): FridgeItem[] {
  return [...items].sort((a, b) => {
    if (sort === '이름') return a.name.localeCompare(b.name, 'ko');
    if (sort === '구입날짜') return b.stored_date.localeCompare(a.stored_date);
    if (!a.expiry_date && !b.expiry_date) return 0;
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return a.expiry_date.localeCompare(b.expiry_date);
  });
}

// ── StatBlock ─────────────────────────────────
function StatBlock({ primary, label, sub, color }: { primary: string | number; label: string; sub: string; color: string }) {
  return (
    <View style={sb.card}>
      <View style={sb.top}>
        <Text style={[sb.primary, { color }]}>{primary}</Text>
        <Text style={sb.label}>{label}</Text>
      </View>
      <Text style={sb.sub}>{sub}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  card:    { flex: 1, backgroundColor: theme.colors.warm.ivory, borderRadius: 14, padding: 12, shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  top:     { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 3 },
  primary: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, lineHeight: 26 },
  label:   { fontSize: 10, color: theme.colors.warm.oak, fontWeight: '600' },
  sub:     { fontSize: 10, color: theme.colors.warm.lightOak, fontWeight: '500' },
});

// ── FoodRow ───────────────────────────────────
interface FoodRowProps {
  item: FridgeItem;
  onToggle: (item: FridgeItem) => void;
  onDelete: (item: FridgeItem) => void;
  onQtyChange: (item: FridgeItem, delta: number) => void;
  onEdit: (item: FridgeItem) => void;
  // 다중 선택 모드
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: (item: FridgeItem) => void;
}

const FoodRow: React.FC<FoodRowProps> = React.memo(({ item, onToggle, onDelete, onQtyChange, onEdit, selectMode, selected, onSelect }) => {
  const swipeRef = useRef<Swipeable>(null);
  const dday = getDDay(item.expiry_date);
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(item.quantity ?? 1));

  const storageStyle = item.storage_type === '냉동'
    ? theme.colors.storage.frozen
    : item.storage_type === '실온'
      ? theme.colors.storage.roomTemp
      : theme.colors.storage.fridge;

  const handleDelete = () => {
    swipeRef.current?.close();
    Alert.alert('삭제 확인', `'${item.name}'을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(item) },
    ]);
  };

  const commitQty = () => {
    setEditingQty(false);
    const parsed = parseInt(qtyInput);
    if (!isNaN(parsed) && parsed > 0 && parsed !== (item.quantity ?? 1)) {
      onQtyChange(item, parsed - (item.quantity ?? 1));
    } else if (!isNaN(parsed) && parsed <= 0) {
      onQtyChange(item, -(item.quantity ?? 1));
    }
  };

  return (
    <Swipeable ref={swipeRef} enabled={!selectMode} renderRightActions={() => <SwipeDeleteAction onDelete={handleDelete} />} overshootRight={false}>
      <TouchableOpacity
        style={[fr.card, item.is_consumed && fr.cardDone, selected && fr.cardSelected]}
        onPress={() => onEdit(item)}
        activeOpacity={0.8}
      >
        {/* 체크박스 (생필품의 이모지 자리) — 다 먹음 토글 */}
        <TouchableOpacity
          style={[fr.checkBox, item.is_consumed && fr.checkBoxDone]}
          onPress={() => onToggle(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
        >
          {item.is_consumed && (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </TouchableOpacity>

        {/* 정보 */}
        <View style={fr.body}>
          <View style={fr.nameRow}>
            <Text style={[fr.name, item.is_consumed && fr.nameDone]} numberOfLines={1}>{item.name}</Text>
            <View style={[fr.chip, { backgroundColor: storageStyle.bg }]}>
              <Text style={[fr.chipText, { color: storageStyle.fg }]}>{item.storage_type}</Text>
            </View>
          </View>
          <View style={fr.bottomRow}>
            <Text style={fr.date}>구입일 {item.stored_date.slice(5).replace('-', '.')}</Text>
            {item.is_consumed
              ? <Text style={fr.consumedAt}>{item.consumed_at?.slice(5).replace('-', '.') ?? ''} 먹음</Text>
              : <Text style={[fr.dday, { color: dday.color }]}>{dday.label}</Text>}
          </View>
        </View>

        {/* 수량 스텝퍼(가로) — 이 영역 터치는 수정으로 안 빠지고 +/-만 동작 */}
        {!item.is_consumed && (
          <Pressable style={fr.stepper} onPress={() => {}}>
            <TouchableOpacity
              onPress={() => onQtyChange(item, -1)}
              style={fr.stepBtnMinus}
              hitSlop={{ top: 12, bottom: 12, left: 10, right: 4 }}
            >
              <Text style={fr.stepMinusText}>−</Text>
            </TouchableOpacity>
            {editingQty ? (
              <TextInput
                style={fr.qtyInput}
                value={qtyInput}
                onChangeText={setQtyInput}
                keyboardType="number-pad"
                onBlur={commitQty}
                onSubmitEditing={commitQty}
                autoFocus
                selectTextOnFocus
                maxLength={4}
              />
            ) : (
              <TouchableOpacity onPress={() => { setQtyInput(String(item.quantity ?? 1)); setEditingQty(true); }}>
                <Text style={fr.qtyNum}>{item.quantity ?? 1}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => onQtyChange(item, 1)}
              style={fr.stepBtnPlus}
              hitSlop={{ top: 12, bottom: 12, left: 4, right: 10 }}
            >
              <Text style={fr.stepPlusText}>+</Text>
            </TouchableOpacity>
          </Pressable>
        )}

        {/* 선택 모드: 카드 전체 터치를 선택 토글로 가로챔 */}
        {selectMode && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onSelect?.(item)} />
        )}
      </TouchableOpacity>
    </Swipeable>
  );
});

// 생필품 행(SupplyRow)과 동일한 규격
const fr = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.warm.ivory, marginHorizontal: 16, marginBottom: 6,
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8,
    shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardDone: { opacity: 0.55 },
  cardSelected: { borderWidth: 1.5, borderColor: theme.colors.brand },
  checkBox: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: theme.colors.warm.cream,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkBoxDone: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  name: { fontSize: 13, fontWeight: '700', color: theme.colors.warm.dark, flex: 1 },
  nameDone: { color: theme.colors.warm.lightOak, textDecorationLine: 'line-through' },
  chip: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  chipText: { fontSize: 9, fontWeight: '700', lineHeight: 12 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 10, color: theme.colors.warm.lightOak },
  dday: { fontSize: 10, fontWeight: '700' },
  consumedAt: { fontSize: 10, color: theme.colors.warm.lightOak },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, paddingLeft: 8 },
  stepBtnPlus: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.colors.brand, justifyContent: 'center', alignItems: 'center',
  },
  stepPlusText: { fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 17 },
  stepBtnMinus: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.colors.warm.edge, justifyContent: 'center', alignItems: 'center',
  },
  stepMinusText: { fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, lineHeight: 17 },
  qtyNum: { fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, minWidth: 18, textAlign: 'center' },
  qtyInput: {
    fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, textAlign: 'center',
    minWidth: 28, borderBottomWidth: 1.5, borderBottomColor: theme.colors.brand,
    paddingHorizontal: 2, paddingVertical: 0,
  },
});

// ── 메인 화면 ─────────────────────────────────

const FridgeScreen: React.FC = () => {
  const navigation = useNavigation<FridgeNav>();
  const isFocused = useIsFocused();
  const isDesktop = useIsDesktopWeb(); // 데스크톱 웹: 2열 그리드

  const [items, setItems] = useState<FridgeItem[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('전체');
  const [sort, setSort] = useState<SortType>('유통기한');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadItems = useCallback(async () => {
    try {
      const fid = await getOrCreateFamilyId();
      if (!fid) return;
      setFamilyId(fid);
      const { data, error } = await supabase.from('fridge_items').select('*').eq('family_id', fid).eq('is_active', true).order('created_at', { ascending: false });
      if (!error && data) setItems(data as FridgeItem[]);
    } catch (e) {
      console.error('FridgeScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { if (isFocused) loadItems(); }, [isFocused, loadItems]);
  useRealtimeRefresh(REALTIME_TABLES, loadItems); // 가족이 바꾸면 즉시 갱신

  const handleToggle = useCallback(async (item: FridgeItem) => {
    const next = !item.is_consumed;
    const today = new Date().toISOString().split('T')[0];
    const payload: Record<string, unknown> = { is_consumed: next, consumed_at: next ? today : null };
    if (!next) payload.quantity = 1;
    await supabase.from('fridge_items').update(payload).eq('id', item.id);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_consumed: next, consumed_at: next ? today : null, quantity: next ? i.quantity : 1 } : i));
    if (next) {
      await cancelExpiryNotification(item.id);
      // 다 먹음 처리 시 장보기 자동 추가 (품목 설정이 켜져 있을 때만)
      if (item.auto_add_to_shopping ?? true) {
        await autoAddToShopping(item.family_id, item.name, 'fridge', item.id, item.default_store_tag ?? '');
      }
    }
  }, []);

  const handleQtyChange = useCallback(async (item: FridgeItem, delta: number) => {
    const next = (item.quantity ?? 1) + delta;
    if (next <= 0) {
      const today = new Date().toISOString().split('T')[0];
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: 0, is_consumed: true, consumed_at: today } : i));
      await supabase.from('fridge_items').update({ quantity: 0, is_consumed: true, consumed_at: today }).eq('id', item.id);
      await cancelExpiryNotification(item.id);
      // 수량 0 도달 시 장보기 자동 추가 (품목 설정이 켜져 있을 때만)
      if (item.auto_add_to_shopping ?? true) {
        await autoAddToShopping(item.family_id, item.name, 'fridge', item.id, item.default_store_tag ?? '');
      }
    } else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: next } : i));
      await supabase.from('fridge_items').update({ quantity: next }).eq('id', item.id);
      // 기준 수량 이하로 떨어지는 순간 장보기 자동 추가 (0이면 위 0 도달 분기에서 처리)
      const th = item.low_stock_threshold ?? 0;
      if (th > 0 && next <= th && (item.quantity ?? 1) > th && (item.auto_add_to_shopping ?? true)) {
        await autoAddToShopping(item.family_id, item.name, 'fridge', item.id, item.default_store_tag ?? '');
      }
    }
  }, []);

  const handleDelete = useCallback(async (item: FridgeItem) => {
    await supabase.from('fridge_items').delete().eq('id', item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
    await cancelExpiryNotification(item.id);
  }, []);

  const handleEdit = useCallback((item: FridgeItem) => {
    navigation.navigate('AddFridgeItem', { itemId: item.id, familyId: familyId ?? undefined });
  }, [navigation, familyId]);

  // ── 통계 (non-consumed 기준) ──────────────────
  const activeItems  = items.filter(i => !i.is_consumed);
  const expiredCount = activeItems.filter(i => getDDay(i.expiry_date).status === 'expired').length;
  const soonCount    = activeItems.filter(i => getDDay(i.expiry_date).status === 'soon').length;

  // ── 섹션 데이터 구성 ──────────────────────────
  const sections = useMemo(() => {
    const filtered = items.filter(item => {
      if (filter === '먹은 음식') return item.is_consumed;
      if (filter === '냉장') return !item.is_consumed && item.storage_type === '냉장';
      if (filter === '냉동') return !item.is_consumed && item.storage_type === '냉동';
      if (filter === '실온') return !item.is_consumed && item.storage_type === '실온';
      return !item.is_consumed;
    });

    const sorted = sortItems(filtered, sort);

    if (filter === '먹은 음식' || sort !== '유통기한') {
      return [{ key: filter === '먹은 음식' ? '먹은 음식' as SectionKey : '여유' as SectionKey, data: sorted }];
    }

    const expired = sorted.filter(i => getDDay(i.expiry_date).status === 'expired');
    const soon    = sorted.filter(i => getDDay(i.expiry_date).status === 'soon');
    const ok      = sorted.filter(i => getDDay(i.expiry_date).status === 'ok');
    const none    = sorted.filter(i => getDDay(i.expiry_date).status === 'none');

    return [
      expired.length > 0 ? { key: '기한 지남' as SectionKey, data: expired } : null,
      soon.length    > 0 ? { key: '임박'     as SectionKey, data: soon    } : null,
      ok.length      > 0 ? { key: '여유'     as SectionKey, data: ok      } : null,
      none.length    > 0 ? { key: '기한없음' as SectionKey, data: none    } : null,
    ].filter(Boolean) as { key: SectionKey; data: FridgeItem[] }[];
  }, [items, filter, sort]);

  const totalDisplay = sections.reduce((s, sec) => s + sec.data.length, 0);
  const visibleItems = useMemo(() => sections.flatMap(sec => sec.data), [sections]);

  // ── 다중 선택 ─────────────────────────────────
  const exitSelectMode = useCallback(() => { setSelectMode(false); setSelectedIds([]); }, []);

  const handleSelect = useCallback((item: FridgeItem) => {
    setSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev => prev.length === visibleItems.length ? [] : visibleItems.map(i => i.id));
  }, [visibleItems]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    Alert.alert('선택 삭제', `${selectedIds.length}개 항목을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('fridge_items').delete().in('id', selectedIds);
          if (error) { Alert.alert('오류', `삭제에 실패했습니다.\n(${error.message})`); return; }
          await Promise.all(selectedIds.map(id => cancelExpiryNotification(id)));
          setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
          exitSelectMode();
        },
      },
    ]);
  }, [selectedIds, exitSelectMode]);

  const SECTION_COLORS: Record<SectionKey, string> = {
    '기한 지남': theme.colors.status.danger,
    '임박':      theme.colors.status.warn,
    '여유':      theme.colors.brand,
    '기한없음':  theme.colors.warm.lightOak,
    '먹은 음식': theme.colors.warm.lightOak,
  };
  const SORTS: SortType[] = ['유통기한', '이름', '구입날짜'];

  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </SafeAreaView>
    );
  }

  // 행 렌더러 (모바일 1열·데스크톱 2열 공용)
  const renderRow = (item: FridgeItem) => (
    <FoodRow
      item={item}
      onToggle={handleToggle}
      onDelete={handleDelete}
      onQtyChange={handleQtyChange}
      onEdit={handleEdit}
      selectMode={selectMode}
      selected={selectedIds.includes(item.id)}
      onSelect={handleSelect}
    />
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* ── 헤더 ── */}
      <View style={s.header}>
        <View>
          <Text style={s.subLabel}>우리 집 냉장고</Text>
          <Text style={s.title}>음식</Text>
        </View>
        <View style={s.headerBtns}>
          <IconBtn onPress={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
            <ListChecks color={selectMode ? theme.colors.brand : theme.colors.warm.dark} size={18} strokeWidth={1.5} />
          </IconBtn>
          <IconBtn onPress={() => navigation.navigate('ReceiptScan')}>
            <ReceiptText color={theme.colors.warm.dark} size={18} strokeWidth={1.5} />
          </IconBtn>
          <IconBtn onPress={() => setShowSortMenu(v => !v)}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M6 12h12M9 18h6" stroke={theme.colors.warm.dark} strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
          </IconBtn>
        </View>
      </View>

      {/* ── StatBlock 3개 ── */}
      <View style={s.statRow}>
        <StatBlock primary={activeItems.length} label="전체" sub="보관 중" color={theme.colors.brand} />
        <StatBlock primary={soonCount} label="임박" sub="D-3 이내" color={theme.colors.status.warn} />
        <StatBlock primary={expiredCount} label="초과" sub="D-day 넘음" color={theme.colors.status.danger} />
      </View>

      {/* ── 필터 탭 ── */}
      {Dimensions.get('window').width >= 768 ? (
        <View style={s.filterWrapTablet}>
          {(['전체', '냉장', '냉동', '실온', '먹은 음식'] as FilterType[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[s.filterTab, filter === f && s.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={s.filterScrollWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterWrap}>
            {(['전체', '냉장', '냉동', '실온', '먹은 음식'] as FilterType[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[s.filterTab, filter === f && s.filterTabActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── 정렬 바 ── */}
      <View style={s.sortBar}>
        <Text style={s.sortCount}>{totalDisplay}개 · {sort}순</Text>
        <TouchableOpacity style={s.sortBtn} onPress={() => setShowSortMenu(v => !v)}>
          <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
            <Path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3" stroke={theme.colors.warm.oak} strokeWidth={2} strokeLinecap="round" />
          </Svg>
          <Text style={s.sortBtnText}>{sort}순</Text>
        </TouchableOpacity>
        {showSortMenu && (
          <View style={s.sortMenu}>
            {SORTS.map(o => (
              <TouchableOpacity key={o} style={[s.sortItem, sort === o && s.sortItemActive]} onPress={() => { setSort(o); setShowSortMenu(false); }}>
                <Text style={[s.sortItemText, sort === o && s.sortItemTextActive]}>{o}순</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── 리스트 ── */}
      {totalDisplay === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>{filter === '먹은 음식' ? '다먹은 음식이 없어요' : '음식을 추가해 보세요 🍱'}</Text>
        </View>
      ) : isDesktop ? (
        // 데스크톱 웹: 2열 그리드
        <SectionList
          sections={sections.map(sec => ({ key: sec.key, count: sec.data.length, data: chunkPairs(sec.data) }))}
          keyExtractor={pair => pair[0].id}
          renderSectionHeader={({ section }) => (
            sort === '유통기한' && filter !== '먹은 음식'
              ? <SectionLabel label={section.key} count={section.count} color={SECTION_COLORS[section.key as SectionKey]} />
              : null
          )}
          renderItem={({ item: pair }) => (
            <View style={{ flexDirection: 'row' }}>
              {pair.map(item => (
                <View key={item.id} style={{ flex: 1 }}>{renderRow(item)}</View>
              ))}
              {pair.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          )}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section }) => (
            sort === '유통기한' && filter !== '먹은 음식'
              ? <SectionLabel label={section.key} count={section.data.length} color={SECTION_COLORS[section.key]} />
              : null
          )}
          renderItem={({ item }) => renderRow(item)}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* ── FAB (선택 모드에선 숨김) ── */}
      {!selectMode && (
        <TouchableOpacity
          style={s.fab}
          onPress={() => navigation.navigate('AddFridgeItem', { familyId: familyId ?? undefined })}
          activeOpacity={0.85}
        >
          <Plus color="#fff" size={24} strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* 다중 선택 하단 바 */}
      {selectMode && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={visibleItems.length > 0 && selectedIds.length === visibleItems.length}
          onSelectAll={handleSelectAll}
          onDelete={handleBulkDelete}
        />
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: theme.colors.warm.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.warm.cream },

  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  subLabel:   { fontSize: 11, color: theme.colors.warm.lightOak, fontWeight: '600' },
  title:      { fontSize: 24, fontWeight: '700', color: theme.colors.warm.dark, letterSpacing: -0.4, marginTop: 1 },
  headerBtns: { flexDirection: 'row', gap: 8 },

  statRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 14 },

  filterScrollWrapper: { height: 44 },
  filterWrap:       { paddingLeft: 16, paddingRight: 8, gap: 6, alignItems: 'center' },
  filterWrapTablet: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, height: 44 },
  filterTab:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, backgroundColor: theme.colors.warm.ivory, borderWidth: 1, borderColor: theme.colors.warm.edge },
  filterTabActive:  { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  filterText:       { fontSize: 11, fontWeight: '600', color: theme.colors.warm.oak },
  filterTextActive: { color: '#fff' },

  sortBar:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 6, position: 'relative', zIndex: 10 },
  sortCount:       { fontSize: 11, color: theme.colors.warm.lightOak, fontWeight: '500' },
  sortBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnText:     { fontSize: 11, color: theme.colors.warm.oak, fontWeight: '600' },
  sortMenu:        { position: 'absolute', right: 16, top: 30, backgroundColor: theme.colors.warm.ivory, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.warm.edge, shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6, overflow: 'hidden' },
  sortItem:        { paddingHorizontal: 20, paddingVertical: 12 },
  sortItemActive:  { backgroundColor: theme.colors.warm.cream },
  sortItemText:    { fontSize: 14, color: theme.colors.warm.oak, fontWeight: '500' },
  sortItemTextActive: { color: theme.colors.warm.dark, fontWeight: '700' },

  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: theme.colors.warm.lightOak, fontWeight: '500' },

  fab: { position: 'absolute', bottom: 24, right: 24, backgroundColor: theme.colors.brand, width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', shadowColor: theme.colors.warm.deep, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
});

export default FridgeScreen;
