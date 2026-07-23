// 카테고리/구입처 편집 바텀시트 (생필품·장보기 공용)
// - ≡ 핸들을 잡아끌면 순서 변경 (다른 행이 실시간으로 비켜남)
// - 행 탭: 그 자리에서 이름 수정 (인라인 입력) / 휴지통: 삭제 / + 추가: 인라인 입력
// - 완료 버튼·배경 탭·뒤로가기 제스처: 닫기
import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Pressable,
  ScrollView, Animated, PanResponder, Platform, KeyboardAvoidingView,
} from 'react-native';
import { GripVertical, Trash2, Plus } from 'lucide-react-native';

import { theme } from '../theme';

const ROW_H = 56; // 행 높이(48) + 간격(8) — 드래그 인덱스 계산 기준

interface ChipEditSheetProps {
  visible: boolean;
  title: string;                          // 예) '카테고리 편집', '구입처 편집'
  items: string[];                        // 현재 순서의 이름 목록
  onClose: () => void;
  onReorder: (ordered: string[]) => void;             // 드래그를 놓을 때마다 호출 (저장)
  onRename: (oldName: string, newName: string) => void; // 인라인 이름 수정 확정
  onDelete: (name: string) => void;                    // 휴지통 → 삭제 (확인은 호출 측에서)
  onAdd: (name: string) => void;                       // 인라인 추가 확정
}

const ChipEditSheet: React.FC<ChipEditSheetProps> = ({
  visible, title, items, onClose, onReorder, onRename, onDelete, onAdd,
}) => {
  const [order, setOrder] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // 인라인 이름 수정 / 추가 입력 상태
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState('');
  const dragIndexRef = useRef<number | null>(null);
  const targetRef = useRef(0);
  const dragY = useRef(new Animated.Value(0)).current;
  const shifts = useRef<Record<string, Animated.Value>>({});
  const getShift = (k: string) => shifts.current[k] ?? (shifts.current[k] = new Animated.Value(0));

  // 열릴 때 + 이름 변경/추가/삭제로 items가 바뀔 때 순서 동기화
  useEffect(() => { if (visible) setOrder(items); }, [visible, items]);

  // 열릴 때 입력 상태 초기화
  useEffect(() => {
    if (visible) { setEditingName(null); setEditText(''); setAdding(false); setAddText(''); }
  }, [visible]);

  const commitRename = () => {
    const oldName = editingName;
    const next = editText.trim();
    setEditingName(null);
    if (oldName && next && next !== oldName) onRename(oldName, next);
  };

  const commitAdd = () => {
    const next = addText.trim();
    setAdding(false);
    setAddText('');
    if (next) onAdd(next);
  };

  // 뒤로가기 제스처 = 완료 (더미 히스토리 항목으로 처리)
  useEffect(() => {
    if (!visible || Platform.OS !== 'web') return;
    window.history.pushState(window.history.state, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const requestClose = () => {
    if (Platform.OS === 'web') window.history.back(); // popstate → onClose
    else onClose();
  };

  // 드래그 중 다른 행들이 비켜나는 애니메이션
  const applyShifts = (start: number, target: number) => {
    order.forEach((k, i) => {
      if (i === start) return;
      let to = 0;
      if (start < target && i > start && i <= target) to = -ROW_H;
      else if (start > target && i >= target && i < start) to = ROW_H;
      Animated.timing(getShift(k), { toValue: to, duration: 150, useNativeDriver: true }).start();
    });
  };

  const finishDrag = () => {
    const s = dragIndexRef.current;
    const t = targetRef.current;
    Object.values(shifts.current).forEach(v => v.setValue(0));
    dragY.setValue(0);
    dragIndexRef.current = null;
    setDragIndex(null);
    if (s !== null && t !== s) {
      const next = [...order];
      const [moved] = next.splice(s, 1);
      next.splice(t, 0, moved);
      setOrder(next);
      onReorder(next);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={requestClose}>
      <KeyboardAvoidingView style={st.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        <View style={st.sheet}>
          <View style={st.handleBar} />
          <Text style={st.title}>{title}</Text>
          <Text style={st.subtitle}>≡ 를 잡아끌면 순서가 바뀌고, 이름을 누르면 수정할 수 있어요</Text>

          <ScrollView style={st.list} scrollEnabled={dragIndex === null} showsVerticalScrollIndicator={false}>
            {order.map((name, i) => {
              const pan = PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onPanResponderGrant: () => {
                  dragIndexRef.current = i;
                  targetRef.current = i;
                  dragY.setValue(0);
                  setDragIndex(i);
                },
                onPanResponderMove: (_, g) => {
                  dragY.setValue(g.dy);
                  const raw = i + Math.round(g.dy / ROW_H);
                  const t = Math.max(0, Math.min(order.length - 1, raw));
                  if (t !== targetRef.current) {
                    targetRef.current = t;
                    applyShifts(i, t);
                  }
                },
                onPanResponderRelease: finishDrag,
                onPanResponderTerminate: finishDrag,
              });
              const dragging = dragIndex === i;
              return (
                <Animated.View
                  key={name}
                  style={[
                    st.row,
                    dragging
                      ? { transform: [{ translateY: dragY }, { scale: 1.02 }], zIndex: 10, elevation: 4, opacity: 0.95 }
                      : { transform: [{ translateY: getShift(name) }] },
                  ]}
                >
                  <View style={st.gripArea} {...pan.panHandlers}>
                    <GripVertical size={18} strokeWidth={1.8} color={theme.colors.warm.lightOak} />
                  </View>
                  {editingName === name ? (
                    <TextInput
                      style={st.rowInput}
                      value={editText}
                      onChangeText={setEditText}
                      autoFocus
                      maxLength={12}
                      returnKeyType="done"
                      onSubmitEditing={commitRename}
                      onBlur={commitRename}
                    />
                  ) : (
                    <TouchableOpacity
                      style={st.rowBody}
                      onPress={() => { setEditingName(name); setEditText(name); }}
                    >
                      <Text style={st.rowName} numberOfLines={1}>{name}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={st.deleteBtn}
                    onPress={() => onDelete(name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={18} strokeWidth={1.8} color={theme.colors.status.danger} />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}

            {/* 추가 행 — 탭하면 인라인 입력으로 전환 */}
            {adding ? (
              <View style={[st.addRow, { borderStyle: 'solid' }]}>
                <TextInput
                  style={st.addInput}
                  value={addText}
                  onChangeText={setAddText}
                  placeholder="이름 입력"
                  placeholderTextColor={theme.colors.warm.lightOak}
                  autoFocus
                  maxLength={12}
                  returnKeyType="done"
                  onSubmitEditing={commitAdd}
                  onBlur={commitAdd}
                />
              </View>
            ) : (
              <TouchableOpacity style={st.addRow} onPress={() => setAdding(true)}>
                <Plus size={18} strokeWidth={2} color={theme.colors.brand} />
                <Text style={st.addText}>추가</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <TouchableOpacity style={st.doneBtn} onPress={requestClose}>
            <Text style={st.doneBtnText}>완료</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: theme.colors.warm.ivory, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12, maxHeight: '75%' },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.warm.edge, alignSelf: 'center', marginBottom: 20 },
  title:     { fontSize: 17, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 4 },
  subtitle:  { fontSize: 12, color: theme.colors.warm.lightOak, marginBottom: 16 },

  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    height: 48, marginBottom: 8,
    backgroundColor: theme.colors.warm.cream, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  gripArea:  { paddingHorizontal: 12, alignSelf: 'stretch', justifyContent: 'center' },
  rowBody:   { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  rowName:   { fontSize: 15, fontWeight: '600', color: theme.colors.warm.dark },
  rowInput:  {
    flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.warm.dark, padding: 0,
    borderBottomWidth: 1.5, borderBottomColor: theme.colors.brand, paddingVertical: 2,
  },
  deleteBtn: { paddingHorizontal: 14, alignSelf: 'stretch', justifyContent: 'center' },

  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 48, marginBottom: 8, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.warm.edge, borderStyle: 'dashed',
  },
  addText: { fontSize: 14, fontWeight: '600', color: theme.colors.brand },
  addInput: {
    flex: 1, fontSize: 15, fontWeight: '600', color: theme.colors.warm.dark, padding: 0,
    paddingHorizontal: 14,
  },

  doneBtn:     { backgroundColor: theme.colors.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default ChipEditSheet;
