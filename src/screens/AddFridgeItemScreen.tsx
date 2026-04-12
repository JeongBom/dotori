// 냉장고 음식 추가 화면
// - food_database 자동완성 검색
// - 냉장/냉동 선택에 따른 권장 보관기간 안내
// - 넣은 날짜 / 유통기한 입력

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search, X, ChevronDown } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { FoodEntry, FridgeCategory, StorageType } from '../types';
import { RootStackParamList } from '../navigation';
import { scheduleExpiryNotification, cancelExpiryNotification, requestNotificationPermissions } from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_NOTIFY_DAYS } from './SettingsScreen';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddFridgeItem'>;
type RouteType = RouteProp<RootStackParamList, 'AddFridgeItem'>;

// ── 날짜 유틸 ──────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

// 월 단위 날짜 더하기
function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

// 자동완성 항목 타입
interface SuggestionItem {
  name: string;
  category: FridgeCategory;
}

// ── 날짜 선택 모달 ────────────────────────────

// iOS: 모달 안에 달력 표시 / Android: 네이티브 달력 바로 표시
interface DatePickerModalProps {
  visible: boolean;
  value: string;          // YYYY-MM-DD
  onConfirm: (date: string) => void;
  onCancel: () => void;
  title: string;
  minimumDate?: Date;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({ visible, value, onConfirm, onCancel, title, minimumDate }) => {
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useEffect(() => {
    if (visible) {
      setTempDate(value && isValidDate(value) ? new Date(value) : new Date());
    }
  }, [visible, value]);

  const toDateStr = (d: Date) => d.toISOString().split('T')[0];

  const onChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selected) onConfirm(toDateStr(selected));
      else onCancel();
    } else {
      if (selected) setTempDate(selected);
    }
  };

  if (!visible) return null;

  // Android: 네이티브 picker를 직접 띄움
  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={tempDate}
        mode="date"
        display="calendar"
        onChange={onChange}
        minimumDate={minimumDate}
      />
    );
  }

  // iOS: 모달 안에 달력 표시
  const screenWidth = Dimensions.get('window').width;
  const MODAL_H_PADDING = 16; // 양쪽 패딩
  const calendarWidth = screenWidth - MODAL_H_PADDING * 2;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={dpStyles.overlay}>
        <View style={[dpStyles.container, { width: calendarWidth }]}>
          <Text style={dpStyles.title}>{title}</Text>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="inline"
            onChange={onChange}
            locale="ko-KR"
            style={{ width: calendarWidth - 16, alignSelf: 'center' }}
            accentColor="#8B5E3C"
            minimumDate={minimumDate}
          />
          <View style={dpStyles.actions}>
            <TouchableOpacity style={dpStyles.cancelBtn} onPress={onCancel}>
              <Text style={dpStyles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dpStyles.confirmBtn} onPress={() => onConfirm(toDateStr(tempDate))}>
              <Text style={dpStyles.confirmText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#FFF8F0', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 16 },
  title: { fontSize: 16, fontWeight: '700', color: '#5C3D1E', textAlign: 'center', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12, paddingHorizontal: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#D4B896', alignItems: 'center' },
  cancelText: { color: '#8B5E3C', fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#8B5E3C', alignItems: 'center' },
  confirmText: { color: '#FFFFFF', fontWeight: '700' },
});

// ── 카테고리 색상 ──────────────────────────────

const CATEGORY_COLORS: Record<FridgeCategory, string> = {
  잎채소: '#5AAF6E',
  뿌리채소: '#D4864A',
  과일: '#D9629A',
  육류: '#D46E6E',
  해산물: '#4A9EC9',
  유제품: '#9478C9',
  가공식품: '#7A9FB0',
  기타: '#9EA8B0',
};

// ── 메인 화면 ─────────────────────────────────

const AddFridgeItemScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  // 음식 데이터베이스
  const [foodDb, setFoodDb] = useState<FoodEntry[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  // 폼 상태
  const [name, setName] = useState('');
  const [category, setCategory] = useState<FridgeCategory>('기타');
  const [storageType, setStorageType] = useState<StorageType>('냉장');
  const [storedDate, setStoredDate] = useState(todayStr());
  const [quantity, setQuantity] = useState(1);
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(route.params?.familyId ?? null);
  const itemId = route.params?.itemId ?? null;
  const isEditing = !!itemId;

  // 날짜 모달 상태
  const [showStoredPicker, setShowStoredPicker] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  // 개수 직접 입력 상태
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState('');

  // familyId가 없으면 조회하거나 자동 생성
  useEffect(() => {
    if (familyId) return;
    getOrCreateFamilyId().then(id => { if (id) setFamilyId(id); });
  }, [familyId]);

  // 수정 모드: 기존 아이템 데이터 로드
  useEffect(() => {
    if (!itemId) return;
    (async () => {
      const { data } = await supabase.from('fridge_items').select('*').eq('id', itemId).single();
      if (!data) return;
      setName(data.name);
      setCategory(data.category);
      setStorageType(data.storage_type);
      setQuantity(data.quantity ?? 1);
      setStoredDate(data.stored_date);
      setExpiryDate(data.expiry_date ?? '');
      setFamilyId(data.family_id);
    })();
  }, [itemId]);

  // food_database + family_foods 로드
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('food_database').select('*').order('name');
      if (data) setFoodDb(data as FoodEntry[]);
    })();
  }, []);

  // 자동완성 필터
  const onNameChange = useCallback((text: string) => {
    setName(text);
    if (text.length < 1) { setSuggestions([]); return; }
    const matches = foodDb
      .filter(f => f.name.includes(text))
      .map(f => ({ name: f.name, category: f.category }))
      .slice(0, 6);
    setSuggestions(matches);
  }, [foodDb]);

  // 자동완성 항목 선택
  const onSelectFood = (food: SuggestionItem) => {
    setName(food.name);
    setCategory(food.category);
    setSuggestions([]);
    Keyboard.dismiss();
  };

  // 넣은 날짜 변경 (유통기한 자동 설정 없음 — 힌트만 업데이트)
  const onStoredDateChange = (date: string) => {
    setStoredDate(date);
  };

  const onStorageTypeChange = (type: StorageType) => setStorageType(type);

  // 저장 (추가 / 수정 공용)
  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('알림', '음식 이름을 입력해주세요.'); return; }
    if (expiryDate && !isValidDate(expiryDate)) { Alert.alert('알림', '유통기한 날짜를 확인해주세요.'); return; }

    const fid = familyId ?? await getOrCreateFamilyId();
    if (!fid) { Alert.alert('오류', '가족 정보를 생성할 수 없습니다.'); return; }
    if (!familyId) setFamilyId(fid);

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        storage_type: storageType,
        quantity,
        stored_date: storedDate,
        expiry_date: expiryDate || null,
      };

      if (isEditing && itemId) {
        // ── 수정 ──
        const { error } = await supabase.from('fridge_items').update(payload).eq('id', itemId);
        if (error) throw error;

        // 알림 재스케줄
        await cancelExpiryNotification(itemId);
        if (expiryDate) {
          const granted = await requestNotificationPermissions();
          if (granted) {
            const notifyDays = parseInt((await AsyncStorage.getItem(STORAGE_KEY_NOTIFY_DAYS)) ?? '3');
            await scheduleExpiryNotification(itemId, name.trim(), expiryDate, notifyDays);
          }
        }
      } else {
        // ── 신규 추가 ──
        const { data, error } = await supabase.from('fridge_items').insert({
          family_id: fid,
          ...payload,
          is_consumed: false,
          consumed_at: null,
        }).select().single();

        if (error) throw error;

        if (data && expiryDate) {
          const granted = await requestNotificationPermissions();
          if (granted) {
            const notifyDays = parseInt((await AsyncStorage.getItem(STORAGE_KEY_NOTIFY_DAYS)) ?? '3');
            await scheduleExpiryNotification(data.id, name.trim(), expiryDate, notifyDays);
          }
        }

      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── 렌더 ────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#5C3D1E" size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? '음식 수정' : '음식 추가'}</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* 음식 이름 + 자동완성 */}
          <Text style={styles.label}>음식 이름</Text>
          <View style={styles.autocompleteWrapper}>
            <View style={styles.inputRow}>
              <Search color="#C49A6C" size={18} strokeWidth={1.8} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="음식 이름을 입력하세요"
                placeholderTextColor="#C49A6C"
                value={name}
                onChangeText={onNameChange}
                autoCorrect={false}
              />
              {name.length > 0 && (
                <TouchableOpacity onPress={() => { setName(''); setSuggestions([]); }}>
                  <X color="#C49A6C" size={18} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>

            {/* 자동완성 드롭다운 */}
            {suggestions.length > 0 && (
              <View style={styles.dropdown}>
                {suggestions.map((food, idx) => (
                  <TouchableOpacity
                    key={`${food.name}-${idx}`}
                    style={styles.dropdownItem}
                    onPress={() => onSelectFood(food)}
                  >
                    <Text style={styles.dropdownName}>{food.name}</Text>
                    <View style={[styles.catBadge, { backgroundColor: CATEGORY_COLORS[food.category] }]}>
                      <Text style={styles.catBadgeText}>{food.category}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* 카테고리 (자동완성 선택 시 자동 입력, 수동 변경 가능) */}
          <Text style={[styles.label, { marginTop: 20 }]}>카테고리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {(['잎채소','뿌리채소','과일','육류','해산물','유제품','가공식품','기타'] as FridgeCategory[]).map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.catChip, category === c && { backgroundColor: CATEGORY_COLORS[c] }]}
                onPress={() => setCategory(c)}
              >
                <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 보관 방법 */}
          <Text style={[styles.label, { marginTop: 20 }]}>보관 방법</Text>
          <View style={styles.toggleRow}>
            {(['냉장', '냉동', '실온'] as StorageType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.toggleBtn, storageType === t && styles.toggleBtnActive]}
                onPress={() => onStorageTypeChange(t)}
              >
                <Text style={[styles.toggleText, storageType === t && styles.toggleTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 개수 */}
          <Text style={[styles.label, { marginTop: 20 }]}>개수</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(q => Math.max(1, q - 1))}>
              <Text style={styles.qtyBtnText}>−</Text>
            </TouchableOpacity>
            {editingQty ? (
              <TextInput
                style={styles.qtyInput}
                value={qtyInput}
                onChangeText={text => setQtyInput(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                autoFocus
                returnKeyType="done"
                onBlur={() => {
                  const parsed = parseInt(qtyInput);
                  setQuantity(parsed > 0 ? parsed : 1);
                  setEditingQty(false);
                }}
                onSubmitEditing={() => {
                  const parsed = parseInt(qtyInput);
                  setQuantity(parsed > 0 ? parsed : 1);
                  setEditingQty(false);
                  Keyboard.dismiss();
                }}
              />
            ) : (
              <TouchableOpacity onPress={() => { setQtyInput(String(quantity)); setEditingQty(true); }}>
                <Text style={styles.qtyNum}>{quantity}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(q => q + 1)}>
              <Text style={styles.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* 넣은 날짜 */}
          <Text style={[styles.label, { marginTop: 20 }]}>넣은 날짜</Text>
          <TouchableOpacity style={styles.dateRow} onPress={() => setShowStoredPicker(true)}>
            <Text style={styles.dateText}>{formatDisplayDate(storedDate)}</Text>
            <ChevronDown color="#8B5E3C" size={18} strokeWidth={2} />
          </TouchableOpacity>

          {/* 유통기한 */}
          <Text style={[styles.label, { marginTop: 16 }]}>유통기한</Text>
          <TouchableOpacity style={styles.dateRow} onPress={() => setShowExpiryPicker(true)}>
            <Text style={[styles.dateText, !expiryDate && styles.datePlaceholder]}>
              {expiryDate ? formatDisplayDate(expiryDate) : '날짜를 선택하세요 (선택사항)'}
            </Text>
            <ChevronDown color="#8B5E3C" size={18} strokeWidth={2} />
          </TouchableOpacity>

          {/* 빠른 날짜 버튼 — 누를 때마다 해당 기간이 누적됨 */}
          <View style={styles.quickDateRow}>
            {[
              { label: '1주',  onPress: () => setExpiryDate(d => { const base = d || storedDate; const next = addDays(base, 7);    return next < storedDate ? storedDate : next; }) },
              { label: '2주',  onPress: () => setExpiryDate(d => { const base = d || storedDate; const next = addDays(base, 14);   return next < storedDate ? storedDate : next; }) },
              { label: '1달',  onPress: () => setExpiryDate(d => { const base = d || storedDate; const next = addMonths(base, 1);  return next < storedDate ? storedDate : next; }) },
            ].map(({ label, onPress }) => (
              <TouchableOpacity key={label} style={styles.quickDateBtn} onPress={onPress}>
                <Text style={styles.quickDateText}>+{label}</Text>
              </TouchableOpacity>
            ))}
            {expiryDate ? (
              <TouchableOpacity style={styles.quickDateBtnClear} onPress={() => setExpiryDate('')}>
                <Text style={styles.quickDateClearText}>초기화</Text>
              </TouchableOpacity>
            ) : null}
          </View>

        </ScrollView>

        {/* 하단 저장 버튼 */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveBottomBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBottomBtnText}>
              {saving ? '저장 중...' : (isEditing ? '수정 완료' : '저장')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 날짜 선택 모달들 */}
      <DatePickerModal
        visible={showStoredPicker}
        value={storedDate}
        title="넣은 날짜 선택"
        onConfirm={d => { onStoredDateChange(d); setShowStoredPicker(false); }}
        onCancel={() => setShowStoredPicker(false)}
      />
      <DatePickerModal
        visible={showExpiryPicker}
        value={expiryDate || storedDate}
        title="유통기한 선택"
        onConfirm={d => { setExpiryDate(d); setShowExpiryPicker(false); }}
        onCancel={() => setShowExpiryPicker(false)}
        minimumDate={new Date(storedDate)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },

  // 헤더
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#DEC8A8',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#5C3D1E' },
  headerRight: { width: 40 }, // 헤더 좌우 균형용 빈 뷰

  // 하단 저장 버튼
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#EDD9C0',
    backgroundColor: '#FDF6EC',
  },
  saveBottomBtn: {
    backgroundColor: '#8B5E3C',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBottomBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // 콘텐츠
  content: { padding: 20, paddingBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginBottom: 8 },

  // 자동완성
  autocompleteWrapper: { position: 'relative', zIndex: 10 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#DEC8A8',
  },
  input: { flex: 1, fontSize: 16, color: '#5C3D1E', padding: 0 },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: '#FFF8F0', borderRadius: 12, marginTop: 4,
    borderWidth: 1, borderColor: '#DEC8A8',
    shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#EDD9C0',
  },
  dropdownName: { fontSize: 15, color: '#5C3D1E', fontWeight: '500' },

  // 카테고리 배지
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catBadgeText: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },

  // 카테고리 선택 스크롤
  catScroll: { marginBottom: 4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8',
  },
  catChipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '500' },
  catChipTextActive: { color: '#FFFFFF' },

  // 냉장/냉동 토글
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8',
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  toggleText: { fontSize: 15, fontWeight: '600', color: '#8B5E3C' },
  toggleTextActive: { color: '#FFFFFF' },

  // 날짜
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#DEC8A8',
  },
  dateText: { fontSize: 16, color: '#5C3D1E', fontWeight: '500' },
  datePlaceholder: { color: '#C49A6C' },
  // 개수 스테퍼
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EDD9C0', alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 20, fontWeight: '700', color: '#5C3D1E', lineHeight: 24 },
  qtyNum: { fontSize: 22, fontWeight: '800', color: '#5C3D1E', minWidth: 32, textAlign: 'center' },
  qtyInput: {
    fontSize: 22, fontWeight: '800', color: '#5C3D1E',
    minWidth: 52, textAlign: 'center',
    borderBottomWidth: 2, borderBottomColor: '#8B5E3C',
    padding: 0,
  },

  // 빠른 날짜 버튼
  quickDateRow: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' },
  quickDateBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#EDD9C0', borderWidth: 1, borderColor: '#D4B896',
  },
  quickDateText: { fontSize: 13, fontWeight: '700', color: '#5C3D1E' },
  quickDateBtnClear: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8',
  },
  quickDateClearText: { fontSize: 12, color: '#C49A6C' },
});

export default AddFridgeItemScreen;
