// 루틴/할일 화면
// - 반복 주기를 오늘부터 1달치 날짜로 전개해 표시
// - 오늘/이번주/이번달/전체 필터
// - 기한 초과 항목 빨간색

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import { Plus, CheckCircle2, Circle, Trash2, X, RefreshCw } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Chore, ChoreTag, RepeatType, UserProfile } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';

type ChoresNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Chores'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ── 날짜 헬퍼 ─────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// DST 문제 없는 날짜 덧셈
function addDays(base: string, n: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function thisMonthEnd(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().split('T')[0];
}

// ── 발생(Occurrence) 타입 ────────────────────

interface ChoreOccurrence {
  chore: Chore;
  date: string | null;   // null = 날짜 없는 단발 to-do
  isDone: boolean;
  isOverdue: boolean;
}

type PeriodFilter = '전체' | '오늘' | '이번주' | '이번달';

// ── 반복 주기 → 일수 변환 ────────────────────

function getIntervalDays(chore: Chore): number | null {
  if (chore.repeat_type === 'none') return null;
  if (chore.repeat_type === 'daily') return 1;
  if (chore.repeat_type === 'weekly') return 7;
  if (chore.repeat_type === 'monthly') return 30;
  if (chore.repeat_type === 'custom') return chore.repeat_interval ?? null;
  return null;
}

// last_done_at >= occDate 이면 완료 (이후 완료 = 이 날짜 포함 완료로 간주)
function isOccurrenceDone(chore: Chore, occDate: string): boolean {
  if (!chore.last_done_at) return false;
  return chore.last_done_at >= occDate;
}

// ── Occurrence 생성 ──────────────────────────

function generateOccurrences(chores: Chore[], fromDate: string, toDate: string): ChoreOccurrence[] {
  const today = todayStr();
  const result: ChoreOccurrence[] = [];

  for (const chore of chores) {
    const interval = getIntervalDays(chore);

    if (interval === null) {
      // 단발 to-do
      if (!chore.due_date) {
        // 날짜 없음: 전체에서만 표시
        result.push({ chore, date: null, isDone: chore.is_done, isOverdue: false });
      } else if (chore.due_date >= fromDate && chore.due_date <= toDate) {
        result.push({
          chore,
          date: chore.due_date,
          isDone: chore.is_done,
          isOverdue: !chore.is_done && chore.due_date < today,
        });
      }
      continue;
    }

    // 반복 chore: 앵커(due_date 또는 생성일)부터 간격마다 발생 생성
    const anchor = chore.due_date ?? chore.created_at.split('T')[0];

    // anchor 기준으로 fromDate 이상이 되는 첫 번째 n 계산
    const anchorTime = new Date(anchor).getTime();
    const fromTime = new Date(fromDate).getTime();
    const intervalMs = interval * 86400000;
    const nStart = Math.max(0, Math.ceil((fromTime - anchorTime) / intervalMs));

    for (let n = nStart; ; n++) {
      // 정수 기반 날짜 계산 (DST 안전)
      const occDate = addDays(anchor, n * interval);
      if (occDate > toDate) break;

      const done = isOccurrenceDone(chore, occDate);
      result.push({
        chore,
        date: occDate,
        isDone: done,
        isOverdue: !done && occDate < today,
      });
    }
  }

  return result;
}

// ── 기간 필터 → 날짜 범위 ────────────────────

function getPeriodRange(period: PeriodFilter): [string, string] {
  const today = todayStr();
  if (period === '오늘')   return [addDays(today, -30), today];
  if (period === '이번주') return [today, addDays(today, 7)];
  if (period === '이번달') return [today, thisMonthEnd()];
  return [addDays(today, -7), addDays(today, 30)]; // 전체
}

// ── 반복 라벨 ────────────────────────────────

function getRepeatLabel(repeat_type: RepeatType, repeat_interval: number | null): string | null {
  if (repeat_type === 'none')    return null;
  if (repeat_type === 'daily')   return '매일';
  if (repeat_type === 'weekly')  return '매주';
  if (repeat_type === 'monthly') return '매달';
  if (repeat_type === 'custom')  return `${repeat_interval ?? '?'}일마다`;
  return null;
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

// ── 스와이프 삭제 ─────────────────────────────

const RightAction: React.FC<{ onDelete: () => void }> = ({ onDelete }) => (
  <TouchableOpacity style={swipeStyles.btn} onPress={onDelete}>
    <Text style={swipeStyles.text}>삭제</Text>
  </TouchableOpacity>
);

const swipeStyles = StyleSheet.create({
  btn: {
    backgroundColor: '#D95F4B', justifyContent: 'center', alignItems: 'center',
    width: 80, marginBottom: 10, borderTopRightRadius: 14, borderBottomRightRadius: 14,
  },
  text: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});

// ── 아이템 행 ─────────────────────────────────

interface ChoreRowProps {
  occurrence: ChoreOccurrence;
  isSolo: boolean;
  onToggle: (occurrence: ChoreOccurrence) => void;
  onEdit: (chore: Chore) => void;
  onDelete: (chore: Chore) => void;
}

const ChoreRow: React.FC<ChoreRowProps> = React.memo(({ occurrence, isSolo, onToggle, onEdit, onDelete }) => {
  const swipeRef = useRef<Swipeable>(null);
  const { chore, date, isDone, isOverdue } = occurrence;
  const repeatLabel = getRepeatLabel(chore.repeat_type, chore.repeat_interval);

  const handleDelete = () => {
    swipeRef.current?.close();
    Alert.alert('삭제 확인', `'${chore.title}'을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(chore) },
    ]);
  };

  return (
    <Swipeable ref={swipeRef} renderRightActions={() => <RightAction onDelete={handleDelete} />} overshootRight={false}>
      <View style={[rowStyles.row, isDone && rowStyles.rowDone, isOverdue && rowStyles.rowOverdue]}>
        {/* 체크박스 */}
        <TouchableOpacity onPress={() => onToggle(occurrence)} style={rowStyles.checkbox} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {isDone
            ? <CheckCircle2 color="#8B5E3C" size={24} strokeWidth={2} />
            : <Circle color={isOverdue ? '#D95F4B' : '#D4B896'} size={24} strokeWidth={1.5} />
          }
        </TouchableOpacity>

        {/* 콘텐츠 */}
        <TouchableOpacity style={rowStyles.content} onPress={() => onEdit(chore)} activeOpacity={0.7}>
          <Text
            style={[rowStyles.title, isDone && rowStyles.titleDone, isOverdue && rowStyles.titleOverdue]}
            numberOfLines={2}
          >
            {chore.title}
          </Text>
          <View style={rowStyles.metaRow}>
            {/* 담당자 */}
            {!isSolo && (
              <View style={rowStyles.metaChip}>
                <Text style={rowStyles.metaText}>{chore.assignee ? chore.assignee.nickname : '모두'}</Text>
              </View>
            )}
            {/* 반복 주기 */}
            {repeatLabel && (
              <View style={rowStyles.repeatChip}>
                <RefreshCw color="#8B5E3C" size={10} strokeWidth={2.5} />
                <Text style={rowStyles.repeatText}>{repeatLabel}</Text>
              </View>
            )}
            {/* 날짜 */}
            {date && (
              <Text style={[rowStyles.dday, isOverdue && rowStyles.ddayOverdue]}>
                {formatShortDate(date)}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* 태그 */}
        {chore.tag && (
          <View style={rowStyles.tagBadge}>
            <Text style={rowStyles.tagText} numberOfLines={1}>{chore.tag.name}</Text>
          </View>
        )}
      </View>
    </Swipeable>
  );
});

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF8F0',
    marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 14,
    shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  rowDone:    { opacity: 0.55 },
  rowOverdue: { backgroundColor: '#FFF0EE', borderWidth: 1, borderColor: '#F5C0B8' },
  checkbox:   { marginRight: 12 },
  content:    { flex: 1 },
  title:      { fontSize: 15, fontWeight: '600', color: '#5C3D1E', marginBottom: 6 },
  titleDone:    { color: '#A87850', textDecorationLine: 'line-through' },
  titleOverdue: { color: '#D95F4B' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  metaChip: {
    backgroundColor: '#EDD9C0', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  metaText:   { fontSize: 11, color: '#8B5E3C', fontWeight: '600' },
  repeatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#F0E8DC', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2,
  },
  repeatText:    { fontSize: 11, color: '#8B5E3C', fontWeight: '600' },
  dday:          { fontSize: 11, fontWeight: '700', color: '#8B5E3C' },
  ddayOverdue:   { color: '#D95F4B' },
  tagBadge: {
    backgroundColor: '#8B5E3C', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8, maxWidth: 72,
  },
  tagText: { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },
});

// ── 태그 관리 모달 ────────────────────────────

interface TagModalProps {
  visible: boolean;
  editing: ChoreTag | null;
  onClose: () => void;
  onSave: (name: string, id?: string) => Promise<void>;
  onDelete: (tag: ChoreTag) => void;
}

const TagModal: React.FC<TagModalProps> = ({ visible, editing, onClose, onSave, onDelete }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setName(editing?.name ?? '');
  }, [visible, editing]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('알림', '태그 이름을 입력해주세요.'); return; }
    setSaving(true);
    await onSave(name.trim(), editing?.id);
    setSaving(false);
  };

  const handleClose = () => { Keyboard.dismiss(); onClose(); };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert('태그 삭제', `'${editing.name}' 태그를 삭제할까요?\n해당 태그가 붙은 루틴에서 태그가 제거됩니다.`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { handleClose(); onDelete(editing); } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={tagModalStyles.kavWrapper} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={tagModalStyles.sheet}>
          <View style={tagModalStyles.handle} />
          <View style={tagModalStyles.headerRow}>
            <Text style={tagModalStyles.title}>{editing ? '태그 수정' : '태그 추가'}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {editing && (
                <TouchableOpacity onPress={handleDelete}>
                  <Trash2 color="#D95F4B" size={18} strokeWidth={2} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose}>
                <X color="#8B5E3C" size={20} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={tagModalStyles.label}>이름</Text>
          <View style={tagModalStyles.inputBox}>
            <TextInput
              style={tagModalStyles.input}
              placeholder="예) 청소, 요리, 장보기"
              placeholderTextColor="#C49A6C"
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              maxLength={12}
            />
          </View>

          <TouchableOpacity
            style={[tagModalStyles.saveBtn, { marginTop: 20 }, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={tagModalStyles.saveBtnText}>{saving ? '저장 중...' : (editing ? '수정 완료' : '저장')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const tagModalStyles = StyleSheet.create({
  kavWrapper: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF8F0', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DEC8A8', alignSelf: 'center', marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '700', color: '#5C3D1E' },
  label: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginBottom: 8 },
  inputBox: { backgroundColor: '#FDF6EC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: '#DEC8A8' },
  input: { fontSize: 16, color: '#5C3D1E', padding: 0 },
  saveBtn: { backgroundColor: '#8B5E3C', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

// ── 메인 화면 ─────────────────────────────────

const ChoresScreen: React.FC = () => {
  const navigation = useNavigation<ChoresNavProp>();
  const isFocused = useIsFocused();

  const [chores, setChores] = useState<Chore[]>([]);
  const [tags, setTags] = useState<ChoreTag[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>('전체');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('전체');
  const [hideDone, setHideDone] = useState(true);
  const [tagModal, setTagModal] = useState<{ visible: boolean; editing: ChoreTag | null }>({ visible: false, editing: null });

  const isSolo = members.length <= 1;

  const loadData = useCallback(async () => {
    try {
      const fid = await getOrCreateFamilyId();
      if (!fid) return;
      setFamilyId(fid);

      const [choresRes, tagsRes, membersRes] = await Promise.all([
        supabase
          .from('chores')
          .select('*, tag:chore_tags(id, name), assignee:user_profiles(id, nickname)')
          .eq('family_id', fid)
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase.from('chore_tags').select('*').eq('family_id', fid).order('created_at'),
        supabase.from('user_profiles').select('id, nickname').eq('family_id', fid),
      ]);

      if (!choresRes.error && choresRes.data) setChores(choresRes.data as Chore[]);
      if (!tagsRes.error && tagsRes.data) setTags(tagsRes.data as ChoreTag[]);
      if (!membersRes.error && membersRes.data) setMembers(membersRes.data as UserProfile[]);
    } catch (e) {
      console.error('ChoresScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (isFocused) {
      setTagFilter('전체');
      setPeriodFilter('전체');
      loadData();
    }
  }, [isFocused, loadData]);

  // ── 완료 토글 (Occurrence 기반) ─────────────
  const handleToggle = useCallback(async (occurrence: ChoreOccurrence) => {
    const { chore, date, isDone } = occurrence;
    const targetDate = date ?? todayStr();

    if (isDone) {
      // 완료 해제: last_done_at = null
      const payload = chore.repeat_type === 'none'
        ? { is_done: false, last_done_at: null }
        : { last_done_at: null };
      await supabase.from('chores').update(payload).eq('id', chore.id);
      setChores(prev => prev.map(c =>
        c.id === chore.id ? { ...c, is_done: false, last_done_at: null } : c
      ));
    } else {
      // 완료: last_done_at = 해당 발생 날짜
      const payload = chore.repeat_type === 'none'
        ? { is_done: true, last_done_at: targetDate }
        : { last_done_at: targetDate };
      await supabase.from('chores').update(payload).eq('id', chore.id);
      setChores(prev => prev.map(c =>
        c.id === chore.id
          ? { ...c, is_done: chore.repeat_type === 'none' ? true : c.is_done, last_done_at: targetDate }
          : c
      ));
    }
  }, []);

  // ── 삭제 ────────────────────────────────────
  const handleDelete = useCallback(async (chore: Chore) => {
    await supabase.from('chores').update({ is_active: false }).eq('id', chore.id);
    setChores(prev => prev.filter(c => c.id !== chore.id));
  }, []);

  // ── 수정 이동 ────────────────────────────────
  const handleEdit = useCallback((chore: Chore) => {
    navigation.navigate('AddChore', { choreId: chore.id, familyId: familyId ?? undefined });
  }, [navigation, familyId]);

  // ── 태그 저장/삭제 ───────────────────────────
  const handleSaveTag = useCallback(async (name: string, id?: string) => {
    if (!familyId) return;
    if (id) {
      const { error } = await supabase.from('chore_tags').update({ name }).eq('id', id);
      if (!error) {
        setTags(prev => prev.map(t => t.id === id ? { ...t, name } : t));
        setChores(prev => prev.map(c => c.tag?.id === id ? { ...c, tag: { ...c.tag!, name } } : c));
        setTagModal({ visible: false, editing: null });
      }
    } else {
      if (tags.some(t => t.name === name)) { Alert.alert('알림', '이미 같은 이름의 태그가 있어요.'); return; }
      const { data, error } = await supabase.from('chore_tags').insert({ family_id: familyId, name }).select().single();
      if (!error && data) {
        setTags(prev => [...prev, data as ChoreTag]);
        setTagModal({ visible: false, editing: null });
      }
    }
  }, [familyId, tags]);

  const handleDeleteTag = useCallback(async (tag: ChoreTag) => {
    await supabase.from('chore_tags').delete().eq('id', tag.id);
    setTags(prev => prev.filter(t => t.id !== tag.id));
    setChores(prev => prev.map(c => c.tag_id === tag.id ? { ...c, tag_id: null, tag: null } : c));
    if (tagFilter === tag.id) setTagFilter('전체');
  }, [tagFilter]);

  // ── Occurrence 계산 ──────────────────────────
  const [fromDate, toDate] = getPeriodRange(periodFilter);

  const allOccurrences = useMemo(() => {
    return generateOccurrences(chores, fromDate, toDate);
  }, [chores, fromDate, toDate]);

  const displayOccurrences = useMemo(() => {
    return allOccurrences.filter(occ => {
      // 날짜 없는 단발은 전체에서만
      if (occ.date === null && periodFilter !== '전체') return false;
      // 태그 필터
      if (tagFilter !== '전체' && occ.chore.tag_id !== tagFilter) return false;
      // 완료 숨기기
      if (hideDone && occ.isDone) return false;
      return true;
    });
  }, [allOccurrences, periodFilter, tagFilter, hideDone]);

  // 기한초과 → 날짜 없음 → 날짜 순
  const sortedOccurrences = useMemo(() => {
    const overdue  = displayOccurrences.filter(o => o.isOverdue).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    const undated  = displayOccurrences.filter(o => !o.date && !o.isOverdue);
    const upcoming = displayOccurrences.filter(o => o.date && !o.isOverdue).sort((a, b) => a.date!.localeCompare(b.date!));
    return [...overdue, ...undated, ...upcoming];
  }, [displayOccurrences]);

  const pendingCount = useMemo(() => {
    // 기간 무관하게 모든 chore 기준 미완료 발생 수 (오늘 기준)
    const today = todayStr();
    const allToday = generateOccurrences(chores, addDays(today, -30), addDays(today, 30));
    const seen = new Set<string>();
    return allToday.filter(o => {
      if (o.isDone) return false;
      // 중복 chore는 가장 이른 발생만 카운트
      if (seen.has(o.chore.id)) return false;
      seen.add(o.chore.id);
      return true;
    }).length;
  }, [chores]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#8B5E3C" />
      </SafeAreaView>
    );
  }

  const filterTabs = [{ id: '전체', name: '전체' }, ...tags.map(t => ({ id: t.id, name: t.name }))];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>루틴</Text>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.hideToggle, !hideDone && styles.hideToggleActive]}
          onPress={() => setHideDone(v => !v)}
        >
          <Text style={[styles.hideToggleText, !hideDone && styles.hideToggleTextActive]}>
            {hideDone ? '완료 보기' : '완료 숨기기'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 태그 필터 */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={filterTabs}
          keyExtractor={t => t.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, gap: 8, paddingRight: 8 }}
          renderItem={({ item: t }) => (
            <TouchableOpacity
              style={[styles.filterTab, tagFilter === t.id && styles.filterTabActive]}
              onPress={() => setTagFilter(t.id)}
              onLongPress={() => {
                if (t.id === '전체') return;
                const tag = tags.find(tg => tg.id === t.id);
                if (tag) setTagModal({ visible: true, editing: tag });
              }}
              delayLongPress={400}
            >
              <Text style={[styles.filterText, tagFilter === t.id && styles.filterTextActive]}>{t.name}</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.addTagBtn}
              onPress={() => setTagModal({ visible: true, editing: null })}
            >
              <Plus color="#8B5E3C" size={14} strokeWidth={2.5} />
              <Text style={styles.addTagBtnText}>태그</Text>
            </TouchableOpacity>
          }
        />
      </View>

      {/* 기간 필터 탭 */}
      <View style={styles.periodRow}>
        {(['전체', '오늘', '이번주', '이번달'] as PeriodFilter[]).map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.periodTab, periodFilter === p && styles.periodTabActive]}
            onPress={() => setPeriodFilter(p)}
          >
            <Text style={[styles.periodText, periodFilter === p && styles.periodTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 날짜 범위 표시 */}
      <View style={styles.rangeBar}>
        <Text style={styles.rangeText}>{fromDate.replace(/-/g, '.')} ~ {toDate.replace(/-/g, '.')}</Text>
        <Text style={styles.countText}>{sortedOccurrences.length}개</Text>
      </View>

      {/* 리스트 */}
      {sortedOccurrences.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {chores.length === 0 ? '루틴을 추가해 보세요' : '해당 기간에 할 일이 없어요'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedOccurrences}
          keyExtractor={o => `${o.chore.id}-${o.date ?? 'undated'}`}
          renderItem={({ item }) => (
            <ChoreRow
              occurrence={item}
              isSolo={isSolo}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddChore', { familyId: familyId ?? undefined })}
        activeOpacity={0.85}
      >
        <Plus color="#FFFFFF" size={26} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* 태그 모달 */}
      <TagModal
        visible={tagModal.visible}
        editing={tagModal.editing}
        onClose={() => setTagModal({ visible: false, editing: null })}
        onSave={handleSaveTag}
        onDelete={handleDeleteTag}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6EC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '800', color: '#5C3D1E' },
  pendingBadge: {
    backgroundColor: '#8B5E3C', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: 'center',
  },
  pendingBadgeText: { fontSize: 12, color: '#FFFFFF', fontWeight: '700' },
  hideToggle: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8',
  },
  hideToggleActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  hideToggleText: { fontSize: 12, color: '#8B5E3C', fontWeight: '600' },
  hideToggleTextActive: { color: '#FFFFFF' },

  filterRow: { marginBottom: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8' },
  filterTabActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  filterText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  filterTextActive: { color: '#FFFFFF' },
  addTagBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8', borderStyle: 'dashed',
  },
  addTagBtnText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },

  periodRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  periodTab: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#FFF8F0', borderWidth: 1, borderColor: '#DEC8A8', alignItems: 'center',
  },
  periodTabActive: { backgroundColor: '#5C3D1E', borderColor: '#5C3D1E' },
  periodText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  periodTextActive: { color: '#FFFFFF' },

  rangeBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 4 },
  rangeText: { fontSize: 11, color: '#C49A6C', fontWeight: '500' },
  countText: { fontSize: 13, color: '#C49A6C', fontWeight: '500' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#C49A6C', fontWeight: '500' },

  fab: {
    position: 'absolute', bottom: 24, right: 24, backgroundColor: '#8B5E3C',
    width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6B4226', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
});

export default ChoresScreen;
