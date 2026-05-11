// 도토리 스플래시 화면
// 디자인: Dotori Splash.html 기반
// 도토리 가족 4마리 + 낙엽 + 로딩 도트 + 스테이지드 애니메이션

import React, { useEffect, useRef } from 'react';
import {
  Animated, StyleSheet, Text, View, Dimensions,
} from 'react-native';
import Svg, { Path, Circle, Ellipse, G } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

// ── 도토리 SVG 컴포넌트들 ─────────────────────

function AcornChild1() {
  return (
    <Svg width={70} height={84} viewBox="0 0 100 120" fill="none">
      {/* 나뭇잎 */}
      <Path d="M52 18 C 60 8, 74 6, 82 12 C 78 22, 68 26, 58 24 C 54 23, 52 21, 52 18 Z" fill="#C8D89A" />
      {/* 꼭지 */}
      <Path d="M50 24 L 50 18" stroke="#6B4226" strokeWidth={2} strokeLinecap="round" />
      {/* 모자 */}
      <Path d="M14 36 C 14 30, 18 24, 24 24 L 76 24 C 82 24, 86 30, 86 36 L 86 42 C 86 46, 83 48, 80 48 L 20 48 C 17 48, 14 46, 14 42 Z" fill="#A87850" />
      <Circle cx={26} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={36} cy={40} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={46} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={56} cy={40} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={66} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={76} cy={40} r={1.6} fill="#6B4226" opacity={0.22} />
      {/* 몸통 */}
      <Path d="M18 48 L 82 48 C 82 78, 68 106, 50 106 C 32 106, 18 78, 18 48 Z" fill="#A87850" opacity={0.72} />
      <Ellipse cx={34} cy={68} rx={6} ry={14} fill="#fff" opacity={0.2} />
      {/* 얼굴 */}
      <Circle cx={40} cy={74} r={1.8} fill="#6B4226" />
      <Circle cx={60} cy={74} r={1.8} fill="#6B4226" />
      <Path d="M43 82 Q 50 86, 57 82" stroke="#6B4226" strokeWidth={1.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

function AcornParent() {
  return (
    <Svg width={100} height={120} viewBox="0 0 100 120" fill="none">
      {/* 나뭇잎 */}
      <Path d="M52 18 C 60 8, 74 6, 82 12 C 78 22, 68 26, 58 24 C 54 23, 52 21, 52 18 Z" fill="#9AB87A" />
      <Path d="M52 18 Q 62 16, 78 14" stroke="#7A9A5A" strokeOpacity={0.55} strokeWidth={1} strokeLinecap="round" fill="none" />
      {/* 꼭지 */}
      <Path d="M50 24 L 50 18" stroke="#6B4226" strokeWidth={2} strokeLinecap="round" />
      {/* 모자 */}
      <Path d="M14 36 C 14 30, 18 24, 24 24 L 76 24 C 82 24, 86 30, 86 36 L 86 42 C 86 46, 83 48, 80 48 L 20 48 C 17 48, 14 46, 14 42 Z" fill="#8B5E3C" />
      <Circle cx={26} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={36} cy={40} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={46} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={56} cy={40} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={66} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={76} cy={40} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={31} cy={42} r={1.4} fill="#6B4226" opacity={0.22} />
      <Circle cx={51} cy={42} r={1.4} fill="#6B4226" opacity={0.22} />
      <Circle cx={71} cy={42} r={1.4} fill="#6B4226" opacity={0.22} />
      {/* 몸통 */}
      <Path d="M18 48 L 82 48 C 82 78, 68 106, 50 106 C 32 106, 18 78, 18 48 Z" fill="#8B5E3C" opacity={0.72} />
      <Ellipse cx={34} cy={68} rx={6} ry={14} fill="#fff" opacity={0.2} />
      {/* 얼굴 */}
      <Circle cx={40} cy={72} r={2.2} fill="#6B4226" />
      <Circle cx={60} cy={72} r={2.2} fill="#6B4226" />
      <Path d="M42 82 Q 50 88, 58 82" stroke="#6B4226" strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* 볼터치 */}
      <Circle cx={34} cy={80} r={2.2} fill="#E8A5A5" opacity={0.55} />
      <Circle cx={66} cy={80} r={2.2} fill="#E8A5A5" opacity={0.55} />
    </Svg>
  );
}

function AcornChild2() {
  return (
    <Svg width={60} height={72} viewBox="0 0 100 120" fill="none">
      {/* 나뭇잎 */}
      <Path d="M52 18 C 60 8, 74 6, 82 12 C 78 22, 68 26, 58 24 C 54 23, 52 21, 52 18 Z" fill="#B4C98A" />
      {/* 꼭지 */}
      <Path d="M50 24 L 50 18" stroke="#6B4226" strokeWidth={2} strokeLinecap="round" />
      {/* 모자 */}
      <Path d="M14 36 C 14 30, 18 24, 24 24 L 76 24 C 82 24, 86 30, 86 36 L 86 42 C 86 46, 83 48, 80 48 L 20 48 C 17 48, 14 46, 14 42 Z" fill="#C49A6C" />
      <Circle cx={26} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={46} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={66} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={36} cy={40} r={1.4} fill="#6B4226" opacity={0.22} />
      <Circle cx={56} cy={40} r={1.4} fill="#6B4226" opacity={0.22} />
      {/* 몸통 */}
      <Path d="M18 48 L 82 48 C 82 78, 68 106, 50 106 C 32 106, 18 78, 18 48 Z" fill="#C49A6C" opacity={0.72} />
      {/* 아기 얼굴 */}
      <Circle cx={42} cy={76} r={1.5} fill="#6B4226" />
      <Circle cx={58} cy={76} r={1.5} fill="#6B4226" />
      <Circle cx={50} cy={82} r={1.8} fill="#E8A5A5" opacity={0.7} />
    </Svg>
  );
}

function AcornChild3() {
  return (
    <Svg width={48} height={58} viewBox="0 0 100 120" fill="none">
      {/* 모자 */}
      <Path d="M14 36 C 14 30, 18 24, 24 24 L 76 24 C 82 24, 86 30, 86 36 L 86 42 C 86 46, 83 48, 80 48 L 20 48 C 17 48, 14 46, 14 42 Z" fill="#A87850" />
      <Circle cx={26} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={46} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      <Circle cx={66} cy={34} r={1.6} fill="#6B4226" opacity={0.22} />
      {/* 몸통 */}
      <Path d="M18 48 L 82 48 C 82 78, 68 106, 50 106 C 32 106, 18 78, 18 48 Z" fill="#A87850" opacity={0.72} />
      {/* 아기 얼굴 */}
      <Circle cx={42} cy={76} r={1.5} fill="#6B4226" />
      <Circle cx={58} cy={76} r={1.5} fill="#6B4226" />
      <Circle cx={50} cy={82} r={1.8} fill="#E8A5A5" opacity={0.7} />
    </Svg>
  );
}

// ── 낙엽 SVG ─────────────────────────────────

function Leaf({ color = '#9AB87A', size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Path d="M20 5 C 30 8, 34 20, 28 32 C 16 34, 6 22, 12 10 Z" fill={color} />
      <Path d="M20 8 Q 20 20 22 30" stroke="#7A9A5A" strokeWidth={1} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// ── 애니메이션 훅 ──────────────────────────────

function useFadeUp(delay: number) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 700, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 700, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return { opacity, transform: [{ translateY }] };
}

function usePop(delay: number) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const translateY = useRef(new Animated.Value(22)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);
  return { opacity, transform: [{ scale }, { translateY }] };
}

function useSway(fromDeg: string, toDeg: string, duration: number, delay: number) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
        ])
      ),
    ]).start();
  }, []);
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: [fromDeg, toDeg] });
  return { transform: [{ rotate }] };
}

function useLeafFall(delay: number) {
  const translateY = useRef(new Animated.Value(-30)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, { toValue: H + 40, duration: 6000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.6, duration: 600, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0.2, duration: 5400, useNativeDriver: true }),
          ]),
          Animated.timing(rotate, { toValue: 1, duration: 6000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -30, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.timing(rotate, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);
  const rotateStr = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '220deg'] });
  return { opacity, transform: [{ translateY }, { rotate: rotateStr }] };
}

function useDotPulse(delay: number) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        Animated.delay(700 - delay),
      ])
    ).start();
  }, []);
  return { opacity: anim };
}

// ── 메인 스플래시 ──────────────────────────────

interface Props { onFinish: () => void; }

export default function SplashScreen({ onFinish }: Props) {
  const screenOpacity = useRef(new Animated.Value(1)).current;

  // 텍스트 애니메이션
  const kicker = useFadeUp(200);
  const title  = useFadeUp(350);
  const caption = useFadeUp(1500);

  // 도토리 팝 애니메이션
  const pop1 = usePop(800);
  const pop2 = usePop(950);
  const pop3 = usePop(1100);
  const pop4 = usePop(1250);

  // 도토리 흔들기 (팝 이후 시작)
  const sway1 = useSway('-3deg', '2deg', 1400, 1900);
  const sway2 = useSway('-2deg', '3deg', 1600, 2000);
  const sway3 = useSway('4deg', '9deg', 1250, 2100);
  const walk4 = useSway('-1deg', '1deg', 1000, 2200);

  // 낙엽
  const leaf1 = useLeafFall(600);
  const leaf2 = useLeafFall(2600);
  const leaf3 = useLeafFall(4200);

  // 로딩 도트
  const dot1 = useDotPulse(0);
  const dot2 = useDotPulse(200);
  const dot3 = useDotPulse(400);

  // 전체 화면 페이드아웃 → onFinish
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0, duration: 400, useNativeDriver: true,
      }).start(() => onFinish());
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[s.container, { opacity: screenOpacity }]}>

      {/* 낙엽 */}
      <Animated.View style={[s.leaf, { left: W * 0.14 }, leaf1]}>
        <Leaf color="#9AB87A" size={20} />
      </Animated.View>
      <Animated.View style={[s.leaf, { left: W * 0.84 }, leaf2]}>
        <Leaf color="#C8A47A" size={16} />
      </Animated.View>
      <Animated.View style={[s.leaf, { left: W * 0.35 }, leaf3]}>
        <Leaf color="#B4C98A" size={14} />
      </Animated.View>

      {/* 상단: 키커 + 타이틀 */}
      <View style={s.topBlock}>
        <Animated.Text style={[s.kicker, kicker]}>TOGETHER SINCE TODAY</Animated.Text>
        <Animated.Text style={[s.title, title]}>도토리</Animated.Text>
      </View>

      {/* 도토리 가족 + 지평선 */}
      <View style={s.horizon}>
        {/* 도토리 행 */}
        <View style={s.acornRow}>
          {/* 자녀 1 */}
          <Animated.View style={[{ transform: [{ rotate: '-4deg' }] }, pop1]}>
            <Animated.View style={sway1}>
              <AcornChild1 />
            </Animated.View>
          </Animated.View>

          {/* 부모 (제일 큼) */}
          <Animated.View style={pop2}>
            <Animated.View style={sway2}>
              <AcornParent />
            </Animated.View>
          </Animated.View>

          {/* 자녀 2 */}
          <Animated.View style={[{ transform: [{ rotate: '5deg' }] }, pop3]}>
            <Animated.View style={sway3}>
              <AcornChild2 />
            </Animated.View>
          </Animated.View>

          {/* 자녀 3 (막내) */}
          <Animated.View style={pop4}>
            <Animated.View style={walk4}>
              <AcornChild3 />
            </Animated.View>
          </Animated.View>
        </View>

        {/* 지평선 */}
        <View style={s.horizonLine} />
        <View style={s.ground} />
      </View>

      {/* 하단 캡션 */}
      <Animated.Text style={[s.captionText, caption]}>
        한 알 한 알, 우리 집 이야기
      </Animated.Text>

      {/* 로딩 도트 */}
      <View style={s.dots}>
        <Animated.View style={[s.dot, dot1]} />
        <Animated.View style={[s.dot, dot2]} />
        <Animated.View style={[s.dot, dot3]} />
      </View>

    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FDF6EC',
    zIndex: 999,
  },
  leaf: {
    position: 'absolute',
    top: 0,
    zIndex: 10,
  },
  topBlock: {
    position: 'absolute',
    top: H * 0.16,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  kicker: {
    fontSize: 11,
    color: '#A87850',
    fontWeight: '700',
    letterSpacing: 4,
    marginBottom: 12,
  },
  title: {
    fontSize: Math.min(84, W * 0.18),
    fontWeight: '900',
    color: '#5C3D1E',
    letterSpacing: -2.5,
    lineHeight: Math.min(84, W * 0.18) * 1.1,
  },
  horizon: {
    position: 'absolute',
    bottom: H * 0.26,
    left: 0,
    right: 0,
  },
  acornRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 30,
    marginBottom: -2,
  },
  horizonLine: {
    height: 1.5,
    backgroundColor: '#A87850',
    opacity: 0.35,
    marginHorizontal: 0,
  },
  ground: {
    height: 80,
    opacity: 0.35,
    backgroundColor: '#DEC8A8',
    // gradient 효과는 LinearGradient 없이 단색으로 대체
  },
  captionText: {
    position: 'absolute',
    bottom: H * 0.12,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 14,
    color: '#8B5E3C',
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  dots: {
    position: 'absolute',
    bottom: H * 0.08,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8B5E3C',
  },
});
