// 전체 자산 변경 히스토리 화면
// - 가족 전체 자산에 대한 모든 변경 기록을 최신순으로 표시
// - 자산명, 이전 금액 → 새 금액, 변동 금액, 변경 이유 표시

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { AssetHistory, Asset } from '../types';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AssetHistory'>;

// 히스토리 행에서 사용할 확장 타입 (자산 정보 포함)
interface HistoryWithAsset extends AssetHistory {
  assetName: string;
  assetCategory: string;
}

// ── 금액 포맷 ────────────────────────────────
// 5,000,000 → "500만원" / 150,000,000 → "1억 5,000만원"

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

// ── 날짜 포맷 ──────────────────────────────────
// "2024-04-11T09:30:00Z" → "2024.04.11 오전 9:30"

function formatDate(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours < 12 ? '오전' : '오후';
  const h = hours % 12 || 12;
  return `${year}.${month}.${day} ${ampm} ${h}:${minutes}`;
}

// ── 히스토리 행 ──────────────────────────────

interface HistoryRowProps {
  item: HistoryWithAsset;
}

const HistoryRow: React.FC<HistoryRowProps> = ({ item }) => {
  const diff = item.new_amount - item.previous_amount;
  const isIncrease = diff > 0;
  const isFirst = item.previous_amount === 0 && item.memo === '최초 등록';

  return (
    <View style={rowStyles.row}>
      {/* 자산명 + 날짜 */}
      <View style={rowStyles.topRow}>
        <Text style={rowStyles.assetName}>{item.assetName}</Text>
        <Text style={rowStyles.date}>{formatDate(item.created_at)}</Text>
      </View>

      {/* 금액 변화 */}
      <View style={rowStyles.amountRow}>
        {isFirst ? (
          <Text style={rowStyles.amountFirst}>
            {'최초 등록  '}
            <Text style={rowStyles.newAmount}>{formatAmount(item.new_amount)}</Text>
          </Text>
        ) : (
          <View style={rowStyles.amountInner}>
            <Text style={rowStyles.prevAmount}>{formatAmount(item.previous_amount)}</Text>
            <Text style={rowStyles.arrow}>{' → '}</Text>
            <Text style={[rowStyles.newAmount, isIncrease ? rowStyles.amountUp : rowStyles.amountDown]}>
              {formatAmount(item.new_amount)}
            </Text>
          </View>
        )}

        {/* 변동 금액 뱃지 */}
        {!isFirst && (
          <View style={[rowStyles.diffBadge, isIncrease ? rowStyles.diffBadgeUp : rowStyles.diffBadgeDown]}>
            <Text style={[rowStyles.diffText, isIncrease ? rowStyles.diffUp : rowStyles.diffDown]}>
              {isIncrease ? '+' : ''}{formatAmount(diff)}
            </Text>
          </View>
        )}
      </View>

      {/* 변경 이유 */}
      {item.memo && item.memo !== '최초 등록' && (
        <Text style={rowStyles.memo}>{item.memo}</Text>
      )}
    </View>
  );
};

const rowStyles = StyleSheet.create({
  row: {
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 8,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assetName: { fontSize: 14, fontWeight: '700', color: '#5C3D1E' },
  date: { fontSize: 11, color: '#C49A6C', fontWeight: '500' },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountInner: { flexDirection: 'row', alignItems: 'center' },
  prevAmount: { fontSize: 14, color: '#C49A6C', fontWeight: '500' },
  arrow: { fontSize: 13, color: '#D4B896' },
  newAmount: { fontSize: 15, fontWeight: '800', color: '#5C3D1E' },
  amountFirst: { fontSize: 13, color: '#A87850', fontWeight: '500' },
  amountUp: { color: '#5AAF6E' },
  amountDown: { color: '#D95F4B' },
  diffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  diffBadgeUp: { backgroundColor: '#E8F5EE' },
  diffBadgeDown: { backgroundColor: '#FCECEA' },
  diffText: { fontSize: 13, fontWeight: '700' },
  diffUp: { color: '#5AAF6E' },
  diffDown: { color: '#D95F4B' },
  memo: { fontSize: 13, color: '#8B5E3C', fontWeight: '500' },
});

// ── 메인 화면 ─────────────────────────────────

const AssetHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [histories, setHistories] = useState<HistoryWithAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistories = useCallback(async () => {
    try {
      const familyId = await getOrCreateFamilyId();
      if (!familyId) return;

      // 1. 가족 전체 자산 목록 조회 (id → 이름/카테고리 맵 구성용)
      const { data: assets } = await supabase
        .from('assets')
        .select('id, name, category')
        .eq('family_id', familyId);

      if (!assets || assets.length === 0) {
        setHistories([]);
        return;
      }

      const assetMap = Object.fromEntries(
        assets.map((a: Pick<Asset, 'id' | 'name' | 'category'>) => [a.id, a])
      );
      const assetIds = assets.map((a: Pick<Asset, 'id'>) => a.id);

      // 2. 해당 자산들의 히스토리 전체 조회 (최신순)
      const { data: rawHistories, error } = await supabase
        .from('asset_histories')
        .select('*')
        .in('asset_id', assetIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 3. 히스토리에 자산명 합치기
      const merged: HistoryWithAsset[] = (rawHistories ?? []).map((h: AssetHistory) => ({
        ...h,
        assetName: assetMap[h.asset_id]?.name ?? '알 수 없는 자산',
        assetCategory: assetMap[h.asset_id]?.category ?? '',
      }));

      setHistories(merged);
    } catch (e) {
      console.error('AssetHistoryScreen load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadHistories(); }, [loadHistories]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronLeft color="#5C3D1E" size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>자산 변경 히스토리</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8B5E3C" />
        </View>
      ) : histories.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>변경 기록이 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={histories}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <HistoryRow item={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
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
  list: { padding: 20, paddingBottom: 40 },
  emptyText: { fontSize: 15, color: '#C49A6C' },
});

export default AssetHistoryScreen;
