// 목표 항목 추가/수정 풀스크린 플로우
// Step 1: 자산 선택
// Step 2: 금액 입력
// Step 3: 날짜 + 메모
// Step 4: 완료

import React, { useState, useEffect, useRef } from 'react';
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
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Path } from 'react-native-svg';

import { supabase } from '../lib/supabase';
import { Asset, AssetCategory } from '../types';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'GoalItemAdd'>;
type RoutePropType = RouteProp<RootStackParamList, 'GoalItemAdd'>;

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

const CAT_CONFIG: Record<AssetCategory, { color: string; emoji: string }> = {
  '예금':   { color: '#4A9EC9', emoji: '🏦' },
  '적금':   { color: '#5AAF6E', emoji: '💵' },
  '주식':   { color: '#D9629A', emoji: '📈' },
  '부동산': { color: '#D4864A', emoji: '🏠' },
  '기타':   { color: '#9EA8B0', emoji: '📦' },
};

const QUICK_CHIPS = [
  { label: '10만',  value: 100_000 },
  { label: '50만',  value: 500_000 },
  { label: '100만', value: 1_000_000 },
  { label: '500만', value: 5_000_000 },
  { label: '1천만', value: 10_000_000 },
  { label: '1억',   value: 100_000_000 },
];

// ── SVG ────────────────────────────────────────
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

// ── 유틸 ───────────────────────────────────────
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

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}.${m}.${d}`;
}

function todayStr(): string {
  return toLocalDateStr(new Date());
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
const GoalItemAddScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { goalId, familyId, itemId } = route.params;
  const isEditing = !!itemId;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // 데이터
  const [assets, setAssets] = useState<Asset[]>([]);
  const [availableAmount, setAvailableAmount] = useState(-1);
  const [loading, setLoading] = useState(true);

  // 폼 상태
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [amountText, setAmountText]       = useState('');
  const [savedDate, setSavedDate]         = useState(todayStr());
  const [memo, setMemo]                   = useState('');
  const [saving, setSaving]               = useState(false);

  // 날짜 피커
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate]             = useState<Date>(new Date());

  // 완료 애니메이션
  const doneScale = useRef(new Animated.Value(0)).current;
  const doneFade  = useRef(new Animated.Value(0)).current;

  // ── 데이터 로드 ────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [assetsRes, allItemsRes] = await Promise.all([
          supabase.from('assets').select('*').eq('family_id', familyId).eq('is_active', true).order('updated_at'),
          supabase.from('goal_items').select('amount, id'),
        ]);
        const assetList = (assetsRes.data ?? []) as Asset[];
        setAssets(assetList);

        // 수정 모드: 기존 항목 로드
        if (itemId) {
          const { data: itemData } = await supabase
            .from('goal_items').select('*').eq('id', itemId).single();
          if (itemData) {
            // 자산 이름으로 매칭
            const match = assetList.find(a => a.name === itemData.name);
            setSelectedAsset(match ?? (assetList[0] ?? null));
            setAmountText(itemData.amount.toLocaleString('ko-KR'));
            setSavedDate(itemData.saved_date?.split('T')?.[0] ?? todayStr());
            setMemo(itemData.memo ?? '');
          }
        } else {
          if (assetList.length > 0) setSelectedAsset(assetList[0]);
        }

        const totalAssets = assetList.reduce((s, a) => s + a.amount, 0);
        const editingAmt = itemId
          ? ((await supabase.from('goal_items').select('amount').eq('id', itemId).single()).data?.amount ?? 0)
          : 0;
        const totalCommitted = (allItemsRes.data ?? []).reduce((s: number, i: any) => s + i.amount, 0);
        setAvailableAmount(totalAssets > 0 ? Math.max(0, totalAssets - totalCommitted + editingAmt) : -1);
      } finally {
        setLoading(false);
      }
    })();
  }, [familyId, itemId]);

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
  const catCfg = selectedAsset ? CAT_CONFIG[selectedAsset.category as AssetCategory] : null;

  // ── Step 검증 ──────────────────────────────
  const goStep2 = () => {
    if (!selectedAsset) { Alert.alert('알림', '자산을 선택해주세요.'); return; }
    setStep(2);
  };

  const goStep3 = () => {
    if (!amount || amount <= 0) { Alert.alert('알림', '금액을 입력해주세요.'); return; }
    if (availableAmount >= 0 && amount > availableAmount) {
      const msg = availableAmount === 0
        ? '총 자산이 이미 모든 목표 항목에 할당됐어요.'
        : `입력 금액이 가용 한도(${formatAmount(availableAmount)})를 초과해요.`;
      Alert.alert('알림', msg);
      return;
    }
    Keyboard.dismiss();
    setStep(3);
  };

  // ── 저장 ───────────────────────────────────
  const handleSave = async () => {
    if (!savedDate) { Alert.alert('알림', '날짜를 선택해주세요.'); return; }

    setSaving(true);
    try {
      if (isEditing && itemId) {
        const { error } = await supabase.from('goal_items').update({
          name: selectedAsset?.name ?? '기타',
          amount,
          saved_date: savedDate,
          memo: memo.trim() || null,
        }).eq('id', itemId);
        if (error) throw error;
        navigation.goBack();
      } else {
        const { error } = await supabase.from('goal_items').insert({
          goal_id: goalId,
          name: selectedAsset?.name ?? '기타',
          amount,
          saved_date: savedDate,
          memo: memo.trim() || null,
        });
        if (error) throw error;
        setStep(4);
      }
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ flex: 1 }} color={C.brown} />
      </SafeAreaView>
    );
  }

  // ── Step 4: 완료 ──────────────────────────
  if (step === 4) {
    return (
      <SafeAreaView style={done.safe}>
        <View style={done.wrap}>
          <Animated.View style={[
            done.circle,
            catCfg ? { backgroundColor: catCfg.color } : { backgroundColor: '#EDD9C0' },
            { transform: [{ scale: doneScale }] },
          ]}>
            <Text style={{ fontSize: 44 }}>{catCfg?.emoji ?? '💰'}</Text>
          </Animated.View>
          <Animated.View style={{ opacity: doneFade, alignItems: 'center', width: '100%' }}>
            <Text style={done.title}>항목 추가 완료!</Text>
            <Text style={done.sub}>{selectedAsset?.name} 항목이 등록됐어요</Text>
            <View style={done.card}>
              <View style={done.row}>
                <Text style={done.rowLabel}>자산</Text>
                <Text style={done.rowVal}>{selectedAsset?.name}</Text>
              </View>
              <View style={done.divider} />
              <View style={done.row}>
                <Text style={done.rowLabel}>금액</Text>
                <Text style={done.rowVal}>{formatAmount(amount)}</Text>
              </View>
              <View style={done.divider} />
              <View style={done.row}>
                <Text style={done.rowLabel}>날짜</Text>
                <Text style={done.rowVal}>{formatDateStr(savedDate)}</Text>
              </View>
              {memo ? (
                <>
                  <View style={done.divider} />
                  <View style={done.row}>
                    <Text style={done.rowLabel}>메모</Text>
                    <Text style={done.rowVal}>{memo}</Text>
                  </View>
                </>
              ) : null}
            </View>
            <TouchableOpacity style={done.btn} onPress={() => navigation.goBack()}>
              <Text style={done.btnText}>목표로 돌아가기</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── 날짜 피커 오버레이 (Step 3) ──────────
  if (step === 3 && showDatePicker) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <SvgX />
          </TouchableOpacity>
          <Text style={s.headerTitle}>날짜 선택</Text>
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
            style={{ alignSelf: 'center' }}
          />
          <View style={s.dpActions}>
            <TouchableOpacity style={s.dpCancel} onPress={() => setShowDatePicker(false)}>
              <Text style={s.dpCancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.dpConfirm} onPress={() => {
              setSavedDate(toLocalDateStr(tempDate));
              setShowDatePicker(false);
            }}>
              <Text style={s.dpConfirmText}>확인</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Step 3: 날짜 + 메모 ─────────────────
  if (step === 3) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep(2)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <SvgChevronLeft />
          </TouchableOpacity>
          <Text style={s.headerTitle}>날짜 · 메모</Text>
          <View style={{ width: 32 }} />
        </View>
        <ProgressBar step={3} />

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            {/* 요약 카드 */}
            <View style={step3.summaryCard}>
              <View style={[step3.iconBox, catCfg && { backgroundColor: catCfg.color + '22' }]}>
                <Text style={{ fontSize: 22 }}>{catCfg?.emoji ?? '💰'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={step3.summaryName}>{selectedAsset?.name}</Text>
                <Text style={[step3.summaryCat, catCfg && { color: catCfg.color }]}>{selectedAsset?.category}</Text>
              </View>
              <Text style={step3.summaryAmt}>{formatAmount(amount)}</Text>
            </View>

            {/* 날짜 */}
            <Text style={s.label}>모은 날짜</Text>
            <TouchableOpacity
              style={step3.datePicker}
              onPress={() => {
                const [y, m, d] = savedDate.split('-').map(Number);
                setTempDate(new Date(y, m - 1, d));
                setShowDatePicker(true);
              }}
            >
              <Text style={step3.dateText}>{formatDateStr(savedDate)}</Text>
            </TouchableOpacity>

            {/* 메모 */}
            <Text style={[s.label, { marginTop: 20 }]}>메모 (선택)</Text>
            <TextInput
              style={s.input}
              placeholder="예: 비상금 계좌에서 절반"
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
              : <Text style={s.ctaText}>{isEditing ? '수정하기' : '저장하기'}</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 2: 금액 입력 ─────────────────────
  if (step === 2) {
    const cap = availableAmount;
    const overLimit = cap >= 0 && amount > cap;
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <SvgChevronLeft />
          </TouchableOpacity>
          <Text style={s.headerTitle}>금액 입력</Text>
          <View style={{ width: 32 }} />
        </View>
        <ProgressBar step={2} />

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
            {catCfg && (
              <View style={amt.contextCard}>
                <View style={[amt.iconBox, { backgroundColor: catCfg.color + '22' }]}>
                  <Text style={{ fontSize: 20 }}>{catCfg.emoji}</Text>
                </View>
                <View>
                  <Text style={amt.assetName}>{selectedAsset?.name}</Text>
                  <Text style={[amt.assetCat, { color: catCfg.color }]}>{selectedAsset?.category}</Text>
                </View>
                {cap >= 0 && (
                  <Text style={amt.capText}>가용 {formatAmount(cap)}</Text>
                )}
              </View>
            )}

            <View style={amt.amountDisplay}>
              <Text style={[amt.amountText, amount > 0 && (overLimit ? amt.amountOver : amt.amountActive)]}>
                {amount > 0 ? formatAmount(amount) : '얼마인가요?'}
              </Text>
              {overLimit && (
                <Text style={amt.overText}>
                  {cap === 0 ? '가용 한도 없음' : `최대 ${formatAmount(cap)}`}
                </Text>
              )}
            </View>

            <TextInput
              style={[s.input, overLimit && { borderColor: '#D95F4B' }]}
              placeholder="직접 입력 (예: 5,000,000)"
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

  // ── Step 1: 자산 선택 ─────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <SvgChevronLeft />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing ? '항목 수정' : '항목 추가'}</Text>
        <View style={{ width: 32 }} />
      </View>
      <ProgressBar step={1} />

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.label}>자산 선택</Text>
        {assets.length === 0 ? (
          <View style={step1.empty}>
            <Text style={step1.emptyText}>먼저 자산을 추가해주세요</Text>
          </View>
        ) : (
          <View style={step1.grid}>
            {assets.map(asset => {
              const cfg = CAT_CONFIG[asset.category as AssetCategory];
              const active = selectedAsset?.id === asset.id;
              return (
                <TouchableOpacity
                  key={asset.id}
                  style={[
                    step1.card,
                    active && { borderColor: cfg.color, backgroundColor: cfg.color + '15' },
                  ]}
                  onPress={() => setSelectedAsset(asset)}
                  activeOpacity={0.75}
                >
                  <Text style={step1.emoji}>{cfg.emoji}</Text>
                  <Text style={[step1.name, active && { color: cfg.color, fontWeight: '800' }]} numberOfLines={2}>
                    {asset.name}
                  </Text>
                  <Text style={[step1.cat, active && { color: cfg.color }]}>{asset.category}</Text>
                  {active && <View style={[step1.dot, { backgroundColor: cfg.color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.cta, assets.length === 0 && { opacity: 0.4 }]}
          onPress={goStep2}
          disabled={assets.length === 0}
        >
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

// ── Step 1 스타일 ──────────────────────────────
const step1 = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%',
    backgroundColor: C.ivory,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.edge,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 4,
    position: 'relative',
  },
  emoji: { fontSize: 24, marginBottom: 2 },
  name: { fontSize: 13, fontWeight: '700', color: C.dark },
  cat:  { fontSize: 11, fontWeight: '600', color: C.warmOak },
  dot: {
    position: 'absolute', top: 10, right: 10,
    width: 8, height: 8, borderRadius: 4,
  },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: C.lightOak, fontWeight: '500' },
});

// ── Step 2 스타일 ──────────────────────────────
const amt = StyleSheet.create({
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.ivory,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.edge,
  },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  assetName: { fontSize: 15, fontWeight: '800', color: C.dark },
  assetCat: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  capText: { marginLeft: 'auto' as any, fontSize: 12, color: C.warmOak, fontWeight: '600' },
  amountDisplay: { alignItems: 'center', marginBottom: 24 },
  amountText: { fontSize: 34, fontWeight: '800', color: '#C5B09A', letterSpacing: -1 },
  amountActive: { color: C.dark },
  amountOver: { color: '#D95F4B' },
  overText: { fontSize: 12, color: '#D95F4B', fontWeight: '600', marginTop: 4 },
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
    gap: 12,
    backgroundColor: C.ivory,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: C.edge,
  },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  summaryName: { fontSize: 15, fontWeight: '800', color: C.dark },
  summaryCat: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  summaryAmt: { marginLeft: 'auto' as any, fontSize: 15, fontWeight: '800', color: C.dark },
  datePicker: {
    backgroundColor: C.ivory,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.edge,
    alignItems: 'center',
  },
  dateText: { fontSize: 16, fontWeight: '600', color: C.dark },
});

// ── Step 4 스타일 ──────────────────────────────
const done = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 80 },
  circle: {
    width: 110, height: 110, borderRadius: 55,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
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

export default GoalItemAddScreen;
