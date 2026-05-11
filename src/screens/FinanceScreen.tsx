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
  TouchableWithoutFeedback,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Swipeable } from 'react-native-gesture-handler';

// ── SVG 아이콘 헬퍼 ──────────────────────────
type IconProps = { color: string; size: number; strokeWidth?: number };
const SvgX = ({ color, size, strokeWidth = 2 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);
const SvgPlus = ({ color, size, strokeWidth = 2 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);
const SvgChevronRight = ({ color, size, strokeWidth = 2 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M9 18l6-6-6-6" />
  </Svg>
);
const SvgHistory = ({ color, size, strokeWidth = 1.5 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <Path d="M3 3v5h5" />
    <Path d="M12 7v5l4 2" />
  </Svg>
);
const SvgPencil = ({ color, size, strokeWidth = 1.8 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);
const SvgTrash2 = ({ color, size, strokeWidth = 1.8 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);
const SvgChevronLeft = ({ color = '#8B5E3C', size = 22 }: Partial<IconProps>) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);
const SvgTarget = ({ color, size, strokeWidth = 1.8 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Circle cx="12" cy="12" r="6" />
    <Circle cx="12" cy="12" r="2" />
  </Svg>
);

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
  onPress: () => void;
}

const TotalCard: React.FC<TotalCardProps> = ({ total, assetCount, onPress }) => (
  <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.88}>
    <Text style={cardStyles.label}>우리 집 총 자산</Text>
    <Text style={cardStyles.amount}>{formatAmount(total)}</Text>
    <Text style={cardStyles.sub}>{assetCount}개 항목  ·  내역 보기 →</Text>
    <Svg width="100%" height={32} viewBox="0 0 300 32" preserveAspectRatio="none" style={{ marginTop: 10 }}>
      <Path
        d="M0,24 L30,22 L60,26 L90,20 L120,21 L150,16 L180,18 L210,10 L240,12 L270,7 L300,5"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  </TouchableOpacity>
);

const cardStyles = StyleSheet.create({
  card: {
    marginBottom: 24,
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
});

// ── 자산 행 ──────────────────────────────────

interface AssetRowProps {
  asset: Asset;
  ownerNickname: string | null;
  isMe: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const AssetRow: React.FC<AssetRowProps> = ({ asset, ownerNickname, isMe, onPress, onEdit, onDelete }) => {
  const { color, emoji } = CAT_CONFIG[asset.category];
  const swipeRef = React.useRef<Swipeable>(null);

  const renderRightActions = () => (
    <View style={rowStyles.swipeActions}>
      <TouchableOpacity
        style={rowStyles.swipeDelete}
        onPress={() => { swipeRef.current?.close(); onDelete(); }}
      >
        <Text style={rowStyles.swipeDeleteText}>삭제</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.75}>
        {/* 카테고리 이모지 아이콘 */}
        <View style={[rowStyles.iconBox, { backgroundColor: color + '22' }]}>
          <Text style={rowStyles.iconEmoji}>{emoji}</Text>
        </View>
        {/* 이름 + 카테고리 */}
        <View style={rowStyles.left}>
          <View style={rowStyles.nameRow}>
            <Text style={rowStyles.name} numberOfLines={1}>{asset.name}</Text>
            {ownerNickname && (
              <View style={[rowStyles.badge, isMe ? rowStyles.badgeMe : rowStyles.badgePartner]}>
                <Text style={[rowStyles.badgeText, isMe ? rowStyles.badgeTextMe : rowStyles.badgeTextPartner]}>
                  {ownerNickname}
                </Text>
              </View>
            )}
          </View>
          <Text style={[rowStyles.catLabel, { color }]}>{asset.category}</Text>
        </View>
        {/* 금액 + 수정 버튼 */}
        <View style={rowStyles.right}>
          <Text style={rowStyles.amount}>{formatAmount(asset.amount)}</Text>
          <TouchableOpacity
            style={rowStyles.editBtn}
            onPress={onEdit}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={rowStyles.editBtnText}>자산 업데이트</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DEC8A855',
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  iconEmoji: { fontSize: 16 },
  left: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '700', color: '#5C3D1E', flexShrink: 1 },
  catLabel: { fontSize: 10, fontWeight: '600' },
  badge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, flexShrink: 0 },
  badgeMe: { backgroundColor: '#EDD9C0' },
  badgePartner: { backgroundColor: '#EEE4F4' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  badgeTextMe: { color: '#8B5E3C' },
  badgeTextPartner: { color: '#9478C9' },
  right: { alignItems: 'flex-end', gap: 5, flexShrink: 0 },
  amount: { fontSize: 14, fontWeight: '700', color: '#5C3D1E' },
  editBtn: {
    backgroundColor: '#EDD9C0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editBtnText: { fontSize: 11, fontWeight: '700', color: '#8B5E3C' },
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: 6,
    marginBottom: 8,
  },
  swipeDelete: {
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeDeleteText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
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
  onEditAsset: (asset: Asset) => void;
  onDeleteAsset: (asset: Asset) => void;
}

const CategorySection: React.FC<CategorySectionProps> = ({
  category, assets, currentUserId, familyMembers, onPressAsset, onEditAsset, onDeleteAsset,
}) => {
  if (assets.length === 0) return null;

  const { color, emoji } = CAT_CONFIG[category];
  const subtotal = assets.reduce((sum, a) => sum + a.amount, 0);

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
          onEdit={() => onEditAsset(asset)}
          onDelete={() => onDeleteAsset(asset)}
        />
      ))}
    </View>
  );
};

const sectionStyles = StyleSheet.create({
  section: { marginBottom: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  catName: { fontSize: 11, fontWeight: '700', color: '#A87850', letterSpacing: 0.2 },
  subtotal: { fontSize: 11, fontWeight: '700' },
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
      <KeyboardAvoidingView
        style={modalStyles.kavContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlayTap} />
        </TouchableWithoutFeedback>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>자산 추가</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <SvgX color="#C49A6C" size={22} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
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
      </KeyboardAvoidingView>
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
      <KeyboardAvoidingView
        style={modalStyles.kavContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlayTap} />
        </TouchableWithoutFeedback>
        <View style={modalStyles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>

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
                <SvgX color="#C49A6C" size={22} strokeWidth={2} />
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
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── 모달 공통 스타일 ──────────────────────────

const modalStyles = StyleSheet.create({
  // KAV가 전체 화면을 감싸고 키보드와 함께 시트가 올라가는 구조
  kavContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  // 다크 오버레이 탭 시 키보드 닫기
  overlayTap: {
    flex: 1,
  },
  // 하위 호환용 (DatePickerModal에서 사용)
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
// 목표 생성/수정: Step 1(이름) → Step 2(금액) → Step 3(기간+메모) → Step 4(완료)

interface GoalModalProps {
  visible: boolean;
  familyId: string;
  existing: GoalData | null;
  onClose: () => void;
  onSaved: () => void;
}

const GOAL_QUICK_CHIPS = [
  { label: '10만', value: 100_000 },
  { label: '50만', value: 500_000 },
  { label: '100만', value: 1_000_000 },
  { label: '500만', value: 5_000_000 },
  { label: '1천만', value: 10_000_000 },
  { label: '1억', value: 100_000_000 },
];

const GoalModal: React.FC<GoalModalProps> = ({ visible, familyId, existing, onClose, onSaved }) => {
  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [isDone, setIsDone]         = useState(false);
  const [title, setTitle]           = useState('');
  const [amountText, setAmountText] = useState('');
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [memo, setMemo]             = useState('');
  const [saving, setSaving]         = useState(false);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate]         = useState<Date>(new Date());

  const doneScale = useRef(new Animated.Value(0)).current;
  const doneFade  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setStep(1);
      setIsDone(false);
      setTitle(existing?.title ?? '');
      setAmountText(existing ? existing.target_amount.toLocaleString('ko-KR') : '');
      setStartDate(existing?.start_date?.split('T')?.[0] ?? '');
      setEndDate(existing?.end_date?.split('T')?.[0] ?? '');
      setMemo(existing?.memo ?? '');
      setActivePicker(null);
      doneScale.setValue(0);
      doneFade.setValue(0);
    }
  }, [visible, existing]);

  useEffect(() => {
    if (isDone) {
      Animated.sequence([
        Animated.spring(doneScale, { toValue: 1, tension: 55, friction: 5, useNativeDriver: true }),
        Animated.timing(doneFade, { toValue: 1, duration: 320, useNativeDriver: true }),
      ]).start();
    }
  }, [isDone]);

  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const parsedAmount = parseCommaInput(amountText);
  const endMinDate = startDate ? (() => {
    const [y, m, d] = startDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  })() : undefined;
  const calWidth = Dimensions.get('window').width - 48;

  const goStep2 = () => {
    if (!title.trim()) { Alert.alert('알림', '목표 이름을 입력해주세요.'); return; }
    Keyboard.dismiss();
    setStep(2);
  };

  const goStep3 = () => {
    if (!parsedAmount || parsedAmount <= 0) { Alert.alert('알림', '목표 금액을 입력해주세요.'); return; }
    Keyboard.dismiss();
    setStep(3);
  };

  const handleSave = async () => {
    if (!startDate) { Alert.alert('알림', '시작일을 선택해주세요.'); return; }
    if (!endDate)   { Alert.alert('알림', '종료일을 선택해주세요.'); return; }
    if (endDate < startDate) { Alert.alert('알림', '종료일은 시작일 이후여야 해요.'); return; }

    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase.from('goals').update({
          title: title.trim(), target_amount: parsedAmount,
          start_date: startDate, end_date: endDate,
          memo: memo.trim() || null,
        }).eq('id', existing.id);
        if (error) throw error;
        onSaved();
        onClose();
      } else {
        const { error } = await supabase.from('goals').insert({
          family_id: familyId, title: title.trim(), target_amount: parsedAmount,
          start_date: startDate, end_date: endDate,
          memo: memo.trim() || null,
        });
        if (error) throw error;
        setIsDone(true);
      }
    } catch (e: any) {
      const msg = e?.message ?? e?.details ?? JSON.stringify(e);
      Alert.alert('오류', `저장에 실패했습니다.\n\n${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (activePicker) { setActivePicker(null); return; }
    if (step > 1) { setStep(s => (s - 1) as 1 | 2 | 3); return; }
    onClose();
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide">
      <SafeAreaView style={gmStyles.safe}>
        {/* ── 완료 화면 ── */}
        {isDone ? (
          <View style={gmStyles.doneWrap}>
            <Animated.View style={[gmStyles.doneCircle, { transform: [{ scale: doneScale }] }]}>
              <Text style={{ fontSize: 44 }}>🎯</Text>
            </Animated.View>
            <Animated.View style={{ opacity: doneFade, alignItems: 'center', width: '100%' }}>
              <Text style={gmStyles.doneTitle}>목표 설정 완료!</Text>
              <Text style={gmStyles.doneSub}>"{title}" 목표가 등록됐어요</Text>
              <View style={gmStyles.doneCard}>
                <View style={gmStyles.doneRow}>
                  <Text style={gmStyles.doneLabel}>목표 금액</Text>
                  <Text style={gmStyles.doneVal}>{formatAmount(parsedAmount)}</Text>
                </View>
                <View style={gmStyles.doneDivider} />
                <View style={gmStyles.doneRow}>
                  <Text style={gmStyles.doneLabel}>기간</Text>
                  <Text style={gmStyles.doneVal}>{formatDateStr(startDate)} ~ {formatDateStr(endDate)}</Text>
                </View>
                {memo ? (
                  <>
                    <View style={gmStyles.doneDivider} />
                    <View style={gmStyles.doneRow}>
                      <Text style={gmStyles.doneLabel}>목적</Text>
                      <Text style={gmStyles.doneVal}>{memo}</Text>
                    </View>
                  </>
                ) : null}
              </View>
              <TouchableOpacity style={gmStyles.doneBtn} onPress={onSaved}>
                <Text style={gmStyles.doneBtnText}>확인</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : (
          <>
            {/* ── 헤더 ── */}
            <View style={gmStyles.header}>
              <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                {step > 1 && !activePicker
                  ? <SvgChevronLeft />
                  : <SvgX color="#C49A6C" size={22} strokeWidth={2} />}
              </TouchableOpacity>
              <Text style={gmStyles.headerTitle}>
                {existing
                  ? '목표 수정'
                  : step === 1 ? '목표 이름' : step === 2 ? '목표 금액' : '기간 설정'}
              </Text>
              <View style={{ width: 32 }} />
            </View>

            {/* ── 진행바 ── */}
            <View style={gmStyles.progressBar}>
              {[1, 2, 3].map(s => (
                <View key={s} style={[gmStyles.progressSeg, s <= step && gmStyles.progressSegActive]} />
              ))}
            </View>

            {/* ── 날짜 피커 오버레이 ── */}
            {activePicker !== null ? (
              <ScrollView contentContainerStyle={gmStyles.content}>
                <Text style={gmStyles.label}>
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
                  <TouchableOpacity style={dpStyles.confirmBtn} onPress={() => {
                    const d = toDateStr(tempDate);
                    if (activePicker === 'start') {
                      setStartDate(d);
                      if (endDate && d > endDate) setEndDate('');
                    } else {
                      setEndDate(d);
                    }
                    setActivePicker(null);
                  }}>
                    <Text style={dpStyles.confirmText}>확인</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

            ) : step === 1 ? (
              /* ── Step 1: 목표 이름 ── */
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView contentContainerStyle={gmStyles.content} keyboardShouldPersistTaps="handled">
                  <Text style={gmStyles.label}>어떤 목표인가요?</Text>
                  <TextInput
                    style={gmStyles.input}
                    placeholder="예: 내 집 마련, 유럽 여행"
                    placeholderTextColor="#C49A6C"
                    value={title}
                    onChangeText={setTitle}
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={goStep2}
                  />
                </ScrollView>
              </TouchableWithoutFeedback>

            ) : step === 2 ? (
              /* ── Step 2: 목표 금액 ── */
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView contentContainerStyle={gmStyles.content} keyboardShouldPersistTaps="handled">
                  <View style={gmStyles.amountDisplay}>
                    <Text style={[gmStyles.amountText, parsedAmount > 0 && gmStyles.amountActive]}>
                      {parsedAmount > 0 ? formatAmount(parsedAmount) : '목표 금액은?'}
                    </Text>
                  </View>
                  <TextInput
                    style={gmStyles.input}
                    placeholder="직접 입력 (예: 100,000,000)"
                    placeholderTextColor="#C49A6C"
                    value={amountText}
                    onChangeText={text => setAmountText(toCommaInput(text))}
                    keyboardType="numeric"
                    selectTextOnFocus
                    autoFocus
                  />
                  <View style={gmStyles.chipGrid}>
                    {GOAL_QUICK_CHIPS.map(chip => (
                      <TouchableOpacity
                        key={chip.label}
                        style={gmStyles.chip}
                        onPress={() => {
                          const cur = parseCommaInput(amountText);
                          setAmountText((cur + chip.value).toLocaleString('ko-KR'));
                        }}
                      >
                        <Text style={gmStyles.chipText}>+{chip.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </TouchableWithoutFeedback>

            ) : (
              /* ── Step 3: 기간 + 목적 ── */
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView contentContainerStyle={gmStyles.content} keyboardShouldPersistTaps="handled">
                  {/* 요약 카드 */}
                  <View style={gmStyles.summaryCard}>
                    <Text style={gmStyles.summaryTitle}>{title}</Text>
                    <Text style={gmStyles.summaryAmount}>{formatAmount(parsedAmount)}</Text>
                  </View>

                  <Text style={gmStyles.label}>목표 기간</Text>
                  <View style={goalStyles.dateRow}>
                    <TouchableOpacity
                      style={goalStyles.datePicker}
                      onPress={() => {
                        setTempDate(startDate ? (() => { const [y,m,d] = startDate.split('-').map(Number); return new Date(y,m-1,d); })() : new Date());
                        setActivePicker('start');
                      }}
                    >
                      <Text style={startDate ? goalStyles.datePickerText : goalStyles.datePickerPlaceholder}>
                        {startDate ? formatDateStr(startDate) : '시작일'}
                      </Text>
                    </TouchableOpacity>
                    <Text style={goalStyles.dateSeparator}>~</Text>
                    <TouchableOpacity
                      style={goalStyles.datePicker}
                      onPress={() => {
                        const base = endDate || startDate;
                        setTempDate(base ? (() => { const [y,m,d] = base.split('-').map(Number); return new Date(y,m-1,d); })() : new Date());
                        setActivePicker('end');
                      }}
                    >
                      <Text style={endDate ? goalStyles.datePickerText : goalStyles.datePickerPlaceholder}>
                        {endDate ? formatDateStr(endDate) : '종료일'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[gmStyles.label, { marginTop: 20 }]}>목적 (선택)</Text>
                  <TextInput
                    style={gmStyles.input}
                    placeholder="예: 신혼집 보증금, 비상금"
                    placeholderTextColor="#C49A6C"
                    value={memo}
                    onChangeText={setMemo}
                    autoCorrect={false}
                  />
                </ScrollView>
              </TouchableWithoutFeedback>
            )}

            {/* ── 하단 CTA ── */}
            {activePicker === null && (
              <View style={gmStyles.footer}>
                <TouchableOpacity
                  style={[gmStyles.cta, saving && { opacity: 0.5 }]}
                  onPress={step === 1 ? goStep2 : step === 2 ? goStep3 : handleSave}
                  disabled={saving}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={gmStyles.ctaText}>
                        {step < 3 ? '다음' : (existing ? '수정하기' : '저장하기')}
                      </Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ── GoalModal 스타일 ───────────────────────────
const gmStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#5C3D1E' },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#EDD9C0' },
  progressSegActive: { backgroundColor: '#8B5E3C' },
  content: { paddingHorizontal: 20, paddingBottom: 120, paddingTop: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#8B5E3C', marginBottom: 12 },
  input: {
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: '#5C3D1E',
    borderWidth: 1,
    borderColor: '#DEC8A8',
    fontWeight: '600',
  },
  amountDisplay: { alignItems: 'center', marginBottom: 24, marginTop: 16 },
  amountText: { fontSize: 34, fontWeight: '800', color: '#C5B09A', letterSpacing: -1 },
  amountActive: { color: '#5C3D1E' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    backgroundColor: '#FFF8F0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#DEC8A8',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#8B5E3C' },
  summaryCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DEC8A8',
    marginBottom: 24,
    alignItems: 'center',
    gap: 6,
  },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: '#5C3D1E' },
  summaryAmount: { fontSize: 26, fontWeight: '800', color: '#8B5E3C', letterSpacing: -0.5 },
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
    backgroundColor: '#8B5E3C',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  // 완료 화면
  doneWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 80 },
  doneCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#EDD9C0',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  doneTitle: { fontSize: 26, fontWeight: '800', color: '#5C3D1E', marginBottom: 6 },
  doneSub: { fontSize: 14, color: '#A87850', fontWeight: '500', marginBottom: 36 },
  doneCard: {
    width: '100%',
    backgroundColor: '#FFF8F0',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DEC8A8',
    marginBottom: 28,
  },
  doneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  doneLabel: { fontSize: 13, color: '#C49A6C', fontWeight: '600' },
  doneVal: { fontSize: 14, fontWeight: '700', color: '#5C3D1E' },
  doneDivider: { height: 1, backgroundColor: '#DEC8A8', marginVertical: 4 },
  doneBtn: {
    width: '100%',
    backgroundColor: '#8B5E3C',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});

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
      setSavedDate(existing?.saved_date?.split('T')?.[0] ?? todayStr);
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
  // availableAmount: 자산이 없으면 무제한(-1), 있으면 실제 가용액
  const availableAmount = totalAssetAmount > 0
    ? Math.max(0, totalAssetAmount - totalCommitted + editingAmount)
    : -1;

  const handleSave = async () => {
    const amount = parseCommaInput(amountText);
    if (!amount || amount <= 0) { Alert.alert('알림', '금액을 올바르게 입력해주세요.'); return; }
    // availableAmount >= 0 이면 한도 체크 (0이면 완전 소진 → 어떤 값이든 초과)
    if (availableAmount >= 0 && amount > availableAmount) {
      const msg = availableAmount === 0
        ? '총 자산이 이미 모든 목표 항목에 할당됐어요.'
        : `입력 금액이 가용 한도(${formatAmount(availableAmount)})를 초과해요.`;
      Alert.alert('알림', msg);
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
      <KeyboardAvoidingView
        style={modalStyles.kavContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlayTap} />
        </TouchableWithoutFeedback>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>{existing ? '항목 수정' : '항목 추가'}</Text>
            <TouchableOpacity onPress={() => { setShowDatePicker(false); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <SvgX color="#C49A6C" size={22} strokeWidth={2} />
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
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
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
                {(() => {
                  const cap = availableAmount; // -1=무제한, 0=소진, >0=가용액
                  if (parsedAmount > 0) {
                    if (cap < 0 || parsedAmount <= cap) {
                      // 무제한이거나 한도 이내 → 한글 금액 표시
                      return <Text style={modalStyles.amountInline}>{formatAmount(parsedAmount)}</Text>;
                    } else {
                      // 한도 초과
                      return (
                        <Text style={[modalStyles.amountInline, { color: '#D95F4B' }]}>
                          {cap === 0 ? '가용 한도 없음' : `최대 ${formatAmount(cap)}`}
                        </Text>
                      );
                    }
                  } else if (cap >= 0) {
                    // 미입력 상태에서 한도 안내
                    return (
                      <Text style={[modalStyles.amountInline, { color: '#C49A6C' }]}>
                        {cap === 0 ? '가용 한도 없음' : `최대 ${formatAmount(cap)}`}
                      </Text>
                    );
                  }
                  return null;
                })()}
              </View>
              <TextInput
                style={[
                  modalStyles.input,
                  availableAmount >= 0 && parsedAmount > availableAmount && { borderColor: '#D95F4B' },
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
      </KeyboardAvoidingView>
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
  const navigation = useNavigation<FinanceNavProp>();
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem]     = useState<GoalItemData | null>(null);
  const cardSwipeRef = React.useRef<Swipeable>(null);

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

  const renderCardDelete = () => (
    <View style={goalStyles.cardSwipeActions}>
      <TouchableOpacity
        style={goalStyles.cardSwipeDelete}
        onPress={() => { cardSwipeRef.current?.close(); handleDeleteGoal(); }}
      >
        <Text style={goalStyles.swipeDeleteText}>삭제</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable ref={cardSwipeRef} renderRightActions={renderCardDelete} overshootRight={false}>
    <View style={goalStyles.goalCard}>
      {/* ── 헤더: 아이콘 + 제목 + 수정 ── */}
      <View style={goalStyles.goalCardHeader}>
        <View style={goalStyles.goalIconBox}>
          <Text style={goalStyles.goalIconEmoji}>🎯</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={goalStyles.goalTitle}>{goal.title}</Text>
          {(goal.memo || goal.start_date) ? (
            <Text style={goalStyles.goalMeta}>
              {goal.memo ? goal.memo : ''}
              {goal.memo && goal.start_date ? '  ·  ' : ''}
              {(goal.start_date || goal.end_date)
                ? `${formatDateStr(goal.start_date)} ~ ${formatDateStr(goal.end_date)}`
                : ''}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setShowGoalModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <SvgPencil color="#C49A6C" size={16} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      {/* ── 금액 & 진행률 ── */}
      <View style={goalStyles.progressAmtRow}>
        <View>
          <Text style={goalStyles.accumulatedLabel}>현재 모은 금액</Text>
          <Text style={goalStyles.accumulated}>{formatAmount(accumulated)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={goalStyles.accumulatedLabel}>목표</Text>
          <Text style={goalStyles.targetLabel}>{formatAmount(goal.target_amount)}</Text>
        </View>
      </View>
      <View style={goalStyles.progressBarBg}>
        <View style={[goalStyles.progressBarFill, { width: `${progressPct}%` }]} />
      </View>
      <Text style={goalStyles.progressPct}>{progressPct}% 달성</Text>

      {/* ── 항목 목록 ── */}
      {goalItems.length > 0 && (
        <View style={goalStyles.itemsDivider} />
      )}
      {goalItems.map(item => {
        const itemSwipeRef = React.createRef<Swipeable>();
        return (
          <Swipeable
            key={item.id}
            ref={itemSwipeRef}
            renderRightActions={() => (
              <View style={goalStyles.itemSwipeActions}>
                <TouchableOpacity
                  style={goalStyles.itemSwipeDelete}
                  onPress={() => { itemSwipeRef.current?.close(); handleDeleteItem(item); }}
                >
                  <Text style={goalStyles.swipeDeleteText}>삭제</Text>
                </TouchableOpacity>
              </View>
            )}
            overshootRight={false}
          >
            <View style={goalStyles.itemRow}>
              <View style={goalStyles.itemIconBox}>
                <Text style={goalStyles.itemIconEmoji}>💰</Text>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={goalStyles.itemName}>{item.name}</Text>
                <Text style={goalStyles.itemMemo}>
                  {item.saved_date ? formatDateStr(item.saved_date) : ''}
                  {item.saved_date && item.memo ? '  ·  ' : ''}
                  {item.memo ?? ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={goalStyles.itemAmount}>{formatAmount(item.amount)}</Text>
                <TouchableOpacity
                  style={goalStyles.itemEditBtn}
                  onPress={() => navigation.navigate('GoalItemAdd', { goalId: goal.id, familyId: goal.family_id, itemId: item.id })}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={goalStyles.itemEditBtnText}>수정</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Swipeable>
        );
      })}

      {/* ── 항목 추가 버튼 ── */}
      <TouchableOpacity
        style={goalStyles.addItemBtn}
        onPress={() => navigation.navigate('GoalItemAdd', { goalId: goal.id, familyId: goal.family_id })}
        activeOpacity={0.75}
      >
        <SvgPlus color="#8B5E3C" size={14} strokeWidth={2.5} />
        <Text style={goalStyles.addItemBtnText}>항목 추가</Text>
      </TouchableOpacity>

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
    </Swipeable>
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
  const navigation = useNavigation<FinanceNavProp>();

  const totalAllGoals = Object.values(goalItemsMap)
    .flat()
    .reduce((s, i) => s + i.amount, 0);

  return (
    <View style={goalStyles.section}>
      {/* 섹션 헤더 */}
      <View style={goalStyles.sectionHeader}>
        <View style={goalStyles.sectionTitleRow}>
          <SvgTarget color="#8B5E3C" size={16} strokeWidth={1.8} />
          <Text style={goalStyles.sectionTitle}>목표 ({goals.length}/2)</Text>
        </View>
        {goals.length < 2 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('GoalAdd', { familyId })}
            style={goalStyles.addGoalBtn}
          >
            <SvgPlus color="#8B5E3C" size={14} strokeWidth={2.5} />
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#DEC8A855',
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  // 카드 헤더
  goalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  goalIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EDD9C0',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  goalIconEmoji: { fontSize: 16 },
  goalTitle: { fontSize: 14, fontWeight: '700', color: '#5C3D1E' },
  goalMeta: { fontSize: 11, color: '#A87850', fontWeight: '500' },
  // 진행률
  progressAmtRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  accumulatedLabel: { fontSize: 10, color: '#C49A6C', fontWeight: '600', marginBottom: 2 },
  accumulated: { fontSize: 18, fontWeight: '800', color: '#5C3D1E' },
  targetLabel: { fontSize: 14, fontWeight: '700', color: '#A87850' },
  progressBarBg: {
    height: 8,
    backgroundColor: '#EDD9C0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#8B5E3C',
    borderRadius: 4,
  },
  progressPct: { fontSize: 11, fontWeight: '700', color: '#8B5E3C', marginBottom: 12 },
  // 항목 구분선
  itemsDivider: { height: 1, backgroundColor: '#EDD9C0', marginBottom: 4 },
  // 항목 행 (자산 행처럼)
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF8F0',
    paddingVertical: 10,
  },
  itemIconBox: {
    width: 32, height: 32, borderRadius: 9,
    backgroundColor: '#EDD9C020',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  itemIconEmoji: { fontSize: 14 },
  itemName: { fontSize: 13, fontWeight: '700', color: '#5C3D1E' },
  itemMemo: { fontSize: 11, color: '#C49A6C' },
  itemAmount: { fontSize: 13, fontWeight: '700', color: '#5C3D1E' },
  itemEditBtn: {
    backgroundColor: '#EDD9C0',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  itemEditBtnText: { fontSize: 10, fontWeight: '700', color: '#8B5E3C' },
  // 항목 추가 버튼
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#DEC8A8',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  addItemBtnText: { fontSize: 13, fontWeight: '700', color: '#8B5E3C' },
  deleteGoalText: { fontSize: 12, color: '#D95F4B', fontWeight: '500' },
  cardSwipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: 6,
    marginBottom: 12,
  },
  cardSwipeDelete: {
    backgroundColor: '#DC2626',
    borderRadius: 16,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemSwipeActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingLeft: 6,
  },
  itemSwipeDelete: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeDeleteText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  emptyCard: {
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DEC8A855',
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

  const [activeTab, setActiveTab] = useState<'assets' | 'goals'>('assets');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberBasic[]>([]);
  const [loading, setLoading] = useState(true);
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

  const getNicknameMap = () => Object.fromEntries(familyMembers.map(m => [m.id, m.nickname]));

  // 자산 행 탭 → 변경 내역 화면
  const handlePressAsset = (asset: Asset) => {
    const ownerNickname = asset.user_id ? (getNicknameMap()[asset.user_id] ?? undefined) : undefined;
    navigation.navigate('AssetHistory', {
      assetId: asset.id,
      assetName: asset.name,
      category: asset.category,
      currentAmount: asset.amount,
      ownerNickname,
    });
  };

  // 수정 버튼 → AssetUpdate 풀스크린
  const handleEditAsset = (asset: Asset) => {
    const ownerNickname = asset.user_id ? (getNicknameMap()[asset.user_id] ?? undefined) : undefined;
    navigation.navigate('AssetUpdate', {
      assetId: asset.id,
      assetName: asset.name,
      assetAmount: asset.amount,
      category: asset.category,
      ownerNickname,
    });
  };

  // 스와이프 삭제 → Alert로 방법 선택
  const handleDeleteAsset = (asset: Asset) => {
    Alert.alert(
      '자산 삭제',
      `${asset.name}을(를) 삭제할까요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '내역 남기고 삭제',
          onPress: () => handleDelete(asset, true),
        },
        {
          text: '내역도 함께 삭제',
          style: 'destructive',
          onPress: () => handleDelete(asset, false),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.subLabel}>우리 집 자산</Text>
        <Text style={styles.title}>자산</Text>
      </View>

      {/* 자산 | 목표 세그먼트 토글 */}
      <View style={styles.segmentWrap}>
        <TouchableOpacity
          style={[styles.segBtn, activeTab === 'assets' && styles.segBtnActive]}
          onPress={() => setActiveTab('assets')}
        >
          <Text style={[styles.segText, activeTab === 'assets' && styles.segTextActive]}>자산</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segBtn, activeTab === 'goals' && styles.segBtnActive]}
          onPress={() => setActiveTab('goals')}
        >
          <Text style={[styles.segText, activeTab === 'goals' && styles.segTextActive]}>목표</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'assets' ? (
          <>
            {/* 총 자산 카드 */}
            <TotalCard
              total={totalAmount}
              assetCount={assets.length}
              onPress={() => navigation.navigate('AllAssetHistory')}
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
                onPressAsset={handlePressAsset}
                onEditAsset={handleEditAsset}
                onDeleteAsset={handleDeleteAsset}
              />
            ))}
          </>
        ) : (
          /* 목표 섹션 */
          familyId ? (
            <GoalSection
              goals={goals}
              goalItemsMap={goalItemsMap}
              assets={assets}
              familyId={familyId}
              onGoalChange={loadAssets}
            />
          ) : null
        )}
      </ScrollView>

      {/* 자산 추가 FAB (자산 탭에서만) */}
      {activeTab === 'assets' && (
        <TouchableOpacity
          style={styles.addFab}
          onPress={() => navigation.navigate('AssetAdd')}
          activeOpacity={0.85}
        >
          <SvgPlus color="#FFFFFF" size={26} strokeWidth={2.5} />
        </TouchableOpacity>
      )}

      {/* 수정 모달 (더 이상 AssetRow에서 열리지 않으나 직접 삭제용으로 유지 가능) */}
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
    paddingBottom: 10,
  },
  subLabel: { fontSize: 12, fontWeight: '600', color: '#A87850', marginBottom: 2, letterSpacing: 0.2 },
  title: { fontSize: 26, fontWeight: '800', color: '#5C3D1E' },
  // 세그먼트 토글
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#EDD9C0',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  segText: { fontSize: 14, fontWeight: '600', color: '#A87850' },
  segTextActive: { color: '#5C3D1E', fontWeight: '800' },
  content: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 },
  emptyText: {
    textAlign: 'center',
    color: '#C49A6C',
    fontSize: 14,
    marginTop: 16,
    marginBottom: 16,
  },
  addFab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#8B5E3C',
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6B4226',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
});

export default FinanceScreen;
