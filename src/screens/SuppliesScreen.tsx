// 생필품 화면 (추후 구현 예정)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShoppingCart } from 'lucide-react-native';

const SuppliesScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <ShoppingCart color="#8B5E3C" size={60} strokeWidth={1.2} />
      <Text style={styles.title}>생필품 재고</Text>
      <Text style={styles.subtitle}>개수 관리, 부족 시 알림</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6EC', gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#5C3D1E', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#8B5E3C' },
});

export default SuppliesScreen;
