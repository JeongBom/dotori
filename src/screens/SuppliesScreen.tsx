// 생필품 재고 관리 화면 — 도토리 v2 디자인

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, SectionList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import { ReceiptText, ListChecks } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Supply, SupplyCategoryEntry } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';
import { sendLowStockNotification } from '../lib/notifications';
import { autoAddToShopping } from '../lib/shopping';
import { theme } from '../theme';
import IconBtn from '../components/IconBtn';
import SectionLabel from '../components/SectionLabel';
import SupplyRow from '../components/SupplyRow';
import SupplyCategoryModal from '../components/SupplyCategoryModal';
import SelectionBar from '../components/SelectionBar';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useIsDesktopWeb } from '../hooks/useIsDesktopWeb';
import { chunkPairs } from '../lib/utils';

const REALTIME_TABLES = ['supplies', 'supply_categories'] as const;

type SuppliesNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Supplies'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type FilterType = '전체' | string;
type SortType = '이름순' | '재고적은순' | '추가순';

const CAT_COLOR = theme.colors.brand;


// ── 정렬 ─────────────────────────────────────
function sortItems(items: Supply[], sort: SortType): Supply[] {
  return [...items].sort((a, b) => {
    if (sort === '이름순') return a.name.localeCompare(b.name, 'ko');
    if (sort === '재고적은순') return a.quantity - b.quantity;
    return b.created_at.localeCompare(a.created_at);
  });
}

// ── 메인 화면 ─────────────────────────────────
const SORTS: SortType[] = ['이름순', '재고적은순', '추가순'];

const SuppliesScreen: React.FC = () => {
  const navigation = useNavigation<SuppliesNavProp>();
  const isFocused = useIsFocused();
  const isDesktop = useIsDesktopWeb(); // 데스크톱 웹: 2열 그리드

  const [items, setItems]           = useState<Supply[]>([]);
  const [categories, setCategories] = useState<SupplyCategoryEntry[]>([]);
  const [familyId, setFamilyId]     = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterType>('전체');
  const [sort, setSort]             = useState<SortType>('추가순');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [categoryModal, setCategoryModal] = useState<{ visible: boolean; editing: SupplyCategoryEntry | null }>({ visible: false, editing: null });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const fid = await getOrCreateFamilyId();
      if (!fid) return;
      setFamilyId(fid);
      const [suppliesRes, catsRes] = await Promise.all([
        supabase.from('supplies').select('*').eq('family_id', fid).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('supply_categories').select('*').eq('family_id', fid).order('created_at', { ascending: true }),
      ]);
      if (!suppliesRes.error && suppliesRes.data) setItems(suppliesRes.data as Supply[]);
      if (!catsRes.error && catsRes.data) setCategories(catsRes.data as SupplyCategoryEntry[]);
    } catch (e) {
      console.error('SuppliesScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (isFocused) { setFilter('전체'); loadData(); } }, [isFocused, loadData]);
  useRealtimeRefresh(REALTIME_TABLES, loadData); // 가족이 바꾸면 즉시 갱신

  const handleQuantityChange = useCallback(async (item: Supply, delta: number) => {
    const next = Math.max(0, item.quantity + delta);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: next } : i));
    await supabase.from('supplies').update({ quantity: next }).eq('id', item.id);
    if (next <= item.low_stock_threshold && item.quantity > item.low_stock_threshold) {
      // 재고 부족 알림 (품목 설정이 켜져 있을 때만)
      if (item.notify_low_stock ?? true) {
        await sendLowStockNotification(item.id, item.name, next);
      }
      // 임계점 이하로 떨어지는 순간 장보기 자동 추가 (품목 설정이 켜져 있을 때만)
      if (item.auto_add_to_shopping ?? true) {
        await autoAddToShopping(item.family_id, item.name, 'supplies', item.id, item.default_store_tag ?? '');
      }
    }
  }, []);

  const handleEdit = useCallback((item: Supply) => {
    navigation.navigate('AddSupply', { supplyId: item.id, familyId: familyId ?? undefined });
  }, [navigation, familyId]);

  const handleDelete = useCallback(async (item: Supply) => {
    const { error } = await supabase.from('supplies').update({ is_active: false }).eq('id', item.id);
    if (!error) setItems(prev => prev.filter(i => i.id !== item.id));
  }, []);

  const handleSaveCategory = useCallback(async (name: string, id?: string) => {
    if (!familyId) return;
    if (id) {
      const { error } = await supabase.from('supply_categories').update({ name }).eq('id', id);
      if (!error) {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
        const oldName = categories.find(c => c.id === id)?.name;
        if (oldName && oldName !== name) {
          await supabase.from('supplies').update({ category: name }).eq('family_id', familyId).eq('category', oldName);
          setItems(prev => prev.map(i => i.category === oldName ? { ...i, category: name } : i));
        }
        setCategoryModal({ visible: false, editing: null });
      }
    } else {
      if (categories.some(c => c.name === name)) { Alert.alert('알림', '이미 같은 이름의 카테고리가 있어요.'); return; }
      const { data, error } = await supabase.from('supply_categories').insert({ family_id: familyId, name, color: CAT_COLOR }).select().single();
      if (!error && data) { setCategories(prev => [...prev, data as SupplyCategoryEntry]); setCategoryModal({ visible: false, editing: null }); }
    }
  }, [familyId, categories]);

  const handleDeleteCategory = useCallback(async (cat: SupplyCategoryEntry) => {
    await supabase.from('supply_categories').delete().eq('id', cat.id);
    await supabase.from('supplies').update({ category: '' }).eq('family_id', familyId).eq('category', cat.name);
    setCategories(prev => prev.filter(c => c.id !== cat.id));
    setItems(prev => prev.map(i => i.category === cat.name ? { ...i, category: '' } : i));
    if (filter === cat.name) setFilter('전체');
  }, [familyId, filter]);

  // 부족 판정: 알림이 켜진 품목만 부족으로 표시 (수량 0은 '사용완료'라 별도 취급)
  const isLow = useCallback((i: Supply) =>
    i.quantity > 0 && (i.notify_low_stock ?? true) && i.quantity <= i.low_stock_threshold, []);

  // 수량 0 = 사용완료 → 메인 목록에서 제외, 전용 탭에서 조회 (다시 사면 자동 복귀)
  const usedUpItems = useMemo(() => sortItems(items.filter(i => i.quantity === 0), sort), [items, sort]);
  const stockItems  = useMemo(() => items.filter(i => i.quantity > 0), [items]);

  const filtered = useMemo(() => {
    if (filter === '사용완료') return usedUpItems;
    return sortItems(stockItems.filter(item => filter === '전체' || item.category === filter), sort);
  }, [stockItems, usedUpItems, filter, sort]);

  // ── 다중 선택 ─────────────────────────────────
  const exitSelectMode = useCallback(() => { setSelectMode(false); setSelectedIds([]); }, []);

  const handleSelect = useCallback((item: Supply) => {
    setSelectedIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(prev => prev.length === filtered.length ? [] : filtered.map(i => i.id));
  }, [filtered]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    Alert.alert('선택 삭제', `${selectedIds.length}개 항목을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('supplies').update({ is_active: false }).in('id', selectedIds);
          if (error) { Alert.alert('오류', `삭제에 실패했습니다.\n(${error.message})`); return; }
          setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
          exitSelectMode();
        },
      },
    ]);
  }, [selectedIds, exitSelectMode]);

  const lowItems      = useMemo(() => filter === '사용완료' ? [] : filtered.filter(isLow), [filtered, filter, isLow]);
  const okItems       = useMemo(() => filter === '사용완료' ? [] : filtered.filter(i => !isLow(i)), [filtered, filter, isLow]);
  const lowStockCount = useMemo(() => stockItems.filter(isLow).length, [stockItems, isLow]);

  const catCounts = useMemo(() => {
    const map: Record<string, number> = { '전체': stockItems.length, '사용완료': usedUpItems.length };
    categories.forEach(c => { map[c.name] = stockItems.filter(i => i.category === c.name).length; });
    return map;
  }, [stockItems, usedUpItems, categories]);

  const sections = useMemo(() => {
    if (filter === '사용완료') {
      return usedUpItems.length > 0 ? [{ key: 'used', data: usedUpItems }] : [];
    }
    const result = [];
    if (lowItems.length > 0) result.push({ key: 'low', data: lowItems });
    if (okItems.length > 0)  result.push({ key: 'ok',  data: okItems });
    return result;
  }, [filter, usedUpItems, lowItems, okItems]);

  // 행/섹션 라벨 렌더러 (모바일 1열·데스크톱 2열 공용)
  const renderRow = (item: Supply) => (
    <SupplyRow
      item={item}
      onDelete={handleDelete}
      onQuantityChange={handleQuantityChange}
      onEdit={handleEdit}
      selectMode={selectMode}
      selected={selectedIds.includes(item.id)}
      onSelect={handleSelect}
    />
  );

  const renderSectionLabel = (key?: string) =>
    key === 'used'
      ? <SectionLabel label="사용완료" count={usedUpItems.length} color={theme.colors.warm.lightOak} />
      : key === 'low'
        ? <SectionLabel label="부족" count={lowItems.length} color={theme.colors.status.danger} />
        : <SectionLabel label="충분" count={okItems.length} color={theme.colors.status.safe} />;

  if (loading) {
    return <SafeAreaView style={s.centered}><ActivityIndicator size="large" color={theme.colors.brand} /></SafeAreaView>;
  }

  const filterTabs: FilterType[] = ['전체', ...categories.map(c => c.name), '사용완료'];

  return (
    <SafeAreaView style={s.safeArea}>
      {/* 헤더 */}
      <View style={s.header}>
        <View>
          <Text style={s.subLabel}>우리 집 재고</Text>
          <Text style={s.title}>생필품</Text>
        </View>
        <View style={s.headerRight}>
          <IconBtn onPress={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
            <ListChecks color={selectMode ? theme.colors.brand : theme.colors.warm.dark} size={18} strokeWidth={1.5} />
          </IconBtn>
          <IconBtn onPress={() => navigation.navigate('ReceiptScan')}>
            <ReceiptText color={theme.colors.warm.dark} size={18} strokeWidth={1.5} />
          </IconBtn>
          <IconBtn onPress={() => setShowSortMenu(v => !v)}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3" stroke={theme.colors.warm.dark} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </IconBtn>
          <IconBtn onPress={() => navigation.navigate('AddSupply', { familyId: familyId ?? undefined })}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={theme.colors.warm.dark} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </IconBtn>
        </View>
      </View>

      {/* 정렬 메뉴 */}
      {showSortMenu && (
        <View style={s.sortMenu}>
          {SORTS.map(sv => (
            <TouchableOpacity key={sv} style={[s.sortMenuItem, sort === sv && s.sortMenuItemActive]}
              onPress={() => { setSort(sv); setShowSortMenu(false); }}>
              <Text style={[s.sortMenuText, sort === sv && s.sortMenuTextActive]}>{sv}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 재고 부족 배너 */}
      {lowStockCount > 0 && (
        <View style={s.alertBanner}>
          <View style={s.alertIcon}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M12 7v6M12 17v.5" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
            </Svg>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.alertTitle}>재고 부족 {lowStockCount}개</Text>
            <Text style={s.alertSub}>장보기 전에 확인하세요</Text>
          </View>
        </View>
      )}

      {/* 카테고리 필터 탭 */}
      <View style={s.filterRow}>
        <FlatList
          horizontal
          data={filterTabs}
          keyExtractor={f => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, gap: 6, paddingRight: 8 }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[s.filterTab, filter === f && s.filterTabActive]}
              onPress={() => setFilter(f)}
              onLongPress={() => {
                if (f === '전체' || f === '사용완료') return;
                const cat = categories.find(c => c.name === f);
                if (cat) setCategoryModal({ visible: true, editing: cat });
              }}
              delayLongPress={400}
            >
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
              <Text style={[s.filterCount, filter === f && s.filterCountActive]}>{catCounts[f] ?? 0}</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity style={s.addCatBtn} onPress={() => setCategoryModal({ visible: true, editing: null })}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke={theme.colors.brand} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
              <Text style={s.addCatText}>카테고리</Text>
            </TouchableOpacity>
          }
        />
      </View>

      {/* 개수 */}
      <View style={s.countBar}>
        <Text style={s.countText}>{filtered.length}개 · {sort}</Text>
      </View>

      {/* 섹션 리스트 */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>
            {items.length === 0
              ? '생필품을 추가해 보세요'
              : filter === '사용완료' ? '사용완료된 물품이 없어요' : `${filter} 항목이 없어요`}
          </Text>
        </View>
      ) : isDesktop ? (
        // 데스크톱 웹: 2열 그리드
        <SectionList
          sections={sections.map(sec => ({ key: sec.key, data: chunkPairs(sec.data) }))}
          keyExtractor={pair => pair[0].id}
          renderSectionHeader={({ section }) => renderSectionLabel(section.key)}
          renderItem={({ item: pair }) => (
            <View style={{ flexDirection: 'row' }}>
              {pair.map(item => (
                <View key={item.id} style={{ flex: 1 }}>{renderRow(item)}</View>
              ))}
              {pair.length === 1 && <View style={{ flex: 1 }} />}
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section }) => renderSectionLabel(section.key)}
          renderItem={({ item }) => renderRow(item)}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* FAB (선택 모드에선 숨김) */}
      {!selectMode && (
        <TouchableOpacity
          style={s.fab}
          onPress={() => navigation.navigate('AddSupply', { familyId: familyId ?? undefined })}
          activeOpacity={0.85}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        </TouchableOpacity>
      )}

      {/* 다중 선택 하단 바 */}
      {selectMode && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={filtered.length > 0 && selectedIds.length === filtered.length}
          onSelectAll={handleSelectAll}
          onDelete={handleBulkDelete}
        />
      )}

      <SupplyCategoryModal
        visible={categoryModal.visible}
        editing={categoryModal.editing}
        onClose={() => setCategoryModal({ visible: false, editing: null })}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />
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

  sortMenu: {
    position: 'absolute', right: 60, top: 52, zIndex: 20,
    backgroundColor: theme.colors.warm.ivory, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.warm.edge,
    shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 8,
    overflow: 'hidden',
  },
  sortMenuItem:      { paddingHorizontal: 20, paddingVertical: 12 },
  sortMenuItemActive:{ backgroundColor: theme.colors.warm.cream },
  sortMenuText:      { fontSize: 14, color: theme.colors.brand, fontWeight: '500' },
  sortMenuTextActive:{ color: theme.colors.warm.dark, fontWeight: '700' },

  alertBanner: {
    marginHorizontal: 16, marginBottom: 12, padding: 10,
    backgroundColor: theme.colors.alert.dangerBg, borderRadius: 14, borderWidth: 1, borderColor: `${theme.colors.status.danger}33`,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  alertIcon: {
    width: 30, height: 30, borderRadius: 10, backgroundColor: theme.colors.status.danger,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  alertTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.status.danger },
  alertSub:   { fontSize: 10, color: theme.colors.warm.oak, marginTop: 1 },

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
  addCatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14,
    backgroundColor: theme.colors.warm.ivory, borderWidth: 1, borderColor: theme.colors.warm.edge, borderStyle: 'dashed',
  },
  addCatText: { fontSize: 11, fontWeight: '600', color: theme.colors.brand, lineHeight: 16 },

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

export default SuppliesScreen;
