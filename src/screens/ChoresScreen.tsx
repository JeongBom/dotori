// 일정/집안일 화면

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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Chore, ChoreTag, RepeatType, UserProfile } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';

type ChoresNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Chores'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ── 디자인 토큰 ────────────────────────────────

const C = {
  brown:    '#8B5E3C',
  warmOak:  '#A87850',
  lightOak: '#C49A6C',
  ivory:    '#FFF8F0',
  cream:    '#FDF6EC',
  edge:     '#DEC8A8',
  dark:     '#5C3D1E',
  deep:     '#6B4226',
  danger:   '#D95F4B',
  warn:     '#E09B4B',
  purple:   '#9478C9',
} as const;

const MEMBER_COLORS = [C.brown, C.purple, '#4A9EC9', '#5AAF6E'];

// ── 날짜 헬퍼 ─────────────────────────────────

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr(): string { return localDateStr(new Date()); }

function addDays(base: string, n: number): string {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

function thisMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function thisMonthEnd(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return localDateStr(last);
}

function thisWeekRange(): [string, string] {
  const d = new Date();
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [localDateStr(monday), localDateStr(sunday)];
}

function thisYearEnd(): string { return `${new Date().getFullYear()}-12-31`; }

function getWeekLabel(): string {
  const d = new Date();
  const weekOfMonth = Math.ceil(d.getDate() / 7);
  return `${d.getMonth() + 1}월 ${weekOfMonth}주차`;
}

// ── 발생(Occurrence) 타입 ────────────────────

interface ChoreOccurrence {
  chore: Chore;
  date: string | null;
  isDone: boolean;
  isOverdue: boolean;
}

type PeriodFilter = '전체' | '오늘' | '이번주' | '이번달';

// ── 반복 주기 → 일수 ─────────────────────────

function getIntervalDays(chore: Chore): number | null {
  if (chore.repeat_type === 'none') return null;
  if (chore.repeat_type === 'daily') return 1;
  if (chore.repeat_type === 'weekly') return 7;
  if (chore.repeat_type === 'monthly') return 30;
  if (chore.repeat_type === 'custom') {
    if (chore.repeat_unit === 'week' || chore.repeat_unit === 'month') return null;
    return chore.repeat_interval ?? null;
  }
  return null;
}

function isOccurrenceDone(chore: Chore, occDate: string): boolean {
  if (!chore.last_done_at) return false;
  return chore.last_done_at >= occDate;
}

function generateWeeklyDayOccurrences(
  chore: Chore, fromDate: string, toDate: string,
  nWeeks: number, dayOfWeek: number,
): ChoreOccurrence[] {
  const today = todayStr();
  const result: ChoreOccurrence[] = [];
  const anchor = chore.due_date ?? chore.created_at.split('T')[0];
  const anchorDate = new Date(anchor + 'T00:00:00');
  const anchorDay = anchorDate.getDay();
  const diffToTarget = ((dayOfWeek - anchorDay) + 7) % 7;
  const firstOccDate = new Date(anchorDate);
  firstOccDate.setDate(anchorDate.getDate() + diffToTarget);
  const firstOcc = localDateStr(firstOccDate);
  const intervalDays = nWeeks * 7;
  const firstOccTime = new Date(firstOcc + 'T00:00:00').getTime();
  const fromTime = new Date(fromDate + 'T00:00:00').getTime();
  const nStart = Math.max(0, Math.floor((fromTime - firstOccTime) / (intervalDays * 86400000)));
  for (let n = nStart; ; n++) {
    const occDate = addDays(firstOcc, n * intervalDays);
    if (occDate > toDate) break;
    if (chore.end_date && occDate >= chore.end_date) break;
    if (occDate < fromDate) continue;
    if (occDate < today) continue;
    if (chore.excluded_dates?.includes(occDate)) continue;
    const done = isOccurrenceDone(chore, occDate);
    result.push({ chore, date: occDate, isDone: done, isOverdue: !done && occDate < today });
  }
  return result;
}

function generateMonthlyDayOccurrences(
  chore: Chore, fromDate: string, toDate: string,
  nMonths: number, weekOfMonth: number, dayOfWeek: number,
): ChoreOccurrence[] {
  const today = todayStr();
  const result: ChoreOccurrence[] = [];
  const anchor = chore.due_date ?? chore.created_at.split('T')[0];
  const anchorD = new Date(anchor + 'T00:00:00');
  const anchorTotalMonths = anchorD.getFullYear() * 12 + anchorD.getMonth();
  const toD = new Date(toDate + 'T00:00:00');
  const toTotalMonths = toD.getFullYear() * 12 + toD.getMonth();
  const fromD = new Date(fromDate + 'T00:00:00');
  const fromTotalMonths = fromD.getFullYear() * 12 + fromD.getMonth();
  const nStart = Math.max(0, Math.floor((fromTotalMonths - anchorTotalMonths) / nMonths));
  for (let n = nStart; ; n++) {
    const totalMonths = anchorTotalMonths + n * nMonths;
    if (totalMonths > toTotalMonths + 1) break;
    const year = Math.floor(totalMonths / 12);
    const month = totalMonths % 12;
    const firstDay = new Date(year, month, 1);
    const firstDow = firstDay.getDay();
    const diff = ((dayOfWeek - firstDow) + 7) % 7;
    const dayNum = 1 + diff + (weekOfMonth - 1) * 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (dayNum > daysInMonth) continue;
    const occDate = localDateStr(new Date(year, month, dayNum));
    if (occDate > toDate) break;
    if (chore.end_date && occDate >= chore.end_date) break;
    if (occDate < fromDate) continue;
    if (occDate < today) continue;
    if (chore.excluded_dates?.includes(occDate)) continue;
    const done = isOccurrenceDone(chore, occDate);
    result.push({ chore, date: occDate, isDone: done, isOverdue: !done && occDate < today });
  }
  return result;
}

function generateOccurrences(chores: Chore[], fromDate: string, toDate: string): ChoreOccurrence[] {
  const today = todayStr();
  const result: ChoreOccurrence[] = [];
  for (const chore of chores) {
    if (chore.repeat_type === 'custom' && chore.repeat_unit === 'week' && chore.repeat_day_of_week != null) {
      result.push(...generateWeeklyDayOccurrences(chore, fromDate, toDate, chore.repeat_interval ?? 1, chore.repeat_day_of_week));
      continue;
    }
    if (chore.repeat_type === 'custom' && chore.repeat_unit === 'month' && chore.repeat_day_of_week != null && chore.repeat_week_of_month != null) {
      result.push(...generateMonthlyDayOccurrences(chore, fromDate, toDate, chore.repeat_interval ?? 1, chore.repeat_week_of_month, chore.repeat_day_of_week));
      continue;
    }
    const interval = getIntervalDays(chore);
    if (interval === null) {
      if (!chore.due_date) {
        result.push({ chore, date: null, isDone: chore.is_done, isOverdue: false });
      } else if (chore.due_date >= fromDate && chore.due_date <= toDate) {
        result.push({ chore, date: chore.due_date, isDone: chore.is_done, isOverdue: !chore.is_done && chore.due_date < today });
      }
      continue;
    }
    const anchor = chore.due_date ?? chore.created_at.split('T')[0];
    const anchorTime = new Date(anchor + 'T00:00:00').getTime();
    const fromTime = new Date(fromDate + 'T00:00:00').getTime();
    const intervalMs = interval * 86400000;
    const nStart = Math.max(0, Math.ceil((fromTime - anchorTime) / intervalMs));
    for (let n = nStart; ; n++) {
      const occDate = addDays(anchor, n * interval);
      if (occDate > toDate) break;
      if (chore.end_date && occDate >= chore.end_date) break;
      if (chore.excluded_dates?.includes(occDate)) continue;
      const done = isOccurrenceDone(chore, occDate);
      result.push({ chore, date: occDate, isDone: done, isOverdue: !done && occDate < today });
    }
  }
  return result;
}

function getPeriodRange(period: PeriodFilter): [string, string] {
  const today = todayStr();
  const yearEnd = thisYearEnd();
  if (period === '오늘')   return [today, today];
  if (period === '이번주') return thisWeekRange();
  if (period === '이번달') return [thisMonthStart(), thisMonthEnd()];
  return [addDays(today, -60), yearEnd];
}

// ── 반복 라벨 ────────────────────────────────

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function getRepeatLabel(chore: Chore): string | null {
  const { repeat_type, repeat_interval, repeat_unit, repeat_day_of_week, repeat_week_of_month } = chore;
  if (repeat_type === 'none')    return null;
  if (repeat_type === 'daily')   return '매일';
  if (repeat_type === 'weekly')  return '매주';
  if (repeat_type === 'monthly') return '매달';
  if (repeat_type === 'custom') {
    const dow = repeat_day_of_week != null ? DOW_LABELS[repeat_day_of_week] : '?';
    if (repeat_unit === 'week') return repeat_interval && repeat_interval > 1 ? `${repeat_interval}주 ${dow}` : `매주 ${dow}`;
    if (repeat_unit === 'month') {
      const wom = repeat_week_of_month ?? 1;
      return repeat_interval && repeat_interval > 1 ? `${repeat_interval}개월 ${wom}째 ${dow}` : `매달 ${wom}째 ${dow}`;
    }
    return `${repeat_interval ?? '?'}일마다`;
  }
  return null;
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dow = DOW_LABELS[d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${dow})`;
}

function buildCalendarGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const weeks: (string | null)[][] = [];
  let week: (string | null)[] = new Array(firstDay).fill(null);
  for (let d = 1; d <= lastDate; d++) {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    week.push(ds);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

// ── 아이콘 헬퍼 ──────────────────────────────

function IconBtn({ onPress, children }: { onPress?: () => void; children: React.ReactNode }) {
  return (
    <TouchableOpacity onPress={onPress} style={iconBtnStyle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      {children}
    </TouchableOpacity>
  );
}
const iconBtnStyle: object = {
  width: 36, height: 36, borderRadius: 18,
  backgroundColor: C.ivory, borderWidth: 1, borderColor: C.edge,
  justifyContent: 'center', alignItems: 'center',
};

// ── 주간 스트립 ───────────────────────────────

interface WeekStripProps {
  occsByDate: Map<string, ChoreOccurrence[]>;
  today: string;
  selectedDate: string;
  onSelectDate: (d: string) => void;
}

const WeekStrip: React.FC<WeekStripProps> = React.memo(({ occsByDate, today, selectedDate, onSelectDate }) => {
  const [weekStart] = thisWeekRange();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayLabels = ['월', '화', '수', '목', '금', '토', '일'];

  return (
    <View style={ws.card}>
      {days.map((dateStr, i) => {
        const isToday    = dateStr === today;
        const isSelected = dateStr === selectedDate;
        const count      = occsByDate.get(dateStr)?.length ?? 0;
        const dayNum     = parseInt(dateStr.split('-')[2], 10);

        return (
          <TouchableOpacity key={dateStr} style={ws.col} onPress={() => onSelectDate(dateStr)} activeOpacity={0.7}>
            <Text style={ws.dow}>{dayLabels[i]}</Text>
            <View style={[ws.circle, isToday && ws.circleToday, isSelected && !isToday && ws.circleSelected]}>
              <Text style={[ws.num, (isToday || isSelected) && ws.numActive]}>{dayNum}</Text>
            </View>
            <View style={ws.dots}>
              {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                <View key={j} style={[ws.dot, isToday ? ws.dotToday : ws.dotNormal]} />
              ))}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

const ws = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: C.ivory, borderRadius: 16, padding: 12,
    flexDirection: 'row', justifyContent: 'space-between',
    shadowColor: C.brown, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  dow: { fontSize: 11, color: C.lightOak, fontWeight: '600' },
  circle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  circleToday: { backgroundColor: C.brown },
  circleSelected: { backgroundColor: C.edge },
  num: { fontSize: 14, fontWeight: '700', color: C.dark },
  numActive: { color: '#FFFFFF' },
  dots: { flexDirection: 'row', gap: 2, height: 4 },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  dotToday: { backgroundColor: C.deep },
  dotNormal: { backgroundColor: C.lightOak },
});

// ── 진행 링 카드 ──────────────────────────────

interface ProgressCardProps {
  done: number;
  total: number;
  members: UserProfile[];
  memberCounts: Record<string, number>;
}

const ProgressCard: React.FC<ProgressCardProps> = ({ done, total, members, memberCounts }) => {
  const r = 24;
  const circumference = 2 * Math.PI * r;
  const ratio = total === 0 ? 0 : done / total;
  const offset = circumference * (1 - ratio);

  return (
    <View style={pr.card}>
      {/* 링 */}
      <View style={pr.ringWrap}>
        <Svg width={56} height={56} viewBox="0 0 56 56">
          <Circle cx={28} cy={28} r={r} stroke="rgba(255,255,255,0.25)" strokeWidth={5} fill="none" />
          <Circle cx={28} cy={28} r={r} stroke="#fff" strokeWidth={5} fill="none"
            strokeDasharray={`${circumference}`}
            strokeDashoffset={`${offset}`}
            strokeLinecap="round"
            transform="rotate(-90 28 28)"
          />
        </Svg>
        <Text style={pr.fraction}>{done}/{total}</Text>
      </View>
      {/* 텍스트 */}
      <View style={pr.info}>
        <Text style={pr.label}>오늘의 집안일</Text>
        <Text style={pr.count}>
          {total === 0 ? '할 일이 없어요' : done === total ? '모두 완료!' : `${total - done}개 남았어요`}
        </Text>
      </View>
      {/* 멤버 칩 */}
      {members.length > 1 && (
        <View style={pr.chips}>
          {members.slice(0, 3).map((m, i) => (
            <View key={m.id} style={pr.chip}>
              <Text style={pr.chipText}>{m.nickname.slice(0, 1)} {memberCounts[m.id] ?? 0}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const pr = StyleSheet.create({
  card: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 14,
    backgroundColor: C.brown,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: C.brown, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4,
  },
  ringWrap: { width: 56, height: 56, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  fraction: {
    position: 'absolute', fontSize: 12, fontWeight: '800', color: '#fff',
  },
  info: { flex: 1 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  count: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 4 },
  chip: { paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: '700', color: '#fff' },
});

// ── 스와이프 삭제 ─────────────────────────────

const RightAction: React.FC<{ onDelete: () => void }> = ({ onDelete }) => (
  <TouchableOpacity style={swipeStyles.btn} onPress={onDelete}>
    <Text style={swipeStyles.text}>삭제</Text>
  </TouchableOpacity>
);
const swipeStyles = StyleSheet.create({
  btn: {
    backgroundColor: C.danger, justifyContent: 'center', alignItems: 'center',
    width: 80, marginBottom: 8, borderTopRightRadius: 14, borderBottomRightRadius: 14,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

// ── 아이템 행 ─────────────────────────────────

type DeleteMode = 'this' | 'future' | 'all';

interface ChoreRowProps {
  occurrence: ChoreOccurrence;
  isSolo: boolean;
  memberColorMap: Record<string, string>;
  onToggle: (o: ChoreOccurrence) => void;
  onEdit: (o: ChoreOccurrence) => void;
  onDelete: (o: ChoreOccurrence, mode: DeleteMode) => void;
}

const ChoreRow: React.FC<ChoreRowProps> = React.memo(({ occurrence, isSolo, memberColorMap, onToggle, onEdit, onDelete }) => {
  const swipeRef = useRef<Swipeable>(null);
  const { chore, date, isDone, isOverdue } = occurrence;
  const repeatLabel = getRepeatLabel(chore);
  const avatarColor = chore.assignee ? (memberColorMap[chore.assignee.id] ?? C.brown) : C.lightOak;

  const handleDelete = () => {
    swipeRef.current?.close();
    const isRepeating = chore.repeat_type !== 'none';
    if (!isRepeating || !date) {
      Alert.alert('삭제 확인', `'${chore.title}'을(를) 삭제할까요?`, [
        { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
        { text: '삭제', style: 'destructive', onPress: () => onDelete(occurrence, 'all') },
      ]);
    } else {
      Alert.alert('일정 삭제', `'${chore.title}'`, [
        { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
        { text: '이 일정만 삭제', onPress: () => onDelete(occurrence, 'this') },
        { text: '이후 일정 모두 삭제', style: 'destructive', onPress: () => onDelete(occurrence, 'future') },
      ]);
    }
  };

  return (
    <Swipeable ref={swipeRef} renderRightActions={() => <RightAction onDelete={handleDelete} />} overshootRight={false}>
      <TouchableOpacity
        style={[row.card, isDone && row.cardDone, isOverdue && row.cardOverdue]}
        onPress={() => onEdit(occurrence)}
        activeOpacity={0.8}
      >
        {/* 체크박스 */}
        <TouchableOpacity onPress={() => onToggle(occurrence)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <View style={[row.check, isDone && row.checkDone, isOverdue && row.checkOverdue]}>
            {isDone && (
              <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
                <Path d="M5 12l5 5 10-11" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}
          </View>
        </TouchableOpacity>

        {/* 콘텐츠 */}
        <View style={row.body}>
          <Text style={[row.title, isDone && row.titleDone, isOverdue && row.titleOverdue]} numberOfLines={2}>
            {chore.title}
          </Text>
          <View style={row.chips}>
            {repeatLabel && (
              <View style={row.chip}>
                <Text style={row.chipText}>🔁 {repeatLabel}</Text>
              </View>
            )}
            {date && (
              <View style={[row.chip, isOverdue && row.chipOverdue]}>
                <Text style={[row.chipText, isOverdue && row.chipTextOverdue]}>{formatShortDate(date)}</Text>
              </View>
            )}
            {chore.tag && (
              <View style={row.tagChip}>
                <Text style={row.tagText}>{chore.tag.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* 담당자 아바타 */}
        {!isSolo && (
          <View style={[row.avatar, { backgroundColor: avatarColor }]}>
            <Text style={row.avatarText}>
              {chore.assignee ? chore.assignee.nickname.slice(0, 1) : '모'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
});

const row = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.ivory, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, paddingVertical: 11, paddingHorizontal: 12,
    shadowColor: C.brown, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardDone: { opacity: 0.55 },
  cardOverdue: { borderLeftWidth: 3, borderLeftColor: C.danger, paddingLeft: 9 },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.edge,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkDone: { backgroundColor: C.brown, borderColor: C.brown },
  checkOverdue: { borderColor: C.danger },
  body: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: C.dark, marginBottom: 4 },
  titleDone: { color: C.lightOak, textDecorationLine: 'line-through' },
  titleOverdue: { color: C.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip: {
    backgroundColor: C.cream, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  chipText: { fontSize: 11, color: C.warmOak, fontWeight: '500' },
  chipOverdue: { backgroundColor: '#FDECEA' },
  chipTextOverdue: { color: C.danger },
  tagChip: {
    backgroundColor: C.brown, borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  tagText: { fontSize: 11, color: '#fff', fontWeight: '700' },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});

// ── 태그 모달 ─────────────────────────────────

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

  useEffect(() => { if (visible) setName(editing?.name ?? ''); }, [visible, editing]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('알림', '태그 이름을 입력해주세요.'); return; }
    setSaving(true);
    await onSave(name.trim(), editing?.id);
    setSaving(false);
  };

  const handleClose = () => { Keyboard.dismiss(); onClose(); };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert('태그 삭제', `'${editing.name}' 태그를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { handleClose(); onDelete(editing); } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={tm.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={tm.sheet}>
          <View style={tm.handle} />
          <View style={tm.headerRow}>
            <Text style={tm.title}>{editing ? '태그 수정' : '태그 추가'}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {editing && (
                <TouchableOpacity onPress={handleDelete}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={C.danger} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={C.brown} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={tm.label}>이름</Text>
          <View style={tm.inputBox}>
            <TextInput
              style={tm.input}
              placeholder="예) 청소, 요리, 장보기"
              placeholderTextColor={C.lightOak}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              maxLength={12}
            />
          </View>
          <TouchableOpacity
            style={[tm.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={tm.saveBtnText}>{saving ? '저장 중...' : editing ? '수정 완료' : '저장'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const tm = StyleSheet.create({
  kav: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.ivory, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.edge, alignSelf: 'center', marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '700', color: C.dark },
  label: { fontSize: 13, fontWeight: '600', color: C.brown, marginBottom: 8 },
  inputBox: { backgroundColor: C.cream, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: C.edge },
  input: { fontSize: 16, color: C.dark, padding: 0 },
  saveBtn: { backgroundColor: C.brown, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

// ── 달력 뷰 ──────────────────────────────────

interface CalendarViewProps {
  year: number;
  month: number;
  occsByDate: Map<string, ChoreOccurrence[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  today: string;
}

const CalendarView: React.FC<CalendarViewProps> = React.memo(({
  year, month, occsByDate, selectedDate, onSelectDate, today,
}) => {
  const grid = useMemo(() => buildCalendarGrid(year, month), [year, month]);

  return (
    <View style={cal.container}>
      <View style={cal.dowRow}>
        {DOW_LABELS.map((d, i) => (
          <Text key={i} style={[cal.dowText, i === 0 && cal.sunText, i === 6 && cal.satText]}>{d}</Text>
        ))}
      </View>
      {grid.map((week, wi) => (
        <View key={wi} style={cal.weekRow}>
          {week.map((dateStr, di) => {
            if (!dateStr) return <View key={di} style={cal.dayCell} />;
            const dayOccs   = occsByDate.get(dateStr) ?? [];
            const hasOverdue = dayOccs.some(o => o.isOverdue);
            const hasPending = dayOccs.some(o => !o.isDone && !o.isOverdue);
            const hasDone    = dayOccs.some(o => o.isDone);
            const isSelected = dateStr === selectedDate;
            const isToday    = dateStr === today;
            const dayNum     = parseInt(dateStr.split('-')[2], 10);
            return (
              <TouchableOpacity key={di} style={cal.dayCell} onPress={() => onSelectDate(dateStr)} activeOpacity={0.7}>
                <View style={[cal.dayNumWrap, isSelected && cal.selectedWrap, isToday && !isSelected && cal.todayWrap]}>
                  <Text style={[cal.dayNum, isSelected && cal.selectedNum, isToday && !isSelected && cal.todayNum, di === 0 && !isSelected && cal.sunNum, di === 6 && !isSelected && cal.satNum]}>
                    {dayNum}
                  </Text>
                </View>
                <View style={cal.dotsRow}>
                  {hasOverdue && <View style={[cal.dot, cal.dotOverdue]} />}
                  {hasPending && <View style={[cal.dot, cal.dotPending]} />}
                  {hasDone    && <View style={[cal.dot, cal.dotDone]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
});

const cal = StyleSheet.create({
  container: { marginHorizontal: 8, marginTop: 4, marginBottom: 4 },
  dowRow: { flexDirection: 'row', marginBottom: 2 },
  dowText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: C.brown, paddingVertical: 6 },
  sunText: { color: C.danger },
  satText: { color: '#6B8ED6' },
  weekRow: { flexDirection: 'row' },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: 4, minHeight: 50 },
  dayNumWrap: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  selectedWrap: { backgroundColor: C.brown },
  todayWrap: { backgroundColor: C.edge },
  dayNum: { fontSize: 14, fontWeight: '600', color: C.dark },
  selectedNum: { color: '#fff', fontWeight: '700' },
  todayNum: { color: C.brown, fontWeight: '700' },
  sunNum: { color: C.danger },
  satNum: { color: '#6B8ED6' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2, height: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  dotOverdue: { backgroundColor: C.danger },
  dotPending: { backgroundColor: C.brown },
  dotDone: { backgroundColor: C.edge },
});

// ── 메인 화면 ─────────────────────────────────

const ChoresScreen: React.FC = () => {
  const navigation = useNavigation<ChoresNavProp>();
  const isFocused = useIsFocused();

  const [chores, setChores]     = useState<Chore[]>([]);
  const [tags, setTags]         = useState<ChoreTag[]>([]);
  const [members, setMembers]   = useState<UserProfile[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tagFilter, setTagFilter]       = useState<string>('전체');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('오늘');
  const [hideDone, setHideDone]         = useState(true);
  const [tagModal, setTagModal] = useState<{ visible: boolean; editing: ChoreTag | null }>({ visible: false, editing: null });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayStr());

  const isSolo = members.length <= 1;

  const memberColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    members.forEach((m, i) => { map[m.id] = MEMBER_COLORS[i % MEMBER_COLORS.length]; });
    return map;
  }, [members]);

  const loadData = useCallback(async () => {
    try {
      const fid = await getOrCreateFamilyId();
      if (!fid) return;
      setFamilyId(fid);
      const [choresRes, tagsRes, membersRes] = await Promise.all([
        supabase.from('chores').select('*, tag:chore_tags(id, name), assignee:user_profiles(id, nickname)')
          .eq('family_id', fid).eq('is_active', true).order('created_at', { ascending: false }),
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
    if (isFocused) { setTagFilter('전체'); loadData(); }
  }, [isFocused, loadData]);

  // ── 완료 토글 ────────────────────────────────
  const handleToggle = useCallback(async (occurrence: ChoreOccurrence) => {
    const { chore, date, isDone } = occurrence;
    const targetDate = date ?? todayStr();
    if (isDone) {
      const payload = chore.repeat_type === 'none' ? { is_done: false, last_done_at: null } : { last_done_at: null };
      await supabase.from('chores').update(payload).eq('id', chore.id);
      setChores(prev => prev.map(c => c.id === chore.id ? { ...c, is_done: false, last_done_at: null } : c));
    } else {
      const payload = chore.repeat_type === 'none' ? { is_done: true, last_done_at: targetDate } : { last_done_at: targetDate };
      await supabase.from('chores').update(payload).eq('id', chore.id);
      setChores(prev => prev.map(c => c.id === chore.id
        ? { ...c, is_done: chore.repeat_type === 'none' ? true : c.is_done, last_done_at: targetDate } : c));
    }
  }, []);

  // ── 삭제 ────────────────────────────────────
  const handleDelete = useCallback(async (occurrence: ChoreOccurrence, mode: DeleteMode) => {
    const { chore, date } = occurrence;
    if (mode === 'all' || !date) {
      await supabase.from('chores').update({ is_active: false }).eq('id', chore.id);
      setChores(prev => prev.filter(c => c.id !== chore.id));
    } else if (mode === 'this') {
      const newExcluded = [...(chore.excluded_dates ?? []), date];
      await supabase.from('chores').update({ excluded_dates: newExcluded }).eq('id', chore.id);
      setChores(prev => prev.map(c => c.id === chore.id ? { ...c, excluded_dates: newExcluded } : c));
    } else if (mode === 'future') {
      await supabase.from('chores').update({ end_date: date }).eq('id', chore.id);
      setChores(prev => prev.map(c => c.id === chore.id ? { ...c, end_date: date } : c));
    }
  }, []);

  // ── 수정 ────────────────────────────────────
  const handleEdit = useCallback((occurrence: ChoreOccurrence) => {
    const { chore, date } = occurrence;
    const isRepeating = chore.repeat_type !== 'none';
    if (!isRepeating || !date) {
      navigation.navigate('AddChore', { choreId: chore.id, familyId: familyId ?? undefined });
      return;
    }
    Alert.alert('일정 수정', `'${chore.title}'`, [
      { text: '취소', style: 'cancel' },
      { text: '이 일정만 수정', onPress: () => navigation.navigate('AddChore', { choreId: chore.id, familyId: familyId ?? undefined, occurrenceDate: date, editMode: 'this' }) },
      { text: '이후 일정 모두 수정', onPress: () => navigation.navigate('AddChore', { choreId: chore.id, familyId: familyId ?? undefined, occurrenceDate: date, editMode: 'future' }) },
    ]);
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
      if (!error && data) { setTags(prev => [...prev, data as ChoreTag]); setTagModal({ visible: false, editing: null }); }
    }
  }, [familyId, tags]);

  const handleDeleteTag = useCallback(async (tag: ChoreTag) => {
    await supabase.from('chore_tags').delete().eq('id', tag.id);
    setTags(prev => prev.filter(t => t.id !== tag.id));
    setChores(prev => prev.map(c => c.tag_id === tag.id ? { ...c, tag_id: null, tag: null } : c));
    if (tagFilter === tag.id) setTagFilter('전체');
  }, [tagFilter]);

  // ── Occurrence 계산 ──────────────────────────
  const [fromDate, toDate] = viewMode === 'calendar'
    ? [thisMonthStart(), thisMonthEnd()]
    : getPeriodRange(periodFilter);

  const allOccurrences = useMemo(() => generateOccurrences(chores, fromDate, toDate), [chores, fromDate, toDate]);

  // 달력 모드: 날짜 → 발생 맵
  const occsByDate = useMemo(() => {
    if (viewMode !== 'calendar') return new Map<string, ChoreOccurrence[]>();
    const map = new Map<string, ChoreOccurrence[]>();
    allOccurrences.forEach(occ => {
      if (!occ.date) return;
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    });
    return map;
  }, [viewMode, allOccurrences]);

  // 주간 스트립: 이번주 발생 맵 (항상 계산)
  const [weekFrom, weekTo] = thisWeekRange();
  const weekOccurrences = useMemo(() => generateOccurrences(chores, weekFrom, weekTo), [chores, weekFrom, weekTo]);
  const weekOccsByDate = useMemo(() => {
    const map = new Map<string, ChoreOccurrence[]>();
    weekOccurrences.forEach(occ => {
      if (!occ.date) return;
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    });
    return map;
  }, [weekOccurrences]);

  // 오늘 진행 현황 (ProgressCard용)
  const todayOccs = useMemo(() => {
    const today = todayStr();
    return generateOccurrences(chores, today, today);
  }, [chores]);
  const todayDone  = useMemo(() => todayOccs.filter(o => o.isDone).length, [todayOccs]);
  const todayTotal = todayOccs.length;

  // 멤버별 오늘 미완료 수
  const memberPendingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todayOccs.filter(o => !o.isDone).forEach(o => {
      const uid = o.chore.assignee?.id;
      if (uid) counts[uid] = (counts[uid] ?? 0) + 1;
    });
    return counts;
  }, [todayOccs]);

  // 달력 모드: 선택 날 발생
  const selectedDateOccs = useMemo(() => {
    if (viewMode !== 'calendar') return [];
    return (occsByDate.get(selectedCalendarDate) ?? [])
      .filter(o => tagFilter === '전체' || o.chore.tag_id === tagFilter)
      .filter(o => !hideDone || !o.isDone);
  }, [viewMode, occsByDate, selectedCalendarDate, tagFilter, hideDone]);

  const displayOccurrences = useMemo(() => {
    return allOccurrences.filter(occ => {
      if (occ.date === null && periodFilter !== '전체') return false;
      if (tagFilter !== '전체' && occ.chore.tag_id !== tagFilter) return false;
      if (hideDone && occ.isDone) return false;
      return true;
    });
  }, [allOccurrences, periodFilter, tagFilter, hideDone]);

  const sortedOccurrences = useMemo(() => {
    const overdue  = displayOccurrences.filter(o => o.isOverdue).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    const undated  = displayOccurrences.filter(o => !o.date && !o.isOverdue);
    const upcoming = displayOccurrences.filter(o => o.date && !o.isOverdue).sort((a, b) => a.date!.localeCompare(b.date!));
    return [...overdue, ...undated, ...upcoming];
  }, [displayOccurrences]);

  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator size="large" color={C.brown} />
      </SafeAreaView>
    );
  }

  const filterTabs = [{ id: '전체', name: '전체' }, ...tags.map(t => ({ id: t.id, name: t.name }))];

  return (
    <SafeAreaView style={s.safeArea}>
      {/* 헤더 */}
      <View style={s.header}>
        <View>
          <Text style={s.subLabel}>{getWeekLabel()}</Text>
          <Text style={s.title}>일정</Text>
        </View>
        <View style={s.headerRight}>
          <IconBtn onPress={() => setHideDone(v => !v)}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              {hideDone
                ? <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" stroke={C.dark} strokeWidth={1.8} strokeLinecap="round" />
                : <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" stroke={C.brown} strokeWidth={1.8} strokeLinecap="round" />
              }
            </Svg>
          </IconBtn>
          <IconBtn onPress={() => setViewMode(v => v === 'list' ? 'calendar' : 'list')}>
            {viewMode === 'list'
              ? <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Rect x={3} y={4} width={18} height={18} rx={2} stroke={C.dark} strokeWidth={1.8} /><Path d="M3 10h18M8 2v4M16 2v4" stroke={C.dark} strokeWidth={1.8} strokeLinecap="round" /></Svg>
              : <Svg width={18} height={18} viewBox="0 0 24 24" fill="none"><Path d="M9 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" stroke={C.brown} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><Path d="M9 12l2 2 4-4" stroke={C.brown} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></Svg>
            }
          </IconBtn>
        </View>
      </View>

      {/* 기간 필터 탭 (리스트 모드) */}
      {viewMode === 'list' && (
        <View style={s.periodRow}>
          {(['오늘', '이번주', '이번달', '전체'] as PeriodFilter[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[s.periodTab, periodFilter === p && s.periodTabActive]}
              onPress={() => setPeriodFilter(p)}
            >
              <Text style={[s.periodText, periodFilter === p && s.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 주간 스트립 (리스트 모드 오늘/이번주) */}
      {viewMode === 'list' && (periodFilter === '오늘' || periodFilter === '이번주') && (
        <WeekStrip
          occsByDate={weekOccsByDate}
          today={todayStr()}
          selectedDate={todayStr()}
          onSelectDate={() => {}}
        />
      )}

      {/* 진행 카드 (오늘 모드, 리스트) */}
      {viewMode === 'list' && periodFilter === '오늘' && (
        <ProgressCard
          done={todayDone}
          total={todayTotal}
          members={members}
          memberCounts={memberPendingCounts}
        />
      )}

      {/* 태그 필터 */}
      <View style={s.filterRow}>
        <FlatList
          horizontal
          data={filterTabs}
          keyExtractor={t => t.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, gap: 8, paddingRight: 8 }}
          renderItem={({ item: t }) => (
            <TouchableOpacity
              style={[s.filterTab, tagFilter === t.id && s.filterTabActive]}
              onPress={() => setTagFilter(t.id)}
              onLongPress={() => {
                if (t.id === '전체') return;
                const tag = tags.find(tg => tg.id === t.id);
                if (tag) setTagModal({ visible: true, editing: tag });
              }}
              delayLongPress={400}
            >
              <Text style={[s.filterText, tagFilter === t.id && s.filterTextActive]}>{t.name}</Text>
            </TouchableOpacity>
          )}
          ListFooterComponent={
            <TouchableOpacity style={s.addTagBtn} onPress={() => setTagModal({ visible: true, editing: null })}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M12 5v14M5 12h14" stroke={C.brown} strokeWidth={2.5} strokeLinecap="round" />
              </Svg>
              <Text style={s.addTagBtnText}>태그</Text>
            </TouchableOpacity>
          }
        />
      </View>

      {/* 개수 표시 */}
      {viewMode === 'list' && (
        <View style={s.countBar}>
          <Text style={s.countText}>{sortedOccurrences.length}개</Text>
        </View>
      )}

      {/* 컨텐츠 */}
      {viewMode === 'calendar' ? (
        <FlatList
          data={selectedDateOccs}
          keyExtractor={o => `${o.chore.id}-${o.date ?? 'undated'}`}
          ListHeaderComponent={
            <>
              <CalendarView
                year={new Date().getFullYear()}
                month={new Date().getMonth()}
                occsByDate={occsByDate}
                selectedDate={selectedCalendarDate}
                onSelectDate={setSelectedCalendarDate}
                today={todayStr()}
              />
              <View style={s.dayHeader}>
                <Text style={s.dayHeaderText}>{formatDayLabel(selectedCalendarDate)}</Text>
                <Text style={s.countText}>{selectedDateOccs.length}개</Text>
              </View>
            </>
          }
          ListEmptyComponent={<View style={s.empty}><Text style={s.emptyText}>이 날은 할 일이 없어요</Text></View>}
          renderItem={({ item }) => (
            <ChoreRow occurrence={item} isSolo={isSolo} memberColorMap={memberColorMap}
              onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : sortedOccurrences.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>
            {chores.length === 0 ? '일정을 추가해 보세요' : '해당 기간에 할 일이 없어요'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedOccurrences}
          keyExtractor={o => `${o.chore.id}-${o.date ?? 'undated'}`}
          renderItem={({ item }) => (
            <ChoreRow occurrence={item} isSolo={isSolo} memberColorMap={memberColorMap}
              onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => navigation.navigate('AddChore', { familyId: familyId ?? undefined })}
        activeOpacity={0.85}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
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

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.cream },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.cream },

  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
  },
  subLabel: { fontSize: 12, color: C.lightOak, fontWeight: '600', marginBottom: 2 },
  title: { fontSize: 26, fontWeight: '800', color: C.dark, letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  periodRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 6, marginBottom: 12 },
  periodTab: {
    flex: 1, paddingVertical: 7, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'transparent', borderWidth: 1, borderColor: 'transparent',
  },
  periodTabActive: { backgroundColor: C.ivory, borderColor: C.edge, shadowColor: C.brown, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  periodText: { fontSize: 13, fontWeight: '700', color: C.lightOak },
  periodTextActive: { color: C.dark },

  filterRow: { marginBottom: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.ivory, borderWidth: 1, borderColor: C.edge },
  filterTabActive: { backgroundColor: C.brown, borderColor: C.brown },
  filterText: { fontSize: 13, color: C.warmOak, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  addTagBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.ivory, borderWidth: 1, borderColor: C.edge, borderStyle: 'dashed',
  },
  addTagBtnText: { fontSize: 13, color: C.brown, fontWeight: '600' },

  countBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, marginBottom: 4 },
  countText: { fontSize: 12, color: C.lightOak, fontWeight: '500' },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 15, color: C.lightOak, fontWeight: '500' },

  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#EDD9C0', marginTop: 4,
  },
  dayHeaderText: { fontSize: 15, fontWeight: '700', color: C.dark },

  fab: {
    position: 'absolute', bottom: 24, right: 24, backgroundColor: C.warmOak,
    width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center',
    shadowColor: C.warmOak, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 6,
  },
});

export default ChoresScreen;
