// 장보기 리스트 화면 — 도토리 v2 디자인
// 체크리스트 + 구입처 태그 필터. 재고(음식/생필품)에서 자동 연동된 항목도 함께 표시.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, SectionList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { ShoppingItem } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';
import { theme } from '../theme';
import IconBtn from '../components/IconBtn';
import SectionLabel from '../components/SectionLabel';
import SwipeDeleteAction from '../components/SwipeDeleteAction';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

const REALTIME_TABLES = ['shopping_items'] as const;

type ShoppingNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Shopping'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type FilterType = '전체' | string;
type StatusTab = '전체' | '미완료' | '완료';

const STATUS_TABS: StatusTab[] = ['전체', '미완료', '완료'];

// ── 장보기 행 ─────────────────────────────────
interface ShoppingRowProps {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem) => void;
  onDelete: (item: ShoppingItem) => void;
  onEdit: (item: ShoppingItem) => void;
}

const SOURCE_LABEL: Record<string, string> = { fridge: '음식 연동', supplies: '생필품 연동' };

const ShoppingRow: React.FC<ShoppingRowProps> = React.memo(({ item, onToggle, onDelete, onEdit }) => {
  const swipeRef = useRef<Swipeable>(null);

  const handleDelete = () => {
    swipeRef.current?.close();
    Alert.alert('삭제 확인', `'${item.name}'을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(item) },
    ]);
  };

  const sourceLabel = SOURCE_LABEL[item.source_type];

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => (
        <SwipeDeleteAction
          onDelete={handleDelete}
          onEdit={() => { swipeRef.current?.close(); onEdit(item); }}
        />
      )}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[row.card, item.is_checked && row.cardChecked]}
        onPress={() => onEdit(item)}
        activeOpacity={0.8}
      >
        {/* 체크박스 — 여기 눌렀을 때만 체크 토글 */}
        <TouchableOpacity
          style={[row.checkbox, item.is_checked && row.checkboxChecked]}
          onPress={() => onToggle(item)}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 10 }}
        >
          {item.is_checked && (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </TouchableOpacity>

        {/* 정보 */}
        <View style={row.body}>
          <Text style={[row.name, item.is_checked && row.nameChecked]} numberOfLines={1}>{item.name}</Text>
          {sourceLabel ? <Text style={row.source}>{sourceLabel}</Text> : null}
        </View>

        {/* 구입처 태그 */}
        {item.store_tag ? (
          <View style={row.tagChip}>
            <Text style={row.tagText}>{item.store_tag}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </Swipeable>
  );
});

const row = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.warm.ivory, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardChecked: { opacity: 0.55 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: theme.colors.warm.edge,
    backgroundColor: theme.colors.warm.cream, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, fontWeight: '600', color: theme.colors.warm.dark },
  nameChecked: { textDecorationLine: 'line-through', color: theme.colors.warm.lightOak },
  source: { fontSize: 10, color: theme.colors.warm.lightOak, marginTop: 2 },
  tagChip: {
    backgroundColor: theme.colors.warm.cream, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0,
  },
  tagText: { fontSize: 10, fontWeight: '600', color: theme.colors.warm.oak },
});

// ── 메인 화면 ─────────────────────────────────
const ShoppingScreen: React.FC = () => {
  const navigation = useNavigation<ShoppingNavProp>();
  const isFocused = useIsFocused();

  const [items, setItems]       = useState<ShoppingItem[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterType>('전체');
  const [statusTab, setStatusTab] = useState<StatusTab>('전체');

  const loadData = useCallback(async () => {
    try {
      const fid = await getOrCreateFamilyId();
      if (!fid) return;
      setFamilyId(fid);
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('family_id', fid)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (!error && data) setItems(data as ShoppingItem[]);
    } catch (e) {
      console.error('ShoppingScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (isFocused) loadData(); }, [isFocused, loadData]);
  useRealtimeRefresh(REALTIME_TABLES, loadData); // 가족이 바꾸면 즉시 갱신

  // 체크 토글 (낙관적 업데이트, 실패 시 원복)
  const handleToggle = useCallback(async (item: ShoppingItem) => {
    const next = !item.is_checked;
    const checkedAt = next ? new Date().toISOString() : null;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: next, checked_at: checkedAt } : i));
    const { error } = await supabase.from('shopping_items').update({ is_checked: next, checked_at: checkedAt }).eq('id', item.id);
    if (error) {
      setItems(prev => prev.map(i => i.id === item.id ? item : i));
      Alert.alert('오류', `변경에 실패했습니다.\n(${error.message})`);
    }
  }, []);

  // 소프트 삭제
  const handleDelete = useCallback(async (item: ShoppingItem) => {
    const { error } = await supabase.from('shopping_items').update({ is_active: false }).eq('id', item.id);
    if (error) {
      Alert.alert('오류', `삭제에 실패했습니다.\n(${error.message})`);
      return;
    }
    setItems(prev => prev.filter(i => i.id !== item.id));
  }, []);

  // 추가/수정 화면으로 이동 (음식/생필품과 동일한 스텝 위저드)
  const goAdd = useCallback(() => {
    navigation.navigate('AddShoppingItem', { familyId: familyId ?? undefined });
  }, [navigation, familyId]);

  const goEdit = useCallback((item: ShoppingItem) => {
    navigation.navigate('AddShoppingItem', { itemId: item.id, familyId: familyId ?? undefined });
  }, [navigation, familyId]);

  // 완료 항목 비우기 (체크된 것 전체 소프트 삭제)
  const handleClearChecked = useCallback(() => {
    const checkedIds = items.filter(i => i.is_checked).map(i => i.id);
    if (checkedIds.length === 0) return;
    Alert.alert('완료 항목 비우기', `구매 완료한 ${checkedIds.length}개 항목을 목록에서 지울까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '비우기', style: 'destructive',
        onPress: async () => {
          await supabase.from('shopping_items').update({ is_active: false }).in('id', checkedIds);
          setItems(prev => prev.filter(i => !i.is_checked));
        },
      },
    ]);
  }, [items]);

  // 구입처 태그 목록 (필터 + 모달 제안용)
  const storeTags = useMemo(
    () => [...new Set(items.map(i => i.store_tag).filter(Boolean))],
    [items],
  );

  const filtered = useMemo(
    () => items.filter(i =>
      (filter === '전체' || i.store_tag === filter) &&
      (statusTab === '전체' || (statusTab === '미완료' ? !i.is_checked : i.is_checked))
    ),
    [items, filter, statusTab],
  );

  const todoItems = useMemo(() => filtered.filter(i => !i.is_checked), [filtered]);
  const doneItems = useMemo(() => filtered.filter(i => i.is_checked), [filtered]);

  const tagCounts = useMemo(() => {
    const map: Record<string, number> = { '전체': items.length };
    storeTags.forEach(t => { map[t] = items.filter(i => i.store_tag === t).length; });
    return map;
  }, [items, storeTags]);

  const sections = useMemo(() => {
    const result = [];
    if (todoItems.length > 0) result.push({ key: 'todo', data: todoItems });
    if (doneItems.length > 0) result.push({ key: 'done', data: doneItems });
    return result;
  }, [todoItems, doneItems]);

  if (loading) {
    return <SafeAreaView style={s.centered}><ActivityIndicator size="large" color={theme.colors.brand} /></SafeAreaView>;
  }

  const filterTabs: FilterType[] = ['전체', ...storeTags];

  return (
    <SafeAreaView style={s.safeArea}>
      {/* 헤더 */}
      <View style={s.header}>
        <View>
          <Text style={s.subLabel}>마트 가는 김에</Text>
          <Text style={s.title}>장보기</Text>
        </View>
        <View style={s.headerRight}>
          {doneItems.length > 0 && (
            <IconBtn onPress={handleClearChecked}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={theme.colors.warm.dark} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </IconBtn>
          )}
          <IconBtn onPress={goAdd}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={theme.colors.warm.dark} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </IconBtn>
        </View>
      </View>

      {/* 상태 탭 (전체 / 미완료) */}
      <View style={s.statusRow}>
        {STATUS_TABS.map(t => (
          <TouchableOpacity
            key={t}
            style={[s.filterTab, statusTab === t && s.filterTabActive]}
            onPress={() => setStatusTab(t)}
          >
            <Text style={[s.filterText, statusTab === t && s.filterTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 구입처 태그 필터 */}
      {storeTags.length > 0 && (
        <View style={s.filterRow}>
          <FlatList
            horizontal
            data={filterTabs}
            keyExtractor={f => f}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16, gap: 6, paddingRight: 16 }}
            renderItem={({ item: f }) => (
              <TouchableOpacity style={[s.filterTab, filter === f && s.filterTabActive]} onPress={() => setFilter(f)}>
                <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
                <Text style={[s.filterCount, filter === f && s.filterCountActive]}>{tagCounts[f] ?? 0}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* 개수 */}
      <View style={s.countBar}>
        <Text style={s.countText}>살 것 {todoItems.length}개 · 완료 {doneItems.length}개</Text>
      </View>

      {/* 섹션 리스트 */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>
            {items.length === 0
              ? '살 것을 추가해 보세요'
              : statusTab !== '전체' ? `${statusTab} 항목이 없어요` : `${filter} 항목이 없어요`}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section }) => (
            section.key === 'todo'
              ? <SectionLabel label="살 것" count={todoItems.length} color={theme.colors.brand} />
              : <SectionLabel label="완료" count={doneItems.length} color={theme.colors.status.safe} />
          )}
          renderItem={({ item }) => (
            <ShoppingRow
              item={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={goEdit}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={goAdd} activeOpacity={0.85}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.warm.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.warm.cream },

  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
  },
  subLabel:    { fontSize: 11, color: theme.colors.warm.lightOak, fontWeight: '600', marginBottom: 1 },
  title:       { fontSize: 24, fontWeight: '700', color: theme.colors.warm.dark, letterSpacing: -0.4 },
  headerRight: { flexDirection: 'row', gap: 8 },

  statusRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 8 },
  filterRow: { marginBottom: 8 },
  filterTab: {
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14,
    backgroundColor: theme.colors.warm.ivory, borderWidth: 1, borderColor: theme.colors.warm.edge,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  filterTabActive:    { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  filterText:         { fontSize: 11, fontWeight: '600', color: theme.colors.warm.oak, lineHeight: 16 },
  filterTextActive:   { color: '#fff' },
  filterCount:        { fontSize: 9, fontWeight: '600', color: theme.colors.warm.lightOak, opacity: 0.75 },
  filterCountActive:  { color: 'rgba(255,255,255,0.75)' },

  countBar:  { paddingHorizontal: 20, marginBottom: 2 },
  countText: { fontSize: 11, color: theme.colors.warm.lightOak, fontWeight: '500' },

  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: theme.colors.warm.lightOak, fontWeight: '500' },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: theme.colors.warm.deep, width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: theme.colors.warm.deep, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 6,
  },
});

export default ShoppingScreen;
