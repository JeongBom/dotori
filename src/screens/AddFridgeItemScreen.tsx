import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search, X, ChevronDown, Check, Star } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { FoodEntry, FridgeCategory, StorageType } from '../types';
import { RootStackParamList } from '../navigation';
import { scheduleExpiryNotification, cancelExpiryNotification, requestNotificationPermissions } from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_NOTIFY_DAYS } from './SettingsScreen';
import { theme } from '../theme';

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

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !isNaN(new Date(s).getTime());
}

interface SuggestionItem {
  name: string;
  category: FridgeCategory;
}

// ── 날짜 선택 모달 ────────────────────────────

interface DatePickerModalProps {
  visible: boolean;
  value: string;
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

  const screenWidth = Dimensions.get('window').width;
  const calendarWidth = screenWidth - 32;

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
            accentColor={theme.colors.brand}
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
  container: { backgroundColor: theme.colors.warm.ivory, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 16 },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.warm.dark, textAlign: 'center', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12, paddingHorizontal: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.warm.edge, alignItems: 'center' },
  cancelText: { color: theme.colors.brand, fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.colors.brand, alignItems: 'center' },
  confirmText: { color: '#FFFFFF', fontWeight: '700' },
});

// ── 메인 화면 ─────────────────────────────────

const TOTAL_STEPS = 3;
const MAX_FAVORITES = 10;
type FavoriteFood = { name: string; storage_type: StorageType };
const favKey = (fid: string) => `fridge_favorites_${fid}`;

const AddFridgeItemScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const itemId = route.params?.itemId ?? null;
  const isEditing = !!itemId;

  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const doneOpacity = useRef(new Animated.Value(0)).current;
  const doneScale = useRef(new Animated.Value(0.85)).current;
  const nameInputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isEditing) {
        const t = setTimeout(() => nameInputRef.current?.focus(), 600);
        return () => clearTimeout(t);
      }
    }, [isEditing])
  );

  // 음식 데이터베이스
  const [foodDb, setFoodDb] = useState<FoodEntry[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);

  // 폼 상태
  const [name, setName] = useState('');
  const [storageType, setStorageType] = useState<StorageType>('냉장');
  const [quantity, setQuantity] = useState(1);
  const [storedDate, setStoredDate] = useState(todayStr());
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(route.params?.familyId ?? null);

  // 날짜 모달
  const [showStoredPicker, setShowStoredPicker] = useState(false);
  const [showExpiryPicker, setShowExpiryPicker] = useState(false);

  // 개수 직접 입력
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState('');

  // 즐겨찾기
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);

  useEffect(() => {
    if (familyId) return;
    getOrCreateFamilyId().then(id => { if (id) setFamilyId(id); });
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    AsyncStorage.getItem(favKey(familyId)).then(json => {
      if (json) setFavorites(JSON.parse(json));
    });
  }, [familyId]);

  const isFav = favorites.some(f => f.name === name.trim());

  const toggleFavorite = useCallback(async () => {
    if (!name.trim() || !familyId) return;
    let next: FavoriteFood[];
    if (isFav) {
      next = favorites.filter(f => f.name !== name.trim());
    } else {
      if (favorites.length >= MAX_FAVORITES) {
        Alert.alert('즐겨찾기 꽉참', `최대 ${MAX_FAVORITES}개까지 저장할 수 있어요.\n기존 항목을 먼저 제거해주세요.`);
        return;
      }
      next = [...favorites, { name: name.trim(), storage_type: storageType }];
    }
    setFavorites(next);
    await AsyncStorage.setItem(favKey(familyId), JSON.stringify(next));
  }, [name, storageType, favorites, isFav, familyId]);

  const removeFavorite = useCallback(async (favName: string) => {
    if (!familyId) return;
    const next = favorites.filter(f => f.name !== favName);
    setFavorites(next);
    await AsyncStorage.setItem(favKey(familyId), JSON.stringify(next));
  }, [favorites, familyId]);

  useEffect(() => {
    if (!itemId) return;
    (async () => {
      const { data } = await supabase.from('fridge_items').select('*').eq('id', itemId).single();
      if (!data) return;
      setName(data.name);
      setStorageType(data.storage_type);
      setQuantity(data.quantity ?? 1);
      setStoredDate(data.stored_date);
      setExpiryDate(data.expiry_date ?? '');
      setFamilyId(data.family_id);
    })();
  }, [itemId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('food_database').select('*').order('name');
      if (data) setFoodDb(data as FoodEntry[]);
    })();
  }, []);

  const onNameChange = useCallback((text: string) => {
    setName(text);
    if (text.length < 1) { setSuggestions([]); return; }
    const matches = foodDb
      .filter(f => f.name.includes(text))
      .map(f => ({ name: f.name, category: f.category }))
      .slice(0, 6);
    setSuggestions(matches);
  }, [foodDb]);

  const onSelectFood = (food: SuggestionItem) => {
    setName(food.name);
    setSuggestions([]);
    Keyboard.dismiss();
  };

  const goNext = () => {
    if (step === 1 && !name.trim()) {
      Alert.alert('알림', '음식 이름을 입력해주세요.');
      return;
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else handleSave();
  };

  const handleSave = async () => {
    if (expiryDate && !isValidDate(expiryDate)) {
      Alert.alert('알림', '유통기한 날짜를 확인해주세요.');
      return;
    }

    const fid = familyId ?? await getOrCreateFamilyId();
    if (!fid) { Alert.alert('오류', '가족 정보를 생성할 수 없습니다.'); return; }
    if (!familyId) setFamilyId(fid);

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        storage_type: storageType,
        quantity,
        stored_date: storedDate,
        expiry_date: expiryDate || null,
      };

      if (isEditing && itemId) {
        const { error } = await supabase.from('fridge_items').update(payload).eq('id', itemId);
        if (error) throw error;
        await cancelExpiryNotification(itemId);
        if (expiryDate) {
          const granted = await requestNotificationPermissions();
          if (granted) {
            const notifyDays = parseInt((await AsyncStorage.getItem(STORAGE_KEY_NOTIFY_DAYS)) ?? '3');
            await scheduleExpiryNotification(itemId, name.trim(), expiryDate, notifyDays);
          }
        }
        navigation.goBack();
      } else {
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

        setDone(true);
        Animated.parallel([
          Animated.spring(doneScale, { toValue: 1, useNativeDriver: true }),
          Animated.timing(doneOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      }
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── 완료 화면 ────────────────────────────────

  if (done) {
    return (
      <SafeAreaView style={s.safeArea}>
        <Animated.View style={[s.doneWrap, { opacity: doneOpacity, transform: [{ scale: doneScale }] }]}>
          <View style={s.doneCircle}>
            <Check color="#FFFFFF" size={36} strokeWidth={2.5} />
          </View>
          <Text style={s.doneTitle}>{name}</Text>
          <Text style={s.doneSub}>
            {storageType === '냉장' ? '냉장고에 추가되었어요' :
             storageType === '냉동' ? '냉동실에 추가되었어요' :
             '실온 보관함에 추가되었어요'}
          </Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── 진행 바 ──────────────────────────────────

  const Progress = () => (
    <View style={s.progressRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[s.progressSeg, i + 1 <= step ? s.progressSegActive : s.progressSegInactive]}
        />
      ))}
    </View>
  );

  // ── 스텝별 콘텐츠 ─────────────────────────────

  const renderStep = () => {
    if (step === 1) {
      return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.stepQuestion}>어떤 음식인가요?</Text>

            {/* 즐겨찾기 */}
            {favorites.length > 0 && (
              <View style={s.favSection}>
                <View style={s.favHeader}>
                  <Star color={theme.colors.star} size={13} fill={theme.colors.star} strokeWidth={0} />
                  <Text style={s.favLabel}>즐겨찾기</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.favRow}>
                  {favorites.map(fav => (
                    <TouchableOpacity
                      key={fav.name}
                      style={s.favChip}
                      onPress={() => {
                        setName(fav.name);
                        setStorageType(fav.storage_type);
                        setSuggestions([]);
                        setStep(2);
                      }}
                      onLongPress={() => Alert.alert(
                        '즐겨찾기 삭제',
                        `"${fav.name}"을(를) 즐겨찾기에서 제거할까요?`,
                        [
                          { text: '취소', style: 'cancel' },
                          { text: '제거', style: 'destructive', onPress: () => removeFavorite(fav.name) },
                        ]
                      )}
                    >
                      <Text style={s.favChipText}>{fav.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={s.autocompleteWrap}>
              <View style={s.inputRow}>
                <Search color={theme.colors.warm.lightOak} size={18} strokeWidth={1.8} style={{ marginRight: 8 }} />
                <TextInput
                  ref={nameInputRef}
                  style={s.input}
                  placeholder="음식 이름을 입력하세요"
                  placeholderTextColor={theme.colors.warm.lightOak}
                  value={name}
                  onChangeText={onNameChange}
                  autoCorrect={false}
                  keyboardAppearance="light"
                />
                {name.length > 0 && (
                  <TouchableOpacity onPress={() => { setName(''); setSuggestions([]); }}>
                    <X color={theme.colors.warm.lightOak} size={18} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>

              {suggestions.length > 0 && (
                <View style={s.dropdown}>
                  {suggestions.map((food, idx) => (
                    <TouchableOpacity
                      key={`${food.name}-${idx}`}
                      style={s.dropdownItem}
                      onPress={() => onSelectFood(food)}
                    >
                      <Text style={s.dropdownName}>{food.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* 즐겨찾기 토글 버튼 */}
            {name.trim().length > 0 && (
              <TouchableOpacity style={s.starRow} onPress={toggleFavorite} activeOpacity={0.7}>
                <Star
                  color={isFav ? theme.colors.star : theme.colors.warm.lightOak}
                  size={16}
                  fill={isFav ? theme.colors.star : 'none'}
                  strokeWidth={2}
                />
                <Text style={[s.starText, isFav && s.starTextActive]}>
                  {isFav ? '즐겨찾기 해제' : `즐겨찾기 추가 (${favorites.length}/${MAX_FAVORITES})`}
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    if (step === 2) {
      return (
        <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
          <Text style={s.stepQuestion}>어떻게 보관하나요?</Text>

          <Text style={s.label}>보관 방법</Text>
          <View style={s.toggleRow}>
            {(['냉장', '냉동', '실온'] as StorageType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.toggleBtn, storageType === t && s.toggleBtnActive]}
                onPress={() => setStorageType(t)}
              >
                <Text style={[s.toggleText, storageType === t && s.toggleTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[s.label, { marginTop: 28 }]}>개수</Text>
          <View style={s.qtyRow}>
            <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity(q => Math.max(1, q - 1))}>
              <Text style={s.qtyBtnText}>−</Text>
            </TouchableOpacity>
            {editingQty ? (
              <TextInput
                style={s.qtyInput}
                value={qtyInput}
                onChangeText={text => setQtyInput(text.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                keyboardAppearance="light"
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
                <Text style={s.qtyNum}>{quantity}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity(q => q + 1)}>
              <Text style={s.qtyBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    // step 3
    return (
      <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false}>
        <Text style={s.stepQuestion}>언제 넣었나요?</Text>

        <Text style={s.label}>넣은 날짜</Text>
        <TouchableOpacity style={s.dateRow} onPress={() => setShowStoredPicker(true)}>
          <Text style={s.dateText}>{formatDisplayDate(storedDate)}</Text>
          <ChevronDown color={theme.colors.brand} size={18} strokeWidth={2} />
        </TouchableOpacity>

        <Text style={[s.label, { marginTop: 24 }]}>유통기한 <Text style={s.labelOptional}>(선택)</Text></Text>
        <TouchableOpacity style={s.dateRow} onPress={() => setShowExpiryPicker(true)}>
          <Text style={[s.dateText, !expiryDate && s.datePlaceholder]}>
            {expiryDate ? formatDisplayDate(expiryDate) : '날짜를 선택하세요'}
          </Text>
          <ChevronDown color={theme.colors.brand} size={18} strokeWidth={2} />
        </TouchableOpacity>

        <View style={s.quickDateRow}>
          {[
            { label: '+1주',  fn: () => setExpiryDate(d => { const base = d || storedDate; return addDays(base, 7); }) },
            { label: '+2주',  fn: () => setExpiryDate(d => { const base = d || storedDate; return addDays(base, 14); }) },
            { label: '+1달',  fn: () => setExpiryDate(d => { const base = d || storedDate; return addMonths(base, 1); }) },
          ].map(({ label, fn }) => (
            <TouchableOpacity key={label} style={s.quickBtn} onPress={fn}>
              <Text style={s.quickBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
          {expiryDate ? (
            <TouchableOpacity style={s.quickBtnClear} onPress={() => setExpiryDate('')}>
              <Text style={s.quickBtnClearText}>초기화</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    );
  };

  const ctaLabel = () => {
    if (saving) return '저장 중...';
    if (step < TOTAL_STEPS) return '다음';
    return isEditing ? '수정 완료' : '저장';
  };

  return (
    <SafeAreaView style={s.safeArea}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => { if (step > 1) setStep(s => s - 1); else navigation.goBack(); }}
          style={s.backBtn}
        >
          <ChevronLeft color={theme.colors.warm.dark} size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing ? '음식 수정' : '음식 추가'}</Text>
        <View style={s.headerRight} />
      </View>

      <Progress />

      <View style={{ flex: 1 }}>
        {renderStep()}
      </View>

      {/* 하단 CTA */}
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.ctaBtn, saving && { opacity: 0.5 }]}
          onPress={goNext}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={s.ctaBtnText}>{ctaLabel()}</Text>
        </TouchableOpacity>
      </View>

      <DatePickerModal
        visible={showStoredPicker}
        value={storedDate}
        title="넣은 날짜 선택"
        onConfirm={d => { setStoredDate(d); setShowStoredPicker(false); }}
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

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.card },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.warm.dark },
  headerRight: { width: 40 },

  progressRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 6, marginBottom: 4 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  progressSegActive: { backgroundColor: theme.colors.brand },
  progressSegInactive: { backgroundColor: theme.colors.storage.fridge.bg },

  stepContent: { padding: 24, paddingBottom: 32 },
  stepQuestion: { fontSize: 22, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 32, lineHeight: 30 },

  label: { fontSize: 13, fontWeight: '600', color: theme.colors.brand, marginBottom: 10 },
  labelOptional: { fontSize: 12, fontWeight: '400', color: theme.colors.warm.lightOak },

  autocompleteWrap: { position: 'relative', zIndex: 10 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.warm.ivory, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  input: { flex: 1, fontSize: 17, color: theme.colors.warm.dark, padding: 0 },
  dropdown: {
    position: 'absolute', top: '100%', left: 0, right: 0,
    backgroundColor: theme.colors.warm.ivory, borderRadius: 14, marginTop: 4,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
    shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 8, elevation: 5,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: theme.colors.storage.fridge.bg,
  },
  dropdownName: { fontSize: 15, color: theme.colors.warm.dark, fontWeight: '500' },

  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: theme.colors.warm.ivory, borderWidth: 1, borderColor: theme.colors.warm.edge, alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  toggleText: { fontSize: 15, fontWeight: '600', color: theme.colors.brand },
  toggleTextActive: { color: '#FFFFFF' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.storage.fridge.bg, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 22, fontWeight: '700', color: theme.colors.warm.dark, lineHeight: 26 },
  qtyNum: { fontSize: 28, fontWeight: '700', color: theme.colors.warm.dark, minWidth: 40, textAlign: 'center' },
  qtyInput: {
    fontSize: 28, fontWeight: '700', color: theme.colors.warm.dark,
    minWidth: 60, textAlign: 'center',
    borderBottomWidth: 2, borderBottomColor: theme.colors.brand, padding: 0,
  },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.warm.ivory, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  dateText: { fontSize: 16, color: theme.colors.warm.dark, fontWeight: '500' },
  datePlaceholder: { color: theme.colors.warm.lightOak },

  quickDateRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  quickBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: theme.colors.storage.fridge.bg, borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  quickBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.warm.dark },
  quickBtnClear: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: theme.colors.warm.ivory, borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  quickBtnClearText: { fontSize: 12, color: theme.colors.warm.lightOak },

  bottomBar: {
    paddingHorizontal: 24, paddingVertical: 16,
    backgroundColor: theme.colors.card,
  },
  ctaBtn: {
    backgroundColor: theme.colors.brand, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  // 즐겨찾기
  favSection: { marginBottom: 20 },
  favHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  favLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.warm.oak },
  favRow: { gap: 8, paddingRight: 4 },
  favChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: theme.colors.warm.ivory, borderWidth: 1.5, borderColor: theme.colors.star,
  },
  favChipText: { fontSize: 13, fontWeight: '600', color: theme.colors.warm.dark },
  starRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 14, paddingVertical: 4,
  },
  starText: { fontSize: 13, color: theme.colors.warm.lightOak, fontWeight: '500' },
  starTextActive: { color: theme.colors.star },

  // 완료 화면
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  doneCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  doneTitle: { fontSize: 24, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 10 },
  doneSub: { fontSize: 15, color: theme.colors.warm.oak, textAlign: 'center', lineHeight: 22, marginBottom: 48 },
  doneBtn: {
    backgroundColor: theme.colors.brand, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 48,
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default AddFridgeItemScreen;
