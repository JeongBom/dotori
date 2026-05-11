// 자산 추가 풀스크린 플로우
// Step 1: 카테고리 + 항목명
// Step 2: 금액 입력
// Step 3: 담당자 선택 + 확인
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle } from 'react-native-svg';

import { supabase, getOrCreateFamilyId } from '../../lib/supabase';
import { AssetCategory } from '../../types';
import { RootStackParamList } from '../../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AssetAdd'>;

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

const CATEGORIES: AssetCategory[] = ['예금', '적금', '주식', '부동산', '기타'];
const CAT_CONFIG: Record<AssetCategory, { color: string; emoji: string }> = {
  '예금':   { color: '#4A9EC9', emoji: '🏦' },
  '적금':   { color: '#5AAF6E', emoji: '💵' },
  '주식':   { color: '#D9629A', emoji: '📈' },
  '부동산': { color: '#D4864A', emoji: '🏠' },
  '기타':   { color: '#9EA8B0', emoji: '📦' },
};

const QUICK_CHIPS = [
  { label: '10만', value: 100_000 },
  { label: '50만', value: 500_000 },
  { label: '100만', value: 1_000_000 },
  { label: '500만', value: 5_000_000 },
  { label: '1천만', value: 10_000_000 },
  { label: '1억', value: 100_000_000 },
];

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

const SvgCheck = ({ color = '#fff', size = 52 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6L9 17l-5-5" />
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

// ── 진행바 ─────────────────────────────────────
const ProgressBar = ({ step }: { step: 1 | 2 | 3 | 4 }) => (
  <View style={pb.bar}>
    {[1, 2, 3, 4].map(s => (
      <View key={s} style={[pb.seg, s <= step && pb.segActive]} />
    ))}
  </View>
);
const pb = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingBottom: 8 },
  seg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#EDD9C0' },
  segActive: { backgroundColor: C.brown },
});

// ── 가족 멤버 타입 ─────────────────────────────
interface Member { id: string; nickname: string }

// ── 메인 컴포넌트 ──────────────────────────────
const AssetAddScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // 폼 상태
  const [category, setCategory] = useState<AssetCategory>('예금');
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // 패밀리 데이터
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [saving, setSaving] = useState(false);

  const acornScale = useRef(new Animated.Value(0)).current;
  const acornRotate = useRef(new Animated.Value(0)).current;
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (step === 4) {
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

  useEffect(() => {
    (async () => {
      const fid = await getOrCreateFamilyId();
      if (!fid) return;
      setFamilyId(fid);
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      setOwnerId(user?.id ?? null);
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, nickname')
        .eq('family_id', fid);
      if (profiles) {
        const sorted = [...profiles].sort((a, b) =>
          a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0
        );
        setMembers(sorted as Member[]);
      }
    })();
  }, []);

  const catCfg = CAT_CONFIG[category];
  const amount = parseComma(amountText);

  // ── Step 1 검증 ────────────────────────────
  const goStep2 = () => {
    if (!name.trim()) { Alert.alert('알림', '항목명을 입력해주세요.'); return; }
    Keyboard.dismiss();
    setStep(2);
  };

  // ── Step 2 검증 ────────────────────────────
  const goStep3 = () => {
    if (amount <= 0) { Alert.alert('알림', '금액을 입력해주세요.'); return; }
    Keyboard.dismiss();
    setStep(3);
  };

  // ── 저장 ───────────────────────────────────
  const handleSave = async () => {
    if (!familyId) return;
    setSaving(true);
    try {
      const { data: asset, error } = await supabase
        .from('assets')
        .insert({
          family_id: familyId,
          user_id: ownerId,
          category,
          name: name.trim(),
          amount,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('asset_histories').insert({
        asset_id: asset.id,
        previous_amount: 0,
        new_amount: amount,
        memo: '최초 등록',
      });

      setStep(4);
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 4: 완료 ──────────────────────────
  const spinInterpolate = acornRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-15deg', '0deg'],
  });

  if (step === 4) {
    const ownerNickname = members.find(m => m.id === ownerId)?.nickname;
    return (
      <SafeAreaView style={done.safe}>
        <View style={done.wrap}>
          <Animated.View style={[
            done.circle,
            { backgroundColor: catCfg.color },
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
          <Text style={done.title}>자산 추가 완료!</Text>
          <Text style={done.sub}>{name} 자산이 등록되었어요</Text>

          <View style={done.card}>
            <View style={done.iconRow}>
              <View style={[done.iconBox, { backgroundColor: catCfg.color + '22' }]}>
                <Text style={done.iconEmoji}>{catCfg.emoji}</Text>
              </View>
              <View>
                <Text style={done.cardName}>{name}</Text>
                <Text style={[done.cardCat, { color: catCfg.color }]}>{category}</Text>
              </View>
            </View>
            <View style={done.divider} />
            <View style={done.row}>
              <Text style={done.rowLabel}>금액</Text>
              <Text style={[done.rowVal, { color: C.dark }]}>{formatAmount(amount)}</Text>
            </View>
            {ownerNickname && (
              <View style={done.row}>
                <Text style={done.rowLabel}>담당자</Text>
                <Text style={[done.rowVal, { color: C.warmOak }]}>{ownerNickname}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={done.btn} onPress={() => navigation.goBack()}>
            <Text style={done.btnText}>자산 목록으로</Text>
          </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step 3: 확인 + 담당자 ─────────────────
  if (step === 3) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep(2)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <SvgChevronLeft />
          </TouchableOpacity>
          <Text style={s.headerTitle}>확인</Text>
          <View style={{ width: 32 }} />
        </View>
        <ProgressBar step={3} />

        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* 요약 카드 */}
          <View style={confirm.card}>
            <View style={confirm.assetRow}>
              <View style={[confirm.iconBox, { backgroundColor: catCfg.color + '22' }]}>
                <Text style={confirm.iconEmoji}>{catCfg.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={confirm.assetName}>{name}</Text>
                <Text style={[confirm.assetCat, { color: catCfg.color }]}>{category}</Text>
              </View>
            </View>
            <View style={confirm.dashed} />
            <View style={confirm.amtWrap}>
              <Text style={confirm.amtLabel}>등록 금액</Text>
              <Text style={confirm.amtVal}>{formatAmount(amount)}</Text>
            </View>
          </View>

          {/* 담당자 선택 (2명 이상일 때만) */}
          {members.length > 1 && (
            <>
              <Text style={s.label}>담당자</Text>
              <View style={confirm.ownerRow}>
                {members.map(m => {
                  const isMe = m.id === currentUserId;
                  const active = ownerId === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        confirm.ownerBtn,
                        active && (isMe ? confirm.ownerBtnMe : confirm.ownerBtnPartner),
                      ]}
                      onPress={() => setOwnerId(m.id)}
                    >
                      <Text style={[
                        confirm.ownerText,
                        active && (isMe ? confirm.ownerTextMe : confirm.ownerTextPartner),
                      ]}>
                        {m.nickname}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>

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

  // ── Step 2: 금액 입력 ─────────────────────
  if (step === 2) {
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
            {/* 컨텍스트 카드 */}
            <View style={amt.contextCard}>
              <View style={[amt.iconBox, { backgroundColor: catCfg.color + '22' }]}>
                <Text style={amt.iconEmoji}>{catCfg.emoji}</Text>
              </View>
              <View>
                <Text style={amt.assetName}>{name}</Text>
                <Text style={[amt.assetCat, { color: catCfg.color }]}>{category}</Text>
              </View>
            </View>

            {/* 금액 큰 표시 */}
            <View style={amt.amountDisplay}>
              <Text style={[amt.amountText, amount > 0 && amt.amountActive]}>
                {amount > 0 ? formatAmount(amount) : '얼마인가요?'}
              </Text>
            </View>

            {/* 텍스트 입력 */}
            <TextInput
              style={s.input}
              placeholder="직접 입력 (예: 5,000,000)"
              placeholderTextColor={C.lightOak}
              value={amountText}
              onChangeText={text => setAmountText(toCommaInput(text))}
              keyboardType="numeric"
              selectTextOnFocus
              autoFocus
            />

            {/* 빠른 금액 칩 */}
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

  // ── Step 1: 카테고리 + 항목명 ─────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <SvgChevronLeft />
        </TouchableOpacity>
        <Text style={s.headerTitle}>자산 추가</Text>
        <View style={{ width: 32 }} />
      </View>
      <ProgressBar step={1} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* 카테고리 카드 그리드 */}
          <Text style={s.label}>카테고리</Text>
          <View style={step1.catGrid}>
            {CATEGORIES.map(cat => {
              const cfg = CAT_CONFIG[cat];
              const active = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    step1.catCard,
                    active && { borderColor: cfg.color, backgroundColor: cfg.color + '15' },
                  ]}
                  onPress={() => setCategory(cat)}
                  activeOpacity={0.75}
                >
                  <Text style={step1.catEmoji}>{cfg.emoji}</Text>
                  <Text style={[step1.catLabel, active && { color: cfg.color, fontWeight: '800' }]}>
                    {cat}
                  </Text>
                  {active && (
                    <View style={[step1.activeDot, { backgroundColor: cfg.color }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 항목명 입력 */}
          <Text style={[s.label, { marginTop: 24 }]}>항목명</Text>
          <TextInput
            style={s.input}
            placeholder="예: 카카오뱅크 적금, 삼성전자"
            placeholderTextColor={C.lightOak}
            value={name}
            onChangeText={setName}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={goStep2}
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
});

// ── Step 1 스타일 ──────────────────────────────
const step1 = StyleSheet.create({
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catCard: {
    width: '30%',
    flexGrow: 1,
    backgroundColor: C.ivory,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.edge,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  catEmoji: { fontSize: 26 },
  catLabel: { fontSize: 13, fontWeight: '600', color: C.warmOak },
  activeDot: {
    position: 'absolute',
    top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
  },
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
  iconEmoji: { fontSize: 20 },
  assetName: { fontSize: 15, fontWeight: '800', color: C.dark },
  assetCat: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  amountDisplay: { alignItems: 'center', marginBottom: 24 },
  amountText: { fontSize: 34, fontWeight: '800', color: '#C5B09A', letterSpacing: -1 },
  amountActive: { color: C.dark },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
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

// ── Step 3 (확인) 스타일 ───────────────────────
const confirm = StyleSheet.create({
  card: {
    backgroundColor: C.ivory,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.edge,
    marginBottom: 24,
  },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  iconEmoji: { fontSize: 22 },
  assetName: { fontSize: 17, fontWeight: '800', color: C.dark },
  assetCat: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  dashed: { borderBottomWidth: 1, borderColor: C.edge, borderStyle: 'dashed', marginBottom: 16 },
  amtWrap: { alignItems: 'center', paddingVertical: 8 },
  amtLabel: { fontSize: 12, color: C.lightOak, fontWeight: '600', marginBottom: 6 },
  amtVal: { fontSize: 28, fontWeight: '800', color: C.dark, letterSpacing: -0.5 },
  ownerRow: { flexDirection: 'row', gap: 12 },
  ownerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: C.ivory,
    borderWidth: 1.5,
    borderColor: C.edge,
    alignItems: 'center',
  },
  ownerBtnMe:      { backgroundColor: C.brown, borderColor: C.brown },
  ownerBtnPartner: { backgroundColor: '#9478C9', borderColor: '#9478C9' },
  ownerText:        { fontSize: 15, fontWeight: '700', color: C.warmOak },
  ownerTextMe:      { color: '#FFFFFF' },
  ownerTextPartner: { color: '#FFFFFF' },
});

// ── Step 4 (완료) 스타일 ───────────────────────
const done = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  wrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 80 },
  circle: {
    width: 110, height: 110, borderRadius: 55,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
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
  },
  btnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});

export default AssetAddScreen;
