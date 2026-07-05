// 원형 아이콘 버튼 — 화면 헤더 공용 (생필품/장보기 등)
import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface IconBtnProps {
  onPress?: () => void;
  children: React.ReactNode;
}

const IconBtn: React.FC<IconBtnProps> = ({ onPress, children }) => (
  <TouchableOpacity onPress={onPress} style={s.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
    {children}
  </TouchableOpacity>
);

const s = StyleSheet.create({
  btn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.warm.ivory, borderWidth: 1, borderColor: theme.colors.warm.edge,
    justifyContent: 'center', alignItems: 'center',
  },
});

export default IconBtn;
