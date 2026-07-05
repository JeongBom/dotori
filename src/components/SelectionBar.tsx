// 다중 선택 모드 하단 바 — 음식/생필품/장보기/메모 공용
// [전체 선택]  "N개 선택됨"  [삭제]
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { theme } from '../theme';

interface SelectionBarProps {
  count: number;        // 선택된 개수
  allSelected: boolean; // 전체 선택 상태 (버튼 라벨 전환용)
  onSelectAll: () => void;
  onDelete: () => void;
}

const SelectionBar: React.FC<SelectionBarProps> = ({ count, allSelected, onSelectAll, onDelete }) => (
  <View style={s.bar}>
    <TouchableOpacity onPress={onSelectAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={s.selectAll}>{allSelected ? '전체 해제' : '전체 선택'}</Text>
    </TouchableOpacity>

    <Text style={s.count}>{count}개 선택됨</Text>

    <TouchableOpacity
      style={[s.deleteBtn, count === 0 && s.deleteBtnDisabled]}
      onPress={onDelete}
      disabled={count === 0}
      activeOpacity={0.85}
    >
      <Trash2 color="#FFFFFF" size={16} strokeWidth={1.5} />
      <Text style={s.deleteText}>삭제</Text>
    </TouchableOpacity>
  </View>
);

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 16, right: 16, bottom: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.warm.ivory, borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
    shadowColor: theme.colors.warm.deep, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 8,
  },
  selectAll: { fontSize: 13, fontWeight: '600', color: theme.colors.brand },
  count: { fontSize: 13, fontWeight: '700', color: theme.colors.warm.dark },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.colors.status.danger, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});

export default SelectionBar;
