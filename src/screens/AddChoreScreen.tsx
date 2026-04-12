// 루틴/할일 추가·수정 화면
// - 제목, 태그, 담당자, 반복 주기, 마감일 설정
// - 1인 가구 시 담당자 UI 숨김

import React, { useState, useEffect, useCallback } from 'react';
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
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus, X, ChevronDown } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Chore, ChoreTag, RepeatType, UserProfile } from '../types';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddChore'>;
type RouteType = RouteProp<RootStackParamList, 'AddChore'>;

// ── 날짜 유틸 ──────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !isNaN(new Date(s).getTime());
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

// ── 날짜 선택 모달 ────────────────────────────

interface DatePickerModalProps {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({ visible, value, onConfirm, onCancel }) => {
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useEffect(() => {
    if (visible) setTempDate(value && isValidDate(value) ? new Date(value) : new Date());
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
    return <DateTimePicker value={tempDate} mode="date" display="calendar" onChange={onChange} />;
  }

  const w = Dimensions.get('window').width - 32;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={dpStyles.overlay}>
        <View style={[dpStyles.container, { width: w }]}>
          <Text style={dpStyles.title}>날짜 선택</Text>
          <DateTimePicker
            value={tempDate} mode="date" display="inline" onChange={onChange}
            locale="ko-KR" style={{ width: w - 16, alignSelf: 'center' }} accentColor="#8B5E3C"
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

// ── 반복 주기 옵션 ────────────────────────────

const REPEAT_OPTIONS: { type: RepeatType; label: string }[] = [
  { type: 'none', label: '없음' },
  { type: 'daily', label: '매일' },
  { type: 'weekly', label: '매주' },
  { type: 'monthly', label: '매달' },
  { type: 'custom', label: '직접' },
];

// ── 메인 화면 ─────────────────────────────────

const AddChoreScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const choreId = route.params?.choreId ?? null;
  const isEditing = !!choreId;

  const [familyId, setFamilyId] = useState<string | null>(route.params?.familyId ?? null);
  const [tags, setTags] = useState<ChoreTag[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [tagId, setTagId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null); // null = 모두
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [repeatInterval, setRepeatInterval] = useState('7');
  const [dueDate, setDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // 새 태그 인라인 추가
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const isSolo = members.length <= 1;

  // 초기 데이터 로드
  useEffect(() => {
    (async () => {
      const fid = familyId ?? await getOrCreateFamilyId();
      if (fid) setFamilyId(fid);

      const [tagsRes, membersRes] = await Promise.all([
        supabase.from('chore_tags').select('*').eq('family_id', fid).order('created_at'),
        supabase.from('user_profiles').select('id, nickname').eq('family_id', fid),
      ]);
      if (!tagsRes.error && tagsRes.data) setTags(tagsRes.data as ChoreTag[]);
      if (!membersRes.error && membersRes.data) setMembers(membersRes.data as UserProfile[]);

      // 수정 모드: 기존 데이터 로드
      if (choreId) {
        const { data } = await supabase.from('chores').select('*').eq('id', choreId).single();
        if (data) {
          setTitle(data.title);
          setTagId(data.tag_id ?? null);
          setAssignedTo(data.assigned_to ?? null);
          setRepeatType(data.repeat_type as RepeatType);
          setRepeatInterval(data.repeat_interval ? String(data.repeat_interval) : '7');
          setDueDate(data.due_date ?? '');
        }
      }
    })();
  }, [choreId, familyId]);

  // 새 태그 추가
  const handleAddNewTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    if (!familyId) return;
    if (tags.some(t => t.name === name)) { Alert.alert('알림', '이미 같은 이름의 태그가 있어요.'); return; }
    const { data, error } = await supabase.from('chore_tags').insert({ family_id: familyId, name }).select().single();
    if (!error && data) {
      const newTag = data as ChoreTag;
      setTags(prev => [...prev, newTag]);
      setTagId(newTag.id);
    }
    setNewTagName('');
    setShowNewTagInput(false);
    Keyboard.dismiss();
  }, [familyId, tags, newTagName]);

  // 저장
  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('알림', '제목을 입력해주세요.'); return; }
    const interval = repeatType === 'custom' ? parseInt(repeatInterval) : null;
    if (repeatType === 'custom' && (!interval || interval < 1)) {
      Alert.alert('알림', '반복 주기를 올바르게 입력해주세요. (1 이상)'); return;
    }

    const fid = familyId ?? await getOrCreateFamilyId();
    if (!fid) { Alert.alert('오류', '가족 정보를 생성할 수 없습니다.'); return; }
    if (!familyId) setFamilyId(fid);

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        tag_id: tagId,
        assigned_to: isSolo ? null : assignedTo,
        repeat_type: repeatType,
        repeat_interval: interval,
        due_date: dueDate || null,
      };

      if (isEditing && choreId) {
        const { error } = await supabase.from('chores').update(payload).eq('id', choreId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('chores').insert({
          family_id: fid,
          ...payload,
          is_done: false,
          last_done_at: null,
          is_active: true,
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
        <Text style={styles.headerTitle}>{isEditing ? '루틴 수정' : '루틴 추가'}</Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          {/* 제목 */}
          <Text style={styles.label}>제목</Text>
          <View style={styles.inputBox}>
            <TextInput
              style={styles.input}
              placeholder="할 일을 입력하세요"
              placeholderTextColor="#C49A6C"
              value={title}
              onChangeText={setTitle}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              maxLength={50}
            />
          </View>

          {/* 태그 */}
          <Text style={[styles.label, { marginTop: 24 }]}>태그</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {/* 없음 칩 */}
            <TouchableOpacity
              style={[styles.chip, tagId === null && styles.chipActive]}
              onPress={() => setTagId(null)}
            >
              <Text style={[styles.chipText, tagId === null && styles.chipTextActive]}>없음</Text>
            </TouchableOpacity>

            {/* 기존 태그 칩 */}
            {tags.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.chip, tagId === t.id && styles.chipActive]}
                onPress={() => setTagId(t.id)}
              >
                <Text style={[styles.chipText, tagId === t.id && styles.chipTextActive]}>{t.name}</Text>
              </TouchableOpacity>
            ))}

            {/* 새 태그 추가 버튼 */}
            {!showNewTagInput && (
              <TouchableOpacity style={styles.addChip} onPress={() => setShowNewTagInput(true)}>
                <Plus color="#8B5E3C" size={13} strokeWidth={2.5} />
                <Text style={styles.addChipText}>새 태그</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* 인라인 새 태그 입력 */}
          {showNewTagInput && (
            <View style={styles.newTagRow}>
              <View style={styles.newTagInputBox}>
                <TextInput
                  style={styles.newTagInput}
                  placeholder="태그 이름"
                  placeholderTextColor="#C49A6C"
                  value={newTagName}
                  onChangeText={setNewTagName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleAddNewTag}
                  maxLength={12}
                />
              </View>
              <TouchableOpacity style={styles.newTagSaveBtn} onPress={handleAddNewTag}>
                <Text style={styles.newTagSaveBtnText}>추가</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowNewTagInput(false); setNewTagName(''); }}>
                <X color="#C49A6C" size={18} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )}

          {/* 담당자 */}
          <Text style={[styles.label, { marginTop: 24 }]}>담당자</Text>
          {isSolo ? (
            <Text style={styles.soloHint}>가족을 초대하면 담당자를 지정할 수 있어요</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              <TouchableOpacity
                style={[styles.chip, assignedTo === null && styles.chipActive]}
                onPress={() => setAssignedTo(null)}
              >
                <Text style={[styles.chipText, assignedTo === null && styles.chipTextActive]}>모두</Text>
              </TouchableOpacity>
              {members.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.chip, assignedTo === m.id && styles.chipActive]}
                  onPress={() => setAssignedTo(m.id)}
                >
                  <Text style={[styles.chipText, assignedTo === m.id && styles.chipTextActive]}>{m.nickname}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* 반복 주기 — 한 줄 가로 스크롤 */}
          <Text style={[styles.label, { marginTop: 24 }]}>반복</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repeatScroll} contentContainerStyle={styles.repeatScrollContent}>
            {REPEAT_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.type}
                style={[styles.repeatBtn, repeatType === opt.type && styles.repeatBtnActive]}
                onPress={() => setRepeatType(opt.type)}
              >
                <Text style={[styles.repeatBtnText, repeatType === opt.type && styles.repeatBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 직접 설정 선택 시 주기 입력 (다음 줄) */}
          {repeatType === 'custom' && (
            <View style={styles.customIntervalRow}>
              <View style={styles.customIntervalBox}>
                <TextInput
                  style={styles.customIntervalInput}
                  value={repeatInterval}
                  onChangeText={v => setRepeatInterval(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  maxLength={3}
                  selectTextOnFocus
                />
              </View>
              <Text style={styles.customIntervalLabel}>일마다 반복</Text>
            </View>
          )}

          {/* 날짜 */}
          <Text style={[styles.label, { marginTop: 24 }]}>날짜</Text>
          <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
            <Text style={[styles.dateText, !dueDate && styles.datePlaceholder]}>
              {dueDate ? formatDisplayDate(dueDate) : '없음 (선택사항)'}
            </Text>
            <ChevronDown color="#8B5E3C" size={18} strokeWidth={2} />
          </TouchableOpacity>
          {dueDate ? (
            <TouchableOpacity style={styles.clearDate} onPress={() => setDueDate('')}>
              <Text style={styles.clearDateText}>날짜 초기화</Text>
            </TouchableOpacity>
          ) : null}

        </ScrollView>

        {/* 저장 버튼 */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? '저장 중...' : (isEditing ? '수정 완료' : '저장')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 날짜 선택 모달 */}
      <DatePickerModal
        visible={showDatePicker}
        value={dueDate || todayStr()}
        onConfirm={d => { setDueDate(d); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
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
  label: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginBottom: 10 },

  // 입력
  inputBox: { backgroundColor: '#FFF8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#DEC8A8' },
  input: { fontSize: 16, color: '#5C3D1E', padding: 0 },

  // 칩
  chipScroll: { marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8',
  },
  chipActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  chipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginRight: 8,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8', borderStyle: 'dashed',
  },
  addChipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },

  // 새 태그 인라인
  newTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  newTagInputBox: { flex: 1, backgroundColor: '#FFF8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#DEC8A8' },
  newTagInput: { fontSize: 14, color: '#5C3D1E', padding: 0 },
  newTagSaveBtn: { backgroundColor: '#8B5E3C', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  newTagSaveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // 반복 (한 줄 가로 스크롤)
  repeatScroll: { marginBottom: 4 },
  repeatScrollContent: { gap: 8, alignItems: 'center', paddingRight: 4 },
  repeatBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8', alignItems: 'center',
  },
  repeatBtnActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  repeatBtnText: { fontSize: 14, fontWeight: '600', color: '#8B5E3C' },
  repeatBtnTextActive: { color: '#FFFFFF' },

  // 직접 설정 다음 줄 입력
  customIntervalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  customIntervalBox: {
    width: 72, backgroundColor: '#FFF8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#DEC8A8', alignItems: 'center',
  },
  customIntervalInput: { fontSize: 18, fontWeight: '700', color: '#5C3D1E', textAlign: 'center', padding: 0, width: '100%' },
  customIntervalLabel: { fontSize: 15, color: '#5C3D1E', fontWeight: '500' },

  // 솔로 안내
  soloHint: { fontSize: 13, color: '#C49A6C', fontStyle: 'italic' },

  // 날짜
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: '#DEC8A8',
  },
  dateText: { fontSize: 16, color: '#5C3D1E', fontWeight: '500' },
  datePlaceholder: { color: '#C49A6C' },
  clearDate: { marginTop: 8, alignSelf: 'flex-start' },
  clearDateText: { fontSize: 12, color: '#C49A6C', textDecorationLine: 'underline' },

  // 하단 저장
  bottomBar: { paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#EDD9C0', backgroundColor: '#FDF6EC' },
  saveBtn: { backgroundColor: '#8B5E3C', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default AddChoreScreen;
