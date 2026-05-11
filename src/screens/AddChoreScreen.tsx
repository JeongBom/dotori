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
  Keyboard,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Plus, X, ChevronDown, Check } from 'lucide-react-native';
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

const REPEAT_OPTIONS: { type: RepeatType; label: string }[] = [
  { type: 'none', label: '없음' },
  { type: 'daily', label: '매일' },
  { type: 'weekly', label: '매주' },
  { type: 'monthly', label: '매달' },
  { type: 'custom', label: '직접' },
];

const TOTAL_STEPS = 3;

// ── 메인 화면 ─────────────────────────────────

const AddChoreScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const choreId = route.params?.choreId ?? null;
  const occurrenceDate = route.params?.occurrenceDate ?? null;
  const editMode = route.params?.editMode ?? null;
  const isEditing = !!choreId;

  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const doneOpacity = useRef(new Animated.Value(0)).current;
  const doneScale = useRef(new Animated.Value(0.85)).current;
  const titleInputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isEditing) {
        const t = setTimeout(() => titleInputRef.current?.focus(), 600);
        return () => clearTimeout(t);
      }
    }, [isEditing])
  );

  const [familyId, setFamilyId] = useState<string | null>(route.params?.familyId ?? null);
  const [tags, setTags] = useState<ChoreTag[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);

  const [title, setTitle] = useState('');
  const [tagId, setTagId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [repeatType, setRepeatType] = useState<RepeatType>('none');
  const [customUnit, setCustomUnit] = useState<'week' | 'month'>('week');
  const [customCount, setCustomCount] = useState(1);
  const [customDayOfWeek, setCustomDayOfWeek] = useState(new Date().getDay());
  const [customWeekOfMonth, setCustomWeekOfMonth] = useState(1);
  const [dueDate, setDueDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const isSolo = members.length <= 1;

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

      if (choreId) {
        const { data } = await supabase.from('chores').select('*').eq('id', choreId).single();
        if (data) {
          setTitle(data.title);
          setTagId(data.tag_id ?? null);
          setAssignedTo(data.assigned_to ?? null);
          setRepeatType(data.repeat_type as RepeatType);
          if (data.repeat_unit) setCustomUnit(data.repeat_unit as 'week' | 'month');
          if (data.repeat_interval) setCustomCount(data.repeat_interval);
          if (data.repeat_day_of_week != null) setCustomDayOfWeek(data.repeat_day_of_week);
          if (data.repeat_week_of_month != null) setCustomWeekOfMonth(data.repeat_week_of_month);
          setDueDate(data.due_date ?? '');
        }
      }
    })();
  }, [choreId, familyId]);

  const handleAddNewTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name || !familyId) return;
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

  const goNext = () => {
    if (step === 1 && !title.trim()) {
      Alert.alert('알림', '제목을 입력해주세요.');
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
        title: title.trim(),
        tag_id: tagId,
        assigned_to: isSolo ? null : assignedTo,
        repeat_type: repeatType,
        repeat_interval: repeatType === 'custom' ? customCount : null,
        repeat_unit: repeatType === 'custom' ? customUnit : null,
        repeat_day_of_week: repeatType === 'custom' ? customDayOfWeek : null,
        repeat_week_of_month: repeatType === 'custom' && customUnit === 'month' ? customWeekOfMonth : null,
        due_date: dueDate || null,
      };

      if (isEditing && choreId && editMode === 'this' && occurrenceDate) {
        const { data: orig } = await supabase.from('chores').select('excluded_dates').eq('id', choreId).single();
        const newExcluded = [...((orig?.excluded_dates as string[] | null) ?? []), occurrenceDate];
        await supabase.from('chores').update({ excluded_dates: newExcluded }).eq('id', choreId);
        const { error } = await supabase.from('chores').insert({
          family_id: fid, ...payload,
          repeat_type: 'none', repeat_interval: null, repeat_unit: null,
          repeat_day_of_week: null, repeat_week_of_month: null,
          due_date: occurrenceDate,
          is_done: false, last_done_at: null, is_active: true,
        });
        if (error) throw error;
        navigation.goBack();

      } else if (isEditing && choreId && editMode === 'future' && occurrenceDate) {
        await supabase.from('chores').update({ end_date: occurrenceDate }).eq('id', choreId);
        const { error } = await supabase.from('chores').insert({
          family_id: fid, ...payload,
          due_date: occurrenceDate,
          is_done: false, last_done_at: null, is_active: true,
        });
        if (error) throw error;
        navigation.goBack();

      } else if (isEditing && choreId) {
        const { error } = await supabase.from('chores').update(payload).eq('id', choreId);
        if (error) throw error;
        navigation.goBack();

      } else {
        const { error } = await supabase.from('chores').insert({
          family_id: fid, ...payload,
          is_done: false, last_done_at: null, is_active: true,
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
          <Text style={s.doneTitle}>일정을 추가했어요!</Text>
          <Text style={s.doneSub}>{title}</Text>
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
            <Text style={s.stepQuestion}>무엇을 할 건가요?</Text>
            <View style={s.inputBox}>
              <TextInput
                ref={titleInputRef}
                style={s.input}
                placeholder="할 일을 입력하세요"
                placeholderTextColor="#C49A6C"
                value={title}
                onChangeText={setTitle}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                maxLength={50}
                keyboardAppearance="light"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    if (step === 2) {
      return (
        <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.stepQuestion}>태그와 담당자를 정해요</Text>

          <Text style={s.label}>태그 <Text style={s.labelOptional}>(선택)</Text></Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <TouchableOpacity
              style={[s.chip, tagId === null && s.chipActive]}
              onPress={() => setTagId(null)}
            >
              <Text style={[s.chipText, tagId === null && s.chipTextActive]}>없음</Text>
            </TouchableOpacity>
            {tags.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[s.chip, tagId === t.id && s.chipActive]}
                onPress={() => setTagId(t.id)}
              >
                <Text style={[s.chipText, tagId === t.id && s.chipTextActive]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
            {!showNewTagInput && (
              <TouchableOpacity style={s.addChip} onPress={() => setShowNewTagInput(true)}>
                <Plus color="#8B5E3C" size={13} strokeWidth={2.5} />
                <Text style={s.addChipText}>새 태그</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {showNewTagInput && (
            <View style={[s.newTagRow, { marginBottom: 16 }]}>
              <View style={s.newTagInputBox}>
                <TextInput
                  style={s.newTagInput}
                  placeholder="태그 이름"
                  placeholderTextColor="#C49A6C"
                  value={newTagName}
                  onChangeText={setNewTagName}
                  autoFocus
                  returnKeyType="done"
                  keyboardAppearance="light"
                  onSubmitEditing={handleAddNewTag}
                  maxLength={12}
                />
              </View>
              <TouchableOpacity style={s.newTagSaveBtn} onPress={handleAddNewTag}>
                <Text style={s.newTagSaveBtnText}>추가</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowNewTagInput(false); setNewTagName(''); }}>
                <X color="#C49A6C" size={18} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )}

          <Text style={[s.label, { marginTop: 20 }]}>담당자 <Text style={s.labelOptional}>(선택)</Text></Text>
          {isSolo ? (
            <Text style={s.soloHint}>가족을 초대하면 담당자를 지정할 수 있어요</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[s.chip, assignedTo === null && s.chipActive]}
                onPress={() => setAssignedTo(null)}
              >
                <Text style={[s.chipText, assignedTo === null && s.chipTextActive]}>모두</Text>
              </TouchableOpacity>
              {members.map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={[s.chip, assignedTo === m.id && s.chipActive]}
                  onPress={() => setAssignedTo(m.id)}
                >
                  <Text style={[s.chipText, assignedTo === m.id && s.chipTextActive]}>{m.nickname}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </ScrollView>
      );
    }

    // step 3
    return (
      <ScrollView contentContainerStyle={s.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.stepQuestion}>반복과 날짜를 설정해요</Text>

        <Text style={s.label}>반복</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
          {REPEAT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.type}
              style={[s.repeatBtn, repeatType === opt.type && s.repeatBtnActive]}
              onPress={() => setRepeatType(opt.type)}
            >
              <Text style={[s.repeatBtnText, repeatType === opt.type && s.repeatBtnTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {repeatType === 'custom' && (
          <View style={s.customBox}>
            <View style={s.customUnitRow}>
              {(['week', 'month'] as const).map(u => (
                <TouchableOpacity
                  key={u}
                  style={[s.customUnitBtn, customUnit === u && s.customUnitBtnActive]}
                  onPress={() => setCustomUnit(u)}
                >
                  <Text style={[s.customUnitText, customUnit === u && s.customUnitTextActive]}>
                    {u === 'week' ? '주' : '개월'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.customSubLabel}>몇 {customUnit === 'week' ? '주' : '개월'}?</Text>
            <View style={s.customCountRow}>
              {[1, 2, 3, 4, 6].map(n => (
                <TouchableOpacity
                  key={n}
                  style={[s.customCountBtn, customCount === n && s.customCountBtnActive]}
                  onPress={() => setCustomCount(n)}
                >
                  <Text style={[s.customCountText, customCount === n && s.customCountTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {customUnit === 'month' && (
              <>
                <Text style={s.customSubLabel}>몇째 주?</Text>
                <View style={s.customCountRow}>
                  {[1, 2, 3, 4].map(w => (
                    <TouchableOpacity
                      key={w}
                      style={[s.customCountBtn, customWeekOfMonth === w && s.customCountBtnActive]}
                      onPress={() => setCustomWeekOfMonth(w)}
                    >
                      <Text style={[s.customCountText, customWeekOfMonth === w && s.customCountTextActive]}>{w}째</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={s.customSubLabel}>무슨 요일?</Text>
            <View style={s.dowRow}>
              {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.dowBtn, customDayOfWeek === i && s.dowBtnActive]}
                  onPress={() => setCustomDayOfWeek(i)}
                >
                  <Text style={[s.dowText, customDayOfWeek === i && s.dowTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.customPreview}>
              {customCount}
              {customUnit === 'week' ? '주' : '개월'}마다
              {customUnit === 'month' ? ` ${customWeekOfMonth}째주` : ''}
              {' '}
              {['일', '월', '화', '수', '목', '금', '토'][customDayOfWeek]}요일
            </Text>
          </View>
        )}

        <Text style={[s.label, { marginTop: 24 }]}>{repeatType === 'custom' ? '종료일' : '날짜'} <Text style={s.labelOptional}>(선택)</Text></Text>
        <TouchableOpacity style={s.dateRow} onPress={() => setShowDatePicker(true)}>
          <Text style={[s.dateText, !dueDate && s.datePlaceholder]}>
            {dueDate ? formatDisplayDate(dueDate) : '없음 (선택사항)'}
          </Text>
          <ChevronDown color="#8B5E3C" size={18} strokeWidth={2} />
        </TouchableOpacity>
        {dueDate ? (
          <TouchableOpacity style={s.clearDate} onPress={() => setDueDate('')}>
            <Text style={s.clearDateText}>날짜 초기화</Text>
          </TouchableOpacity>
        ) : null}
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
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => { if (step > 1) setStep(st => st - 1); else navigation.goBack(); }}
          style={s.backBtn}
        >
          <ChevronLeft color="#5C3D1E" size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing ? '일정 수정' : '일정 추가'}</Text>
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

      <DatePickerModal
        visible={showDatePicker}
        value={dueDate || todayStr()}
        onConfirm={d => { setDueDate(d); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
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
  soloHint: { fontSize: 13, color: '#C49A6C', fontStyle: 'italic', marginBottom: 8 },

  inputBox: { backgroundColor: '#FFF8F0', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: '#DEC8A8' },
  input: { fontSize: 17, color: '#5C3D1E', padding: 0 },

  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, marginRight: 8,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8',
  },
  chipActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  chipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  addChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, marginRight: 8,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8', borderStyle: 'dashed',
  },
  addChipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },

  newTagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  newTagInputBox: { flex: 1, backgroundColor: '#FFF8F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#DEC8A8' },
  newTagInput: { fontSize: 14, color: '#5C3D1E', padding: 0 },
  newTagSaveBtn: { backgroundColor: '#8B5E3C', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  newTagSaveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  repeatBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8', alignItems: 'center',
  },
  repeatBtnActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  repeatBtnText: { fontSize: 14, fontWeight: '600', color: '#8B5E3C' },
  repeatBtnTextActive: { color: '#FFFFFF' },

  customBox: { backgroundColor: '#FFF8F0', borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#DEC8A8' },
  customSubLabel: { fontSize: 12, fontWeight: '600', color: '#8B5E3C', marginBottom: 8, marginTop: 12 },
  customUnitRow: { flexDirection: 'row', gap: 8 },
  customUnitBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#FDF6EC', borderWidth: 1, borderColor: '#DEC8A8' },
  customUnitBtnActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  customUnitText: { fontSize: 15, fontWeight: '700', color: '#8B5E3C' },
  customUnitTextActive: { color: '#FFFFFF' },
  customCountRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  customCountBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FDF6EC', borderWidth: 1, borderColor: '#DEC8A8' },
  customCountBtnActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  customCountText: { fontSize: 14, fontWeight: '600', color: '#8B5E3C' },
  customCountTextActive: { color: '#FFFFFF' },
  dowRow: { flexDirection: 'row', gap: 6 },
  dowBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#FDF6EC', borderWidth: 1, borderColor: '#DEC8A8' },
  dowBtnActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  dowText: { fontSize: 13, fontWeight: '600', color: '#8B5E3C' },
  dowTextActive: { color: '#FFFFFF' },
  customPreview: { marginTop: 12, fontSize: 13, fontWeight: '600', color: '#A87850', textAlign: 'center' },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFF8F0', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16,
    borderWidth: 1, borderColor: '#DEC8A8',
  },
  dateText: { fontSize: 16, color: '#5C3D1E', fontWeight: '500' },
  datePlaceholder: { color: '#C49A6C' },
  clearDate: { marginTop: 10, alignSelf: 'flex-start' },
  clearDateText: { fontSize: 12, color: '#C49A6C', textDecorationLine: 'underline' },

  bottomBar: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#FFFFFF' },
  ctaBtn: { backgroundColor: '#8B5E3C', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  doneCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#8B5E3C', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: '#5C3D1E', marginBottom: 10 },
  doneSub: { fontSize: 15, color: '#A87850', textAlign: 'center', lineHeight: 22, marginBottom: 48 },
  doneBtn: { backgroundColor: '#8B5E3C', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48 },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default AddChoreScreen;
