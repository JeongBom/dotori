// 생필품 추가/수정 화면
// - 제품명, 카테고리(동적), 수량, 알림 기준 수량, 세부내용

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { SupplyCategoryEntry } from '../types';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddSupply'>;
type RouteType = RouteProp<RootStackParamList, 'AddSupply'>;

const AddSupplyScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const supplyId = route.params?.supplyId ?? null;
  const isEditing = !!supplyId;

  const [familyId, setFamilyId] = useState<string | null>(route.params?.familyId ?? null);
  const [categories, setCategories] = useState<SupplyCategoryEntry[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);

  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [threshold, setThreshold] = useState(1);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // 수량 직접 입력
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

  // 수정 모드: 기존 데이터 로드
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

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('알림', '제품명을 입력해주세요.'); return; }

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
      } else {
        const { error } = await supabase.from('supplies').insert({
          family_id: fid,
          is_active: true,
          ...payload,
        });
        if (error) throw error;
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다. 다시 시도해주세요.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#5C3D1E" size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? '생필품 수정' : '생필품 추가'}</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          {/* 제품명 */}
          <Text style={styles.label}>제품명</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="예) 주방 세제, 샴푸, 두루마리 휴지"
              placeholderTextColor="#C49A6C"
              value={name}
              onChangeText={setName}
              autoCorrect={false}
              returnKeyType="done"
            />
          </View>

          {/* 카테고리 */}
          <Text style={[styles.label, { marginTop: 20 }]}>카테고리</Text>
          {catsLoading ? (
            <ActivityIndicator size="small" color="#8B5E3C" style={{ alignSelf: 'flex-start', marginBottom: 8 }} />
          ) : categories.length === 0 ? (
            <Text style={styles.noCatText}>생필품 화면에서 카테고리를 먼저 추가해주세요</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {/* 카테고리 없음 옵션 */}
              <TouchableOpacity
                style={[styles.catChip, selectedCategory === '' && styles.catChipActiveGray]}
                onPress={() => setSelectedCategory('')}
              >
                <Text style={[styles.catChipText, selectedCategory === '' && styles.catChipTextWhite]}>없음</Text>
              </TouchableOpacity>
              {categories.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.catChip,
                    selectedCategory === c.name && { backgroundColor: c.color, borderColor: c.color },
                  ]}
                  onPress={() => setSelectedCategory(c.name)}
                >
                  <Text style={[styles.catChipText, selectedCategory === c.name && styles.catChipTextWhite]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* 현재 수량 */}
          <Text style={[styles.label, { marginTop: 20 }]}>현재 수량</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setQuantity(q => Math.max(0, q - 1))}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>

            {editingQty ? (
              <TextInput
                style={styles.stepInput}
                value={qtyInput}
                onChangeText={t => setQtyInput(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                autoFocus
                returnKeyType="done"
                onBlur={() => { const p = parseInt(qtyInput); setQuantity(p >= 0 ? p : 0); setEditingQty(false); }}
                onSubmitEditing={() => { const p = parseInt(qtyInput); setQuantity(p >= 0 ? p : 0); setEditingQty(false); Keyboard.dismiss(); }}
              />
            ) : (
              <TouchableOpacity onPress={() => { setQtyInput(String(quantity)); setEditingQty(true); }}>
                <Text style={styles.stepNum}>{quantity}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.stepBtn} onPress={() => setQuantity(q => q + 1)}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* 알림 기준 수량 */}
          <Text style={[styles.label, { marginTop: 20 }]}>알림 기준 수량</Text>
          <Text style={styles.subLabel}>재고가 이 수량 이하로 떨어지면 알림을 보내요</Text>
          <View style={styles.stepperRow}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setThreshold(t => Math.max(1, t - 1))}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>

            {editingThreshold ? (
              <TextInput
                style={styles.stepInput}
                value={thresholdInput}
                onChangeText={t => setThresholdInput(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                autoFocus
                returnKeyType="done"
                onBlur={() => { const p = parseInt(thresholdInput); setThreshold(p >= 1 ? p : 1); setEditingThreshold(false); }}
                onSubmitEditing={() => { const p = parseInt(thresholdInput); setThreshold(p >= 1 ? p : 1); setEditingThreshold(false); Keyboard.dismiss(); }}
              />
            ) : (
              <TouchableOpacity onPress={() => { setThresholdInput(String(threshold)); setEditingThreshold(true); }}>
                <Text style={styles.stepNum}>{threshold}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.stepBtn} onPress={() => setThreshold(t => t + 1)}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* 세부내용 */}
          <Text style={[styles.label, { marginTop: 20 }]}>세부내용</Text>
          <View style={[styles.inputBox, styles.noteBox]}>
            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="제품명 또는 메모를 자유롭게 적어보세요 (선택사항)"
              placeholderTextColor="#C49A6C"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        {/* 하단 저장 버튼 */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving ? '저장 중...' : (isEditing ? '수정 완료' : '저장')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#DEC8A8',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#5C3D1E' },
  headerRight: { width: 40 },

  content: { padding: 20, paddingBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginBottom: 8 },
  subLabel: { fontSize: 12, color: '#C49A6C', marginBottom: 8, marginTop: -4 },

  inputBox: {
    backgroundColor: '#FFF8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#DEC8A8',
  },
  input: { fontSize: 16, color: '#5C3D1E', padding: 0 },
  noteBox: { paddingVertical: 12 },
  noteInput: { minHeight: 72 },

  noCatText: { fontSize: 13, color: '#C49A6C', marginBottom: 8, fontStyle: 'italic' },

  chipScroll: { marginBottom: 4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8',
  },
  catChipActiveGray: { backgroundColor: '#9EA8B0', borderColor: '#9EA8B0' },
  catChipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '500' },
  catChipTextWhite: { color: '#FFFFFF', fontWeight: '600' },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EDD9C0', alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, fontWeight: '700', color: '#5C3D1E', lineHeight: 24 },
  stepNum: { fontSize: 22, fontWeight: '800', color: '#5C3D1E', minWidth: 32, textAlign: 'center' },
  stepInput: {
    fontSize: 22, fontWeight: '800', color: '#5C3D1E',
    minWidth: 52, textAlign: 'center',
    borderBottomWidth: 2, borderBottomColor: '#8B5E3C',
    padding: 0,
  },

  bottomBar: {
    paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: '#EDD9C0',
    backgroundColor: '#FDF6EC',
  },
  saveBtn: {
    backgroundColor: '#8B5E3C', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default AddSupplyScreen;
