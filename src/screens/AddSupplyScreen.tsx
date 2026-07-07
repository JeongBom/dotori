import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Keyboard,
  ActivityIndicator,
  Animated,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Check } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { SupplyCategoryEntry } from '../types';
import { RootStackParamList } from '../navigation';
import { theme } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddSupply'>;
type RouteType = RouteProp<RootStackParamList, 'AddSupply'>;

const TOTAL_STEPS = 3;

const AddSupplyScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const supplyId = route.params?.supplyId ?? null;
  const isEditing = !!supplyId;

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

  const [familyId, setFamilyId] = useState<string | null>(route.params?.familyId ?? null);
  const [categories, setCategories] = useState<SupplyCategoryEntry[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [threshold, setThreshold] = useState(1);
  const [note, setNote] = useState('');
  const [notifyLowStock, setNotifyLowStock] = useState(true); // 재고 부족 알림
  const [autoAdd, setAutoAdd] = useState(true);       // 다 쓰면 장보기 자동 추가
  const [storeTag, setStoreTag] = useState('');       // 기본 구입처 태그 (선택)
  const [storeTagOptions, setStoreTagOptions] = useState<string[]>([]); // 기존 태그 제안
  const [saving, setSaving] = useState(false);

  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState('');
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState('');

  useEffect(() => {
    const init = async () => {
      const fid = familyId ?? await getOrCreateFamilyId();
      if (!fid) return;
      if (!familyId) setFamilyId(fid);

      const [catsRes, tagsRes] = await Promise.all([
        supabase.from('supply_categories').select('*').eq('family_id', fid).order('created_at', { ascending: true }),
        supabase.from('shopping_items').select('store_tag').eq('family_id', fid).eq('is_active', true),
      ]);

      if (catsRes.data) setCategories(catsRes.data as SupplyCategoryEntry[]);
      if (tagsRes.data) {
        setStoreTagOptions([...new Set(tagsRes.data.map(t => t.store_tag).filter(Boolean))]);
      }
      setCatsLoading(false);
    };
    init();
  }, [familyId]);

  useEffect(() => {
    if (!supplyId) return;
    (async () => {
      const { data } = await supabase.from('supplies').select('*').eq('id', supplyId).single();
      if (!data) return;
      setName(data.name);
      setSelectedCategory(data.category ?? '');
      setQuantity(data.quantity);
      setThreshold(data.low_stock_threshold ?? 1);
      setNote(data.note ?? '');
      setNotifyLowStock(data.notify_low_stock ?? true);
      setAutoAdd(data.auto_add_to_shopping ?? true);
      setStoreTag(data.default_store_tag ?? '');
      setFamilyId(data.family_id);
    })();
  }, [supplyId]);

  const goNext = () => {
    if (step === 1 && !name.trim()) {
      Alert.alert('알림', '제품명을 입력해주세요.');
      return;
    }
    if (step < TOTAL_STEPS) setStep(s => s + 1);
    else handleSave();
  };

  const handleSave = async () => {
    const fid = familyId ?? await getOrCreateFamilyId();
    if (!fid) { Alert.alert('오류', '가족 정보를 생성할 수 없습니다.'); return; }
    if (!familyId) setFamilyId(fid);

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category: selectedCategory,
        quantity,
        low_stock_threshold: threshold,
        note: note.trim() || null,
        notify_low_stock: notifyLowStock,
        auto_add_to_shopping: autoAdd,
        default_store_tag: storeTag.trim(),
      };

      if (isEditing && supplyId) {
        const { error } = await supabase.from('supplies').update(payload).eq('id', supplyId);
        if (error) throw error;
        navigation.goBack();
      } else {
        const { error } = await supabase.from('supplies').insert({
          family_id: fid,
          is_active: true,
          ...payload,
        });
        if (error) throw error;

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
          <Text style={s.doneTitle}>생필품을 추가했어요!</Text>
          <Text style={s.doneSub}>{name} 이(가) 등록됐어요</Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={s.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const Progress = () => (
    <View style={s.progressRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View key={i} style={[s.progressSeg, i + 1 <= step ? s.progressSegActive : s.progressSegInactive]} />
      ))}
    </View>
  );

  const renderStep = () => {
    if (step === 1) {
      return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.stepQuestion}>어떤 생필품인가요?</Text>
            <View style={s.inputBox}>
              <TextInput
                ref={nameInputRef}
                style={s.input}
                placeholder="예) 주방 세제, 샴푸, 두루마리 휴지"
                placeholderTextColor={theme.colors.warm.lightOak}
                value={name}
                onChangeText={setName}
                autoCorrect={false}
                returnKeyType="done"
                keyboardAppearance="light"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    if (step === 2) {
      return (
        <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={s.stepQuestion}>카테고리와 수량을 설정해요</Text>

          <Text style={s.label}>카테고리 <Text style={s.labelOptional}>(선택)</Text></Text>
          {catsLoading ? (
            <ActivityIndicator size="small" color={theme.colors.brand} style={{ alignSelf: 'flex-start', marginBottom: 16 }} />
          ) : categories.length === 0 ? (
            <Text style={s.noCatText}>생필품 화면에서 카테고리를 먼저 추가해주세요</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <TouchableOpacity
                style={[s.catChip, selectedCategory === '' && s.catChipGray]}
                onPress={() => setSelectedCategory('')}
              >
                <Text style={[s.catChipText, selectedCategory === '' && s.catChipTextWhite]}>없음</Text>
              </TouchableOpacity>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catChip, selectedCategory === c.name && { backgroundColor: c.color, borderColor: c.color }]}
                  onPress={() => setSelectedCategory(c.name)}
                >
                  <Text style={[s.catChipText, selectedCategory === c.name && s.catChipTextWhite]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={s.label}>현재 수량</Text>
          <View style={s.qtyRow}>
            <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity(q => Math.max(0, q - 1))}>
              <Text style={s.qtyBtnText}>−</Text>
            </TouchableOpacity>
            {editingQty ? (
              <TextInput
                style={s.qtyInput}
                value={qtyInput}
                onChangeText={t => setQtyInput(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                keyboardAppearance="light"
                autoFocus
                returnKeyType="done"
                onBlur={() => { const p = parseInt(qtyInput); setQuantity(p >= 0 ? p : 0); setEditingQty(false); }}
                onSubmitEditing={() => { const p = parseInt(qtyInput); setQuantity(p >= 0 ? p : 0); setEditingQty(false); Keyboard.dismiss(); }}
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

          {/* 재고 부족 알림 on/off — 끄면 기준 수량 입력도 숨김 */}
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>재고 부족 알림</Text>
              <Text style={s.subLabel}>기준 수량 이하가 되면 알림을 보내요</Text>
            </View>
            <Switch
              value={notifyLowStock}
              onValueChange={setNotifyLowStock}
              trackColor={{ false: theme.colors.warm.edge, true: theme.colors.brand }}
              thumbColor="#fff"
            />
          </View>

          {notifyLowStock && (
            <>
              <Text style={[s.label, { marginTop: 24 }]}>알림 기준 수량</Text>
              <Text style={s.subLabel}>재고가 이 수량 이하로 떨어지면 알림을 보내요</Text>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => setThreshold(t => Math.max(1, t - 1))}>
                  <Text style={s.qtyBtnText}>−</Text>
                </TouchableOpacity>
                {editingThreshold ? (
                  <TextInput
                    style={s.qtyInput}
                    value={thresholdInput}
                    onChangeText={t => setThresholdInput(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    keyboardAppearance="light"
                    autoFocus
                    returnKeyType="done"
                    onBlur={() => { const p = parseInt(thresholdInput); setThreshold(p >= 1 ? p : 1); setEditingThreshold(false); }}
                    onSubmitEditing={() => { const p = parseInt(thresholdInput); setThreshold(p >= 1 ? p : 1); setEditingThreshold(false); Keyboard.dismiss(); }}
                  />
                ) : (
                  <TouchableOpacity onPress={() => { setThresholdInput(String(threshold)); setEditingThreshold(true); }}>
                    <Text style={s.qtyNum}>{threshold}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.qtyBtn} onPress={() => setThreshold(t => t + 1)}>
                  <Text style={s.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      );
    }

    // step 3
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.stepContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          <Text style={s.stepQuestion}>세부 내용을 적어요 <Text style={s.labelOptional}>(선택)</Text></Text>
          <View style={[s.inputBox, { paddingVertical: 14 }]}>
            <TextInput
              style={[s.input, { minHeight: 100, textAlignVertical: 'top' }]}
              placeholder="제품명 또는 메모를 자유롭게 적어보세요"
              placeholderTextColor={theme.colors.warm.lightOak}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={4}
              keyboardAppearance="light"
            />
          </View>

          {/* 장보기 자동 추가 토글 */}
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>다 쓰면 장보기에 자동 추가</Text>
              <Text style={s.subLabel}>알림 기준 수량 이하로 떨어지면 장보기에 올려요</Text>
            </View>
            <Switch
              value={autoAdd}
              onValueChange={setAutoAdd}
              trackColor={{ false: theme.colors.warm.edge, true: theme.colors.brand }}
              thumbColor="#fff"
            />
          </View>

          {/* 기본 구입처 (자동 추가 켜져 있을 때만) */}
          {autoAdd && (
            <>
              <Text style={[s.label, { marginTop: 20 }]}>기본 구입처 <Text style={s.labelOptional}>(선택)</Text></Text>
              <View style={s.inputBox}>
                <TextInput
                  style={s.input}
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
                      style={[s.catChip, storeTag === t && s.catChipGray]}
                      onPress={() => setStoreTag(storeTag === t ? '' : t)}
                    >
                      <Text style={[s.catChipText, storeTag === t && s.catChipTextWhite]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  const ctaLabel = () => {
    if (saving) return '저장 중...';
    if (step < TOTAL_STEPS) return '다음';
    return isEditing ? '수정 완료' : '저장';
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => { if (step > 1) setStep(s => s - 1); else navigation.goBack(); }}
          style={s.backBtn}
        >
          <ChevronLeft color={theme.colors.warm.dark} size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing ? '생필품 수정' : '생필품 추가'}</Text>
        <View style={s.headerRight} />
      </View>

      <Progress />

      <View style={{ flex: 1 }}>
        {renderStep()}
      </View>

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
  progressSegInactive: { backgroundColor: theme.colors.warm.edge },

  stepContent: { padding: 24, paddingBottom: 32 },
  stepQuestion: { fontSize: 22, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 32, lineHeight: 30 },

  label: { fontSize: 13, fontWeight: '600', color: theme.colors.brand, marginBottom: 10 },
  labelOptional: { fontSize: 12, fontWeight: '400', color: theme.colors.warm.lightOak },
  subLabel: { fontSize: 12, color: theme.colors.warm.lightOak, marginBottom: 10, marginTop: -6 },
  noCatText: { fontSize: 13, color: theme.colors.warm.lightOak, marginBottom: 16, fontStyle: 'italic' },

  inputBox: {
    backgroundColor: theme.colors.warm.ivory, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  input: { fontSize: 17, color: theme.colors.warm.dark, padding: 0 },

  catChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, marginRight: 8,
    backgroundColor: theme.colors.warm.ivory, borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  catChipGray: { backgroundColor: theme.colors.neutral, borderColor: theme.colors.neutral },
  catChipText: { fontSize: 13, color: theme.colors.brand, fontWeight: '500' },
  catChipTextWhite: { color: '#FFFFFF', fontWeight: '600' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 28 },
  tagSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, rowGap: 8 },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.warm.edge, alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 22, fontWeight: '700', color: theme.colors.warm.dark, lineHeight: 26 },
  qtyNum: { fontSize: 28, fontWeight: '700', color: theme.colors.warm.dark, minWidth: 40, textAlign: 'center' },
  qtyInput: {
    fontSize: 28, fontWeight: '700', color: theme.colors.warm.dark,
    minWidth: 60, textAlign: 'center',
    borderBottomWidth: 2, borderBottomColor: theme.colors.brand, padding: 0,
  },

  bottomBar: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: theme.colors.card },
  ctaBtn: {
    backgroundColor: theme.colors.brand, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

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

export default AddSupplyScreen;
