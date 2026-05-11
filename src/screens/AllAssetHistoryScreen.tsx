// 전체 자산 변경 내역 화면
// 모든 자산의 변경 기록을 최신순으로 표시 + 소유자 표시 + 스와이프 수정/삭제

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AllAssetHistory'>;

const CAT_CONFIG: Record<string, { color: string; emoji: string }> = {
  '예금':   { color: '#4A9EC9', emoji: '🏦' },
  '적금':   { color: '#5AAF6E', emoji: '💵' },
  '주식':   { color: '#D9629A', emoji: '📈' },
  '부동산': { color: '#D4864A', emoji: '🏠' },
  '기타':   { color: '#9EA8B0', emoji: '📦' },
};

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

function formatDiff(n: number): string {
  return n.toLocaleString('ko-KR');
}

function makeSparklinePath(amounts: number[]): string {
  if (amounts.length < 2) return '';
  const W = 300, H = 40;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const range = max - min || 1;
  const pts = amounts.map((v, i) => {
    const x = (i / (amounts.length - 1)) * W;
    const y = H - 4 - ((v - min) / range) * (H - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return 'M' + pts.join(' L');
}

// 시간순으로 전체 자산 합계 타임라인 계산
function buildTotalTimeline(histories: FlatHistory[]): { total: number; timestamp: string }[] {
  const sorted = [...histories].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const assetAmounts: Record<string, number> = {};
  const seenAssets = new Set<string>();
  const points: { total: number; timestamp: string }[] = [];

  for (const h of sorted) {
    if (!seenAssets.has(h.assetId)) {
      assetAmounts[h.assetId] = h.previous_amount;
      seenAssets.add(h.assetId);
    }
    assetAmounts[h.assetId] = h.new_amount;
    const total = Object.values(assetAmounts).reduce((s, v) => s + v, 0);
    points.push({ total, timestamp: h.created_at });
  }
  return points;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${month}월 ${day}일 · ${hh}:${mm}`;
}

const SvgChevronLeft = () => (
  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke="#5C3D1E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);

interface FlatHistory {
  id: string;
  assetId: string;
  assetName: string;
  category: string;
  ownerNickname?: string;
  previous_amount: number;
  new_amount: number;
  memo: string | null;
  created_at: string;
}

// ── 내역 행 ───────────────────────────────────
interface RowProps {
  item: FlatHistory;
  onDelete: (item: FlatHistory) => void;
  onEdit: (item: FlatHistory) => void;
}

const HistoryRow: React.FC<RowProps> = ({ item, onDelete, onEdit }) => {
  const swipeRef = useRef<Swipeable>(null);
  const cfg = CAT_CONFIG[item.category] ?? CAT_CONFIG['기타'];
  const diff = item.new_amount - item.previous_amount;
  const isIncrease = diff >= 0;
  const isFirst = item.previous_amount === 0 && item.memo === '최초 등록';
  const label = item.memo && item.memo !== '최초 등록' ? item.memo : isFirst ? '자산 최초 등록' : '금액 변경';

  const renderRightActions = () => (
    <View style={row.swipeActions}>
      <TouchableOpacity
        style={row.swipeEdit}
        onPress={() => { swipeRef.current?.close(); onEdit(item); }}
      >
        <Text style={row.swipeEditText}>수정</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={row.swipeDelete}
        onPress={() => { swipeRef.current?.close(); onDelete(item); }}
      >
        <Text style={row.swipeDeleteText}>삭제</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} friction={2} rightThreshold={40}>
      <View style={row.card}>
        {/* +/- 인디케이터 */}
        <View style={[row.indicator, isFirst ? row.indFirst : isIncrease ? row.indUp : row.indDown]}>
          <Text style={[row.indText, isFirst ? row.neutral : isIncrease ? row.up : row.down]}>
            {isFirst ? '·' : isIncrease ? '+' : '−'}
          </Text>
        </View>

        {/* 가운데: 이름+소유자 + 날짜 */}
        <View style={row.middle}>
          <View style={row.nameRow}>
            <Text style={row.label} numberOfLines={1}>{label}</Text>
          </View>
          <View style={row.subRow}>
            <Text style={[row.catDot, { color: cfg.color }]}>{cfg.emoji}</Text>
            <Text style={row.assetName} numberOfLines={1}>{item.assetName}</Text>
            {item.ownerNickname && (
              <View style={row.ownerBadge}>
                <Text style={row.ownerText}>{item.ownerNickname}</Text>
              </View>
            )}
            <Text style={row.date}>· {formatDateShort(item.created_at)}</Text>
          </View>
        </View>

        {/* 오른쪽: 변동금액 + 잔액 */}
        <View style={row.right}>
          <Text style={[row.diff, isFirst ? row.neutral : isIncrease ? row.up : row.down]}>
            {isFirst ? `+${formatDiff(item.new_amount)}` : `${isIncrease ? '+' : '−'}${formatDiff(Math.abs(diff))}`}
          </Text>
          <Text style={row.balance}>잔액 {formatAmount(item.new_amount)}</Text>
        </View>
      </View>
    </Swipeable>
  );
};

const row = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FDF6EC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  indicator: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  indUp:    { backgroundColor: '#D0DDD0' },
  indDown:  { backgroundColor: '#DDD0D0' },
  indFirst: { backgroundColor: '#DDD8CC' },
  indText:  { fontSize: 17, fontWeight: '800', lineHeight: 22 },
  up:       { color: '#4E7850' },
  down:     { color: '#78504E' },
  neutral:  { color: '#786E50' },
  middle: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '700', color: '#111827' },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'nowrap' },
  catDot: { fontSize: 11 },
  assetName: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  ownerBadge: {
    backgroundColor: '#EDD9C0',
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 5,
  },
  ownerText: { fontSize: 10, color: '#8B5E3C', fontWeight: '700' },
  date: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  right: { alignItems: 'flex-end', gap: 3, flexShrink: 0 },
  diff:    { fontSize: 15, fontWeight: '800' },
  balance: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  swipeActions: { flexDirection: 'row', marginBottom: 8, gap: 6, paddingLeft: 6 },
  swipeEdit: {
    width: 76, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#A87850', borderRadius: 14,
  },
  swipeDelete: {
    width: 76, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#78504E', borderRadius: 14,
  },
  swipeEditText:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  swipeDeleteText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});

// ── 메인 화면 ─────────────────────────────────
const AllAssetHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [histories, setHistories] = useState<FlatHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<FlatHistory | null>(null);
  const [editAmountText, setEditAmountText] = useState('');
  const [editMemoText, setEditMemoText] = useState('');
  const [sparklinePath, setSparklinePath] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [monthChange, setMonthChange] = useState<number | null>(null);

  useEffect(() => {
    if (histories.length === 0) { setSparklinePath(''); setTotalAmount(0); setMonthChange(null); return; }
    const timeline = buildTotalTimeline(histories);
    setSparklinePath(makeSparklinePath(timeline.map(p => p.total)));
    setTotalAmount(timeline[timeline.length - 1].total);

    const monthAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const before = timeline.filter(p => new Date(p.timestamp).getTime() <= monthAgoMs);
    const refTotal = before.length > 0 ? before[before.length - 1].total : timeline[0].total;
    const current = timeline[timeline.length - 1].total;
    if (refTotal > 0) setMonthChange(((current - refTotal) / refTotal) * 100);
    else setMonthChange(null);
  }, [histories]);

  const load = useCallback(async () => {
    try {
      const familyId = await getOrCreateFamilyId();
      if (!familyId) { setLoading(false); return; }

      const [assetsRes, profilesRes] = await Promise.all([
        supabase
          .from('assets')
          .select('id, name, category, user_id, asset_histories(id, created_at, new_amount, previous_amount, memo)')
          .eq('family_id', familyId)
          .eq('is_active', true),
        supabase
          .from('user_profiles')
          .select('id, nickname')
          .eq('family_id', familyId),
      ]);

      const nicknameMap: Record<string, string> = {};
      for (const p of (profilesRes.data ?? []) as any[]) {
        nicknameMap[p.id] = p.nickname;
      }

      const flat: FlatHistory[] = [];
      for (const asset of (assetsRes.data ?? []) as any[]) {
        for (const h of (asset.asset_histories ?? [])) {
          flat.push({
            id: h.id,
            assetId: asset.id,
            assetName: asset.name,
            category: asset.category,
            ownerNickname: asset.user_id ? nicknameMap[asset.user_id] : undefined,
            previous_amount: h.previous_amount,
            new_amount: h.new_amount,
            memo: h.memo ?? null,
            created_at: h.created_at,
          });
        }
      }

      flat.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setHistories(flat);
    } catch (e) {
      console.error('AllAssetHistoryScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEdit = useCallback((item: FlatHistory) => {
    setEditingItem(item);
    setEditAmountText(item.new_amount.toLocaleString('ko-KR'));
    setEditMemoText(item.memo && item.memo !== '최초 등록' ? item.memo : '');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingItem) return;
    const newAmount = parseInt(editAmountText.replace(/,/g, ''), 10) || 0;
    const newMemo = editMemoText.trim() || null;

    const { error } = await supabase
      .from('asset_histories')
      .update({ new_amount: newAmount, memo: newMemo })
      .eq('id', editingItem.id);

    if (error) { Alert.alert('오류', '수정에 실패했습니다.'); return; }

    // 해당 자산의 가장 최신 내역이면 asset amount도 업데이트
    const assetLatest = histories.find(h => h.assetId === editingItem.assetId);
    if (assetLatest?.id === editingItem.id) {
      await supabase.from('assets').update({ amount: newAmount }).eq('id', editingItem.assetId);
    }

    setHistories(prev => prev.map(h =>
      h.id === editingItem.id ? { ...h, new_amount: newAmount, memo: newMemo } : h
    ));
    setEditingItem(null);
  }, [editingItem, editAmountText, editMemoText, histories]);

  const handleDelete = useCallback((item: FlatHistory) => {
    const isFirst = item.previous_amount === 0 && item.memo === '최초 등록';
    const revertMsg = isFirst
      ? `이 내역을 삭제하면 자산 금액이 0원으로 초기화돼요.`
      : `이 내역을 삭제하면 [${item.assetName}] 금액이\n${formatAmount(item.new_amount)} → ${formatAmount(item.previous_amount)}\n으로 되돌아가요.`;

    Alert.alert('내역 삭제', revertMsg, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제 및 금액 되돌리기',
        style: 'destructive',
        onPress: async () => {
          const { error: updateErr } = await supabase
            .from('assets').update({ amount: item.previous_amount }).eq('id', item.assetId);
          if (updateErr) { Alert.alert('오류', '자산 금액 변경에 실패했습니다.'); return; }

          const { error: deleteErr } = await supabase
            .from('asset_histories').delete().eq('id', item.id);
          if (!deleteErr) {
            setHistories(prev => prev.filter(h => h.id !== item.id));
          } else {
            Alert.alert('오류', '내역 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  }, []);

  return (
    <SafeAreaView style={st.safe}>
      {/* 수정 모달 */}
      <Modal visible={!!editingItem} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={modal.overlay} onPress={() => setEditingItem(null)}>
            <Pressable style={modal.sheet} onPress={() => {}}>
              <View style={modal.handle} />
              <Text style={modal.title}>내역 수정</Text>

              <Text style={modal.label}>금액</Text>
              <TextInput
                style={modal.input}
                value={editAmountText}
                onChangeText={t => {
                  const digits = t.replace(/[^0-9]/g, '');
                  setEditAmountText(digits ? parseInt(digits, 10).toLocaleString('ko-KR') : '');
                }}
                keyboardType="numeric"
                placeholder="금액 입력"
                placeholderTextColor="#C49A6C"
              />

              <Text style={modal.label}>변경 이유</Text>
              <TextInput
                style={modal.input}
                value={editMemoText}
                onChangeText={setEditMemoText}
                placeholder="예: 월급 입금, 주식 매수"
                placeholderTextColor="#C49A6C"
              />

              <TouchableOpacity style={modal.saveBtn} onPress={handleSaveEdit}>
                <Text style={modal.saveBtnText}>저장</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* 헤더 */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <SvgChevronLeft />
        </TouchableOpacity>
        <Text style={st.headerTitle}>전체 자산 내역</Text>
        <View style={st.backBtn} />
      </View>

      {loading ? (
        <View style={st.centered}>
          <ActivityIndicator size="large" color="#8B5E3C" />
        </View>
      ) : histories.length === 0 ? (
        <View style={st.centered}>
          <Text style={st.emptyText}>변경 내역이 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={histories}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <HistoryRow item={item} onDelete={handleDelete} onEdit={handleEdit} />
          )}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={st.summaryCard}>
              <Text style={st.summaryLabel}>전체 자산 합계</Text>
              <Text style={st.summaryAmount}>{formatAmount(totalAmount)}</Text>
              {monthChange !== null && (
                <Text style={st.monthChange}>
                  지난 달 대비 {monthChange >= 0 ? '+' : ''}{monthChange.toFixed(0)}%
                </Text>
              )}
              {sparklinePath !== '' && (
                <Svg width="100%" height={44} viewBox="0 0 300 44" preserveAspectRatio="none" style={{ marginTop: 10 }}>
                  <Path
                    d={sparklinePath}
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FDF6EC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDD9C0',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#5C3D1E', textAlign: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  emptyText: { fontSize: 15, color: '#C49A6C' },
  summaryCard: {
    backgroundColor: '#8B5E3C',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  summaryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 4 },
  summaryAmount: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  monthChange: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 4 },
});

const modal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FDF6EC',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DEC8A8', alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 18, fontWeight: '800', color: '#5C3D1E', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: '#A87850', marginBottom: 6 },
  input: {
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#5C3D1E',
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#DEC8A8',
    marginBottom: 16,
  },
  saveBtn: {
    backgroundColor: '#8B5E3C',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default AllAssetHistoryScreen;
