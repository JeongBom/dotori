// Swipeable renderRightActions용 액션 버튼 — 생필품/장보기 등 공용
// onEdit을 넘기면 [수정][삭제] 두 버튼, 없으면 [삭제]만 표시
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface SwipeDeleteActionProps {
  onDelete: () => void;
  onEdit?: () => void;
}

const SwipeDeleteAction: React.FC<SwipeDeleteActionProps> = ({ onDelete, onEdit }) => (
  <View style={s.row}>
    {onEdit && (
      <TouchableOpacity style={[s.btn, s.editBtn]} onPress={onEdit}>
        <Text style={s.text}>수정</Text>
      </TouchableOpacity>
    )}
    <TouchableOpacity style={[s.btn, s.deleteBtn, !onEdit && s.deleteOnly]} onPress={onDelete}>
      <Text style={s.text}>삭제</Text>
    </TouchableOpacity>
  </View>
);

const s = StyleSheet.create({
  row: { flexDirection: 'row' },
  btn: {
    justifyContent: 'center', alignItems: 'center',
    width: 72, marginBottom: 8,
  },
  editBtn:    { backgroundColor: theme.colors.warm.oak },
  deleteBtn:  { backgroundColor: theme.colors.status.danger, borderTopRightRadius: 14, borderBottomRightRadius: 14 },
  deleteOnly: { width: 80 },
  text: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default SwipeDeleteAction;
