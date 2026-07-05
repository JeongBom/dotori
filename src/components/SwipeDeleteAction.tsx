// Swipeable renderRightActions용 삭제 버튼 — 생필품/장보기 등 공용
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface SwipeDeleteActionProps {
  onDelete: () => void;
}

const SwipeDeleteAction: React.FC<SwipeDeleteActionProps> = ({ onDelete }) => (
  <TouchableOpacity style={s.btn} onPress={onDelete}>
    <Text style={s.text}>삭제</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  btn: {
    backgroundColor: theme.colors.status.danger, justifyContent: 'center', alignItems: 'center',
    width: 80, marginBottom: 8, borderTopRightRadius: 14, borderBottomRightRadius: 14,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

export default SwipeDeleteAction;
