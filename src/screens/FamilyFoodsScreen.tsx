// 자주 쓰는 음식 관리 화면
// - 등록된 음식 목록 조회
// - 각 음식의 보관기간 수정
// - 음식 삭제

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Pencil, Trash2, X, Check } from 'lucide-react-native';
import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { FamilyFood } from '../types';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'FamilyFoods'>;

const FamilyFoodsScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [foods, setFoods] = useState<FamilyFood[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 수정 모달 상태
  const [editTarget, setEditTarget] = useState<FamilyFood | null>(null);
  const [editFridge, setEditFridge] = useState('');
  const [editFreezer, setEditFreezer] = useState('');
  const [editRoom, setEditRoom] = useState('');

  const loadFoods = useCallback(async () => {
    const fid = await getOrCreateFamilyId();
    if (!fid) return;
    setFamilyId(fid);
    const { data } = await supabase
      .from('family_foods')
      .select('*')
      .eq('family_id', fid)
      .order('name');
    if (data) setFoods(data as FamilyFood[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadFoods(); }, [loadFoods]);

  const openEdit = (food: FamilyFood) => {
    setEditTarget(food);
    setEditFridge(food.fridge_days != null ? String(food.fridge_days) : '');
    setEditFreezer(food.freezer_days != null ? String(food.freezer_days) : '');
    setEditRoom(food.room_days != null ? String(food.room_days) : '');
  };

  const handleSaveEdit = async () => {
    if (!editTarget || !familyId) return;
    const updated = {
      fridge_days:  editFridge  ? parseInt(editFridge)  : null,
      freezer_days: editFreezer ? parseInt(editFreezer) : null,
      room_days:    editRoom    ? parseInt(editRoom)    : null,
    };
    await supabase.from('family_foods').update(updated).eq('id', editTarget.id);
    setFoods(prev => prev.map(f => f.id === editTarget.id ? { ...f, ...updated } : f));
    setEditTarget(null);
  };

  const handleDelete = (food: FamilyFood) => {
    Alert.alert('삭제', `"${food.name}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await supabase.from('family_foods').delete().eq('id', food.id);
          setFoods(prev => prev.filter(f => f.id !== food.id));
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: FamilyFood }) => (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.name}</Text>
        <View style={styles.daysRow}>
          {item.fridge_days  != null && <DayChip label="냉장" days={item.fridge_days}  color="#EDD9C0" textColor="#8B5E3C" />}
          {item.freezer_days != null && <DayChip label="냉동" days={item.freezer_days} color="#C8D8F0" textColor="#5A7EC9" />}
          {item.room_days    != null && <DayChip label="실온" days={item.room_days}    color="#F0E8D4" textColor="#A07840" />}
        </View>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
          <Pencil color="#8B5E3C" size={18} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
          <Trash2 color="#D95F4B" size={18} strokeWidth={2} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft color="#5C3D1E" size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>자주 쓰는 음식</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? null : foods.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>저장된 음식이 없어요</Text>
          <Text style={styles.emptyDesc}>음식을 등록할 때 체크박스로 추가해보세요</Text>
        </View>
      ) : (
        <FlatList
          data={foods}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16 }}
        />
      )}

      {/* 수정 모달 */}
      <Modal visible={!!editTarget} transparent animationType="fade">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editTarget?.name}</Text>
              <TouchableOpacity onPress={() => setEditTarget(null)}>
                <X color="#C49A6C" size={20} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>각 보관 방법별 권장 일수를 입력하세요 (비워두면 미설정)</Text>

            {[
              { label: '냉장 보관', value: editFridge,  setter: setEditFridge,  color: '#8B5E3C' },
              { label: '냉동 보관', value: editFreezer, setter: setEditFreezer, color: '#5A7EC9' },
              { label: '실온 보관', value: editRoom,    setter: setEditRoom,    color: '#A07840' },
            ].map(({ label, value, setter, color }) => (
              <View key={label} style={styles.inputRow}>
                <Text style={[styles.inputLabel, { color }]}>{label}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.dayInput}
                    value={value}
                    onChangeText={setter}
                    keyboardType="number-pad"
                    placeholder="일수"
                    placeholderTextColor="#C49A6C"
                    maxLength={4}
                  />
                  <Text style={styles.dayUnit}>일</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
              <Check color="#FFFFFF" size={18} strokeWidth={2.5} />
              <Text style={styles.saveBtnText}>저장</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const DayChip: React.FC<{ label: string; days: number; color: string; textColor: string }> = ({ label, days, color, textColor }) => (
  <View style={[styles.dayChip, { backgroundColor: color }]}>
    <Text style={[styles.dayChipText, { color: textColor }]}>{label} {days}일</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#DEC8A8',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#5C3D1E' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#C49A6C' },
  emptyDesc: { fontSize: 13, color: '#D4B896' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF8F0', borderRadius: 14,
    padding: 14, marginBottom: 10,
    shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#5C3D1E', marginBottom: 6 },
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  dayChipText: { fontSize: 11, fontWeight: '600' },
  rowActions: { flexDirection: 'row', gap: 12 },
  actionBtn: { padding: 4 },

  // 모달
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center', paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#FFF8F0', borderRadius: 20, padding: 24,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#5C3D1E' },
  modalDesc: { fontSize: 12, color: '#C49A6C', marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  inputLabel: { fontSize: 14, fontWeight: '600' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dayInput: {
    width: 72, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FFFFFF', borderRadius: 10,
    borderWidth: 1, borderColor: '#DEC8A8',
    fontSize: 16, color: '#5C3D1E', textAlign: 'center',
  },
  dayUnit: { fontSize: 14, color: '#8B5E3C', fontWeight: '600' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8,
    backgroundColor: '#8B5E3C', borderRadius: 12, paddingVertical: 14,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});

export default FamilyFoodsScreen;
