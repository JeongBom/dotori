// 영수증 스캔 화면 — 사진 한 장으로 음식/생필품 재고 일괄 반영
// 흐름: 사진 선택 → AI 분석 → 확인/수정 → 반영
// 원칙: 자동 반영 금지(확인 화면 필수), 가격 정보는 다루지 않음

import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Camera, Image as ImageIcon, Check, X, RotateCcw, ReceiptText } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import { getOrCreateFamilyId } from '../lib/supabase';
import {
  parseReceipt, loadInventoryForMatching, matchReceiptItems,
  matchSingleReceiptItem, applyReceiptItems, InventorySnapshot,
} from '../lib/receipt';
import { ReceiptCategory, ReceiptReviewItem } from '../types';
import { RootStackParamList } from '../navigation';
import { theme } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ReceiptScan'>;
type Phase = 'pick' | 'analyzing' | 'review' | 'done' | 'error';

const ReceiptScanScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [phase, setPhase] = useState<Phase>('pick');
  const [rows, setRows] = useState<ReceiptReviewItem[]>([]);
  const [inventory, setInventory] = useState<InventorySnapshot | null>(null);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneSummary, setDoneSummary] = useState('');

  // ── 사진 선택 → 분석 ──────────────────────────
  const analyze = useCallback(async (base64: string, mimeType: string) => {
    setPhase('analyzing');
    try {
      const fid = await getOrCreateFamilyId();
      if (!fid) throw new Error('가족 정보를 찾을 수 없습니다');
      setFamilyId(fid);

      // 재고를 먼저 읽어서 품목명을 AI 오독 교정 힌트로 전달
      const inv = await loadInventoryForMatching(fid);
      setInventory(inv);
      const knownNames = [...inv.fridge, ...inv.supplies].map(i => i.name);

      const parsed = await parseReceipt(base64, mimeType, knownNames);
      if (parsed.length === 0) {
        setErrorMsg('영수증에서 품목을 찾지 못했어요.\n영수증이 잘 보이게 다시 찍어주세요.');
        setPhase('error');
        return;
      }
      setRows(matchReceiptItems(parsed, inv));
      setPhase('review');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setErrorMsg(`분석에 실패했어요.\n(${msg})`);
      setPhase('error');
    }
  }, []);

  const pickImage = useCallback(async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('알림', fromCamera ? '카메라 권한을 허용해주세요.' : '사진 접근 권한을 허용해주세요.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 1,
    };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.uri) return;

    // 카메라 원본은 수 MB라 API 이미지 한도(5MB)를 넘을 수 있음
    // → 가로 1600px로 줄이고 압축해서 전송 (잔글씨 판독과 용량의 균형점)
    const resized = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (!resized.base64) {
      Alert.alert('오류', '이미지 처리에 실패했습니다. 다시 시도해주세요.');
      return;
    }
    analyze(resized.base64, 'image/jpeg');
  }, [analyze]);

  // ── 확인 화면 행 조작 ─────────────────────────
  const updateRow = useCallback((key: string, patch: Partial<ReceiptReviewItem>) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  }, []);

  const includedCount = rows.filter(r => !r.excluded).length;

  const handleApply = useCallback(async () => {
    if (!familyId || includedCount === 0) return;
    setSaving(true);
    const res = await applyReceiptItems(familyId, rows);
    setSaving(false);
    setDoneSummary(
      res.failed > 0
        ? `${res.applied}개 반영, ${res.failed}개 실패했어요`
        : `${res.applied}개 품목을 재고에 반영했어요`
    );
    setPhase('done');
  }, [familyId, rows, includedCount]);

  // ── 렌더: 단계별 ──────────────────────────────

  const renderPick = () => (
    <View style={s.centerWrap}>
      <View style={s.pickIconCircle}>
        <ReceiptText color={theme.colors.brand} size={36} strokeWidth={1.5} />
      </View>
      <Text style={s.pickTitle}>영수증으로 채우기</Text>
      <Text style={s.pickDesc}>
        장 봐온 영수증을 찍으면{'\n'}음식과 생필품 재고에 한 번에 반영해요
      </Text>

      <TouchableOpacity style={s.primaryBtn} onPress={() => pickImage(true)} activeOpacity={0.85}>
        <Camera color="#FFFFFF" size={20} strokeWidth={1.5} />
        <Text style={s.primaryBtnText}>카메라로 찍기</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.secondaryBtn} onPress={() => pickImage(false)} activeOpacity={0.85}>
        <ImageIcon color={theme.colors.brand} size={20} strokeWidth={1.5} />
        <Text style={s.secondaryBtnText}>앨범에서 선택</Text>
      </TouchableOpacity>

      <Text style={s.privacyNote}>품목과 수량만 읽어요. 가격은 저장하지 않아요.</Text>
    </View>
  );

  const renderAnalyzing = () => (
    <View style={s.centerWrap}>
      <ActivityIndicator size="large" color={theme.colors.brand} />
      <Text style={s.analyzingText}>영수증을 읽고 있어요...</Text>
    </View>
  );

  const renderError = () => (
    <View style={s.centerWrap}>
      <Text style={s.errorText}>{errorMsg}</Text>
      <TouchableOpacity style={s.primaryBtn} onPress={() => setPhase('pick')} activeOpacity={0.85}>
        <RotateCcw color="#FFFFFF" size={18} strokeWidth={1.5} />
        <Text style={s.primaryBtnText}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDone = () => (
    <View style={s.centerWrap}>
      <View style={s.doneCircle}>
        <Check color="#FFFFFF" size={36} strokeWidth={2.5} />
      </View>
      <Text style={s.doneTitle}>반영 완료!</Text>
      <Text style={s.doneSub}>{doneSummary}</Text>
      <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
        <Text style={s.primaryBtnText}>확인</Text>
      </TouchableOpacity>
    </View>
  );

  const renderReviewRow = ({ item }: { item: ReceiptReviewItem }) => (
    <View style={[r.card, item.excluded && r.cardExcluded]}>
      {/* 분류 칩 — 탭하면 음식↔생필품 전환 (전환한 분류 쪽에서 다시 매칭) */}
      <TouchableOpacity
        style={[r.catChip, item.category === 'supply' && r.catChipSupply]}
        disabled={item.excluded}
        onPress={() => {
          const nextCat: ReceiptCategory = item.category === 'food' ? 'supply' : 'food';
          const res = inventory
            ? matchSingleReceiptItem(item.name, nextCat, inventory, true)
            : { matched: null, suggestion: null, category: nextCat };
          updateRow(item.key, res);
        }}
      >
        <Text style={r.catChipText}>{item.category === 'food' ? '음식' : '생필품'}</Text>
      </TouchableOpacity>

      {/* 이름 + 매칭 정보 — 이름을 고치면 매칭도 다시 계산됨 */}
      <View style={r.body}>
        <TextInput
          style={r.nameInput}
          value={item.name}
          onChangeText={t => {
            const res = inventory
              ? matchSingleReceiptItem(t, item.category, inventory)
              : { matched: item.matched, category: item.category };
            updateRow(item.key, { name: t, ...res });
          }}
          editable={!item.excluded}
          maxLength={30}
        />
        {item.matched ? (
          <View style={r.matchRow}>
            <Text style={r.matchedText} numberOfLines={1}>
              기존 '{item.matched.name}' {item.matched.quantity} → {item.matched.quantity + item.quantity}
            </Text>
            {/* 합침 거부 → 새 품목으로 */}
            <TouchableOpacity onPress={() => updateRow(item.key, { matched: null })} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={r.matchAction}>따로 추가</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={r.matchRow}>
            <Text style={r.newText}>새로 추가</Text>
            {/* 비슷한 품목 추천 → 탭하면 합치기 */}
            {item.suggestion && (
              <TouchableOpacity
                onPress={() => updateRow(item.key, {
                  matched: item.suggestion,
                  category: item.suggestion!.table === 'fridge' ? 'food' : 'supply',
                })}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={r.matchAction}>'{item.suggestion.name}'에 합치기</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* 수량 스텝퍼 */}
      {!item.excluded && (
        <View style={r.stepper}>
          <TouchableOpacity
            style={r.stepBtn}
            onPress={() => updateRow(item.key, { quantity: Math.max(1, item.quantity - 1) })}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
          >
            <Text style={r.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={r.qtyNum}>{item.quantity}</Text>
          <TouchableOpacity
            style={[r.stepBtn, r.stepBtnPlus]}
            onPress={() => updateRow(item.key, { quantity: Math.min(99, item.quantity + 1) })}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
          >
            <Text style={[r.stepBtnText, r.stepBtnPlusText]}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 제외/복원 토글 */}
      <TouchableOpacity
        style={r.excludeBtn}
        onPress={() => updateRow(item.key, { excluded: !item.excluded })}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
      >
        {item.excluded
          ? <RotateCcw color={theme.colors.warm.oak} size={16} strokeWidth={1.5} />
          : <X color={theme.colors.warm.lightOak} size={16} strokeWidth={1.5} />}
      </TouchableOpacity>
    </View>
  );

  const renderReview = () => (
    <>
      <Text style={s.reviewCount}>인식된 품목 {rows.length}개 · 반영 대상 {includedCount}개</Text>
      <Text style={s.reviewHint}>이름과 수량을 확인하고, 잘못 읽힌 항목은 ✕로 제외하세요</Text>
      <FlatList
        data={rows}
        keyExtractor={item => item.key}
        renderItem={renderReviewRow}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.ctaBtn, (saving || includedCount === 0) && { opacity: 0.5 }]}
          onPress={handleApply}
          disabled={saving || includedCount === 0}
          activeOpacity={0.85}
        >
          <Text style={s.ctaBtnText}>
            {saving ? '반영 중...' : `${includedCount}개 재고에 반영하기`}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ChevronLeft color={theme.colors.warm.dark} size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>영수증으로 채우기</Text>
        <View style={s.headerRight} />
      </View>

      {phase === 'pick' && renderPick()}
      {phase === 'analyzing' && renderAnalyzing()}
      {phase === 'review' && renderReview()}
      {phase === 'error' && renderError()}
      {phase === 'done' && renderDone()}
    </SafeAreaView>
  );
};

// ── 화면 스타일 ─────────────────────────────────
const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.card },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.warm.dark },
  headerRight: { width: 40 },

  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  pickIconCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.warm.cream,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  pickTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 10 },
  pickDesc: { fontSize: 14, color: theme.colors.warm.oak, textAlign: 'center', lineHeight: 21, marginBottom: 36 },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.brand, borderRadius: 16,
    paddingVertical: 16, alignSelf: 'stretch', marginBottom: 12,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: theme.colors.warm.ivory, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.warm.edge,
    paddingVertical: 16, alignSelf: 'stretch',
  },
  secondaryBtnText: { color: theme.colors.brand, fontSize: 16, fontWeight: '600' },
  privacyNote: { fontSize: 12, color: theme.colors.warm.lightOak, marginTop: 24, textAlign: 'center' },

  analyzingText: { fontSize: 15, color: theme.colors.warm.oak, marginTop: 16, fontWeight: '600' },
  errorText: { fontSize: 15, color: theme.colors.warm.dark, textAlign: 'center', lineHeight: 23, marginBottom: 28 },

  doneCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  doneTitle: { fontSize: 24, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 10 },
  doneSub: { fontSize: 15, color: theme.colors.warm.oak, textAlign: 'center', lineHeight: 22, marginBottom: 40 },

  reviewCount: { fontSize: 15, fontWeight: '700', color: theme.colors.warm.dark, paddingHorizontal: 24, marginTop: 4 },
  reviewHint: { fontSize: 12, color: theme.colors.warm.lightOak, paddingHorizontal: 24, marginTop: 4, marginBottom: 12 },

  bottomBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: theme.colors.card,
  },
  ctaBtn: { backgroundColor: theme.colors.brand, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  ctaBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});

// ── 확인 행 스타일 ──────────────────────────────
const r = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.warm.ivory, marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  cardExcluded: { opacity: 0.45 },
  catChip: {
    backgroundColor: theme.colors.brand, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3, flexShrink: 0,
  },
  catChipSupply: { backgroundColor: theme.colors.warm.deep },
  catChipText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  body: { flex: 1, minWidth: 0 },
  nameInput: {
    fontSize: 14, fontWeight: '600', color: theme.colors.warm.dark,
    padding: 0, borderBottomWidth: 1, borderBottomColor: `${theme.colors.warm.edge}88`,
    paddingBottom: 2,
  },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  matchedText: { fontSize: 11, color: theme.colors.status.safe, fontWeight: '600', flexShrink: 1 },
  newText: { fontSize: 11, color: theme.colors.brand, fontWeight: '600' },
  matchAction: { fontSize: 11, color: theme.colors.warm.oak, fontWeight: '600', textDecorationLine: 'underline' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  stepBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.colors.warm.edge, justifyContent: 'center', alignItems: 'center',
  },
  stepBtnPlus: { backgroundColor: theme.colors.brand },
  stepBtnText: { fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, lineHeight: 17 },
  stepBtnPlusText: { color: '#FFFFFF' },
  qtyNum: { fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, minWidth: 18, textAlign: 'center' },
  excludeBtn: { flexShrink: 0, padding: 2 },
});

export default ReceiptScanScreen;
