// 생필품 재고 관리 화면 — 도토리 v2 디자인

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, SectionList, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
  TextInput, Modal, Pressable, KeyboardAvoidingView,
  Platform, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Supply, SupplyCategoryEntry } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';
import { sendLowStockNotification } from '../lib/notifications';
import { theme } from '../theme';
import IconBtn from '../components/IconBtn';
import SectionLabel from '../components/SectionLabel';
import SwipeDeleteAction from '../components/SwipeDeleteAction';

type SuppliesNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Supplies'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type FilterType = '전체' | string;
type SortType = '이름순' | '재고적은순' | '추가순';

const CAT_COLOR = theme.colors.brand;

// ── 물품명 → 이모지 매핑 ──────────────────────
function getSupplyEmoji(name: string, category?: string): string {
  const n = name;
  if (/샴푸|린스|컨디셔너/.test(n)) return '🚿';
  if (/비누|핸드워시|손비누|폼클/.test(n)) return '🫧';
  if (/치약|칫솔/.test(n)) return '🦷';
  if (/면도기|면도|쉐이빙/.test(n)) return '🪒';
  if (/바디워시|샤워젤|바디클/.test(n)) return '🛁';
  if (/로션|보디로션|핸드크림|크림/.test(n)) return '🧴';
  if (/면봉/.test(n)) return '🩺';
  if (/선크림|선스크린|자외선차단/.test(n)) return '☀️';
  if (/섬유유연제|유연제/.test(n)) return '🌸';
  if (/세탁세제|세탁|빨래/.test(n)) return '🧺';
  if (/주방세제|설거지세제/.test(n)) return '🍽️';
  if (/수세미/.test(n)) return '🧽';
  if (/고무장갑|위생장갑/.test(n)) return '🧤';
  if (/종이컵|일회용컵/.test(n)) return '☕';
  if (/지퍼백|비닐봉투|랩|호일/.test(n)) return '📦';
  if (/쓰레기봉투|쓰레기|봉투/.test(n)) return '🗑️';
  if (/락스|표백제|염소/.test(n)) return '🧪';
  if (/청소포|물걸레|청소티슈/.test(n)) return '🫧';
  if (/세제/.test(n)) return '🧴';
  if (/청소/.test(n)) return '🧹';
  if (/화장지|두루마리휴지|두루마리/.test(n)) return '🧻';
  if (/물티슈/.test(n)) return '💧';
  if (/휴지|티슈|화장솜/.test(n)) return '🧻';
  if (/기저귀|팸퍼스|하기스/.test(n)) return '👶';
  if (/생리대|탐폰|생리팬티/.test(n)) return '🩹';
  if (/마스크/.test(n)) return '😷';
  if (/밴드|반창고|붕대/.test(n)) return '🩹';
  if (/소독|알코올|과산화수소/.test(n)) return '🧪';
  if (/진통제|소화제|약|비타민/.test(n)) return '💊';
  if (/방향제|탈취제|디퓨저|향수/.test(n)) return '🌸';
  if (/방충제|모기/.test(n)) return '🪰';
  if (category) {
    if (/욕실|세면/.test(category)) return '🚿';
    if (/주방/.test(category))      return '🍽️';
    if (/세탁|세제/.test(category)) return '🧺';
    if (/청소/.test(category))      return '🧹';
  }
  return '📦';
}

// ── 정렬 ─────────────────────────────────────
function sortItems(items: Supply[], sort: SortType): Supply[] {
  return [...items].sort((a, b) => {
    if (sort === '이름순') return a.name.localeCompare(b.name, 'ko');
    if (sort === '재고적은순') return a.quantity - b.quantity;
    return b.created_at.localeCompare(a.created_at);
  });
}

// ── 생필품 행 ─────────────────────────────────
interface SupplyRowProps {
  item: Supply;
  onDelete: (item: Supply) => void;
  onQuantityChange: (item: Supply, delta: number) => void;
  onEdit: (item: Supply) => void;
}

const SupplyRow: React.FC<SupplyRowProps> = React.memo(({ item, onDelete, onQuantityChange, onEdit }) => {
  const swipeRef = useRef<Swipeable>(null);
  const isLow = item.quantity <= item.low_stock_threshold;
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(item.quantity));

  const level = Math.min(item.quantity / Math.max(item.low_stock_threshold * 3, 1), 1);
  const barColor = isLow
    ? theme.colors.status.danger
    : level > 0.8
      ? theme.colors.status.safe
      : theme.colors.status.warn;

  const commitQtyEdit = () => {
    setEditingQty(false);
    const parsed = parseInt(qtyInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== item.quantity) {
      onQuantityChange(item, parsed - item.quantity);
    }
  };

  const handleDelete = () => {
    swipeRef.current?.close();
    Alert.alert('삭제 확인', `'${item.name}'을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(item) },
    ]);
  };

  const emoji = getSupplyEmoji(item.name, item.category);

  return (
    <Swipeable ref={swipeRef} renderRightActions={() => <SwipeDeleteAction onDelete={handleDelete} />} overshootRight={false}>
      <TouchableOpacity
        style={[row.card, isLow && row.cardLow]}
        onPress={() => onEdit(item)}
        activeOpacity={0.8}
      >
        {/* 이모지 아이콘 */}
        <View style={row.iconBox}>
          <Text style={row.iconEmoji}>{emoji}</Text>
        </View>

        {/* 정보 */}
        <View style={row.body}>
          <View style={row.nameRow}>
            <Text style={row.name} numberOfLines={1}>{item.name}</Text>
            {item.category ? (
              <View style={row.catChip}>
                <Text style={row.catText}>{item.category}</Text>
              </View>
            ) : null}
          </View>

          {/* 프로그레스 바 */}
          <View style={row.barTrack}>
            <View style={[row.barFill, { width: `${Math.max(level * 100, 3)}%` as any, backgroundColor: barColor }]} />
          </View>

          <View style={row.bottomRow}>
            {item.note ? (
              <Text style={row.note} numberOfLines={1}>{item.note}</Text>
            ) : (
              <Text style={row.threshold}>최소 {item.low_stock_threshold}개</Text>
            )}
            {isLow && <Text style={row.lowLabel}>부족</Text>}
          </View>
        </View>

        {/* 수량 스텝퍼 */}
        <View style={row.stepper}>
          <TouchableOpacity onPress={() => onQuantityChange(item, 1)} style={row.stepBtnPlus}>
            <Text style={row.stepPlusText}>+</Text>
          </TouchableOpacity>
          {editingQty ? (
            <TextInput
              style={row.qtyInput}
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
              <Text style={[row.qtyNum, isLow && row.qtyNumLow]}>{item.quantity}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onQuantityChange(item, -1)} style={row.stepBtnMinus}>
            <Text style={row.stepMinusText}>−</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

const row = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.warm.ivory, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, padding: 10,
    shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardLow: { borderWidth: 1, borderColor: theme.colors.alert.dangerBorder },
  iconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.warm.cream,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  iconEmoji: { fontSize: 18 },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  name: { fontSize: 13, fontWeight: '700', color: theme.colors.warm.dark, flex: 1 },
  catChip: { backgroundColor: theme.colors.warm.cream, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  catText: { fontSize: 9, fontWeight: '600', color: theme.colors.warm.lightOak },
  barTrack: { height: 4, backgroundColor: `${theme.colors.warm.edge}66`, borderRadius: 2, marginBottom: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  note: { fontSize: 10, color: theme.colors.warm.lightOak, flex: 1 },
  threshold: { fontSize: 10, color: theme.colors.warm.lightOak },
  lowLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.status.danger },
  stepper: { alignItems: 'center', gap: 2, flexShrink: 0 },
  stepBtnPlus: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: theme.colors.brand, justifyContent: 'center', alignItems: 'center',
  },
  stepPlusText: { fontSize: 13, fontWeight: '700', color: '#fff', lineHeight: 16 },
  stepBtnMinus: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: theme.colors.warm.edge, justifyContent: 'center', alignItems: 'center',
  },
  stepMinusText: { fontSize: 13, fontWeight: '700', color: theme.colors.warm.dark, lineHeight: 16 },
  qtyNum: { fontSize: 15, fontWeight: '700', color: theme.colors.warm.dark, minWidth: 20, textAlign: 'center' },
  qtyNumLow: { color: theme.colors.status.danger },
  qtyInput: {
    fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, textAlign: 'center',
    minWidth: 28, borderBottomWidth: 1.5, borderBottomColor: theme.colors.brand,
    paddingHorizontal: 2, paddingVertical: 0,
  },
});

// ── 카테고리 모달 ─────────────────────────────
interface CategoryModalProps {
  visible: boolean;
  editing: SupplyCategoryEntry | null;
  onClose: () => void;
  onSave: (name: string, id?: string) => Promise<void>;
  onDelete: (cat: SupplyCategoryEntry) => void;
}

const CategoryModal: React.FC<CategoryModalProps> = ({ visible, editing, onClose, onSave, onDelete }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setName(editing?.name ?? ''); }, [visible, editing]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('알림', '카테고리 이름을 입력해주세요.'); return; }
    setSaving(true);
    await onSave(name.trim(), editing?.id);
    setSaving(false);
  };

  const handleClose = () => { Keyboard.dismiss(); onClose(); };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert('카테고리 삭제', `'${editing.name}' 카테고리를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { handleClose(); onDelete(editing); } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={cm.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={cm.sheet}>
          <View style={cm.handle} />
          <View style={cm.headerRow}>
            <Text style={cm.title}>{editing ? '카테고리 수정' : '카테고리 추가'}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {editing && (
                <TouchableOpacity onPress={handleDelete}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={theme.colors.status.danger} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={theme.colors.brand} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={cm.label}>이름</Text>
          <View style={cm.inputBox}>
            <TextInput
              style={cm.input}
              placeholder="예) 욕실용품, 세탁용품"
              placeholderTextColor={theme.colors.warm.lightOak}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              maxLength={12}
            />
          </View>
          <TouchableOpacity style={[cm.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            <Text style={cm.saveBtnText}>{saving ? '저장 중...' : editing ? '수정 완료' : '저장'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const cm = StyleSheet.create({
  kav:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: theme.colors.warm.ivory, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.warm.edge, alignSelf: 'center', marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:     { fontSize: 17, fontWeight: '700', color: theme.colors.warm.dark },
  label:     { fontSize: 13, fontWeight: '600', color: theme.colors.brand, marginBottom: 8 },
  inputBox:  { backgroundColor: theme.colors.warm.cream, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.warm.edge },
  input:     { fontSize: 16, color: theme.colors.warm.dark, padding: 0 },
  saveBtn:   { backgroundColor: theme.colors.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ── 메인 화면 ─────────────────────────────────
const SORTS: SortType[] = ['이름순', '재고적은순', '추가순'];

const SuppliesScreen: React.FC = () => {
  const navigation = useNavigation<SuppliesNavProp>();
  const isFocused = useIsFocused();

  const [items, setItems]           = useState<Supply[]>([]);
  const [categories, setCategories] = useState<SupplyCategoryEntry[]>([]);
  const [familyId, setFamilyId]     = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState<FilterType>('전체');
  const [sort, setSort]             = useState<SortType>('추가순');
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
  useEffect(() => { if (isFocused) { setFilter('전체'); loadData(); } }, [isFocused, loadData]);

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

  const filtered = useMemo(() => sortItems(
    items.filter(item => filter === '전체' || item.category === filter), sort,
  ), [items, filter, sort]);

  const lowItems      = useMemo(() => filtered.filter(i => i.quantity <= i.low_stock_threshold), [filtered]);
  const okItems       = useMemo(() => filtered.filter(i => i.quantity > i.low_stock_threshold), [filtered]);
  const lowStockCount = useMemo(() => items.filter(i => i.quantity <= i.low_stock_threshold).length, [items]);

  const catCounts = useMemo(() => {
    const map: Record<string, number> = { '전체': items.length };
    categories.forEach(c => { map[c.name] = items.filter(i => i.category === c.name).length; });
    return map;
  }, [items, categories]);

  const sections = useMemo(() => {
    const result = [];
    if (lowItems.length > 0) result.push({ key: 'low', data: lowItems });
    if (okItems.length > 0)  result.push({ key: 'ok',  data: okItems });
    return result;
  }, [lowItems, okItems]);

  if (loading) {
    return <SafeAreaView style={s.centered}><ActivityIndicator size="large" color={theme.colors.brand} /></SafeAreaView>;
  }

  const filterTabs: FilterType[] = ['전체', ...categories.map(c => c.name)];

  return (
    <SafeAreaView style={s.safeArea}>
      {/* 헤더 */}
      <View style={s.header}>
        <View>
          <Text style={s.subLabel}>우리 집 재고</Text>
          <Text style={s.title}>생필품</Text>
        </View>
        <View style={s.headerRight}>
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
                if (f === '전체') return;
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
          <Text style={s.emptyText}>{items.length === 0 ? '생필품을 추가해 보세요' : `${filter} 항목이 없어요`}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderSectionHeader={({ section }) => (
            section.key === 'low'
              ? <SectionLabel label="부족" count={lowItems.length} color={theme.colors.status.danger} />
              : <SectionLabel label="충분" count={okItems.length} color={theme.colors.status.safe} />
          )}
          renderItem={({ item }) => (
            <SupplyRow
              item={item}
              onDelete={handleDelete}
              onQuantityChange={handleQuantityChange}
              onEdit={handleEdit}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate('AddSupply', { familyId: familyId ?? undefined })}
        activeOpacity={0.85}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      </TouchableOpacity>

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
