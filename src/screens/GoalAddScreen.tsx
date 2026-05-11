// 목표 추가 풀스크린 플로우
// Step 1: 목표 이름
// Step 2: 목표 금액
// Step 3: 기간 + 목적
// Step 4: 완료

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';

import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'GoalAdd'>;
type RoutePropType = RouteProp<RootStackParamList, 'GoalAdd'>;

// ── 디자인 토큰 ────────────────────────────────
const C = {
  dark:     '#5C3D1E',
  brown:    '#8B5E3C',
  warmOak:  '#A87850',
  lightOak: '#C49A6C',
  ivory:    '#FFF8F0',
  cream:    '#FDF6EC',
  edge:     '#DEC8A8',
};

const QUICK_CHIPS = [
  { label: '10만',  value: 100_000 },
  { label: '50만',  value: 500_000 },
  { label: '100만', value: 1_000_000 },
  { label: '500만', value: 5_000_000 },
  { label: '1천만', value: 10_000_000 },
  { label: '1억',   value: 100_000_000 },
];

// ── SVG 아이콘 ─────────────────────────────────
const SvgChevronLeft = ({ color = C.brown, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);
const SvgX = ({ color = C.lightOak, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

// ── 금액 유틸 ──────────────────────────────────
function formatAmount(n: number): string {
  if (n === 0) return '0원';
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const won = n % 10_000;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man.toLocaleString()}만`);
  if (won > 0 && eok === 0) parts.push(`${won.toLocaleString()}`);
  return parts.join(' ') + '원';
}

function toCommaInput(text: string): string {
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('ko-KR');
}

function parseComma(text: string): number {
  return parseInt(text.replace(/,/g, ''), 10) || 0;
}

function formatDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── 진행바 ─────────────────────────────────────
const ProgressBar = ({ step }: { step: 1 | 2 | 3 | 4 }) => (
  <View style={pb.bar}>
    {[1, 2, 3].map(s => (
      <View key={s} style={[pb.seg, s <= step && pb.segActive]} />
    ))}
  </View>
);
const pb = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingBottom: 8 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#EDD9C0' },
  segActive: { backgroundColor: C.brown },
});

// ── 메인 컴포넌트 ──────────────────────────────
const GoalAddScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { familyId } = route.params;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const titleInputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => titleInputRef.current?.focus(), 600);
      return () => clearTimeout(t);
    }, [])
  );

  // 폼 상태
  const [title, setTitle]           = useState('');
  const [amountText, setAmountText] = useState('');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [memo, setMemo]             = useState('');
  const [saving, setSaving]         = useState(false);

  // 날짜 피커
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate]         = useState<Date>(new Date());

  // 완료 애니메이션
  const doneScale = useRef(new Animated.Value(0)).current;
  const doneFade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 4) {
      doneScale.setValue(0);
      doneFade.setValue(0);
      Animated.sequence([
        Animated.spring(doneScale, { toValue: 1, tension: 55, friction: 5, useNativeDriver: true }),
        Animated.timing(doneFade, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start();
    }
  }, [step]);

  const amount = parseComma(amountText);

  const endMinDate = startDate ? (() => {
    const [y, m, d] = startDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  })() : undefined;

  // ── 날짜 피커 열기 ──────────────────────────
  const openPicker = (which: 'start' | 'end') => {
    const base = which === 'end' ? (endDate || startDate) : startDate;
    setTempDate(base ? (() => { const [y,m,d] = base.split('-').map(Number); return new Date(y,m-1,d); })() : new Date());
    setActivePicker(which);
  };

  const confirmPicker = () => {
    const d = toLocalDateStr(tempDate);
    if (activePicker === 'start') {
      setStartDate(d);
      if (endDate && d > endDate) setEndDate('');
    } else {
      setEndDate(d);
    }
    setActivePicker(null);
  };

  // ── Step 검증 ──────────────────────────────
  const goStep2 = () => {
    if (!title.trim()) { Alert.alert('알림', '목표 이름을 입력해주세요.'); return; }
    Keyboard.dismiss();
    setStep(2);
  };

  const goStep3 = () => {
    if (!amount || amount <= 0) { Alert.alert('알림', '목표 금액을 입력해주세요.'); return; }
    Keyboard.dismiss();
    setStep(3);
  };

  // ── 저장 ───────────────────────────────────
  const handleSave = async () => {
    if (!startDate) { Alert.alert('알림', '시작일을 선택해주세요.'); return; }
    if (!endDate)   { Alert.alert('알림', '종료일을 선택해주세요.'); return; }
    if (endDate < startDate) { Alert.alert('알림', '종료일은 시작일 이후여야 해요.'); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from('goals').insert({
        family_id: familyId,
        title: title.trim(),
        target_amount: amount,
        start_date: startDate,
        end_date: endDate,
        memo: memo.trim() || null,
      });
      if (error) throw error;
      setStep(4);
    } catch (e: any) {
      const msg = e?.message ?? e?.details ?? JSON.stringify(e);
      Alert.alert('오류', `저장에 실패했습니다.\n\n${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 4: 완료 ──────────────────────────
  if (step === 4) {
    return (
      <SafeAreaView style={done.safe}>
        <View style={done.wrap}>
          <Animated.View style={[done.circle, { transform: [{ scale: doneScale }] }]}>
            <Text style={{ fontSize: 44 }}>🎯</Text>
          </Animated.View>
          <Animated.View style={{ opacity: doneFade, alignItems: 'center', width: '100%' }}>
            <Text style={done.title}>목표 설정 완료!</Text>
            <Text style={done.sub}>"{title}" 목표가 등록됐어요</Text>
            <View style={done.card}>
              <View style={done.row}>
                <Text style={done.rowLabel}>목표 금액</Text>
                <Text style={done.rowVal}>{formatAmount(amount)}</Text>
              </View>
              <View style={done.divider} />
              <View style={done.row}>
                <Text style={done.rowLabel}>기간</Text>
                <Text style={done.rowVal}>{formatDateStr(startDate)} ~ {formatDateStr(endDate)}</Text>
              </View>
              {memo ? (
                <>
                  <View style={done.divider} />
                  <View style={done.row}>
                    <Text style={done.rowLabel}>목적</Text>
                    <Text style={done.rowVal}>{memo}</Text>
                  </View>
                </>
              ) : null}
            </View>
            <TouchableOpacity style={done.btn} onPress={() => navigation.goBack()}>
              <Text style={done.btnText}>목표 목록으로</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── 날짜 피커 오버레이 (Step 3) ──────────────
  if (step === 3 && activePicker !== null) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setActivePicker(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <SvgX />
          </TouchableOpacity>
          <Text style={s.headerTitle}>
            {activePicker === 'start' ? '시작일 선택' : '종료일 선택'}
          </Text>
          <View style={{ width: 32 }} />
        </View>
        <ProgressBar step={3} />
        <ScrollView contentContainerStyle={s.content}>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="inline"
            onChange={(_, d) => { if (d) setTempDate(d); }}
            locale="ko-KR"
            accentColor={C.brown}
            minimumDate={activePicker === 'end' ? endMinDate : undefined}
            style={{ alignSelf: 'center' }}
          />
          <View style={s.dpActions}>
            <TouchableOpacity style={s.dpCancel} onPress={() => setActivePicker(null)}>
              <Text style={s.dpCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dpConfirm} onPress={confirmPicker}>
              <Text style={s.dpConfirmText}>확인</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step 3: 기간 + 목적 ─────────────────────
  if (step === 3) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep(2)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <SvgChevronLeft />
          </TouchableOpacity>
          <Text style={s.headerTitle}>기간 설정</Text>
          <View style={{ width: 32 }} />
        </View>
        <ProgressBar step={3} />

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            {/* 요약 카드 */}
            <View style={step3.summaryCard}>
              <View style={step3.summaryIcon}>
                <Text style={{ fontSize: 22 }}>🎯</Text>
              </View>
              <View>
                <Text style={step3.summaryTitle}>{title}</Text>
                <Text style={step3.summaryAmount}>{formatAmount(amount)}</Text>
              </View>
            </View>

            <Text style={s.label}>목표 기간</Text>
            <View style={step3.dateRow}>
              <TouchableOpacity style={step3.datePicker} onPress={() => openPicker('start')}>
                <Text style={startDate ? step3.dateText : step3.datePlaceholder}>
                  {startDate ? formatDateStr(startDate) : '시작일'}
                </Text>
              </TouchableOpacity>
              <Text style={step3.dateSep}>~</Text>
              <TouchableOpacity style={step3.datePicker} onPress={() => openPicker('end')}>
                <Text style={endDate ? step3.dateText : step3.datePlaceholder}>
                  {endDate ? formatDateStr(endDate) : '종료일'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.label, { marginTop: 20 }]}>목적 (선택)</Text>
            <TextInput
              style={s.input}
              placeholder="예: 신혼집 보증금, 비상금"
              placeholderTextColor={C.lightOak}
              value={memo}
              onChangeText={setMemo}
              autoCorrect={false}
              keyboardAppearance="light"
            />
          </ScrollView>
        </TouchableWithoutFeedback>

        <View style={s.footer}>
          <TouchableOpacity
            style={[s.cta, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.ctaText}>저장하기</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 2: 목표 금액 ─────────────────────
  if (step === 2) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <SvgChevronLeft />
          </TouchableOpacity>
          <Text style={s.headerTitle}>목표 금액</Text>
          <View style={{ width: 32 }} />
        </View>
        <ProgressBar step={2} />

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            <View style={amt.amountDisplay}>
              <Text style={[amt.amountText, amount > 0 && amt.amountActive]}>
                {amount > 0 ? formatAmount(amount) : '목표 금액은?'}
              </Text>
            </View>
            <TextInput
              style={s.input}
              placeholder="직접 입력 (예: 100,000,000)"
              placeholderTextColor={C.lightOak}
              value={amountText}
              onChangeText={text => setAmountText(toCommaInput(text))}
              keyboardType="numeric"
              keyboardAppearance="light"
              selectTextOnFocus
            />
            <View style={amt.chipGrid}>
              {QUICK_CHIPS.map(chip => (
                <TouchableOpacity
                  key={chip.label}
                  style={amt.chip}
                  onPress={() => {
                    const cur = parseComma(amountText);
                    setAmountText((cur + chip.value).toLocaleString('ko-KR'));
                  }}
                >
                  <Text style={amt.chipText}>+{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>

        <View style={s.footer}>
          <TouchableOpacity style={s.cta} onPress={goStep3}>
            <Text style={s.ctaText}>다음</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 1: 목표 이름 ─────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <SvgChevronLeft />
        </TouchableOpacity>
        <Text style={s.headerTitle}>목표 추가</Text>
        <View style={{ width: 32 }} />
      </View>
      <ProgressBar step={1} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>어떤 목표인가요?</Text>
          <TextInput
            ref={titleInputRef}
            style={s.input}
            placeholder="예: 내 집 마련, 유럽 여행"
            placeholderTextColor={C.lightOak}
            value={title}
            onChangeText={setTitle}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={goStep2}
            keyboardAppearance="light"
          />
        </ScrollView>
      </TouchableWithoutFeedback>

      <View style={s.footer}>
        <TouchableOpacity style={s.cta} onPress={goStep2}>
          <Text style={s.ctaText}>다음</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// ── 공통 스타일 ────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.dark },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 8 },
  label: { fontSize: 13, fontWeight: '700', color: C.brown, marginBottom: 12 },
  input: {
    backgroundColor: C.ivory,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: C.dark,
    borderWidth: 1,
    borderColor: C.edge,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0E8DC',
  },
  cta: {
    backgroundColor: C.brown,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  dpActions: { flexDirection: 'row', gap: 12, marginTop: 12, paddingHorizontal: 4 },
  dpCancel: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderRadius: 12, borderWidth: 1, borderColor: C.edge,
  },
  dpCancelText: { fontSize: 15, color: C.brown, fontWeight: '600' },
  dpConfirm: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderRadius: 12, backgroundColor: C.brown,
  },
  dpConfirmText: { fontSize: 15, color: '#FFFFFF', fontWeight: '700' },
});

// ── Step 2 스타일 ──────────────────────────────
const amt = StyleSheet.create({
  amountDisplay: { alignItems: 'center', marginBottom: 24, marginTop: 16 },
  amountText: { fontSize: 34, fontWeight: '800', color: '#C5B09A', letterSpacing: -1 },
  amountActive: { color: C.dark },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    backgroundColor: C.ivory,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: C.edge,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: C.brown },
});

// ── Step 3 스타일 ──────────────────────────────
const step3 = StyleSheet.create({
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.ivory,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.edge,
  },
  summaryIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#EDD9C0',
    justifyContent: 'center', alignItems: 'center',
  },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: C.dark, marginBottom: 2 },
  summaryAmount: { fontSize: 13, fontWeight: '700', color: C.brown },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datePicker: {
    flex: 1,
    backgroundColor: C.ivory,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: C.edge,
    alignItems: 'center',
  },
  dateText:        { fontSize: 14, fontWeight: '600', color: C.dark },
  datePlaceholder: { fontSize: 14, color: C.lightOak },
  dateSep: { fontSize: 16, color: C.warmOak, fontWeight: '600' },
});

// ── Step 4 스타일 ──────────────────────────────
const done = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 80 },
  circle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#EDD9C0',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: C.dark, marginBottom: 6 },
  sub:   { fontSize: 14, color: C.warmOak, fontWeight: '500', marginBottom: 36 },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.edge,
    marginBottom: 28,
  },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  rowLabel: { fontSize: 13, color: C.lightOak, fontWeight: '600' },
  rowVal:   { fontSize: 14, fontWeight: '700', color: C.dark },
  divider:  { height: 1, backgroundColor: C.edge, marginVertical: 2 },
  btn: {
    width: '100%',
    backgroundColor: C.brown,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});

export default GoalAddScreen;
