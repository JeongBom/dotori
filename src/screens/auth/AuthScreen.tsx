// 로그인 / 회원가입 화면
// - 로그인: 이메일 + 비밀번호
// - 회원가입: 이메일 + 비밀번호 + 닉네임 한 번에 입력
// - 회원가입 완료 → 이메일 인증 안내 → 인증 후 자동으로 FamilySetup 이동

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation';
import { theme } from '../../theme';
import TextField from '../../components/design-system/TextField';
import PrimaryButton from '../../components/design-system/PrimaryButton';
import TextButton from '../../components/design-system/TextButton';
import SegmentedControl from '../../components/design-system/SegmentedControl';

// ── 도토리 마크 SVG ────────────────────────────

const AcornMark = ({ size = 52 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 52 60" fill="none">
    <Path d="M12 30 Q11 52 26 52 Q41 52 40 30 Z" fill={theme.colors.brand} />
    <Rect x="8" y="18" width="36" height="16" rx="7" fill={theme.colors.warm.deep} />
    <Circle cx="17" cy="26" r="1.5" fill="rgba(255,255,255,0.22)" />
    <Circle cx="26" cy="26" r="1.5" fill="rgba(255,255,255,0.22)" />
    <Circle cx="35" cy="26" r="1.5" fill="rgba(255,255,255,0.22)" />
    <Path d="M26 18 Q29 11 33 7" stroke={theme.colors.warm.deep} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

// ── 봉투 SVG (이메일 인증 대기용) ──────────────

const EnvelopeSvg = () => (
  <Svg width="80" height="80" viewBox="0 0 80 80" fill="none">
    <Rect x="8" y="20" width="64" height="44" rx="6" fill={theme.colors.warm.edge} />
    <Rect x="8" y="20" width="64" height="44" rx="6" stroke={theme.colors.brand} strokeWidth="2" />
    <Path d="M8 26 L40 48 L72 26" stroke={theme.colors.brand} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="58" cy="22" r="11" fill={theme.colors.status.danger} />
    <Path d="M58 16.5 L58 23" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    <Circle cx="58" cy="27" r="1.8" fill="#fff" />
  </Svg>
);

// ── 타입 ───────────────────────────────────────

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type AuthTab = 'login' | 'signup';

// ── 메인 컴포넌트 ──────────────────────────────

const AuthScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [tab, setTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const pendingPassword = useRef('');

  // 다른 기기에서 인증한 경우 자동 감지 (3초마다 세션 확인)
  useEffect(() => {
    if (!pendingEmail) return;
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) clearInterval(interval);
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingEmail]);

  const switchTab = (t: AuthTab) => {
    setTab(t);
    setEmail('');
    setPassword('');
    setPasswordConfirm('');
    setNickname('');
  };

  // ── 로그인 ──────────────────────────────────

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        Alert.alert('로그인 실패', '이메일 또는 비밀번호를 확인해주세요.');
      } else if (error.message.includes('Email not confirmed')) {
        Alert.alert('알림', '이메일 인증이 필요해요.\n받은 메일함을 확인해주세요.');
      } else {
        Alert.alert('오류', error.message);
      }
    }
  };

  // ── 회원가입 ─────────────────────────────────

  const handleSignup = async () => {
    if (!email.trim() || !password || !passwordConfirm || !nickname.trim()) {
      Alert.alert('알림', '모든 항목을 입력해주세요.');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('알림', '비밀번호가 일치하지 않아요.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('알림', '비밀번호는 6자 이상이어야 해요.');
      return;
    }
    if (nickname.trim().length > 10) {
      Alert.alert('알림', '닉네임은 10자 이내로 입력해주세요.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: 'https://jeongbom.github.io/dotori/auth-callback.html',
        data: { nickname: nickname.trim() },
      },
    });

    if (error) {
      setLoading(false);
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        Alert.alert('알림', '이미 가입된 이메일이에요. 로그인해주세요.');
      } else {
        Alert.alert('오류', error.message);
      }
      return;
    }

    if (data.user?.identities?.length === 0) {
      setLoading(false);
      Alert.alert('알림', '이미 가입된 이메일이에요. 로그인해주세요.');
      return;
    }

    if (!data.user) {
      setLoading(false);
      Alert.alert('오류', '회원가입에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    setLoading(false);

    if (!data.session) {
      pendingPassword.current = password;
      setPendingEmail(email.trim().toLowerCase());
    }
  };

  // ── 이메일 인증 대기 화면 ───────────────────

  if (pendingEmail) {
    const handleCheckVerified = async () => {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: pendingEmail,
        password: pendingPassword.current,
      });
      setLoading(false);
      if (error) {
        Alert.alert('아직 인증 전이에요', '메일함에서 링크를 클릭한 후 다시 눌러주세요.');
      }
    };

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pendingBox}>
          <EnvelopeSvg />
          <Text style={styles.pendingTitle}>이메일을 확인해주세요</Text>
          <Text style={styles.pendingDesc}>
            <Text style={{ fontWeight: theme.fontWeight.bold, color: theme.colors.warm.dark }}>{pendingEmail}</Text>
            {'\n'}로 인증 메일을 보냈어요.{'\n\n'}
            <Text style={{ color: theme.colors.warm.lightOak }}>
              1. 메일함에서 인증 링크를 클릭하세요{'\n'}
              2. 앱으로 돌아와 아래 버튼을 눌러주세요
            </Text>
          </Text>
          <View style={styles.pendingActions}>
            <PrimaryButton
              label="인증 완료했어요"
              onPress={handleCheckVerified}
              loading={loading}
            />
            <TextButton
              label="로그인으로 돌아가기"
              onPress={() => setPendingEmail(null)}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── 로그인 / 회원가입 폼 ────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* 로고 */}
          <View style={styles.logoArea}>
            <AcornMark size={52} />
            <Text style={styles.appName}>도토리</Text>
            <Text style={styles.appDesc}>가족이 함께 쓰는 홈 매니저</Text>
          </View>

          {/* 탭 */}
          <View style={styles.segRow}>
            <SegmentedControl
              options={[
                { label: '로그인', value: 'login' },
                { label: '회원가입', value: 'signup' },
              ]}
              value={tab}
              onChange={(v) => switchTab(v as AuthTab)}
            />
          </View>

          {/* 폼 카드 */}
          <View style={styles.card}>

            <TextField
              label="이메일"
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <TextField
              label="비밀번호"
              value={password}
              onChangeText={setPassword}
              placeholder="6자 이상"
              secureTextEntry
              returnKeyType="next"
            />

            {tab === 'signup' && (
              <>
                <TextField
                  label="비밀번호 확인"
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  placeholder="비밀번호를 다시 입력하세요"
                  secureTextEntry
                  returnKeyType="next"
                />

                <TextField
                  label="닉네임"
                  labelHint={`${nickname.length} / 10자`}
                  value={nickname}
                  onChangeText={setNickname}
                  placeholder="예: 도토리, 아내, 남편"
                  autoCorrect={false}
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                />
              </>
            )}

            <PrimaryButton
              label={tab === 'login' ? '로그인' : '회원가입'}
              onPress={tab === 'login' ? handleLogin : handleSignup}
              loading={loading}
            />

            {tab === 'login' && (
              <TextButton
                label="비밀번호를 잊으셨나요?"
                onPress={() => navigation.navigate('ForgotPassword')}
              />
            )}

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.bg },
  content: {
    paddingHorizontal: theme.spacing.screenHorizontal,
    paddingTop: 36,
    paddingBottom: 60,
  },

  // 로고
  logoArea: { alignItems: 'center', marginBottom: 36 },
  appName: {
    fontSize: 30,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.warm.dark,
    letterSpacing: -0.6,
    marginTop: 10,
  },
  appDesc: {
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },

  // 탭 컨트롤
  segRow: { marginBottom: 20 },

  // 폼 카드
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 22,
    gap: theme.spacing.cardGap,
    shadowColor: theme.colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  // 이메일 인증 대기
  pendingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxl,
  },
  pendingTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.warm.dark,
    marginTop: 28,
    marginBottom: 14,
    textAlign: 'center',
  },
  pendingDesc: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 36,
  },
  pendingActions: {
    width: '100%',
    gap: theme.spacing.sm,
  },
});

export default AuthScreen;
