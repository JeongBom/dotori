// 생필품 리스트 행 (SuppliesScreen 전용)
// 스와이프 삭제 + 수량 스텝퍼 + 재고 게이지
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  StyleSheet, Alert, DimensionValue,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import { Supply } from '../types';
import { theme } from '../theme';
import SwipeDeleteAction from './SwipeDeleteAction';

// ── 물품명 → 이모지 매핑 ──────────────────────
export function getSupplyEmoji(name: string, category?: string): string {
  const n = name;
  if (/샴푸|린스|컨디셔너/.test(n)) return '🚿';
  if (/비누|핸드워시|손비누|폼클/.test(n)) return '🫧';
  if (/치약|칫솔/.test(n)) return '🦷';
  if (/면도기|면도|쉐이빙/.test(n)) return '🪒';
  if (/바디워시|샤워젤|바디클/.test(n)) return '🛁';
  if (/로션|보디로션|핸드크림|크림/.test(n)) return '🧴';
  if (/면봉/.test(n)) return '🩺';
  if (/선크림|선스크린|자외선차단/.test(n)) return '☀️';
  if (/섬유유연제|유연제/.test(n)) return '🌸';
  if (/세탁세제|세탁|빨래/.test(n)) return '🧺';
  if (/주방세제|설거지세제/.test(n)) return '🍽️';
  if (/수세미/.test(n)) return '🧽';
  if (/고무장갑|위생장갑/.test(n)) return '🧤';
  if (/종이컵|일회용컵/.test(n)) return '☕';
  if (/지퍼백|비닐봉투|랩|호일/.test(n)) return '📦';
  if (/쓰레기봉투|쓰레기|봉투/.test(n)) return '🗑️';
  if (/락스|표백제|염소/.test(n)) return '🧪';
  if (/청소포|물걸레|청소티슈/.test(n)) return '🫧';
  if (/세제/.test(n)) return '🧴';
  if (/청소/.test(n)) return '🧹';
  if (/화장지|두루마리휴지|두루마리/.test(n)) return '🧻';
  if (/물티슈/.test(n)) return '💧';
  if (/휴지|티슈|화장솜/.test(n)) return '🧻';
  if (/기저귀|팸퍼스|하기스/.test(n)) return '👶';
  if (/생리대|탐폰|생리팬티/.test(n)) return '🩹';
  if (/마스크/.test(n)) return '😷';
  if (/밴드|반창고|붕대/.test(n)) return '🩹';
  if (/소독|알코올|과산화수소/.test(n)) return '🧪';
  if (/진통제|소화제|약|비타민/.test(n)) return '💊';
  if (/방향제|탈취제|디퓨저|향수/.test(n)) return '🌸';
  if (/방충제|모기/.test(n)) return '🪰';
  if (category) {
    if (/욕실|세면/.test(category)) return '🚿';
    if (/주방/.test(category))      return '🍽️';
    if (/세탁|세제/.test(category)) return '🧺';
    if (/청소/.test(category))      return '🧹';
  }
  return '📦';
}

interface SupplyRowProps {
  item: Supply;
  onDelete: (item: Supply) => void;
  onQuantityChange: (item: Supply, delta: number) => void;
  onEdit: (item: Supply) => void;
}

const SupplyRow: React.FC<SupplyRowProps> = React.memo(({ item, onDelete, onQuantityChange, onEdit }) => {
  const swipeRef = useRef<Swipeable>(null);
  const isLow = item.quantity <= item.low_stock_threshold;
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(item.quantity));

  const level = Math.min(item.quantity / Math.max(item.low_stock_threshold * 3, 1), 1);
  const barColor = isLow
    ? theme.colors.status.danger
    : level > 0.8
      ? theme.colors.status.safe
      : theme.colors.status.warn;

  const commitQtyEdit = () => {
    setEditingQty(false);
    const parsed = parseInt(qtyInput);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== item.quantity) {
      onQuantityChange(item, parsed - item.quantity);
    }
  };

  const handleDelete = () => {
    swipeRef.current?.close();
    Alert.alert('삭제 확인', `'${item.name}'을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(item) },
    ]);
  };

  const emoji = getSupplyEmoji(item.name, item.category);
  const barWidth: DimensionValue = `${Math.max(level * 100, 3)}%`;

  return (
    <Swipeable ref={swipeRef} renderRightActions={() => <SwipeDeleteAction onDelete={handleDelete} />} overshootRight={false}>
      <TouchableOpacity
        style={[row.card, isLow && row.cardLow]}
        onPress={() => onEdit(item)}
        activeOpacity={0.8}
      >
        {/* 이모지 아이콘 */}
        <View style={row.iconBox}>
          <Text style={row.iconEmoji}>{emoji}</Text>
        </View>

        {/* 정보 */}
        <View style={row.body}>
          <View style={row.nameRow}>
            <Text style={row.name} numberOfLines={1}>{item.name}</Text>
            {item.category ? (
              <View style={row.catChip}>
                <Text style={row.catText}>{item.category}</Text>
              </View>
            ) : null}
          </View>

          {/* 프로그레스 바 */}
          <View style={row.barTrack}>
            <View style={[row.barFill, { width: barWidth, backgroundColor: barColor }]} />
          </View>

          <View style={row.bottomRow}>
            {item.note ? (
              <Text style={row.note} numberOfLines={1}>{item.note}</Text>
            ) : (
              <Text style={row.threshold}>최소 {item.low_stock_threshold}개</Text>
            )}
            {isLow && <Text style={row.lowLabel}>부족</Text>}
          </View>
        </View>

        {/* 수량 스텝퍼(가로) — 이 영역 터치는 수정으로 안 빠지고 +/-만 동작 */}
        <Pressable style={row.stepper} onPress={() => {}}>
          <TouchableOpacity
            onPress={() => onQuantityChange(item, -1)}
            style={row.stepBtnMinus}
            hitSlop={{ top: 12, bottom: 12, left: 10, right: 4 }}
          >
            <Text style={row.stepMinusText}>−</Text>
          </TouchableOpacity>
          {editingQty ? (
            <TextInput
              style={row.qtyInput}
              value={qtyInput}
              onChangeText={setQtyInput}
              keyboardType="number-pad"
              onBlur={commitQtyEdit}
              onSubmitEditing={commitQtyEdit}
              autoFocus
              selectTextOnFocus
              maxLength={4}
            />
          ) : (
            <TouchableOpacity onPress={() => { setQtyInput(String(item.quantity)); setEditingQty(true); }}>
              <Text style={[row.qtyNum, isLow && row.qtyNumLow]}>{item.quantity}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => onQuantityChange(item, 1)}
            style={row.stepBtnPlus}
            hitSlop={{ top: 12, bottom: 12, left: 4, right: 10 }}
          >
            <Text style={row.stepPlusText}>+</Text>
          </TouchableOpacity>
        </Pressable>
      </TouchableOpacity>
    </Swipeable>
  );
});

const row = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.warm.ivory, marginHorizontal: 16, marginBottom: 6,
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8,
    shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardLow: { borderWidth: 1, borderColor: theme.colors.alert.dangerBorder },
  iconBox: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: theme.colors.warm.cream,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  iconEmoji: { fontSize: 15 },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  name: { fontSize: 13, fontWeight: '700', color: theme.colors.warm.dark, flex: 1 },
  catChip: { backgroundColor: theme.colors.warm.cream, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  catText: { fontSize: 9, fontWeight: '600', color: theme.colors.warm.lightOak },
  barTrack: { height: 4, backgroundColor: `${theme.colors.warm.edge}66`, borderRadius: 2, marginBottom: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  note: { fontSize: 10, color: theme.colors.warm.lightOak, flex: 1 },
  threshold: { fontSize: 10, color: theme.colors.warm.lightOak },
  lowLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.status.danger },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, paddingLeft: 8 },
  stepBtnPlus: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.colors.brand, justifyContent: 'center', alignItems: 'center',
  },
  stepPlusText: { fontSize: 14, fontWeight: '700', color: '#fff', lineHeight: 17 },
  stepBtnMinus: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: theme.colors.warm.edge, justifyContent: 'center', alignItems: 'center',
  },
  stepMinusText: { fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, lineHeight: 17 },
  qtyNum: { fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, minWidth: 18, textAlign: 'center' },
  qtyNumLow: { color: theme.colors.status.danger },
  qtyInput: {
    fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, textAlign: 'center',
    minWidth: 28, borderBottomWidth: 1.5, borderBottomColor: theme.colors.brand,
    paddingHorizontal: 2, paddingVertical: 0,
  },
});

export default SupplyRow;
