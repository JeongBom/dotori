// 리스트 섹션 라벨 (점 + 라벨 + 개수) — 생필품/장보기 등 공용
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface SectionLabelProps {
  label: string;
  count: number;
  color: string;
}

const SectionLabel: React.FC<SectionLabelProps> = ({ label, count, color }) => (
  <View style={s.wrap}>
    <View style={[s.dot, { backgroundColor: color }]} />
    <Text style={[s.label, { color }]}>{label}</Text>
    <Text style={s.count}>{count}</Text>
  </View>
);

const s = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  dot:   { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 12, fontWeight: '700' },
  count: { fontSize: 11, color: theme.colors.warm.lightOak, fontWeight: '500' },
});

export default SectionLabel;
