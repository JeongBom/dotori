// 음식 리스트 행 (FridgeScreen 전용)
// 체크(다 먹음) + 수량 스텝퍼 + D-day, SupplyRow와 동일 규격
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  StyleSheet, Alert,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { FridgeItem } from '../types';
import { theme } from '../theme';
import SwipeDeleteAction from './SwipeDeleteAction';
import { getDDay } from '../lib/dateUtils';

// ── FoodRow ───────────────────────────────────
export interface FoodRowProps {
  item: FridgeItem;
  onToggle: (item: FridgeItem) => void;
  onDelete: (item: FridgeItem) => void;
  onQtyChange: (item: FridgeItem, delta: number) => void;
  onEdit: (item: FridgeItem) => void;
  // 다중 선택 모드
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: (item: FridgeItem) => void;
}

const FoodRow: React.FC<FoodRowProps> = React.memo(({ item, onToggle, onDelete, onQtyChange, onEdit, selectMode, selected, onSelect }) => {
  const swipeRef = useRef<Swipeable>(null);
  const dday = getDDay(item.expiry_date);
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(item.quantity ?? 1));

  const storageStyle = item.storage_type === '냉동'
    ? theme.colors.storage.frozen
    : item.storage_type === '실온'
      ? theme.colors.storage.roomTemp
      : theme.colors.storage.fridge;

  const handleDelete = () => {
    swipeRef.current?.close();
    Alert.alert('삭제 확인', `'${item.name}'을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel', onPress: () => swipeRef.current?.close() },
      { text: '삭제', style: 'destructive', onPress: () => onDelete(item) },
    ]);
  };

  const commitQty = () => {
    setEditingQty(false);
    const parsed = parseInt(qtyInput);
    if (!isNaN(parsed) && parsed > 0 && parsed !== (item.quantity ?? 1)) {
      onQtyChange(item, parsed - (item.quantity ?? 1));
    } else if (!isNaN(parsed) && parsed <= 0) {
      onQtyChange(item, -(item.quantity ?? 1));
    }
  };

  return (
    <Swipeable ref={swipeRef} enabled={!selectMode} renderRightActions={() => <SwipeDeleteAction onDelete={handleDelete} />} overshootRight={false}>
      <TouchableOpacity
        style={[fr.card, item.is_consumed && fr.cardDone, selected && fr.cardSelected]}
        onPress={() => onEdit(item)}
        activeOpacity={0.8}
      >
        {/* 체크박스 (생필품의 이모지 자리) — 다 먹음 토글 */}
        <TouchableOpacity
          style={[fr.checkBox, item.is_consumed && fr.checkBoxDone]}
          onPress={() => onToggle(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
        >
          {item.is_consumed && (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          )}
        </TouchableOpacity>

        {/* 정보 */}
        <View style={fr.body}>
          <View style={fr.nameRow}>
            <Text style={[fr.name, item.is_consumed && fr.nameDone]} numberOfLines={1}>{item.name}</Text>
            <View style={[fr.chip, { backgroundColor: storageStyle.bg }]}>
              <Text style={[fr.chipText, { color: storageStyle.fg }]}>{item.storage_type}</Text>
            </View>
          </View>
          <View style={fr.bottomRow}>
            <Text style={fr.date}>구입일 {item.stored_date.slice(5).replace('-', '.')}</Text>
            {item.is_consumed
              ? <Text style={fr.consumedAt}>{item.consumed_at?.slice(5).replace('-', '.') ?? ''} 먹음</Text>
              : <Text style={[fr.dday, { color: dday.color }]}>{dday.label}</Text>}
          </View>
        </View>

        {/* 수량 스텝퍼(가로) — 이 영역 터치는 수정으로 안 빠지고 +/-만 동작 */}
        {!item.is_consumed && (
          <Pressable style={fr.stepper} onPress={() => {}}>
            <TouchableOpacity
              onPress={() => onQtyChange(item, -1)}
              style={fr.stepBtnMinus}
              hitSlop={{ top: 12, bottom: 12, left: 10, right: 4 }}
            >
              <Text style={fr.stepMinusText}>−</Text>
            </TouchableOpacity>
            {editingQty ? (
              <TextInput
                style={fr.qtyInput}
                value={qtyInput}
                onChangeText={setQtyInput}
                keyboardType="number-pad"
                onBlur={commitQty}
                onSubmitEditing={commitQty}
                autoFocus
                selectTextOnFocus
                maxLength={4}
              />
            ) : (
              <TouchableOpacity onPress={() => { setQtyInput(String(item.quantity ?? 1)); setEditingQty(true); }}>
                <Text style={fr.qtyNum}>{item.quantity ?? 1}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => onQtyChange(item, 1)}
              style={fr.stepBtnPlus}
              hitSlop={{ top: 12, bottom: 12, left: 4, right: 10 }}
            >
              <Text style={fr.stepPlusText}>+</Text>
            </TouchableOpacity>
          </Pressable>
        )}

        {/* 선택 모드: 카드 전체 터치를 선택 토글로 가로챔 */}
        {selectMode && (
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onSelect?.(item)} />
        )}
      </TouchableOpacity>
    </Swipeable>
  );
});

// 생필품 행(SupplyRow)과 동일한 규격
const fr = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.warm.ivory, marginHorizontal: 16, marginBottom: 6,
    borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8,
    shadowColor: theme.colors.brand, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardDone: { opacity: 0.55 },
  cardSelected: { borderWidth: 1.5, borderColor: theme.colors.brand },
  checkBox: {
    width: 30, height: 30, borderRadius: 9, backgroundColor: theme.colors.warm.cream,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  checkBoxDone: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  name: { fontSize: 13, fontWeight: '700', color: theme.colors.warm.dark, flex: 1 },
  nameDone: { color: theme.colors.warm.lightOak, textDecorationLine: 'line-through' },
  chip: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  chipText: { fontSize: 9, fontWeight: '700', lineHeight: 12 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 10, color: theme.colors.warm.lightOak },
  dday: { fontSize: 10, fontWeight: '700' },
  consumedAt: { fontSize: 10, color: theme.colors.warm.lightOak },
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
  qtyInput: {
    fontSize: 14, fontWeight: '700', color: theme.colors.warm.dark, textAlign: 'center',
    minWidth: 28, borderBottomWidth: 1.5, borderBottomColor: theme.colors.brand,
    paddingHorizontal: 2, paddingVertical: 0,
  },
});

export default FoodRow;
