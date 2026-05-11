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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Check } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { SupplyCategoryEntry } from '../types';
import { RootStackParamList } from '../navigation';

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

      const { data } = await supabase
        .from('supply_categories')
        .select('*')
        .eq('family_id', fid)
        .order('created_at', { ascending: true });

      if (data) setCategories(data as SupplyCategoryEntry[]);
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
                placeholderTextColor="#C49A6C"
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
            <ActivityIndicator size="small" color="#8B5E3C" style={{ alignSelf: 'flex-start', marginBottom: 16 }} />
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

          <Text style={[s.label, { marginTop: 28 }]}>알림 기준 수량</Text>
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
              placeholderTextColor="#C49A6C"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={4}
              keyboardAppearance="light"
            />
          </View>
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
          <ChevronLeft color="#5C3D1E" size={24} strokeWidth={2} />
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
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#5C3D1E' },
  headerRight: { width: 40 },

  progressRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 6, marginBottom: 4 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  progressSegActive: { backgroundColor: '#8B5E3C' },
  progressSegInactive: { backgroundColor: '#EDD9C0' },

  stepContent: { padding: 24, paddingBottom: 32 },
  stepQuestion: { fontSize: 22, fontWeight: '800', color: '#5C3D1E', marginBottom: 32, lineHeight: 30 },

  label: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginBottom: 10 },
  labelOptional: { fontSize: 12, fontWeight: '400', color: '#C49A6C' },
  subLabel: { fontSize: 12, color: '#C49A6C', marginBottom: 10, marginTop: -6 },
  noCatText: { fontSize: 13, color: '#C49A6C', marginBottom: 16, fontStyle: 'italic' },

  inputBox: {
    backgroundColor: '#FFF8F0', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: '#DEC8A8',
  },
  input: { fontSize: 17, color: '#5C3D1E', padding: 0 },

  catChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, marginRight: 8,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8',
  },
  catChipGray: { backgroundColor: '#9EA8B0', borderColor: '#9EA8B0' },
  catChipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '500' },
  catChipTextWhite: { color: '#FFFFFF', fontWeight: '600' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  qtyBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EDD9C0', alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnText: { fontSize: 22, fontWeight: '700', color: '#5C3D1E', lineHeight: 26 },
  qtyNum: { fontSize: 28, fontWeight: '800', color: '#5C3D1E', minWidth: 40, textAlign: 'center' },
  qtyInput: {
    fontSize: 28, fontWeight: '800', color: '#5C3D1E',
    minWidth: 60, textAlign: 'center',
    borderBottomWidth: 2, borderBottomColor: '#8B5E3C', padding: 0,
  },

  bottomBar: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#FFFFFF' },
  ctaBtn: {
    backgroundColor: '#8B5E3C', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  doneCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#8B5E3C', alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#5C3D1E', marginBottom: 10 },
  doneSub: { fontSize: 15, color: '#A87850', textAlign: 'center', lineHeight: 22, marginBottom: 48 },
  doneBtn: {
    backgroundColor: '#8B5E3C', borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 48,
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default AddSupplyScreen;
