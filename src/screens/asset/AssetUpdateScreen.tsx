// 자산 업데이트 풀스크린 플로우 (수정)
// Step 1: 금액 입력 (추가/감소 토글 + 숫자 입력)
// Step 2: 확인 (요약 카드 + 이유 입력)
// Step 3: 완료 (성공 화면)

import React, { useState, useRef, useEffect } from 'react';
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
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AssetUpdate'>;
type RouteType = RouteProp<RootStackParamList, 'AssetUpdate'>;

// ── 디자인 토큰 ────────────────────────────────
const C = {
  dark:     '#5C3D1E',
  brown:    '#8B5E3C',
  warmOak:  '#A87850',
  lightOak: '#C49A6C',
  ivory:    '#FFF8F0',
  cream:    '#FDF6EC',
  edge:     '#DEC8A8',
  up:       '#4CAF7D',
  down:     '#D95F4B',
  upBg:     '#E8F5EE',
  downBg:   '#FCECEA',
};

// ── SVG 아이콘 ─────────────────────────────────
const SvgChevronLeft = ({ color = C.brown, size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

const AcornSvg = ({ size = 72, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <Path d="M5 11c0-1 1-2 2-2h14c1 0 2 1 2 2 0 1-1 2-2 2H7c-1 0-2-1-2-2z" fill={color} />
    <Path d="M7 13h14c0 5-3 11-7 11s-7-6-7-11z" fill={color} fillOpacity={0.6} />
    <Path d="M14 4v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
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

// ── 카테고리 색/이모지 ─────────────────────────
const CAT_CONFIG: Record<string, { color: string; emoji: string }> = {
  '예금':   { color: '#4A9EC9', emoji: '🏦' },
  '적금':   { color: '#5AAF6E', emoji: '💵' },
  '주식':   { color: '#D9629A', emoji: '📈' },
  '부동산': { color: '#D4864A', emoji: '🏠' },
  '기타':   { color: '#9EA8B0', emoji: '📦' },
};

const QUICK_CHIPS = [
  { label: '1만', value: 10_000 },
  { label: '5만', value: 50_000 },
  { label: '10만', value: 100_000 },
  { label: '50만', value: 500_000 },
  { label: '100만', value: 1_000_000 },
];

const MEMO_CHIPS = ['월급 입금', '이체', '주식 매수', '주식 매도', '이자 수령', '지출'];

// ── 진행바 ─────────────────────────────────────
const ProgressBar = ({ step }: { step: 1 | 2 | 3 }) => (
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

const AssetUpdateScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();
  const { assetId, assetName, assetAmount, category, ownerNickname } = route.params;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isIncrease, setIsIncrease] = useState(true);
  const [changeText, setChangeText] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  const acornScale = useRef(new Animated.Value(0)).current;
  const acornRotate = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 3) {
      acornScale.setValue(0);
      acornRotate.setValue(0);
      contentFade.setValue(0);
      Animated.sequence([
        Animated.spring(acornScale, {
          toValue: 1,
          tension: 55,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
      Animated.timing(acornRotate, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [step]);

  const catCfg = CAT_CONFIG[category] ?? CAT_CONFIG['기타'];
  const changeAmount = parseComma(changeText);
  const newAmount = isIncrease
    ? assetAmount + changeAmount
    : Math.max(0, assetAmount - changeAmount);
  const diff = newAmount - assetAmount;

  const handleChipAdd = (val: number) => {
    const newVal = changeAmount + val;
    setChangeText(newVal.toLocaleString('ko-KR'));
  };

  const goToConfirm = () => {
    if (changeAmount <= 0) {
      Alert.alert('알림', '변동 금액을 입력해주세요.');
      return;
    }
    if (!isIncrease && changeAmount > assetAmount) {
      Alert.alert('알림', '감소 금액이 현재 금액을 초과할 수 없어요.');
      return;
    }
    Keyboard.dismiss();
    setStep(2);
  };

  const handleSave = async () => {
    if (!memo.trim()) {
      Alert.alert('알림', '변경 이유를 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ amount: newAmount })
        .eq('id', assetId);
      if (error) throw error;

      await supabase.from('asset_histories').insert({
        asset_id: assetId,
        previous_amount: assetAmount,
        new_amount: newAmount,
        memo: memo.trim(),
      });

      setStep(3);
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const spinInterpolate = acornRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-15deg', '0deg'],
  });

  // ── Step 3: 완료 화면 ──────────────────────────
  if (step === 3) {
    return (
      <SafeAreaView style={done.safe}>
        <View style={done.wrap}>
          {/* 도토리 애니메이션 서클 */}
          <Animated.View style={[
            done.circle,
            {
              transform: [
                { scale: acornScale },
                { rotate: spinInterpolate },
              ],
            },
          ]}>
            <AcornSvg size={72} color="#FFFFFF" />
          </Animated.View>

          <Animated.View style={{ opacity: contentFade, alignItems: 'center', width: '100%' }}>
          <Text style={done.title}>업데이트 완료!</Text>
          <Text style={done.sub}>{assetName} 자산이 수정되었어요</Text>

          {/* 요약 카드 */}
          <View style={done.card}>
            <View style={done.iconRow}>
              <View style={[done.iconBox, { backgroundColor: catCfg.color + '22' }]}>
                <Text style={done.iconEmoji}>{catCfg.emoji}</Text>
              </View>
              <View>
                <Text style={done.cardName}>{assetName}</Text>
                {ownerNickname && <Text style={[done.cardCat, { color: catCfg.color }]}>{ownerNickname}</Text>}
              </View>
            </View>
            <View style={done.divider} />
            <View style={done.row}>
              <Text style={done.rowLabel}>변동</Text>
              <Text style={[done.rowVal, { color: diff >= 0 ? C.up : C.down }]}>
                {diff >= 0 ? '+' : '−'}{formatAmount(Math.abs(diff))}
              </Text>
            </View>
            <View style={done.row}>
              <Text style={done.rowLabel}>새 금액</Text>
              <Text style={[done.rowVal, { color: C.dark }]}>{formatAmount(newAmount)}</Text>
            </View>
            <View style={done.row}>
              <Text style={done.rowLabel}>이유</Text>
              <Text style={[done.rowVal, { color: C.warmOak }]}>{memo}</Text>
            </View>
          </View>

          <TouchableOpacity style={done.btn} onPress={() => navigation.goBack()}>
            <Text style={done.btnText}>자산 목록으로</Text>
          </TouchableOpacity>
          <TouchableOpacity style={done.histBtn} onPress={() => navigation.goBack()}>
            <Text style={done.histBtnText}>히스토리 보기</Text>
          </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 2: 확인 화면 ──────────────────────────
  if (step === 2) {
    return (
      <SafeAreaView style={s.safe}>
        {/* 헤더 */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep(1)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <SvgChevronLeft />
          </TouchableOpacity>
          <Text style={s.headerTitle}>확인</Text>
          <View style={{ width: 32 }} />
        </View>
        <ProgressBar step={2} />

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

            {/* 요약 카드 */}
            <View style={confirm.card}>
              <View style={confirm.assetRow}>
                <View style={[confirm.iconBox, { backgroundColor: catCfg.color + '22' }]}>
                  <Text style={confirm.iconEmoji}>{catCfg.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={confirm.assetName}>{assetName}</Text>
                  <Text style={[confirm.assetCat, { color: catCfg.color }]}>{category}</Text>
                </View>
                {ownerNickname && (
                  <View style={confirm.badge}>
                    <Text style={confirm.badgeText}>{ownerNickname}</Text>
                  </View>
                )}
              </View>

              <View style={confirm.dashed} />

              <View style={confirm.amtRow}>
                <View style={confirm.amtCol}>
                  <Text style={confirm.amtLabel}>현재</Text>
                  <Text style={confirm.amtVal}>{formatAmount(assetAmount)}</Text>
                </View>
                <Text style={confirm.arrow}>→</Text>
                <View style={confirm.amtCol}>
                  <Text style={confirm.amtLabel}>변경 후</Text>
                  <Text style={[confirm.amtVal, { color: diff >= 0 ? C.up : C.down }]}>
                    {formatAmount(newAmount)}
                  </Text>
                </View>
              </View>
              <Text style={[confirm.diffText, { color: diff >= 0 ? C.up : C.down }]}>
                {diff >= 0 ? '+' : '−'}{formatAmount(Math.abs(diff))}
              </Text>
            </View>

            {/* 이유 입력 */}
            <Text style={s.label}>변경 이유</Text>

            {/* 빠른 선택 칩 */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {MEMO_CHIPS.map(chip => (
                  <TouchableOpacity
                    key={chip}
                    style={[confirm.chip, memo === chip && confirm.chipActive]}
                    onPress={() => setMemo(chip)}
                  >
                    <Text style={[confirm.chipText, memo === chip && confirm.chipTextActive]}>
                      {chip}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TextInput
              style={s.input}
              placeholder="예: 월급 입금, 주식 매수"
              placeholderTextColor={C.lightOak}
              value={memo}
              onChangeText={setMemo}
              autoCorrect={false}
              returnKeyType="done"
            />

          </ScrollView>
        </TouchableWithoutFeedback>

        {/* CTA */}
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

  // ── Step 1: 금액 입력 ──────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      {/* 헤더 */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <SvgChevronLeft />
        </TouchableOpacity>
        <Text style={s.headerTitle}>자산 수정</Text>
        <View style={{ width: 32 }} />
      </View>
      <ProgressBar step={1} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* 현재 자산 컨텍스트 카드 */}
          <View style={amt.contextCard}>
            <View style={[amt.iconBox, { backgroundColor: catCfg.color + '22' }]}>
              <Text style={amt.iconEmoji}>{catCfg.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={amt.assetName}>{assetName}</Text>
              <Text style={amt.currentAmt}>현재 {formatAmount(assetAmount)}</Text>
            </View>
            {ownerNickname && (
              <View style={amt.badge}>
                <Text style={amt.badgeText}>{ownerNickname}</Text>
              </View>
            )}
          </View>

          {/* 추가/감소 토글 */}
          <View style={amt.toggleRow}>
            <TouchableOpacity
              style={[amt.toggleBtn, isIncrease && amt.toggleUp]}
              onPress={() => setIsIncrease(true)}
            >
              <Text style={[amt.toggleText, isIncrease && { color: C.up }]}>+ 추가</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[amt.toggleBtn, !isIncrease && amt.toggleDown]}
              onPress={() => setIsIncrease(false)}
            >
              <Text style={[amt.toggleText, !isIncrease && { color: C.down }]}>− 감소</Text>
            </TouchableOpacity>
          </View>

          {/* 금액 큰 글씨 표시 */}
          <View style={amt.amountDisplay}>
            <Text style={[amt.amountText, changeAmount > 0 && (isIncrease ? { color: C.up } : { color: C.down })]}>
              {changeAmount > 0 ? (isIncrease ? '+' : '−') + formatAmount(changeAmount) : '금액 입력'}
            </Text>
            {changeAmount > 0 && (
              <Text style={amt.previewText}>→ {formatAmount(newAmount)}</Text>
            )}
          </View>

          {/* 텍스트 입력 */}
          <TextInput
            style={s.input}
            placeholder="직접 입력 (예: 500,000)"
            placeholderTextColor={C.lightOak}
            value={changeText}
            onChangeText={text => setChangeText(toCommaInput(text))}
            keyboardType="numeric"
            selectTextOnFocus
          />

          {/* 빠른 금액 칩 */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {QUICK_CHIPS.map(chip => (
                <TouchableOpacity key={chip.label} style={amt.chip} onPress={() => handleChipAdd(chip.value)}>
                  <Text style={amt.chipText}>+{chip.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

        </ScrollView>
      </TouchableWithoutFeedback>

      {/* CTA */}
      <View style={s.footer}>
        <TouchableOpacity style={s.cta} onPress={goToConfirm}>
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
  label: {
    fontSize: 13, fontWeight: '700', color: C.brown,
    marginBottom: 10, marginTop: 20,
  },
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
    bottom: 0,
    left: 0,
    right: 0,
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
});

// ── Step 1 (금액 입력) 스타일 ──────────────────
const amt = StyleSheet.create({
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.ivory,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.edge,
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  iconEmoji: { fontSize: 18 },
  assetName: { fontSize: 15, fontWeight: '800', color: C.dark },
  currentAmt: { fontSize: 12, color: C.warmOak, fontWeight: '600', marginTop: 2 },
  badge: {
    backgroundColor: '#EDD9C0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.brown },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  toggleBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: C.ivory, borderWidth: 1.5, borderColor: C.edge,
    alignItems: 'center',
  },
  toggleUp:   { backgroundColor: '#E8F5EE', borderColor: C.up },
  toggleDown: { backgroundColor: '#FCECEA', borderColor: C.down },
  toggleText: { fontSize: 16, fontWeight: '700', color: C.warmOak },
  amountDisplay: { alignItems: 'center', marginBottom: 20 },
  amountText: { fontSize: 36, fontWeight: '800', color: '#C5B09A', letterSpacing: -1 },
  previewText: { fontSize: 14, color: C.warmOak, fontWeight: '600', marginTop: 4 },
  chip: {
    backgroundColor: C.ivory,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.edge,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: C.brown },
});

// ── Step 2 (확인) 스타일 ───────────────────────
const confirm = StyleSheet.create({
  card: {
    backgroundColor: C.ivory,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.edge,
    marginBottom: 4,
  },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  iconEmoji: { fontSize: 20 },
  assetName: { fontSize: 16, fontWeight: '800', color: C.dark },
  assetCat: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  badge: {
    backgroundColor: '#EDD9C0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: C.brown },
  dashed: {
    borderBottomWidth: 1,
    borderColor: C.edge,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  amtRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 8 },
  amtCol: { alignItems: 'center' },
  amtLabel: { fontSize: 11, color: C.lightOak, fontWeight: '600', marginBottom: 4 },
  amtVal: { fontSize: 18, fontWeight: '800', color: C.dark },
  arrow: { fontSize: 18, color: C.lightOak, fontWeight: '300' },
  diffText: { textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: 4 },
  chip: {
    backgroundColor: C.ivory,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.edge,
  },
  chipActive: { backgroundColor: C.brown, borderColor: C.brown },
  chipText: { fontSize: 13, fontWeight: '600', color: C.brown },
  chipTextActive: { color: '#FFFFFF' },
});

// ── Step 3 (완료) 스타일 ───────────────────────
const done = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 80 },
  circle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: C.brown,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: C.dark, marginBottom: 6 },
  sub: { fontSize: 14, color: C.warmOak, fontWeight: '500', marginBottom: 36 },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.edge,
    marginBottom: 28,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  iconEmoji: { fontSize: 18 },
  cardName: { fontSize: 15, fontWeight: '800', color: C.dark },
  cardCat: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  divider: { height: 1, backgroundColor: C.edge, marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowLabel: { fontSize: 13, color: C.lightOak, fontWeight: '600' },
  rowVal: { fontSize: 14, fontWeight: '700' },
  btn: {
    width: '100%',
    backgroundColor: C.brown,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  histBtn: { paddingVertical: 12, alignItems: 'center' },
  histBtnText: { fontSize: 14, color: C.warmOak, fontWeight: '600' },
});

export default AssetUpdateScreen;
