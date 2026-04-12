// 냉장고 관리 화면
// - 필터(전체/냉장/냉동/먹은 음식), 정렬(유통기한/이름/넣은날짜)
// - D-day 색상 코딩, 체크박스로 다먹음 처리, 스와이프 삭제

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import { Plus, ArrowUpDown, CheckCircle2, Circle } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { FridgeItem } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';
import { cancelExpiryNotification } from '../lib/notifications';

type FridgeNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Fridge'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ── 타입 ──────────────────────────────────────

type FilterType = '전체' | '냉장' | '냉동' | '실온' | '먹은 음식';
type SortType = '유통기한' | '이름' | '넣은날짜';

// ── D-day 계산 ────────────────────────────────

interface DDay {
  label: string;
  color: string;
}

function getDDay(expiryDate: string | null): DDay {
  if (!expiryDate) return { label: '기한없음', color: '#C49A6C' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const diff = Math.round((expiry.getTime() - today.getTime()) / 86400000);

  if (diff < 0) return { label: `D+${Math.abs(diff)}`, color: '#D95F4B' };
  if (diff === 0) return { label: 'D-day', color: '#D95F4B' };
  if (diff <= 3) return { label: `D-${diff}`, color: '#D95F4B' };
  if (diff <= 7) return { label: `D-${diff}`, color: '#E09B4B' };
  return { label: `D-${diff}`, color: '#8B5E3C' };
}

// ── 정렬 함수 ─────────────────────────────────

function sortItems(items: FridgeItem[], sort: SortType): FridgeItem[] {
  return [...items].sort((a, b) => {
    if (sort === '이름') return a.name.localeCompare(b.name, 'ko');
    if (sort === '넣은날짜') return b.stored_date.localeCompare(a.stored_date);
    // 유통기한 임박순: null을 마지막으로
    if (!a.expiry_date && !b.expiry_date) return 0;
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return a.expiry_date.localeCompare(b.expiry_date);
  });
}

// ── 스와이프 삭제 액션 ────────────────────────

const RightAction: React.FC<{ onDelete: () => void }> = ({ onDelete }) => (
  <TouchableOpacity style={swipeStyles.deleteBtn} onPress={onDelete}>
    <Text style={swipeStyles.deleteText}>삭제</Text>
  </TouchableOpacity>
);

const swipeStyles = StyleSheet.create({
  deleteBtn: {
    backgroundColor: '#D95F4B',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 10,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
  },
  deleteText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});

// ── 개별 아이템 행 ────────────────────────────

interface FridgeItemRowProps {
  item: FridgeItem;
  onToggleConsumed: (item: FridgeItem) => void;
  onDelete: (item: FridgeItem) => void;
  onQuantityChange: (item: FridgeItem, delta: number) => void;
  onEdit: (item: FridgeItem) => void;
}

const FridgeItemRow: React.FC<FridgeItemRowProps> = React.memo(({ item, onToggleConsumed, onDelete, onQuantityChange, onEdit }) => {
  const swipeRef = useRef<Swipeable>(null);
  const dday = getDDay(item.expiry_date);
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(item.quantity ?? 1));

  const startQtyEdit = () => {
    setQtyInput(String(item.quantity ?? 1));
    setEditingQty(true);
  };

  const commitQtyEdit = () => {
    setEditingQty(false);
    const parsed = parseInt(qtyInput);
    if (!isNaN(parsed) && parsed > 0 && parsed !== (item.quantity ?? 1)) {
      onQuantityChange(item, parsed - (item.quantity ?? 1));
    } else if (parsed <= 0) {
      onQuantityChange(item, -(item.quantity ?? 1)); // 0 이하 → 다먹음
    }
  };

  const handleDelete = () => {
    swipeRef.current?.close();
    Alert.alert(
      '삭제 확인',
      `${item.name}을(를) 삭제할까요?`,
      [
        { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
        { text: '삭제', style: 'destructive', onPress: () => onDelete(item) },
      ],
    );
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => <RightAction onDelete={handleDelete} />}
      overshootRight={false}
    >
      <View style={rowStyles.row}>
        {/* 체크박스 */}
        <TouchableOpacity onPress={() => onToggleConsumed(item)} style={rowStyles.checkbox}>
          {item.is_consumed
            ? <CheckCircle2 color="#8B5E3C" size={24} strokeWidth={2} />
            : <Circle color="#D4B896" size={24} strokeWidth={1.5} />
          }
        </TouchableOpacity>

        {/* 음식 정보 (탭하면 수정) */}
        <TouchableOpacity style={rowStyles.info} onPress={() => onEdit(item)} activeOpacity={0.7}>
          <View style={rowStyles.topRow}>
            <Text style={[rowStyles.name, item.is_consumed && rowStyles.nameConsumed]}>
              {item.name}
            </Text>
          </View>
          <View style={rowStyles.bottomRow}>
            <View style={[rowStyles.storageChip, item.storage_type === '냉동' && rowStyles.storageChipFreezer, item.storage_type === '실온' && rowStyles.storageChipRoom]}>
              <Text style={[rowStyles.storageText, item.storage_type === '냉동' && rowStyles.storageTextFreezer, item.storage_type === '실온' && rowStyles.storageTextRoom]}>
                {item.storage_type}
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: '#C49A6C' }}>
              넣은 날: {item.stored_date.replace(/-/g, '.')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* 수량 + D-day */}
        <View style={rowStyles.rightCol}>
          {!item.is_consumed && (
            <View style={rowStyles.qtyRow}>
              <TouchableOpacity onPress={() => onQuantityChange(item, -1)} style={rowStyles.qtyBtn}>
                <Text style={rowStyles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              {editingQty ? (
                <TextInput
                  style={rowStyles.qtyInput}
                  value={qtyInput}
                  onChangeText={setQtyInput}
                  keyboardType="number-pad"
                  onBlur={commitQtyEdit}
                  onSubmitEditing={commitQtyEdit}
                  autoFocus
                  selectTextOnFocus
                  maxLength={4}
                />
              ) : (
                <TouchableOpacity onPress={startQtyEdit}>
                  <Text style={rowStyles.qtyNum}>{item.quantity ?? 1}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => onQuantityChange(item, 1)} style={rowStyles.qtyBtn}>
                <Text style={rowStyles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
          {!item.is_consumed && (
            <Text style={[rowStyles.dday, { color: dday.color }]}>{dday.label}</Text>
          )}
          {item.is_consumed && item.consumed_at && (
            <Text style={rowStyles.consumedDate}>{item.consumed_at.replace(/-/g, '.')}</Text>
          )}
        </View>
      </View>
    </Swipeable>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  checkbox: { marginRight: 12 },
  info: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  name: { fontSize: 15, fontWeight: '600', color: '#5C3D1E' },
  nameConsumed: { color: '#C49A6C', textDecorationLine: 'line-through' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  storageChip: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    backgroundColor: '#EDD9C0',
  },
  storageChipFreezer: { backgroundColor: '#C8D8F0' },
  storageChipRoom: { backgroundColor: '#F0E8D4' },
  storageText: { fontSize: 11, color: '#8B5E3C', fontWeight: '600' },
  storageTextFreezer: { color: '#5A7EC9' },
  storageTextRoom: { color: '#A07840' },
  rightCol: { alignItems: 'flex-end', gap: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#EDD9C0', alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 14, fontWeight: '700', color: '#5C3D1E', lineHeight: 18 },
  qtyNum: { fontSize: 14, fontWeight: '700', color: '#5C3D1E', minWidth: 20, textAlign: 'center' },
  qtyInput: {
    fontSize: 14, fontWeight: '700', color: '#5C3D1E', textAlign: 'center',
    minWidth: 36, paddingHorizontal: 4, paddingVertical: 0,
    borderBottomWidth: 1.5, borderBottomColor: '#8B5E3C',
  },
  dday: { fontSize: 13, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  consumedDate: { fontSize: 11, color: '#C49A6C', textAlign: 'right' },
});

// ── 메인 화면 ─────────────────────────────────

const FridgeScreen: React.FC = () => {
  const navigation = useNavigation<FridgeNavProp>();
  const isFocused = useIsFocused();

  const [items, setItems] = useState<FridgeItem[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('전체');
  const [sort, setSort] = useState<SortType>('유통기한');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // 데이터 로드
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

  // 다먹음 토글
  const handleToggleConsumed = useCallback(async (item: FridgeItem) => {
    const newConsumed = !item.is_consumed;
    const today = new Date().toISOString().split('T')[0];

    // 체크 해제 시 수량을 1로 복구
    const updatePayload: Record<string, unknown> = {
      is_consumed: newConsumed,
      consumed_at: newConsumed ? today : null,
    };
    if (!newConsumed) updatePayload.quantity = 1;

    const { error } = await supabase
      .from('fridge_items')
      .update(updatePayload)
      .eq('id', item.id);

    if (!error) {
      setItems(prev => prev.map(i =>
        i.id === item.id
          ? { ...i, is_consumed: newConsumed, consumed_at: newConsumed ? today : null, quantity: newConsumed ? i.quantity : 1 }
          : i
      ));
      // 다먹음 처리 시 알림 취소
      if (newConsumed) await cancelExpiryNotification(item.id);
    }
  }, []);

  // 수량 변경 (0이 되면 자동으로 다먹음 처리)
  const handleQuantityChange = useCallback(async (item: FridgeItem, delta: number) => {
    const next = (item.quantity ?? 1) + delta;
    if (next <= 0) {
      // 개수 0 → 다먹음 처리
      const today = new Date().toISOString().split('T')[0];
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: 0, is_consumed: true, consumed_at: today } : i));
      await supabase.from('fridge_items').update({ quantity: 0, is_consumed: true, consumed_at: today }).eq('id', item.id);
      await cancelExpiryNotification(item.id);
    } else {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: next } : i));
      await supabase.from('fridge_items').update({ quantity: next }).eq('id', item.id);
    }
  }, []);

  // 수정 화면으로 이동
  const handleEdit = useCallback((item: FridgeItem) => {
    navigation.navigate('AddFridgeItem', { itemId: item.id, familyId: familyId ?? undefined });
  }, [navigation, familyId]);

  // 삭제
  const handleDelete = useCallback(async (item: FridgeItem) => {
    const { error } = await supabase.from('fridge_items').delete().eq('id', item.id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== item.id));
      await cancelExpiryNotification(item.id);
    }
  }, []);

  // 필터 + 정렬 적용
  const displayItems = sortItems(
    items.filter(item => {
      if (filter === '먹은 음식') return item.is_consumed;
      if (filter === '냉장') return !item.is_consumed && item.storage_type === '냉장';
      if (filter === '냉동') return !item.is_consumed && item.storage_type === '냉동';
      if (filter === '실온') return !item.is_consumed && item.storage_type === '실온';
      return !item.is_consumed; // 전체
    }),
    sort,
  );

  const FILTERS: FilterType[] = ['전체', '냉장', '냉동', '실온', '먹은 음식'];
  const SORTS: SortType[] = ['유통기한', '이름', '넣은날짜'];

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#8B5E3C" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>음식</Text>
      </View>

      {/* 필터 탭 */}
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 정렬 바 */}
      <View style={styles.sortBar}>
        <Text style={styles.countText}>{displayItems.length}개</Text>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortMenu(!showSortMenu)}>
          <ArrowUpDown color="#8B5E3C" size={14} strokeWidth={2} />
          <Text style={styles.sortBtnText}>{sort}순</Text>
        </TouchableOpacity>

        {/* 정렬 드롭다운 */}
        {showSortMenu && (
          <View style={styles.sortMenu}>
            {SORTS.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.sortMenuItem, sort === s && styles.sortMenuItemActive]}
                onPress={() => { setSort(s); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortMenuText, sort === s && styles.sortMenuTextActive]}>{s}순</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 리스트 */}
      {displayItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {filter === '먹은 음식' ? '다먹은 음식이 없어요' : '음식을 추가해 보세요 🍱'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <FridgeItemRow
              item={item}
              onToggleConsumed={handleToggleConsumed}
              onDelete={handleDelete}
              onQuantityChange={handleQuantityChange}
              onEdit={handleEdit}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
      {/* 음식 추가 FAB */}
      <TouchableOpacity
        style={styles.addFab}
        onPress={() => navigation.navigate('AddFridgeItem', { familyId: familyId ?? undefined })}
        activeOpacity={0.85}
      >
        <Plus color="#FFFFFF" size={26} strokeWidth={2.5} />
      </TouchableOpacity>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6EC' },

  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#5C3D1E' },
  addFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#8B5E3C',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6B4226',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // 필터
  filterRow: {
    flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8',
  },
  filterTabActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  filterText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },

  // 정렬 바
  sortBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 4, position: 'relative', zIndex: 10,
  },
  countText: { fontSize: 13, color: '#C49A6C', fontWeight: '500' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  sortMenu: {
    position: 'absolute', right: 16, top: 28,
    backgroundColor: '#FFF8F0', borderRadius: 12,
    borderWidth: 1, borderColor: '#DEC8A8',
    shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 6,
    overflow: 'hidden',
  },
  sortMenuItem: { paddingHorizontal: 20, paddingVertical: 12 },
  sortMenuItemActive: { backgroundColor: '#FDF6EC' },
  sortMenuText: { fontSize: 14, color: '#8B5E3C', fontWeight: '500' },
  sortMenuTextActive: { color: '#5C3D1E', fontWeight: '700' },

  // 빈 상태
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#C49A6C', fontWeight: '500' },
});

export default FridgeScreen;
