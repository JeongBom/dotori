// SummaryCard: 대시보드 홈 화면 2×2 그리드 카드 컴포넌트

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';

interface Stat {
  label: string;
  value: string | number;
  highlight?: boolean;
}

interface SummaryCardProps {
  title: string;
  icon: React.ReactNode;
  color: string;
  // 크게 강조할 주요 수치
  primaryStat: Stat;
  // 작게 표시할 보조 수치 (선택)
  secondaryStats?: Stat[];
  onPress: () => void;
  style?: ViewStyle;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title, icon, color, primaryStat, secondaryStats, onPress, style,
}) => {
  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.85}>
      {/* 상단: 컬러 바 (아이콘 + 제목) */}
      <View style={[styles.header, { backgroundColor: color }]}>
        <View style={styles.iconWrapper}>{icon}</View>
        <Text style={styles.title}>{title}</Text>
      </View>

      {/* 본문 */}
      <View style={styles.body}>
        {/* 주요 수치 크게 */}
        <Text
          style={[styles.primaryValue, primaryStat.highlight && styles.highlightValue]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {primaryStat.value}
        </Text>
        <Text style={styles.primaryLabel}>{primaryStat.label}</Text>

        {/* 보조 수치들 */}
        {secondaryStats && secondaryStats.length > 0 && (
          <View style={styles.secondaryList}>
            {secondaryStats.map((stat, i) => (
              <View key={i} style={styles.secondaryRow}>
                <Text style={styles.secondaryLabel}>{stat.label}</Text>
                <Text style={[styles.secondaryValue, stat.highlight && styles.highlightValue]}>
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },

  // 상단 컬러 바
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  iconWrapper: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // 본문
  body: {
    padding: 14,
  },
  primaryValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#5C3D1E',
    marginBottom: 2,
  },
  primaryLabel: {
    fontSize: 11,
    color: '#8B5E3C',
    fontWeight: '500',
    marginBottom: 10,
  },

  // 보조 수치
  secondaryList: {
    borderTopWidth: 1,
    borderTopColor: '#DEC8A8',
    paddingTop: 8,
    gap: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryLabel: {
    fontSize: 11,
    color: '#8B5E3C',
  },
  secondaryValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C3D1E',
  },

  highlightValue: {
    color: '#D95F4B',
  },
});

export default SummaryCard;
