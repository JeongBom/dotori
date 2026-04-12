// 재무 화면 - 자산 관리
// 구조: 총 자산 카드 → 카테고리별 자산 목록 → 추가 버튼
// 자산 탭 → 수정 모달 (금액/메모) → 히스토리 화면

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, X, History, ChevronRight, Target, Pencil, Trash2 } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Asset, AssetCategory } from '../types';
import { RootTabParamList, RootStackParamList } from '../navigation';

type FinanceNavProp = CompositeNavigationProp<
  BottomTabNavigationProp<RootTabParamList, 'Finance'>,
  NativeStackNavigationProp<RootStackParamList>
>;

// ── 카테고리 설정 ──────────────────────────────

const CATEGORIES: AssetCategory[] = ['예금', '적금', '주식', '부동산', '기타'];

const CAT_CONFIG: Record<AssetCategory, { color: string; emoji: string }> = {
  '예금':   { color: '#4A9EC9', emoji: '🏦' },
  '적금':   { color: '#5AAF6E', emoji: '💵' },
  '주식':   { color: '#D9629A', emoji: '📈' },
  '부동산': { color: '#D4864A', emoji: '🏠' },
  '기타':   { color: '#9EA8B0', emoji: '📦' },
};

// ── 금액 포맷 ──────────────────────────────────
// 5,000,000 → "500만원" / 150,000,000 → "1억 5,000만원"

function formatAmount(n: number): string {
  if (n === 0) return '0원';
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const won = n % 10_000;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man.toLocaleString()}만`);
  if (won > 0 && eok === 0) parts.push(`${won.toLocaleString()}`); // 억 단위 넘으면 원 단위 생략
  return parts.join(' ') + '원';
}

// ── 총 자산 카드 ──────────────────────────────

interface TotalCardProps {
  total: number;
  assetCount: number;
  onHistoryPress: () => void;
}

const TotalCard: React.FC<TotalCardProps> = ({ total, assetCount, onHistoryPress }) => (
  <View style={cardStyles.card}>
    <View style={cardStyles.topRow}>
      <Text style={cardStyles.label}>우리 집 총 자산</Text>
      <TouchableOpacity onPress={onHistoryPress} style={cardStyles.historyBtn}>
        <History color="rgba(255,255,255,0.85)" size={16} strokeWidth={1.5} />
        <Text style={cardStyles.historyBtnText}>히스토리</Text>
      </TouchableOpacity>
    </View>
    <Text style={cardStyles.amount}>{formatAmount(total)}</Text>
    <Text style={cardStyles.sub}>{assetCount}개 항목</Text>
  </View>
);

const cardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 28,
    backgroundColor: '#8B5E3C',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    shadowColor: '#6B4226',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  amount: { fontSize: 32, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  sub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6 },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  historyBtnText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
});

// ── 자산 행 ──────────────────────────────────

interface AssetRowProps {
  asset: Asset;
  ownerNickname: string | null; // 담당자 닉네임 (null이면 뱃지 미표시)
  isMe: boolean;
  onPress: () => void;
}

const AssetRow: React.FC<AssetRowProps> = ({ asset, ownerNickname, isMe, onPress }) => (
  <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.7}>
    <View style={rowStyles.left}>
      <Text style={rowStyles.name}>{asset.name}</Text>
      {/* 담당자 뱃지: 닉네임이 있을 때만 표시 */}
      {ownerNickname && (
        <View style={[rowStyles.badge, isMe ? rowStyles.badgeMe : rowStyles.badgePartner]}>
          <Text style={[rowStyles.badgeText, isMe ? rowStyles.badgeTextMe : rowStyles.badgeTextPartner]}>
            {ownerNickname}
          </Text>
        </View>
      )}
    </View>
    <View style={rowStyles.right}>
      <Text style={rowStyles.amount}>{formatAmount(asset.amount)}</Text>
      <ChevronRight color="#D4B896" size={16} strokeWidth={2} />
    </View>
  </TouchableOpacity>
);

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#5C3D1E' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeMe: { backgroundColor: '#EDD9C0' },
  badgePartner: { backgroundColor: '#EEE4F4' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextMe: { color: '#8B5E3C' },
  badgeTextPartner: { color: '#9478C9' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  amount: { fontSize: 15, fontWeight: '700', color: '#5C3D1E' },
});

// ── 카테고리 섹션 ────────────────────────────

// 가족 구성원 기본 타입 (닉네임 표시용)
interface FamilyMemberBasic {
  id: string;
  nickname: string;
}

interface CategorySectionProps {
  category: AssetCategory;
  assets: Asset[];
  currentUserId: string | null;
  familyMembers: FamilyMemberBasic[];
  onPressAsset: (asset: Asset) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category, assets, currentUserId, familyMembers, onPressAsset,
}) => {
  if (assets.length === 0) return null;

  const { color, emoji } = CAT_CONFIG[category];
  const subtotal = assets.reduce((sum, a) => sum + a.amount, 0);

  // user_id → 닉네임 맵
  const nicknameMap = Object.fromEntries(familyMembers.map(m => [m.id, m.nickname]));

  return (
    <View style={sectionStyles.section}>
      {/* 카테고리 헤더: 이름 + 소계 */}
      <View style={sectionStyles.header}>
        <View style={sectionStyles.headerLeft}>
          <View style={[sectionStyles.dot, { backgroundColor: color }]} />
          <Text style={sectionStyles.catName}>{emoji} {category}</Text>
        </View>
        <Text style={[sectionStyles.subtotal, { color }]}>{formatAmount(subtotal)}</Text>
      </View>
      {assets.map(asset => (
        <AssetRow
          key={asset.id}
          asset={asset}
          ownerNickname={asset.user_id ? (nicknameMap[asset.user_id] ?? null) : null}
          isMe={asset.user_id === currentUserId}
          onPress={() => onPressAsset(asset)}
        />
      ))}
    </View>
  );
};

const sectionStyles = StyleSheet.create({
  section: { marginBottom: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  catName: { fontSize: 13, fontWeight: '700', color: '#5C3D1E' },
  subtotal: { fontSize: 13, fontWeight: '600' },
});

// ── 금액 입력 → 쉼표 포맷 헬퍼 ──────────────
// "1000000" → "1,000,000" (입력 중 실시간 반영)

function toCommaInput(text: string): string {
  const digits = text.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('ko-KR');
}

function parseCommaInput(text: string): number {
  return parseInt(text.replace(/,/g, ''), 10) || 0;
}

// ── 자산 추가 모달 ────────────────────────────

interface AddAssetModalProps {
  visible: boolean;
  familyId: string;
  currentUserId: string | null;
  familyMembers: FamilyMemberBasic[]; // 가족 구성원 목록 (닉네임 표시용)
  onClose: () => void;
  onSaved: () => void;
}

const AddAssetModal: React.FC<AddAssetModalProps> = ({
  visible, familyId, currentUserId, familyMembers, onClose, onSaved,
}) => {
  const [category, setCategory] = useState<AssetCategory>('예금');
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  // 선택된 담당자 ID (초기값: 현재 유저)
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(currentUserId);
  const [saving, setSaving] = useState(false);

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (visible) {
      setCategory('예금');
      setName('');
      setAmountText('');
      setSelectedOwnerId(currentUserId);
    }
  }, [visible, currentUserId]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('알림', '항목명을 입력해주세요.'); return; }
    const amount = parseCommaInput(amountText);
    if (!amount || amount <= 0) { Alert.alert('알림', '금액을 올바르게 입력해주세요.'); return; }

    setSaving(true);
    try {
      const { data: asset, error } = await supabase
        .from('assets')
        .insert({ family_id: familyId, user_id: selectedOwnerId, category, name: name.trim(), amount })
        .select()
        .single();

      if (error) throw error;

      // 최초 등록 히스토리 자동 기록
      await supabase.from('asset_histories').insert({
        asset_id: asset.id,
        previous_amount: 0,
        new_amount: amount,
        memo: '최초 등록',
      });

      onSaved();
      onClose();
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const parsedAmount = parseCommaInput(amountText);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>자산 추가</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color="#C49A6C" size={22} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} automaticallyAdjustKeyboardInsets>
            <View>

            {/* 카테고리 */}
            <Text style={modalStyles.label}>카테고리</Text>
            <View style={modalStyles.catRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    modalStyles.catChip,
                    category === c && { backgroundColor: CAT_CONFIG[c].color, borderColor: CAT_CONFIG[c].color },
                  ]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[modalStyles.catChipText, category === c && { color: '#FFFFFF' }]}>
                    {CAT_CONFIG[c].emoji} {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 항목명 */}
            <Text style={modalStyles.label}>항목명</Text>
            <TextInput
              style={modalStyles.input}
              placeholder="예: 카카오뱅크 적금"
              placeholderTextColor="#C49A6C"
              value={name}
              onChangeText={setName}
              autoCorrect={false}
              returnKeyType="next"
            />

            {/* 금액 */}
            <View style={modalStyles.labelRow}>
              <Text style={modalStyles.labelInRow}>금액 (원)</Text>
              {parsedAmount > 0 && <Text style={modalStyles.amountInline}>{formatAmount(parsedAmount)}</Text>}
            </View>
            <TextInput
              style={modalStyles.input}
              placeholder="예: 5,000,000"
              placeholderTextColor="#C49A6C"
              value={amountText}
              onChangeText={text => setAmountText(toCommaInput(text))}
              keyboardType="numeric"
            />

            {/* 담당자 선택: 가족이 2명 이상일 때만 선택 가능, 1명이면 자동 선택 표시 */}
            <Text style={modalStyles.label}>담당자</Text>
            <View style={modalStyles.ownerRow}>
              {familyMembers.map((member, idx) => {
                const isSelected = selectedOwnerId === member.id;
                // 첫 번째 멤버(나)는 브라운, 나머지(파트너)는 퍼플
                const isCurrentUser = member.id === currentUserId;
                return (
                  <TouchableOpacity
                    key={member.id}
                    style={[
                      modalStyles.ownerBtn,
                      isSelected && (isCurrentUser ? modalStyles.ownerBtnActive : modalStyles.ownerBtnPartnerActive),
                    ]}
                    onPress={() => {
                      // 혼자일 때는 선택 변경 불필요 (이미 자동 선택)
                      if (familyMembers.length > 1) setSelectedOwnerId(member.id);
                    }}
                    activeOpacity={familyMembers.length > 1 ? 0.7 : 1}
                  >
                    <Text style={[
                      modalStyles.ownerBtnText,
                      isSelected && (isCurrentUser ? modalStyles.ownerBtnTextActive : modalStyles.ownerBtnTextPartnerActive),
                    ]}>
                      {member.nickname}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[modalStyles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={modalStyles.saveBtnText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── 자산 수정 모달 ────────────────────────────
// 추가/감소 선택 → 변동 금액 입력 → 이유 입력 방식

interface EditAssetModalProps {
  visible: boolean;
  asset: Asset | null;
  currentUserId: string | null;
  familyMembers: FamilyMemberBasic[];
  onClose: () => void;
  onSaved: () => void;
  onDelete: (asset: Asset, keepHistory: boolean) => void;
}

const EditAssetModal: React.FC<EditAssetModalProps> = ({
  visible, asset, currentUserId, familyMembers, onClose, onSaved, onDelete,
}) => {
  const [isIncrease, setIsIncrease] = useState(true); // true=추가, false=감소
  const [changeText, setChangeText] = useState('');   // 변동 금액 (쉼표 포맷)
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsIncrease(true);
      setChangeText('');
      setMemo('');
    }
  }, [visible]);

  if (!asset) return null;

  const changeAmount = parseCommaInput(changeText);
  // 최종 금액 미리보기
  const newAmount = isIncrease
    ? asset.amount + changeAmount
    : asset.amount - changeAmount;

  const handleSave = async () => {
    if (changeAmount <= 0) {
      Alert.alert('알림', '변동 금액을 입력해주세요.');
      return;
    }
    if (!isIncrease && newAmount < 0) {
      Alert.alert('알림', '감소 금액이 현재 금액을 초과할 수 없어요.');
      return;
    }
    if (!memo.trim()) {
      Alert.alert('알림', '변경 이유를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ amount: newAmount })
        .eq('id', asset.id);

      if (error) throw error;

      // 변경 히스토리 기록
      await supabase.from('asset_histories').insert({
        asset_id: asset.id,
        previous_amount: asset.amount,
        new_amount: newAmount,
        memo: memo.trim(),
      });

      onSaved();
      onClose();
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      '삭제 방법 선택',
      `${asset.name}을(를) 어떻게 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '히스토리 남기고 삭제',
          onPress: () => { onClose(); onDelete(asset, true); },
        },
        {
          text: '히스토리 포함 삭제',
          style: 'destructive',
          onPress: () => { onClose(); onDelete(asset, false); },
        },
      ],
    );
  };

  const { color, emoji } = CAT_CONFIG[asset.category];
  const showPreview = changeAmount > 0;

  // 담당자 닉네임 (familyMembers에서 조회)
  const nicknameMap = Object.fromEntries(familyMembers.map(m => [m.id, m.nickname]));
  const ownerNickname = asset.user_id ? (nicknameMap[asset.user_id] ?? null) : null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} automaticallyAdjustKeyboardInsets>

            {/* 헤더 */}
            <View style={modalStyles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={modalStyles.sheetTitle}>{asset.name}</Text>
                <Text style={[modalStyles.sheetSubtitle, { color }]}>
                  {ownerNickname
                    ? `${emoji} ${asset.category}  ${ownerNickname}`
                    : `${emoji} ${asset.category}`}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color="#C49A6C" size={22} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* 현재 금액 */}
            <View style={modalStyles.currentRow}>
              <Text style={modalStyles.currentLabel}>현재 금액</Text>
              <Text style={modalStyles.currentValue}>
                {asset.amount.toLocaleString('ko-KR')}원
              </Text>
            </View>

            {/* 추가 / 감소 선택 */}
            <Text style={modalStyles.label}>변동 유형</Text>
            <View style={modalStyles.toggleRow}>
              <TouchableOpacity
                style={[modalStyles.toggleBtn, isIncrease && modalStyles.toggleBtnUp]}
                onPress={() => setIsIncrease(true)}
              >
                <Text style={[modalStyles.toggleBtnText, isIncrease && modalStyles.toggleBtnTextUp]}>
                  + 추가
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[modalStyles.toggleBtn, !isIncrease && modalStyles.toggleBtnDown]}
                onPress={() => setIsIncrease(false)}
              >
                <Text style={[modalStyles.toggleBtnText, !isIncrease && modalStyles.toggleBtnTextDown]}>
                  − 감소
                </Text>
              </TouchableOpacity>
            </View>

            {/* 변동 금액 입력 */}
            <View style={modalStyles.labelRow}>
              <Text style={modalStyles.labelInRow}>변동 금액 (원)</Text>
              {showPreview && (
                <Text style={[modalStyles.amountInline, isIncrease ? modalStyles.amountUp : modalStyles.amountDown]}>
                  → {newAmount.toLocaleString('ko-KR')}원
                </Text>
              )}
            </View>
            <TextInput
              style={modalStyles.input}
              placeholder="예: 500,000"
              placeholderTextColor="#C49A6C"
              value={changeText}
              onChangeText={text => setChangeText(toCommaInput(text))}
              keyboardType="numeric"
              selectTextOnFocus
            />

            {/* 변경 이유 */}
            <Text style={modalStyles.label}>
              변경 이유 <Text style={{ color: '#D95F4B' }}>*</Text>
            </Text>
            <TextInput
              style={modalStyles.input}
              placeholder="예: 월급 입금, 주식 매수"
              placeholderTextColor="#C49A6C"
              value={memo}
              onChangeText={setMemo}
              autoCorrect={false}
              returnKeyType="done"
            />

            {/* 저장 버튼 */}
            <TouchableOpacity
              style={[modalStyles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={modalStyles.saveBtnText}>{saving ? '저장 중...' : '저장'}</Text>
            </TouchableOpacity>

            {/* 삭제 */}
            <TouchableOpacity style={modalStyles.deleteBtn} onPress={handleDelete}>
              <Text style={modalStyles.deleteBtnText}>이 자산 삭제</Text>
            </TouchableOpacity>

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── 모달 공통 스타일 ──────────────────────────

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFF8F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    maxHeight: Dimensions.get('window').height * 0.85,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#5C3D1E' },
  sheetSubtitle: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5E3C',
    marginTop: 16,
    marginBottom: 8,
  },
  // 라벨과 금액 미리보기를 한 줄에
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  labelInRow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5E3C',
  },
  amountInline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B5E3C',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#5C3D1E',
    borderWidth: 1,
    borderColor: '#DEC8A8',
  },
  amountPreview: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginTop: 6 },
  amountUp: { color: '#5AAF6E' },
  amountDown: { color: '#D95F4B' },
  // 카테고리 칩
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#DEC8A8',
  },
  catChipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '500' },
  // 담당자 선택
  ownerRow: { flexDirection: 'row', gap: 12 },
  ownerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#DEC8A8',
    alignItems: 'center',
  },
  ownerBtnActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  ownerBtnPartnerActive: { backgroundColor: '#9478C9', borderColor: '#9478C9' },
  ownerBtnText: { fontSize: 15, fontWeight: '600', color: '#8B5E3C' },
  ownerBtnTextActive: { color: '#FFFFFF' },
  ownerBtnTextPartnerActive: { color: '#FFFFFF' },
  // 현재 금액 표시
  currentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FDF6EC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  currentLabel: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  currentValue: { fontSize: 17, fontWeight: '800', color: '#5C3D1E' },
  // 추가/감소 토글
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#DEC8A8',
    alignItems: 'center',
  },
  toggleBtnUp: { backgroundColor: '#E8F5EE', borderColor: '#5AAF6E' },
  toggleBtnDown: { backgroundColor: '#FCECEA', borderColor: '#D95F4B' },
  toggleBtnText: { fontSize: 15, fontWeight: '700', color: '#8B5E3C' },
  toggleBtnTextUp: { color: '#5AAF6E' },
  toggleBtnTextDown: { color: '#D95F4B' },
  // 변동 후 미리보기
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FDF6EC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 8,
  },
  previewLabel: { fontSize: 12, color: '#A87850', fontWeight: '600' },
  previewValue: { fontSize: 16, fontWeight: '800' },
  // 버튼 행
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  historyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4B896',
    backgroundColor: '#FFF8F0',
  },
  historyBtnText: { fontSize: 14, fontWeight: '600', color: '#8B5E3C' },
  saveBtn: {
    backgroundColor: '#8B5E3C',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  deleteBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  deleteBtnText: { fontSize: 13, color: '#D95F4B', fontWeight: '500' },
});

// ── 날짜 피커 모달 (AddFridgeItemScreen과 동일한 패턴) ──

interface DatePickerModalProps {
  visible: boolean;
  value: string;
  title: string;
  minimumDate?: Date;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible, value, title, minimumDate, onConfirm, onCancel,
}) => {
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useEffect(() => {
    if (visible) {
      setTempDate(value ? new Date(value) : new Date());
    }
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
    return (
      <DateTimePicker
        value={tempDate}
        mode="date"
        display="calendar"
        onChange={onChange}
        minimumDate={minimumDate}
      />
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const calendarWidth = screenWidth - 32;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={dpStyles.overlay}>
        <View style={[dpStyles.container, { width: calendarWidth }]}>
          <Text style={dpStyles.title}>{title}</Text>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="inline"
            onChange={onChange}
            locale="ko-KR"
            style={{ width: calendarWidth - 16, alignSelf: 'center' }}
            accentColor="#8B5E3C"
            minimumDate={minimumDate}
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
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#DEC8A8' },
  cancelText: { fontSize: 15, color: '#8B5E3C', fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: '#8B5E3C' },
  confirmText: { fontSize: 15, color: '#FFFFFF', fontWeight: '700' },
});

// ── 목표 타입 ──────────────────────────────────

interface GoalData {
  id: string;
  family_id: string;
  title: string;
  target_amount: number;
  start_date: string | null;
  end_date: string | null;
  memo: string | null;
  is_active: boolean;
  created_at: string;
}

interface GoalItemData {
  id: string;
  goal_id: string;
  asset_id: string | null;
  name: string;
  amount: number;
  saved_date: string | null;
  memo: string | null;
  is_active: boolean;
}

// ── 날짜 포맷 헬퍼 ─────────────────────────────

function formatDateStr(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ── 목표 모달 ────────────────────────────────
// 목표 생성/수정: 제목, 목표 금액, 마감일, 목적 입력

interface GoalModalProps {
  visible: boolean;
  familyId: string;
  existing: GoalData | null;
  onClose: () => void;
  onSaved: () => void;
}

const GoalModal: React.FC<GoalModalProps> = ({ visible, familyId, existing, onClose, onSaved }) => {
  const [title, setTitle]           = useState('');
  const [amountText, setAmountText] = useState('');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [memo, setMemo]             = useState('');
  const [saving, setSaving]         = useState(false);
  // 인라인 캘린더 — 'start' | 'end' | null (중첩 Modal 방지)
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate]         = useState<Date>(new Date());

  useEffect(() => {
    if (visible) {
      setTitle(existing?.title ?? '');
      setAmountText(existing ? existing.target_amount.toLocaleString('ko-KR') : '');
      setStartDate(existing?.start_date?.split('T')[0] ?? '');
      setEndDate(existing?.end_date?.split('T')[0] ?? '');
      setMemo(existing?.memo ?? '');
      setActivePicker(null);
    }
  }, [visible, existing]);

  // 로컬 날짜 문자열 (UTC 변환으로 인한 하루 밀림 방지)
  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const openPicker = (which: 'start' | 'end') => {
    let dateStr: string;
    if (which === 'end') {
      // endDate가 없거나 startDate보다 이전이면 startDate로 초기화
      // (DateTimePicker가 minimumDate를 시각적으로 표시하지만 value는 변경 안함 → 불일치 방지)
      if (endDate && (!startDate || endDate >= startDate)) {
        dateStr = endDate;
      } else {
        dateStr = startDate;
      }
    } else {
      dateStr = startDate;
    }
    if (dateStr) {
      const [y, mo, d] = dateStr.split('-').map(Number);
      setTempDate(new Date(y, mo - 1, d));
    } else {
      setTempDate(new Date());
    }
    setActivePicker(which);
  };

  const confirmPicker = () => {
    const d = toDateStr(tempDate);
    if (activePicker === 'start') {
      setStartDate(d);
      if (endDate && d > endDate) setEndDate('');
    } else {
      setEndDate(d);
    }
    setActivePicker(null);
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('알림', '목표 이름을 입력해주세요.'); return; }
    const amount = parseCommaInput(amountText);
    if (!amount || amount <= 0) { Alert.alert('알림', '목표 금액을 올바르게 입력해주세요.'); return; }
    if (!startDate) { Alert.alert('알림', '시작 기간을 선택해주세요.'); return; }
    if (!endDate)   { Alert.alert('알림', '종료 기간을 선택해주세요.'); return; }
    if (endDate < startDate) { Alert.alert('알림', '종료 기간은 시작 기간 이후여야 해요.'); return; }

    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase.from('goals').update({
          title: title.trim(), target_amount: amount,
          start_date: startDate, end_date: endDate,
          memo: memo.trim() || null,
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('goals').insert({
          family_id: familyId, title: title.trim(), target_amount: amount,
          start_date: startDate, end_date: endDate,
          memo: memo.trim() || null,
        });
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? e?.details ?? JSON.stringify(e);
      Alert.alert('오류', `저장에 실패했습니다.\n\n${msg}`);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const parsedAmount = parseCommaInput(amountText);
  // 로컬 기준 Date 생성 (UTC 파싱으로 인한 날짜 밀림 방지)
  const endMinDate = startDate ? (() => {
    const [y, m, d] = startDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  })() : undefined;
  const calWidth = Dimensions.get('window').width - 48;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          {/* 헤더 */}
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>{existing ? '목표 수정' : '목표 설정'}</Text>
            <TouchableOpacity onPress={() => { setActivePicker(null); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color="#C49A6C" size={22} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* 인라인 캘린더 — activePicker 선택 시 */}
          {activePicker !== null ? (
            <View>
              <Text style={modalStyles.label}>
                {activePicker === 'start' ? '시작일 선택' : '종료일 선택'}
              </Text>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                onChange={(_, d) => { if (d) setTempDate(d); }}
                locale="ko-KR"
                accentColor="#8B5E3C"
                minimumDate={activePicker === 'end' ? endMinDate : undefined}
                style={{ width: calWidth, alignSelf: 'center' }}
              />
              <View style={dpStyles.actions}>
                <TouchableOpacity style={dpStyles.cancelBtn} onPress={() => setActivePicker(null)}>
                  <Text style={dpStyles.cancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dpStyles.confirmBtn} onPress={confirmPicker}>
                  <Text style={dpStyles.confirmText}>확인</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* 일반 폼 필드 */
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} automaticallyAdjustKeyboardInsets>
              <Text style={modalStyles.label}>목표 이름</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="예: 내 집 마련, 유럽 여행"
                placeholderTextColor="#C49A6C"
                value={title}
                onChangeText={setTitle}
                autoCorrect={false}
              />

              <View style={modalStyles.labelRow}>
                <Text style={modalStyles.labelInRow}>목표 금액 (원)</Text>
                {parsedAmount > 0 && <Text style={modalStyles.amountInline}>{formatAmount(parsedAmount)}</Text>}
              </View>
              <TextInput
                style={modalStyles.input}
                placeholder="예: 100,000,000"
                placeholderTextColor="#C49A6C"
                value={amountText}
                onChangeText={text => setAmountText(toCommaInput(text))}
                keyboardType="numeric"
              />

              <Text style={modalStyles.label}>목표 기간</Text>
              <View style={goalStyles.dateRow}>
                <TouchableOpacity style={goalStyles.datePicker} onPress={() => openPicker('start')}>
                  <Text style={startDate ? goalStyles.datePickerText : goalStyles.datePickerPlaceholder}>
                    {startDate ? formatDateStr(startDate) : '시작일 선택'}
                  </Text>
                </TouchableOpacity>
                <Text style={goalStyles.dateSeparator}>~</Text>
                <TouchableOpacity style={goalStyles.datePicker} onPress={() => openPicker('end')}>
                  <Text style={endDate ? goalStyles.datePickerText : goalStyles.datePickerPlaceholder}>
                    {endDate ? formatDateStr(endDate) : '종료일 선택'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={modalStyles.label}>목적 (선택)</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="예: 신혼집 보증금, 비상금"
                placeholderTextColor="#C49A6C"
                value={memo}
                onChangeText={setMemo}
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[modalStyles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={modalStyles.saveBtnText}>{saving ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ── 목표 항목 모달 ─────────────────────────────
// 항목 추가/수정: 자산 선택 + 기여 금액 입력

interface GoalItemModalProps {
  visible: boolean;
  goalId: string;
  assets: Asset[];
  existing: GoalItemData | null;
  totalCommitted: number; // 모든 목표의 항목 합산 (수정 중인 항목 제외)
  onClose: () => void;
  onSaved: () => void;
}

const GoalItemModal: React.FC<GoalItemModalProps> = ({
  visible, goalId, assets, existing, totalCommitted, onClose, onSaved,
}) => {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [savedDate, setSavedDate]   = useState('');
  const [memo, setMemo]             = useState('');
  const [saving, setSaving]         = useState(false);
  // 인라인 날짜 피커
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate]             = useState<Date>(new Date());

  const toLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  useEffect(() => {
    if (visible) {
      setSelectedAssetId(existing?.asset_id ?? (assets[0]?.id ?? null));
      setAmountText(existing ? existing.amount.toLocaleString('ko-KR') : '');
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      setSavedDate(existing?.saved_date?.split('T')[0] ?? todayStr);
      setMemo(existing?.memo ?? '');
      setShowDatePicker(false);
    }
  }, [visible, existing, assets]);

  // 로컬 날짜 문자열 (UTC 변환으로 인한 하루 밀림 방지)
  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const totalAssetAmount = assets.reduce((sum, a) => sum + a.amount, 0);
  // 수정 중이면 기존 항목 금액은 가용 한도에서 제외하지 않음
  const editingAmount = existing?.amount ?? 0;
  const availableAmount = totalAssetAmount > 0
    ? Math.max(0, totalAssetAmount - totalCommitted + editingAmount)
    : 0;

  const handleSave = async () => {
    const amount = parseCommaInput(amountText);
    if (!amount || amount <= 0) { Alert.alert('알림', '금액을 올바르게 입력해주세요.'); return; }
    if (availableAmount > 0 && amount > availableAmount) {
      Alert.alert('알림', `입력 금액이 가용 한도(${formatAmount(availableAmount)})를 초과해요.\n(총 자산 - 다른 목표 항목 합산)`);
      return;
    }
    if (!savedDate) { Alert.alert('알림', '날짜를 선택해주세요.'); return; }

    const selectedAsset = assets.find(a => a.id === selectedAssetId);
    const itemName = selectedAsset?.name ?? '기타';

    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase.from('goal_items').update({
          name: itemName, amount, saved_date: savedDate, memo: memo.trim() || null,
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('goal_items').insert({
          goal_id: goalId, name: itemName, amount,
          saved_date: savedDate, memo: memo.trim() || null,
        });
        if (error) throw error;
      }
      onSaved();
      onClose();
    } catch (e) {
      Alert.alert('오류', '저장에 실패했습니다.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const parsedAmount = parseCommaInput(amountText);
  const calWidth = Dimensions.get('window').width - 48;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>{existing ? '항목 수정' : '항목 추가'}</Text>
            <TouchableOpacity onPress={() => { setShowDatePicker(false); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X color="#C49A6C" size={22} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* 인라인 날짜 피커 */}
          {showDatePicker ? (
            <View>
              <Text style={modalStyles.label}>날짜 선택</Text>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                onChange={(_, d) => { if (d) setTempDate(d); }}
                locale="ko-KR"
                accentColor="#8B5E3C"
                style={{ width: calWidth, alignSelf: 'center' }}
              />
              <View style={dpStyles.actions}>
                <TouchableOpacity style={dpStyles.cancelBtn} onPress={() => setShowDatePicker(false)}>
                  <Text style={dpStyles.cancelText}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dpStyles.confirmBtn} onPress={() => { setSavedDate(toDateStr(tempDate)); setShowDatePicker(false); }}>
                  <Text style={dpStyles.confirmText}>확인</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} automaticallyAdjustKeyboardInsets>
              {/* 자산 선택 */}
              <Text style={modalStyles.label}>자산 선택</Text>
              {assets.length === 0 ? (
                <Text style={goalStyles.emptyAssetNote}>먼저 자산을 추가해주세요</Text>
              ) : (
                <View style={goalStyles.assetPickerRow}>
                  {assets.map(a => (
                    <TouchableOpacity
                      key={a.id}
                      style={[goalStyles.assetChip, selectedAssetId === a.id && goalStyles.assetChipActive]}
                      onPress={() => setSelectedAssetId(a.id)}
                    >
                      <Text style={[goalStyles.assetChipText, selectedAssetId === a.id && goalStyles.assetChipTextActive]}>
                        {a.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 금액 */}
              <View style={modalStyles.labelRow}>
                <Text style={modalStyles.labelInRow}>금액 (원)</Text>
                {parsedAmount > 0 && availableAmount > 0 && parsedAmount <= availableAmount && (
                  <Text style={modalStyles.amountInline}>{formatAmount(parsedAmount)}</Text>
                )}
                {parsedAmount > 0 && availableAmount > 0 && parsedAmount > availableAmount && (
                  <Text style={[modalStyles.amountInline, { color: '#D95F4B' }]}>
                    최대 {formatAmount(availableAmount)}
                  </Text>
                )}
                {parsedAmount === 0 && availableAmount > 0 && (
                  <Text style={[modalStyles.amountInline, { color: '#C49A6C' }]}>
                    최대 {formatAmount(availableAmount)}
                  </Text>
                )}
              </View>
              <TextInput
                style={[
                  modalStyles.input,
                  availableAmount > 0 && parsedAmount > availableAmount && { borderColor: '#D95F4B' },
                ]}
                placeholder="예: 5,000,000"
                placeholderTextColor="#C49A6C"
                value={amountText}
                onChangeText={text => setAmountText(toCommaInput(text))}
                keyboardType="numeric"
              />

              {/* 날짜 */}
              <Text style={modalStyles.label}>모은 날짜</Text>
              <TouchableOpacity
                style={goalStyles.datePicker}
                onPress={() => { setTempDate(savedDate ? toLocalDate(savedDate) : new Date()); setShowDatePicker(true); }}
              >
                <Text style={savedDate ? goalStyles.datePickerText : goalStyles.datePickerPlaceholder}>
                  {savedDate ? formatDateStr(savedDate) : '날짜 선택'}
                </Text>
              </TouchableOpacity>

              {/* 메모 */}
              <Text style={modalStyles.label}>메모 (선택)</Text>
              <TextInput
                style={modalStyles.input}
                placeholder="예: 비상금 계좌에서 절반"
                placeholderTextColor="#C49A6C"
                value={memo}
                onChangeText={setMemo}
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[modalStyles.saveBtn, saving && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={modalStyles.saveBtnText}>{saving ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// ── 목표 카드 (단일 목표) ─────────────────────

interface GoalCardProps {
  goal: GoalData;
  goalItems: GoalItemData[];
  assets: Asset[];
  otherGoalsTotal: number; // 다른 목표들의 항목 금액 합산
  onGoalChange: () => void;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal, goalItems, assets, otherGoalsTotal, onGoalChange }) => {
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem]     = useState<GoalItemData | null>(null);

  const accumulated  = goalItems.reduce((s, i) => s + i.amount, 0);

  // ── 목표 달성 축하 팝업 ─────────────────────
  const hasMountedRef      = useRef(false);
  const prevAccumulatedRef = useRef(accumulated);
  useEffect(() => {
    if (
      hasMountedRef.current &&
      prevAccumulatedRef.current < goal.target_amount &&
      accumulated >= goal.target_amount
    ) {
      Alert.alert('🎉 목표 달성!', `"${goal.title}" 목표를 달성했어요!\n함께 축하해요 🎊`);
    }
    hasMountedRef.current      = true;
    prevAccumulatedRef.current = accumulated;
  }, [accumulated]);

  // ── 기간 만료 연장 안내 (화면 진입 시 1회) ───
  useEffect(() => {
    if (!goal.end_date || accumulated >= goal.target_amount) return;
    const [y, m, d] = goal.end_date.split('-').map(Number);
    const endDate = new Date(y, m - 1, d);
    endDate.setHours(23, 59, 59, 999);
    if (endDate < new Date()) {
      Alert.alert(
        '목표 기간이 지났어요',
        `"${goal.title}" 목표 기간이 종료되었어요.\n기간을 연장하시겠어요?`,
        [
          { text: '아니요', style: 'cancel' },
          { text: '연장하기', onPress: () => setShowGoalModal(true) },
        ],
      );
    }
  }, []);
  const progressRatio = Math.min(accumulated / (goal.target_amount || 1), 1);
  const progressPct  = Math.round(progressRatio * 100);

  const handleDeleteGoal = () => {
    Alert.alert('목표 삭제', '목표와 모든 항목이 삭제됩니다. 계속할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await supabase.from('goal_items').delete().eq('goal_id', goal.id);
          await supabase.from('goals').delete().eq('id', goal.id);
          onGoalChange();
        },
      },
    ]);
  };

  const handleDeleteItem = (item: GoalItemData) => {
    Alert.alert('항목 삭제', `${item.name} 항목을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await supabase.from('goal_items').delete().eq('id', item.id);
          onGoalChange();
        },
      },
    ]);
  };

  return (
    <View style={goalStyles.goalCard}>
      {/* 목표 헤더 */}
      <View style={goalStyles.goalCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={goalStyles.goalTitle}>{goal.title}</Text>
          {goal.memo ? <Text style={goalStyles.goalMemo}>{goal.memo}</Text> : null}
          {(goal.start_date || goal.end_date) && (
            <Text style={goalStyles.goalDeadline}>
              {formatDateStr(goal.start_date)} ~ {formatDateStr(goal.end_date)}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowGoalModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Pencil color="#C49A6C" size={16} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* 금액 & 진행률 */}
      <View style={goalStyles.progressRow}>
        <Text style={goalStyles.accumulated}>{formatAmount(accumulated)}</Text>
        <Text style={goalStyles.targetLabel}>/ {formatAmount(goal.target_amount)}</Text>
        <Text style={goalStyles.progressPct}>{progressPct}%</Text>
      </View>
      <View style={goalStyles.progressBarBg}>
        <View style={[goalStyles.progressBarFill, { width: `${progressPct}%` }]} />
      </View>

      {/* 항목 목록 */}
      {goalItems.map(item => (
        <View key={item.id} style={goalStyles.itemRow}>
          <View style={{ flex: 1 }}>
            <Text style={goalStyles.itemName}>{item.name}</Text>
            <Text style={goalStyles.itemMemo}>
              {item.saved_date ? formatDateStr(item.saved_date) : ''}
              {item.saved_date && item.memo ? '  ·  ' : ''}
              {item.memo ?? ''}
            </Text>
          </View>
          <Text style={goalStyles.itemAmount}>{formatAmount(item.amount)}</Text>
          <TouchableOpacity
            onPress={() => { setEditingItem(item); setShowItemModal(true); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Pencil color="#D4B896" size={14} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteItem(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 color="#D95F4B" size={14} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      ))}

      {/* 항목 추가 + 목표 삭제 */}
      <View style={goalStyles.goalFooter}>
        <TouchableOpacity
          style={goalStyles.addItemBtn}
          onPress={() => { setEditingItem(null); setShowItemModal(true); }}
        >
          <Plus color="#8B5E3C" size={14} strokeWidth={2.5} />
          <Text style={goalStyles.addItemBtnText}>항목 추가</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteGoal}>
          <Text style={goalStyles.deleteGoalText}>목표 삭제</Text>
        </TouchableOpacity>
      </View>

      <GoalModal
        visible={showGoalModal}
        familyId={goal.family_id}
        existing={goal}
        onClose={() => setShowGoalModal(false)}
        onSaved={() => { setShowGoalModal(false); onGoalChange(); }}
      />
      <GoalItemModal
        visible={showItemModal}
        goalId={goal.id}
        assets={assets}
        existing={editingItem}
        totalCommitted={accumulated + otherGoalsTotal - (editingItem?.amount ?? 0)}
        onClose={() => { setShowItemModal(false); setEditingItem(null); }}
        onSaved={() => { setShowItemModal(false); setEditingItem(null); onGoalChange(); }}
      />
    </View>
  );
};

// ── 목표 섹션 (최대 2개) ──────────────────────

interface GoalSectionProps {
  goals: GoalData[];
  goalItemsMap: Record<string, GoalItemData[]>;
  assets: Asset[];
  familyId: string;
  onGoalChange: () => void;
}

const GoalSection: React.FC<GoalSectionProps> = ({ goals, goalItemsMap, assets, familyId, onGoalChange }) => {
  const [showGoalModal, setShowGoalModal] = useState(false);

  // 전체 목표 항목 합산 (다른 목표 계산용)
  const totalAllGoals = Object.values(goalItemsMap)
    .flat()
    .reduce((s, i) => s + i.amount, 0);

  return (
    <View style={goalStyles.section}>
      {/* 섹션 헤더 */}
      <View style={goalStyles.sectionHeader}>
        <View style={goalStyles.sectionTitleRow}>
          <Target color="#8B5E3C" size={16} strokeWidth={1.8} />
          <Text style={goalStyles.sectionTitle}>목표 ({goals.length}/2)</Text>
        </View>
        {goals.length < 2 && (
          <TouchableOpacity onPress={() => setShowGoalModal(true)} style={goalStyles.addGoalBtn}>
            <Plus color="#8B5E3C" size={14} strokeWidth={2.5} />
            <Text style={goalStyles.addGoalBtnText}>목표 추가</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 빈 상태 */}
      {goals.length === 0 && (
        <View style={goalStyles.emptyCard}>
          <Text style={goalStyles.emptyText}>목표를 설정해보세요</Text>
          <Text style={goalStyles.emptySubText}>최대 2개의 목표를 만들고{'\n'}자산별 기여 금액을 기록해요</Text>
        </View>
      )}

      {/* 목표 카드들 */}
      {goals.map(g => {
        const thisGoalTotal = (goalItemsMap[g.id] ?? []).reduce((s, i) => s + i.amount, 0);
        return (
        <View key={g.id} style={{ marginBottom: 12 }}>
          <GoalCard
            goal={g}
            goalItems={goalItemsMap[g.id] ?? []}
            assets={assets}
            otherGoalsTotal={totalAllGoals - thisGoalTotal}
            onGoalChange={onGoalChange}
          />
        </View>
        );
      })}

      {/* 목표 추가 모달 */}
      <GoalModal
        visible={showGoalModal}
        familyId={familyId}
        existing={null}
        onClose={() => setShowGoalModal(false)}
        onSaved={() => { setShowGoalModal(false); onGoalChange(); }}
      />
    </View>
  );
};

const goalStyles = StyleSheet.create({
  section: { marginTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#5C3D1E' },
  addGoalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#DEC8A8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addGoalBtnText: { fontSize: 12, fontWeight: '600', color: '#8B5E3C' },
  goalCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  goalCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  goalTitle: { fontSize: 16, fontWeight: '800', color: '#5C3D1E', marginBottom: 2 },
  goalMemo: { fontSize: 12, color: '#A87850', fontWeight: '500', marginBottom: 2 },
  goalDeadline: { fontSize: 12, color: '#C49A6C', fontWeight: '500' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  accumulated: { fontSize: 18, fontWeight: '800', color: '#5C3D1E' },
  targetLabel: { fontSize: 13, color: '#C49A6C', fontWeight: '500', flex: 1 },
  progressPct: { fontSize: 13, fontWeight: '700', color: '#8B5E3C' },
  progressBarBg: {
    height: 8,
    backgroundColor: '#EDD9C0',
    borderRadius: 4,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#8B5E3C',
    borderRadius: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDD9C0',
  },
  itemName: { fontSize: 14, fontWeight: '600', color: '#5C3D1E' },
  itemMemo: { fontSize: 11, color: '#C49A6C', marginTop: 1 },
  itemAmount: { fontSize: 14, fontWeight: '700', color: '#5C3D1E' },
  goalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EDD9C0',
  },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#DEC8A8',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addItemBtnText: { fontSize: 13, fontWeight: '600', color: '#8B5E3C' },
  deleteGoalText: { fontSize: 12, color: '#D95F4B', fontWeight: '500' },
  emptyCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: '#8B5E3C', marginBottom: 6 },
  emptySubText: { fontSize: 12, color: '#C49A6C', textAlign: 'center', lineHeight: 18 },
  assetPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  assetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: '#DEC8A8',
  },
  assetChipActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  assetChipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '500' },
  assetChipTextActive: { color: '#FFFFFF' },
  emptyAssetNote: { fontSize: 13, color: '#C49A6C', marginTop: 4, marginBottom: 8 },
  // 날짜 범위 선택 (GoalModal 내)
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  datePicker: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#DEC8A8',
    alignItems: 'center',
  },
  datePickerText: { fontSize: 14, fontWeight: '600', color: '#5C3D1E' },
  datePickerPlaceholder: { fontSize: 14, color: '#C49A6C' },
  dateSeparator: { fontSize: 16, color: '#A87850', fontWeight: '600' },
});

// ── 메인 화면 ─────────────────────────────────

const FinanceScreen: React.FC = () => {
  const navigation = useNavigation<FinanceNavProp>();
  const isFocused = useIsFocused();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);

  // 목표 상태 (최대 2개)
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [goalItemsMap, setGoalItemsMap] = useState<Record<string, GoalItemData[]>>({});

  // 데이터 로드
  const loadAssets = useCallback(async () => {
    try {
      const fid = await getOrCreateFamilyId();
      if (!fid) return;
      setFamilyId(fid);

      // 현재 로그인 유저 ID
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      // 가족 구성원 닉네임 로드 (담당자 표시용)
      // 나 자신이 먼저 오도록 정렬: 현재 유저를 첫 번째로
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, nickname')
        .eq('family_id', fid);

      if (profiles) {
        const sorted = [...profiles].sort((a, b) =>
          a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0
        );
        setFamilyMembers(sorted as FamilyMemberBasic[]);
      }

      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('family_id', fid)
        .eq('is_active', true)
        .order('updated_at', { ascending: true });

      if (!error && data) setAssets(data as Asset[]);

      // 목표 로드 (최대 2개, created_at 오름차순)
      const { data: goalsData } = await supabase
        .from('goals')
        .select('*')
        .eq('family_id', fid)
        .order('created_at', { ascending: true })
        .limit(2);

      if (goalsData && goalsData.length > 0) {
        setGoals(goalsData as GoalData[]);
        const map: Record<string, GoalItemData[]> = {};
        for (const g of goalsData) {
          const { data: items } = await supabase
            .from('goal_items')
            .select('*')
            .eq('goal_id', g.id)
            .order('id', { ascending: false });
          map[g.id] = (items ?? []) as GoalItemData[];
        }
        setGoalItemsMap(map);
      } else {
        setGoals([]);
        setGoalItemsMap({});
      }
    } catch (e) {
      console.error('FinanceScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);
  useEffect(() => { if (isFocused) loadAssets(); }, [isFocused, loadAssets]);

  // 삭제 (keepHistory=true → 소프트 삭제, keepHistory=false → 히스토리 포함 완전 삭제)
  const handleDelete = useCallback(async (asset: Asset, keepHistory: boolean) => {
    try {
      if (keepHistory) {
        // 소프트 삭제: is_active = false
        const { error } = await supabase
          .from('assets')
          .update({ is_active: false })
          .eq('id', asset.id);
        if (error) throw error;
      } else {
        // 완전 삭제: 히스토리 먼저 삭제 후 자산 삭제
        await supabase.from('asset_histories').delete().eq('asset_id', asset.id);
        const { error } = await supabase.from('assets').delete().eq('id', asset.id);
        if (error) throw error;
      }
      setAssets(prev => prev.filter(a => a.id !== asset.id));
    } catch (e) {
      Alert.alert('오류', '삭제에 실패했습니다.');
      console.error(e);
    }
  }, []);

  // 카테고리별 그룹화
  const grouped = useMemo(
    () => CATEGORIES.reduce<Record<AssetCategory, Asset[]>>((acc, cat) => {
      acc[cat] = assets.filter(a => a.category === cat);
      return acc;
    }, {} as Record<AssetCategory, Asset[]>),
    [assets],
  );

  const totalAmount = useMemo(() => assets.reduce((sum, a) => sum + a.amount, 0), [assets]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#8B5E3C" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>자산</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 총 자산 카드 */}
        <TotalCard
          total={totalAmount}
          assetCount={assets.length}
          onHistoryPress={() => navigation.navigate('AssetHistory')}
        />

        {/* 자산이 없을 때 안내 */}
        {assets.length === 0 && (
          <Text style={styles.emptyText}>
            + 버튼을 눌러 자산을 추가해 보세요 💰
          </Text>
        )}

        {/* 카테고리별 자산 목록 */}
        {CATEGORIES.map(cat => (
          <CategorySection
            key={cat}
            category={cat}
            assets={grouped[cat]}
            currentUserId={currentUserId}
            familyMembers={familyMembers}
            onPressAsset={asset => setEditingAsset(asset)}
          />
        ))}

        {/* 목표 섹션 */}
        {familyId && (
          <GoalSection
            goals={goals}
            goalItemsMap={goalItemsMap}
            assets={assets}
            familyId={familyId}
            onGoalChange={loadAssets}
          />
        )}
      </ScrollView>

      {/* 자산 추가 FAB */}
      <TouchableOpacity
        style={styles.addFab}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.85}
      >
        <Plus color="#FFFFFF" size={26} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* 추가 모달 */}
      {familyId && (
        <AddAssetModal
          visible={showAddModal}
          familyId={familyId}
          currentUserId={currentUserId}
          familyMembers={familyMembers}
          onClose={() => setShowAddModal(false)}
          onSaved={loadAssets}
        />
      )}

      {/* 수정 모달 */}
      <EditAssetModal
        visible={!!editingAsset}
        asset={editingAsset}
        currentUserId={currentUserId}
        familyMembers={familyMembers}
        onClose={() => setEditingAsset(null)}
        onSaved={loadAssets}
        onDelete={handleDelete}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6EC' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#5C3D1E' },
  content: { paddingHorizontal: 20, paddingBottom: 100, paddingTop: 4 },
  emptyText: {
    textAlign: 'center',
    color: '#C49A6C',
    fontSize: 15,
    marginTop: 20,
    marginBottom: 16,
  },
  addFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#8B5E3C',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6B4226',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default FinanceScreen;
