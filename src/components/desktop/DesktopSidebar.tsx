// 데스크톱 웹 전용 좌측 사이드바 (하단 탭바 대체)
// Tab.Navigator의 tabBar로 주입되므로 라우트/포커스 상태를 그대로 받는다
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Svg, { Path } from 'react-native-svg';
import { Settings } from 'lucide-react-native';

import { theme } from '../../theme';
import { SIDEBAR_WIDTH } from '../../hooks/useIsDesktopWeb';

// 도토리 로고 (대시보드 AcornMark와 동일 모양)
function AcornMark({ size = 26 }: { size?: number }) {
  const color = theme.colors.brand;
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Path d="M5 11c0-1 1-2 2-2h14c1 0 2 1 2 2 0 1-1 2-2 2H7c-1 0-2-1-2-2z" fill={color} />
      <Path d="M7 13h14c0 5-3 11-7 11s-7-6-7-11z" fill={color} fillOpacity={0.55} />
      <Path d="M14 4v5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const DesktopSidebar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  return (
    <View style={s.bar}>
      {/* 로고 */}
      <View style={s.logoRow}>
        <AcornMark />
        <Text style={s.logoText}>도토리</Text>
      </View>

      {/* 탭 메뉴 */}
      <View style={s.menu}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? theme.colors.brand : theme.colors.warm.oak;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;

          return (
            <TouchableOpacity
              key={route.key}
              style={[s.item, focused && s.itemActive]}
              onPress={() => navigation.navigate(route.name)}
              activeOpacity={0.7}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text style={[s.itemLabel, { color }, focused && s.itemLabelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 하단: 설정 */}
      <TouchableOpacity
        style={s.item}
        onPress={() => navigation.navigate('Settings' as never)}
        activeOpacity={0.7}
      >
        <Settings color={theme.colors.warm.oak} size={20} strokeWidth={1.5} />
        <Text style={[s.itemLabel, { color: theme.colors.warm.oak }]}>설정</Text>
      </TouchableOpacity>
    </View>
  );
};

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDEBAR_WIDTH,
    backgroundColor: theme.colors.warm.ivory,
    borderRightWidth: 1, borderRightColor: theme.colors.warm.edge,
    paddingHorizontal: 14, paddingVertical: 20,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, marginBottom: 24 },
  logoText: { fontSize: 20, fontWeight: '700', color: theme.colors.warm.dark, letterSpacing: -0.5 },
  menu: { flex: 1, gap: 2 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 12, paddingVertical: 11, borderRadius: 10,
  },
  itemActive: { backgroundColor: theme.colors.warm.cream },
  itemLabel: { fontSize: 14, fontWeight: '600' },
  itemLabelActive: { fontWeight: '700' },
});

export default DesktopSidebar;
