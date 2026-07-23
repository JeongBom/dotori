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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Search, X, ChevronDown, Check, Star } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { fetchStoreTagOptions, ensureStoreTag } from '../lib/storeTags';
import { FoodEntry, FridgeCategory, StorageType } from '../types';
import { RootStackParamList } from '../navigation';
import { scheduleExpiryNotification, cancelExpiryNotification, requestNotificationPermissions } from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY_NOTIFY_DAYS } from './SettingsScreen';
import { theme } from '../theme';
import { todayStr, addDays, addMonths, formatDisplayDate, isValidDate } from '../lib/dateUtils';
import DatePickerModal from '../components/DatePickerModal';
import AppSwitch from '../components/design-system/AppSwitch';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddFridgeItem'>;
type RouteType = RouteProp<RootStackParamList, 'AddFridgeItem'>;

interface SuggestionItem {
  name: string;
  category: FridgeCategory;
}

// ── 메인 화면 ─────────────────────────────────

const TOTAL_STEPS = 3;
const MAX_FAVORITES = 10;
type FavoriteFood = { name: string; storage_type: StorageType };
const favKey = (fid: string) => `fridge_favorites_${fid}`;

// 단계(라우트) 인스턴스 간 공유되는 입력값 초안
// 각 단계를 별도 라우트로 push하므로(뒤로가기 = 전 단계), 입력값은 모듈 스코프에 보관해 이어받는다.
type FridgeDraft = {
  name: string; storageType: StorageType; quantity: number;
  storedDate: string; expiryDate: string;
  autoAdd: boolean; threshold: number; storeTag: string;
};
const emptyFridgeDraft = (): FridgeDraft => ({
  name: '', storageType: '냉장', quantity: 1,
  storedDate: todayStr(), expiryDate: '',
  autoAdd: true, threshold: 0, storeTag: '',
});
let draft: FridgeDraft = emptyFridgeDraft();

const AddFridgeItemScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const itemId = route.params?.itemId ?? null;
  const isEditing = !!itemId;

  const step = route.params?.step ?? 1;

  // 위저드 진입(1단계 첫 렌더) 시 초안 초기화 — 아래 useState들이 초안에서 초기값을 읽는다
  const firstRender = useRef(true);
  if (firstRender.current) {
    firstRender.current = false;
    if (step === 1) draft = emptyFridgeDraft();
  }
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
  const [name, setName] = useState(draft.name);
  const [storageType, setStorageType] = useState<StorageType>(draft.storageType);
  const [quantity, setQuantity] = useState(draft.quantity);
  const [storedDate, setStoredDate] = useState(draft.storedDate);
  const [expiryDate, setExpiryDate] = useState(draft.expiryDate);
  const [autoAdd, setAutoAdd] = useState(draft.autoAdd);       // 다 쓰면 장보기 자동 추가
  const [threshold, setThreshold] = useState(draft.threshold); // 장보기 기준 수량 (0 = 다 쓰면)
  const [storeTag, setStoreTag] = useState(draft.storeTag);    // 기본 구입처 태그 (선택)
  const [storeTagOptions, setStoreTagOptions] = useState<string[]>([]); // 기존 태그 제안
  const [saving, setSaving] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(route.params?.familyId ?? null);

  // 입력값을 초안에 반영 — 다음/이전 단계 인스턴스가 이어받는다
  useEffect(() => { draft.name = name; }, [name]);
  useEffect(() => { draft.storageType = storageType; }, [storageType]);
  useEffect(() => { draft.quantity = quantity; }, [quantity]);
  useEffect(() => { draft.storedDate = storedDate; }, [storedDate]);
  useEffect(() => { draft.expiryDate = expiryDate; }, [expiryDate]);
  useEffect(() => { draft.autoAdd = autoAdd; }, [autoAdd]);
  useEffect(() => { draft.threshold = threshold; }, [threshold]);
  useEffect(() => { draft.storeTag = storeTag; }, [storeTag]);

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
    // 수정 모드 데이터 로드는 1단계 인스턴스에서만 — 이후 단계는 초안에서 이어받음
    if (!itemId || step > 1) return;
    (async () => {
      const { data } = await supabase.from('fridge_items').select('*').eq('id', itemId).single();
      if (!data) return;
      setName(data.name);
      setStorageType(data.storage_type);
      setQuantity(data.quantity ?? 1);
      setStoredDate(data.stored_date);
      setExpiryDate(data.expiry_date ?? '');
      setAutoAdd(data.auto_add_to_shopping ?? true);
      setThreshold(data.low_stock_threshold ?? 0);
      setStoreTag(data.default_store_tag ?? '');
      setFamilyId(data.family_id);
    })();
  }, [itemId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('food_database').select('*').order('name');
      if (data) setFoodDb(data as FoodEntry[]);
    })();
  }, []);

  // 기존 구입처 태그 목록 (기본 구입처 제안 칩용)
  useEffect(() => {
    (async () => {
      const fid = familyId ?? await getOrCreateFamilyId();
      if (!fid) return;
      setStoreTagOptions(await fetchStoreTagOptions(fid));
    })();
  }, [familyId]);

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
    // 다음 단계를 같은 화면 라우트로 push — 뒤로가기가 자연스럽게 전 단계로 간다
    if (step < TOTAL_STEPS) navigation.push('AddFridgeItem', { ...route.params, step: step + 1 });
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
        auto_add_to_shopping: autoAdd,
        default_store_tag: storeTag.trim(),
        low_stock_threshold: threshold,
      };

      // 새 구입처면 태그로 등록 — 장보기 필터에 바로 나타남
      if (storeTag.trim()) await ensureStoreTag(fid, storeTag.trim());

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
        navigation.pop(step); // 위저드 단계 전부 빠져나가 목록으로
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
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      Alert.alert('오류', `저장에 실패했습니다.\n(${msg})`);
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
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.pop(step)}>
            <Text style={s.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── 진행 바 ──────────────────────────────────

  // 진행 바 — 지나온 단계 세그먼트를 누르면 그 단계로 되돌아간다
  const Progress = () => (
    <View style={s.progressRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <TouchableOpacity
          key={i}
          style={[s.progressSeg, i + 1 <= step ? s.progressSegActive : s.progressSegInactive]}
          onPress={() => navigation.pop(step - (i + 1))}
          disabled={i + 1 >= step}
          hitSlop={{ top: 12, bottom: 12 }}
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
                        // push 직후 마운트되는 2단계 인스턴스가 읽도록 초안에 즉시 반영
                        draft.name = fav.name;
                        draft.storageType = fav.storage_type;
                        navigation.push('AddFridgeItem', { ...route.params, step: 2 });
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
        <Text style={s.stepQuestion}>언제 구입했나요?</Text>

        <Text style={s.label}>구입 날짜</Text>
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

        {/* 장보기 자동 추가 토글 */}
        <View style={s.autoAddRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>다 쓰면 장보기에 자동 추가</Text>
            <Text style={s.toggleSub}>수량이 0이 되면 장보기에 올려요</Text>
          </View>
          <AppSwitch
            value={autoAdd}
            onValueChange={setAutoAdd}
          />
        </View>

        {/* 기본 구입처 (자동 추가 켜져 있을 때만) */}
        {autoAdd && (
          <>
            <Text style={[s.label, { marginTop: 20 }]}>장보기 기준 수량</Text>
            <Text style={s.thresholdSub}>이 수량 이하가 되면 장보기에 올려요 (0 = 다 쓰면)</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setThreshold(t => Math.max(0, t - 1))}>
                <Text style={s.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.qtyNum}>{threshold}</Text>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setThreshold(t => t + 1)}>
                <Text style={s.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.label, { marginTop: 20 }]}>기본 구입처 <Text style={s.labelOptional}>(선택)</Text></Text>
            <View style={s.tagInputBox}>
              <TextInput
                style={s.tagInput}
                placeholder="예) 이마트, 쿠팡, 동네마트"
                placeholderTextColor={theme.colors.warm.lightOak}
                value={storeTag}
                onChangeText={setStoreTag}
                maxLength={12}
                keyboardAppearance="light"
              />
            </View>
            {storeTagOptions.length > 0 && (
              <View style={s.tagSuggestRow}>
                {storeTagOptions.map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[s.tagChip, storeTag === t && s.tagChipActive]}
                    onPress={() => setStoreTag(storeTag === t ? '' : t)}
                  >
                    <Text style={[s.tagChipText, storeTag === t && s.tagChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
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
        title="구입 날짜 선택"
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

  // 장보기 자동 추가 토글 + 기본 구입처
  autoAddRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32 },
  toggleSub: { fontSize: 12, color: theme.colors.warm.lightOak, marginTop: -4 },
  thresholdSub: { fontSize: 12, color: theme.colors.warm.lightOak, marginTop: -6, marginBottom: 12 },
  tagInputBox: {
    backgroundColor: theme.colors.warm.ivory, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  tagInput: { fontSize: 16, color: theme.colors.warm.dark, padding: 0 },
  tagSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: theme.colors.warm.ivory, borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  tagChipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  tagChipText: { fontSize: 13, color: theme.colors.brand, fontWeight: '500' },
  tagChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

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
