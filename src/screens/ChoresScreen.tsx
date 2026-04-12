// 루틴 화면 (추후 구현 예정)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';

const ChoresScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Calendar color="#8B5E3C" size={60} strokeWidth={1.2} />
      <Text style={styles.title}>루틴</Text>
      <Text style={styles.subtitle}>반복 주기 설정, 가족 담당자 지정</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6EC', gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#5C3D1E', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#8B5E3C' },
});

export default ChoresScreen;
