// 장보기 리스트 화면 — 도토리 v2 디자인
// 체크리스트 + 구입처 태그 필터. 재고(음식/생필품)에서 자동 연동된 항목도 함께 표시.

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, SectionList, StyleSheet,
  TouchableOpacity, Pressable, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { ListChecks } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { ShoppingItem, ReceiptCategory } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';
import { theme } from '../theme';
import IconBtn from '../components/IconBtn';
import SectionLabel from '../components/SectionLabel';
import SwipeDeleteAction from '../components/SwipeDeleteAction';
import SelectionBar from '../components/SelectionBar';
import StoreTagModal from '../components/StoreTagModal';
import ChipFilterRow from '../components/ChipFilterRow';
import ChipEditSheet from '../components/ChipEditSheet';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useIsDesktopWeb } from '../hooks/useIsDesktopWeb';
import { chunkPairs } from '../lib/utils';
import { ensureStoreTag, renameStoreTag, deleteStoreTag, saveStoreTagOrder } from '../lib/storeTags';
import { planInventoryAdd, InventoryAddPlan } from '../lib/shopping';

const REALTIME_TABLES = ['shopping_items', 'store_tags'] as const;

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
  // 다중 선택 모드
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: (item: ShoppingItem) => void;
}

const SOURCE_LABEL: Record<string, string> = { fridge: '음식 연동', supplies: '생필품 연동' };

const ShoppingRow: React.FC<ShoppingRowProps> = React.memo(({ item, onToggle, onDelete, onEdit, selectMode, selected, onSelect }) => {
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
      enabled={!selectMode}
      renderRightActions={() => (
        <SwipeDeleteAction
          onDelete={handleDelete}
          onEdit={() => { swipeRef.current?.close(); onEdit(item); }}
        />
      )}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[row.card, item.is_checked && row.cardChecked, selected && row.cardSelected]}
        onPress={() => onEdit(item)}
        activeOpacity={0.8}
      >
        {/* 체크박스 (생필품의 이모지 자리) — 여기 눌렀을 때만 체크 토글 */}
        <TouchableOpacity
          style={[row.checkbox, item.is_checked && row.checkboxChecked]}
          onPress={() => onToggle(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
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

        {/* 선택 모드: 카드 전체 터치를 선택 토글로 가로챔 */}
        {selectMode && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onSelect?.(item)} />
        )}
      </TouchableOpacity>
    </Swipeable>
  );
});

// 생필품 행(SupplyRow)과 동일한 규격
const row = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.warm.ivory, marginHorizontal: 16, marginBottom: 6,
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8,
    shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardChecked: { opacity: 0.55 },
  cardSelected: { borderWidth: 1.5, borderColor: theme.colors.brand },
  checkbox: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: theme.colors.warm.cream,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  body: { flex: 1, minWidth: 0 },
  name: { fontSize: 13, fontWeight: '700', color: theme.colors.warm.dark },
  nameChecked: { textDecorationLine: 'line-through', color: theme.colors.warm.lightOak },
  source: { fontSize: 10, color: theme.colors.warm.lightOak, marginTop: 3 },
  tagChip: {
    backgroundColor: theme.colors.warm.cream, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1, flexShrink: 0,
  },
  tagText: { fontSize: 9, fontWeight: '600', color: theme.colors.warm.lightOak },
});

// ── 재고 추가 제안 시트 ────────────────────────
// 체크(구매 완료)한 항목을 음식/생필품 중 어디에 넣을지 고르는 바텀시트.
// 추정된 쪽을 강조해서 보여주되, 잘못 추정했거나 새로운 품목이면 사용자가 직접 고른다.
interface InventoryAddSheetProps {
  offer: { item: ShoppingItem; plan: InventoryAddPlan } | null;
  onPick: (category: ReceiptCategory) => void;
  onClose: () => void;
}

const InventoryAddSheet: React.FC<InventoryAddSheetProps> = ({ offer, onPick, onClose }) => {
  if (!offer) return null;
  const { item, plan } = offer;
  const detail = plan.matched
    ? `이미 있는 '${plan.matched.name}'에 개수를 더해요 (현재 ${plan.matched.quantity}개)`
    : '새 품목으로 등록해요 — 개수와 상세는 다음 화면에서 정해요';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={sheet.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={sheet.body}>
          <View style={sheet.handle} />
          <Text style={sheet.title}>{`'${item.name}' 재고에 추가할까요?`}</Text>
          <Text style={sheet.desc}>{detail}</Text>
          <View style={sheet.btnRow}>
            {(['food', 'supply'] as ReceiptCategory[]).map(c => {
              const primary = plan.category === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[sheet.pickBtn, primary && sheet.pickBtnPrimary]}
                  onPress={() => onPick(c)}
                  activeOpacity={0.85}
                >
                  <Text style={[sheet.pickText, primary && sheet.pickTextPrimary]}>
                    {c === 'food' ? '음식에 추가' : '생필품에 추가'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={sheet.laterBtn} onPress={onClose}>
            <Text style={sheet.laterText}>나중에</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const sheet = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  body: {
    backgroundColor: theme.colors.warm.ivory, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.warm.edge, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 6 },
  desc: { fontSize: 13, color: theme.colors.warm.lightOak, marginBottom: 20 },
  btnRow: { flexDirection: 'row', gap: 10 },
  pickBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center',
    backgroundColor: theme.colors.warm.cream, borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  pickBtnPrimary: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  pickText: { fontSize: 15, fontWeight: '600', color: theme.colors.brand },
  pickTextPrimary: { color: '#fff' },
  laterBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  laterText: { fontSize: 14, color: theme.colors.warm.lightOak, fontWeight: '500' },
});

// ── 메인 화면 ─────────────────────────────────
const ShoppingScreen: React.FC = () => {
  const navigation = useNavigation<ShoppingNavProp>();
  const isFocused = useIsFocused();
  const isDesktop = useIsDesktopWeb(); // 데스크톱 웹: 2열 그리드

  const [items, setItems]       = useState<ShoppingItem[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterType>('전체');
  const [statusTab, setStatusTab] = useState<StatusTab>('전체');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // store_tags 테이블의 태그 이름 목록 — 항목이 다 지워져도 유지되는 영구 태그
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [tagModal, setTagModal] = useState<{ visible: boolean; editing: string | null }>({ visible: false, editing: null });
  const [tagSheetVisible, setTagSheetVisible] = useState(false); // 구입처 편집 시트

  const loadData = useCallback(async () => {
    try {
      const fid = await getOrCreateFamilyId();
      if (!fid) return;
      setFamilyId(fid);
      const [itemsRes, tagsRes] = await Promise.all([
        supabase
          .from('shopping_items')
          .select('*')
          .eq('family_id', fid)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('store_tags').select('name').eq('family_id', fid)
          .order('sort_order', { ascending: true, nullsFirst: false }) // NULL(새 태그)은 맨 뒤
          .order('created_at', { ascending: true }),
      ]);
      if (!itemsRes.error && itemsRes.data) setItems(itemsRes.data as ShoppingItem[]);
      if (!tagsRes.error && tagsRes.data) setTagNames(tagsRes.data.map(t => t.name as string));
    } catch (e) {
      console.error('ShoppingScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (isFocused) loadData(); }, [isFocused, loadData]);
  useRealtimeRefresh(REALTIME_TABLES, loadData); // 가족이 바꾸면 즉시 갱신

  // 체크(구매 완료) 시 음식/생필품 재고 추가 제안
  const [addOffer, setAddOffer] = useState<{ item: ShoppingItem; plan: InventoryAddPlan } | null>(null);

  const offerInventoryAdd = useCallback(async (item: ShoppingItem) => {
    if (!familyId) return;
    try {
      const plan = await planInventoryAdd(familyId, item);
      setAddOffer({ item, plan });
    } catch (e) {
      // 제안 실패가 체크 자체를 막으면 안 되므로 로그만 남김
      console.error('offerInventoryAdd error:', e);
    }
  }, [familyId]);

  // 시트에서 음식/생필품 선택 → 기존 위저드로 이동
  // 기존 품목이 있으면 수정 모드(+1)로, 없으면 이름·이전 설정을 미리 채운 등록 모드로 연다
  const handlePickCategory = useCallback((category: ReceiptCategory) => {
    if (!addOffer) return;
    const { item, plan } = addOffer;
    setAddOffer(null);
    const fid = familyId ?? undefined;
    if (category === 'food') {
      if (plan.matched?.table === 'fridge') {
        navigation.navigate('AddFridgeItem', { familyId: fid, itemId: plan.matched.id, bump: 1 });
      } else {
        navigation.navigate('AddFridgeItem', {
          familyId: fid,
          prefill: {
            name: item.name,
            storageType: plan.prefill?.storageType,
            autoAdd: plan.prefill?.autoAdd,
            threshold: plan.prefill?.threshold,
            storeTag: plan.prefill?.storeTag ?? (item.store_tag || undefined),
          },
        });
      }
    } else {
      if (plan.matched?.table === 'supplies') {
        navigation.navigate('AddSupply', { familyId: fid, supplyId: plan.matched.id, bump: 1 });
      } else {
        navigation.navigate('AddSupply', {
          familyId: fid,
          prefill: {
            name: item.name,
            category: plan.prefill?.category,
            autoAdd: plan.prefill?.autoAdd,
            threshold: plan.prefill?.threshold,
            storeTag: plan.prefill?.storeTag ?? (item.store_tag || undefined),
          },
        });
      }
    }
  }, [addOffer, familyId, navigation]);

  // 체크 토글 (낙관적 업데이트, 실패 시 원복)
  const handleToggle = useCallback(async (item: ShoppingItem) => {
    const next = !item.is_checked;
    const checkedAt = next ? new Date().toISOString() : null;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: next, checked_at: checkedAt } : i));
    const { error } = await supabase.from('shopping_items').update({ is_checked: next, checked_at: checkedAt }).eq('id', item.id);
    if (error) {
      setItems(prev => prev.map(i => i.id === item.id ? item : i));
      Alert.alert('오류', `변경에 실패했습니다.\n(${error.message})`);
      return;
    }
    if (next) offerInventoryAdd(item);
  }, [offerInventoryAdd]);

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
  // 영구 태그(store_tags) + 아직 테이블에 없는 항목 태그의 합집합 — 완료/비우기 후에도 태그가 남는다
  const storeTags = useMemo(
    () => [...new Set([...tagNames, ...items.map(i => i.store_tag).filter(Boolean)])],
    [tagNames, items],
  );

  // ── 구입처 태그 추가/수정/삭제 ─────────────────
  const handleSaveTag = useCallback(async (name: string, oldName?: string) => {
    if (!familyId) return;
    if (name !== oldName && storeTags.includes(name)) {
      Alert.alert('알림', '이미 같은 이름의 구입처가 있어요.');
      return;
    }
    if (oldName) {
      await renameStoreTag(familyId, oldName, name);
      setTagNames(prev => prev.includes(oldName) ? prev.map(t => t === oldName ? name : t) : [...prev, name]);
      setItems(prev => prev.map(i => i.store_tag === oldName ? { ...i, store_tag: name } : i));
      if (filter === oldName) setFilter(name);
    } else {
      await ensureStoreTag(familyId, name);
      setTagNames(prev => prev.includes(name) ? prev : [...prev, name]);
    }
    setTagModal({ visible: false, editing: null });
  }, [familyId, storeTags, filter]);

  const handleDeleteTag = useCallback(async (name: string) => {
    if (!familyId) return;
    await deleteStoreTag(familyId, name);
    setTagNames(prev => prev.filter(t => t !== name));
    setItems(prev => prev.map(i => i.store_tag === name ? { ...i, store_tag: '' } : i));
    if (filter === name) setFilter('전체');
  }, [familyId, filter]);

  // 칩 드래그로 순서 변경 — 낙관적으로 로컬 먼저 반영
  const handleSaveTagOrder = useCallback(async (ordered: string[]) => {
    if (!familyId) return;
    setTagNames(ordered);
    await saveStoreTagOrder(familyId, ordered);
  }, [familyId]);

  const filtered = useMemo(
    () => items.filter(i =>
      (filter === '전체' || i.store_tag === filter) &&
      (statusTab === '전체' || (statusTab === '미완료' ? !i.is_checked : i.is_checked))
    ),
    [items, filter, statusTab],
  );

  const todoItems = useMemo(() => filtered.filter(i => !i.is_checked), [filtered]);
  const doneItems = useMemo(() => filtered.filter(i => i.is_checked), [filtered]);

  // ── 다중 선택 ─────────────────────────────────
  const exitSelectMode = useCallback(() => { setSelectMode(false); setSelectedIds([]); }, []);

  const handleSelect = useCallback((item: ShoppingItem) => {
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
          const { error } = await supabase.from('shopping_items').update({ is_active: false }).in('id', selectedIds);
          if (error) { Alert.alert('오류', `삭제에 실패했습니다.\n(${error.message})`); return; }
          setItems(prev => prev.filter(i => !selectedIds.includes(i.id)));
          exitSelectMode();
        },
      },
    ]);
  }, [selectedIds, exitSelectMode]);

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

  // 행/섹션 라벨 렌더러 (모바일 1열·데스크톱 2열 공용)
  const renderRow = (item: ShoppingItem) => (
    <ShoppingRow
      item={item}
      onToggle={handleToggle}
      onDelete={handleDelete}
      onEdit={goEdit}
      selectMode={selectMode}
      selected={selectedIds.includes(item.id)}
      onSelect={handleSelect}
    />
  );

  const renderSectionLabel = (key?: string) =>
    key === 'todo'
      ? <SectionLabel label="살 것" count={todoItems.length} color={theme.colors.brand} />
      : <SectionLabel label="완료" count={doneItems.length} color={theme.colors.status.safe} />;

  if (loading) {
    return <SafeAreaView style={s.centered}><ActivityIndicator size="large" color={theme.colors.brand} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safeArea}>
      {/* 헤더 */}
      <View style={s.header}>
        <View>
          <Text style={s.subLabel}>마트 가는 김에</Text>
          <Text style={s.title}>장보기</Text>
        </View>
        <View style={s.headerRight}>
          <IconBtn onPress={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
            <ListChecks color={selectMode ? theme.colors.brand : theme.colors.warm.dark} size={18} strokeWidth={1.5} />
          </IconBtn>
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

      {/* 구입처 태그 필터 — 탭: 필터 / 길게: 편집 시트 (순서 변경·이름 변경·삭제) */}
      <View style={s.filterRow}>
        <ChipFilterRow
          keys={storeTags}
          chipStyle={f => [s.filterTab, filter === f && s.filterTabActive]}
          renderChipContent={f => (
            <>
              <Text style={[s.filterText, filter === f && s.filterTextActive]}>{f}</Text>
              <Text style={[s.filterCount, filter === f && s.filterCountActive]}>{tagCounts[f] ?? 0}</Text>
            </>
          )}
          onPressChip={f => setFilter(f)}
          onLongPressChip={() => setTagSheetVisible(true)}
          leading={
            <TouchableOpacity style={[s.filterTab, filter === '전체' && s.filterTabActive]} onPress={() => setFilter('전체')}>
              <Text style={[s.filterText, filter === '전체' && s.filterTextActive]}>전체</Text>
              <Text style={[s.filterCount, filter === '전체' && s.filterCountActive]}>{tagCounts['전체'] ?? 0}</Text>
            </TouchableOpacity>
          }
          trailing={
            <TouchableOpacity style={s.filterTab} onPress={() => setTagModal({ visible: true, editing: null })}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke={theme.colors.warm.oak} strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={s.filterText}>추가</Text>
            </TouchableOpacity>
          }
        />
      </View>

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
        <TouchableOpacity style={s.fab} onPress={goAdd} activeOpacity={0.85}>
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

      {/* 구매 완료 → 재고 추가 제안 시트 */}
      <InventoryAddSheet
        offer={addOffer}
        onPick={handlePickCategory}
        onClose={() => setAddOffer(null)}
      />

      {/* 구입처 태그 추가/수정 바텀시트 */}
      <StoreTagModal
        visible={tagModal.visible}
        editing={tagModal.editing}
        onClose={() => setTagModal({ visible: false, editing: null })}
        onSave={handleSaveTag}
        onDelete={handleDeleteTag}
      />

      {/* 구입처 편집 시트 — 드래그로 순서 변경, 탭으로 이름 변경, 휴지통으로 삭제 */}
      <ChipEditSheet
        visible={tagSheetVisible}
        title="구입처 편집"
        items={storeTags}
        onClose={() => setTagSheetVisible(false)}
        onReorder={handleSaveTagOrder}
        onRename={(oldName, newName) => handleSaveTag(newName, oldName)}
        onAdd={name => handleSaveTag(name)}
        onDelete={name => {
          Alert.alert('구입처 삭제', `'${name}' 구입처를 삭제할까요?\n이 구입처를 쓰던 항목은 미분류가 돼요.`, [
            { text: '취소', style: 'cancel' },
            { text: '삭제', style: 'destructive', onPress: () => handleDeleteTag(name) },
          ]);
        }}
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
