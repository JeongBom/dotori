// 데스크톱 웹 전용: 화면을 가운데 모달 카드로 감싸는 HOC
// 모바일/앱에서는 원래 화면을 그대로 렌더링한다.
// 스택 등록 시 presentation: 'transparentModal' + 투명 contentStyle과 함께 사용.
import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { theme } from '../../theme';
import { useIsDesktopWeb } from '../../hooks/useIsDesktopWeb';

export function withDesktopPanel<P extends object>(Screen: React.ComponentType<P>): React.FC<P> {
  const Wrapped: React.FC<P> = (props) => {
    const isDesktop = useIsDesktopWeb();
    const navigation = useNavigation();

    if (!isDesktop) return <Screen {...props} />;

    return (
      <View style={s.overlay}>
        {/* 바깥(스크림) 클릭 시 닫기 */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => navigation.goBack()} />
        <View style={s.card}>
          <Screen {...props} />
        </View>
      </View>
    );
  };
  return Wrapped;
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(46, 30, 15, 0.45)', // 도토리 브라운 계열 스크림
    padding: 32,
  },
  card: {
    width: 560, maxWidth: '100%', height: '92%', maxHeight: 780,
    borderRadius: 20, overflow: 'hidden',
    backgroundColor: theme.colors.card,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
    shadowColor: theme.colors.warm.deep, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 40, elevation: 16,
  },
});
