// 생필품 재고 관리 화면
// - 사용자 정의 카테고리 (추가/수정/삭제 + 색상 피커)
// - 카테고리 필터(롱프레스 → 수정), 정렬, 수량 +/-, 스와이프 삭제
// - 재고 임계값 이하 시 경고 표시 및 즉시 알림

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
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import { Plus, ArrowUpDown, AlertTriangle, X, Trash2 } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Supply, SupplyCategoryEntry } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';
import { sendLowStockNotification } from '../lib/notifications';

type SuppliesNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Supplies'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type FilterType = '전체' | string;
type SortType = '이름순' | '재고적은순' | '추가순';

const CAT_COLOR = '#8B5E3C'; // 모든 카테고리 통일 색상

// ── 정렬 ─────────────────────────────────────

function sortItems(items: Supply[], sort: SortType): Supply[] {
  return [...items].sort((a, b) => {
    if (sort === '이름순') return a.name.localeCompare(b.name, 'ko');
    if (sort === '재고적은순') return a.quantity - b.quantity;
    return b.created_at.localeCompare(a.created_at);
  });
}

// ── 스와이프 삭제 ─────────────────────────────

const RightAction: React.FC<{ onDelete: () => void }> = ({ onDelete }) => (
  <TouchableOpacity style={swipeStyles.deleteBtn} onPress={onDelete}>
    <Text style={swipeStyles.deleteText}>삭제</Text>
  </TouchableOpacity>
);

const swipeStyles = StyleSheet.create({
  deleteBtn: {
    backgroundColor: '#D95F4B', justifyContent: 'center', alignItems: 'center',
    width: 80, marginBottom: 10, borderTopRightRadius: 14, borderBottomRightRadius: 14,
  },
  deleteText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});

// ── 개별 아이템 행 ────────────────────────────

interface SupplyRowProps {
  item: Supply;
  catColor: string;
  onDelete: (item: Supply) => void;
  onQuantityChange: (item: Supply, delta: number) => void;
  onEdit: (item: Supply) => void;
}

const SupplyRow: React.FC<SupplyRowProps> = React.memo(({ item, catColor, onDelete, onQuantityChange, onEdit }) => {
  const swipeRef = useRef<Swipeable>(null);
  const isLow = item.quantity <= item.low_stock_threshold;
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(item.quantity));

  const commitQtyEdit = () => {
    setEditingQty(false);
    const parsed = parseInt(qtyInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== item.quantity) {
      onQuantityChange(item, parsed - item.quantity);
    }
  };

  const handleDelete = () => {
    swipeRef.current?.close();
    Alert.alert('삭제 확인', `${item.name}을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(item) },
    ]);
  };

  return (
    <Swipeable ref={swipeRef} renderRightActions={() => <RightAction onDelete={handleDelete} />} overshootRight={false}>
      <TouchableOpacity style={[rowStyles.row, isLow && rowStyles.rowLow]} onPress={() => onEdit(item)} activeOpacity={0.75}>
        <View style={[rowStyles.catBar, { backgroundColor: catColor }]} />
        <View style={rowStyles.info}>
          <View style={rowStyles.topRow}>
            <Text style={rowStyles.name}>{item.name}</Text>
            {isLow && <AlertTriangle color="#D95F4B" size={15} strokeWidth={2} />}
            {item.category ? (
              <View style={[rowStyles.catBadge, { backgroundColor: catColor }]}>
                <Text style={rowStyles.catText}>{item.category}</Text>
              </View>
            ) : null}
          </View>
          {item.note ? <Text style={rowStyles.note} numberOfLines={1}>{item.note}</Text> : null}
        </View>
        <View style={rowStyles.rightCol}>
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
              <TouchableOpacity onPress={() => { setQtyInput(String(item.quantity)); setEditingQty(true); }}>
                <Text style={[rowStyles.qtyNum, isLow && rowStyles.qtyNumLow]}>{item.quantity}개</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => onQuantityChange(item, 1)} style={rowStyles.qtyBtn}>
              <Text style={rowStyles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          {isLow && <Text style={rowStyles.lowLabel}>재고 부족</Text>}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F0',
    marginHorizontal: 16, marginBottom: 10, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  rowLow: { borderWidth: 1, borderColor: '#F5C2BB' },
  catBar: { width: 4, alignSelf: 'stretch' },
  info: { flex: 1, paddingVertical: 14, paddingHorizontal: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { fontSize: 15, fontWeight: '600', color: '#5C3D1E', flex: 1 },
  catBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  catText: { fontSize: 10, color: '#FFFFFF', fontWeight: '600' },
  note: { fontSize: 12, color: '#C49A6C', marginTop: 2 },
  rightCol: { alignItems: 'flex-end', paddingRight: 14, gap: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#EDD9C0', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 14, fontWeight: '700', color: '#5C3D1E', lineHeight: 18 },
  qtyNum: { fontSize: 14, fontWeight: '700', color: '#5C3D1E', minWidth: 32, textAlign: 'center' },
  qtyNumLow: { color: '#D95F4B' },
  qtyInput: {
    fontSize: 14, fontWeight: '700', color: '#5C3D1E', textAlign: 'center',
    minWidth: 36, paddingHorizontal: 4, paddingVertical: 0,
    borderBottomWidth: 1.5, borderBottomColor: '#8B5E3C',
  },
  lowLabel: { fontSize: 11, color: '#D95F4B', fontWeight: '600' },
});

// ── 카테고리 모달 (추가 / 수정 겸용) ──────────

interface CategoryModalProps {
  visible: boolean;
  editing: SupplyCategoryEntry | null; // null → 추가 모드
  onClose: () => void;
  onSave: (name: string, id?: string) => Promise<void>;
  onDelete: (cat: SupplyCategoryEntry) => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ visible, editing, onClose, onSave, onDelete }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(editing?.name ?? '');
    }
  }, [visible, editing]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('알림', '카테고리 이름을 입력해주세요.'); return; }
    setSaving(true);
    await onSave(name.trim(), editing?.id);
    setSaving(false);
  };

  const handleClose = () => { Keyboard.dismiss(); onClose(); };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert('카테고리 삭제', `'${editing.name}' 카테고리를 삭제할까요?\n해당 카테고리로 등록된 생필품은 카테고리 없음으로 변경됩니다.`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { handleClose(); onDelete(editing); } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={modalStyles.kavWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <View style={modalStyles.headerRow}>
            <Text style={modalStyles.title}>{editing ? '카테고리 수정' : '카테고리 추가'}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {editing && (
                <TouchableOpacity onPress={handleDelete}>
                  <Trash2 color="#D95F4B" size={18} strokeWidth={2} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose}>
                <X color="#8B5E3C" size={20} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={modalStyles.label}>이름</Text>
          <View style={modalStyles.inputBox}>
            <TextInput
              style={modalStyles.input}
              placeholder="예) 욕실용품, 세탁용품"
              placeholderTextColor="#C49A6C"
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              maxLength={12}
            />
          </View>

          <TouchableOpacity
            style={[modalStyles.saveBtn, { marginTop: 20 }, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={modalStyles.saveBtnText}>{saving ? '저장 중...' : (editing ? '수정 완료' : '저장')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  kavWrapper: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF8F0', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DEC8A8', alignSelf: 'center', marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '700', color: '#5C3D1E' },
  label: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginBottom: 8 },
  inputBox: { backgroundColor: '#FDF6EC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#DEC8A8' },
  input: { fontSize: 16, color: '#5C3D1E', padding: 0 },
  saveBtn: { backgroundColor: '#8B5E3C', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

// ── 메인 화면 ─────────────────────────────────

const SORTS: SortType[] = ['이름순', '재고적은순', '추가순'];

const SuppliesScreen: React.FC = () => {
  const navigation = useNavigation<SuppliesNavProp>();
  const isFocused = useIsFocused();

  const [items, setItems] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<SupplyCategoryEntry[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('전체');
  const [sort, setSort] = useState<SortType>('추가순');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [categoryModal, setCategoryModal] = useState<{ visible: boolean; editing: SupplyCategoryEntry | null }>({ visible: false, editing: null });

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

  // 화면 포커스 시: 데이터 갱신 + 필터를 전체로 리셋
  useEffect(() => {
    if (isFocused) {
      setFilter('전체');
      loadData();
    }
  }, [isFocused, loadData]);

  const handleQuantityChange = useCallback(async (item: Supply, delta: number) => {
    const next = Math.max(0, item.quantity + delta);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: next } : i));
    await supabase.from('supplies').update({ quantity: next }).eq('id', item.id);
    if (next <= item.low_stock_threshold && item.quantity > item.low_stock_threshold) {
      await sendLowStockNotification(item.id, item.name, next);
    }
  }, []);

  const handleEdit = useCallback((item: Supply) => {
    navigation.navigate('AddSupply', { supplyId: item.id, familyId: familyId ?? undefined });
  }, [navigation, familyId]);

  const handleDelete = useCallback(async (item: Supply) => {
    const { error } = await supabase.from('supplies').update({ is_active: false }).eq('id', item.id);
    if (!error) setItems(prev => prev.filter(i => i.id !== item.id));
  }, []);

  // 카테고리 저장 (추가 또는 수정)
  const handleSaveCategory = useCallback(async (name: string, id?: string) => {
    if (!familyId) return;
    if (id) {
      // 수정
      const { error } = await supabase.from('supply_categories').update({ name }).eq('id', id);
      if (!error) {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c));
        // 해당 카테고리를 사용하는 supply들도 이름 업데이트
        const oldName = categories.find(c => c.id === id)?.name;
        if (oldName && oldName !== name) {
          await supabase.from('supplies').update({ category: name }).eq('family_id', familyId).eq('category', oldName);
          setItems(prev => prev.map(i => i.category === oldName ? { ...i, category: name } : i));
        }
        setCategoryModal({ visible: false, editing: null });
      }
    } else {
      // 추가
      if (categories.some(c => c.name === name)) { Alert.alert('알림', '이미 같은 이름의 카테고리가 있어요.'); return; }
      const { data, error } = await supabase.from('supply_categories').insert({ family_id: familyId, name, color: CAT_COLOR }).select().single();
      if (!error && data) {
        setCategories(prev => [...prev, data as SupplyCategoryEntry]);
        setCategoryModal({ visible: false, editing: null });
      }
    }
  }, [familyId, categories]);

  // 카테고리 삭제
  const handleDeleteCategory = useCallback(async (cat: SupplyCategoryEntry) => {
    await supabase.from('supply_categories').delete().eq('id', cat.id);
    // 해당 카테고리 사용 중인 supply → 카테고리 없음('')으로
    await supabase.from('supplies').update({ category: '' }).eq('family_id', familyId).eq('category', cat.name);
    setCategories(prev => prev.filter(c => c.id !== cat.id));
    setItems(prev => prev.map(i => i.category === cat.name ? { ...i, category: '' } : i));
    if (filter === cat.name) setFilter('전체');
  }, [familyId, filter]);

  const displayItems = sortItems(
    items.filter(item => filter === '전체' || item.category === filter),
    sort,
  );
  const lowStockCount = items.filter(i => i.quantity <= i.low_stock_threshold).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#8B5E3C" />
      </SafeAreaView>
    );
  }

  const filterTabs: FilterType[] = ['전체', ...categories.map(c => c.name)];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>생필품</Text>
        {lowStockCount > 0 && (
          <View style={styles.lowStockBadge}>
            <AlertTriangle color="#D95F4B" size={13} strokeWidth={2} />
            <Text style={styles.lowStockBadgeText}>부족 {lowStockCount}개</Text>
          </View>
        )}
      </View>

      {/* 카테고리 필터 + 추가 버튼 */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={filterTabs}
          keyExtractor={f => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, gap: 8, paddingRight: 8 }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
              onLongPress={() => {
                // 전체 탭은 수정 불가
                if (f === '전체') return;
                const cat = categories.find(c => c.name === f);
                if (cat) setCategoryModal({ visible: true, editing: cat });
              }}
              delayLongPress={400}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addCatBtn}
              onPress={() => setCategoryModal({ visible: true, editing: null })}
            >
              <Plus color="#8B5E3C" size={14} strokeWidth={2.5} />
              <Text style={styles.addCatBtnText}>카테고리</Text>
            </TouchableOpacity>
          }
        />
      </View>

      {/* 정렬 바 */}
      <View style={styles.sortBar}>
        <Text style={styles.countText}>{displayItems.length}개</Text>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortMenu(v => !v)}>
          <ArrowUpDown color="#8B5E3C" size={14} strokeWidth={2} />
          <Text style={styles.sortBtnText}>{sort}</Text>
        </TouchableOpacity>
        {showSortMenu && (
          <View style={styles.sortMenu}>
            {SORTS.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.sortMenuItem, sort === s && styles.sortMenuItemActive]}
                onPress={() => { setSort(s); setShowSortMenu(false); }}
              >
                <Text style={[styles.sortMenuText, sort === s && styles.sortMenuTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 리스트 */}
      {displayItems.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {items.length === 0 ? '생필품을 추가해 보세요' : `${filter} 항목이 없어요`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayItems}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <SupplyRow
              item={item}
              catColor={CAT_COLOR}
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

      {/* FAB */}
      <TouchableOpacity
        style={styles.addFab}
        onPress={() => navigation.navigate('AddSupply', { familyId: familyId ?? undefined })}
        activeOpacity={0.85}
      >
        <Plus color="#FFFFFF" size={26} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* 카테고리 추가/수정 모달 */}
      <CategoryModal
        visible={categoryModal.visible}
        editing={categoryModal.editing}
        onClose={() => setCategoryModal({ visible: false, editing: null })}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6EC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#5C3D1E' },
  lowStockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FDE8E5', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, borderColor: '#F5C2BB',
  },
  lowStockBadgeText: { fontSize: 12, color: '#D95F4B', fontWeight: '700' },
  filterRow: { marginBottom: 12 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8' },
  filterTabActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  filterText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  addCatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8', borderStyle: 'dashed',
  },
  addCatBtnText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  sortBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 4, position: 'relative', zIndex: 10,
  },
  countText: { fontSize: 13, color: '#C49A6C', fontWeight: '500' },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  sortMenu: {
    position: 'absolute', right: 16, top: 28, backgroundColor: '#FFF8F0', borderRadius: 12,
    borderWidth: 1, borderColor: '#DEC8A8',
    shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6, overflow: 'hidden',
  },
  sortMenuItem: { paddingHorizontal: 20, paddingVertical: 12 },
  sortMenuItemActive: { backgroundColor: '#FDF6EC' },
  sortMenuText: { fontSize: 14, color: '#8B5E3C', fontWeight: '500' },
  sortMenuTextActive: { color: '#5C3D1E', fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#C49A6C', fontWeight: '500' },
  addFab: {
    position: 'absolute', bottom: 24, right: 24, backgroundColor: '#8B5E3C', width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6B4226', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
});

export default SuppliesScreen;
