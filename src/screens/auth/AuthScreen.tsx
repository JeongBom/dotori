// 로그인 / 회원가입 화면
// - 로그인: 이메일 + 비밀번호
// - 회원가입: 이메일 + 비밀번호 + 닉네임 한 번에 입력
// - 회원가입 완료 → 이메일 인증 안내 → 인증 후 자동으로 FamilySetup 이동

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation';
import { theme } from '../../theme';

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
  const [focused, setFocused] = useState<string | null>(null);
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
    setFocused(null);
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

    await supabase
      .from('user_profiles')
      .insert({ id: data.user.id, nickname: nickname.trim(), role: 'owner', family_id: null });

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
            <Text style={{ fontWeight: '700', color: theme.colors.warm.dark }}>{pendingEmail}</Text>
            {'\n'}로 인증 메일을 보냈어요.{'\n\n'}
            <Text style={{ color: theme.colors.warm.lightOak }}>
              1. 메일함에서 인증 링크를 클릭하세요{'\n'}
              2. 앱으로 돌아와 아래 버튼을 눌러주세요
            </Text>
          </Text>
          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.5 }]}
            onPress={handleCheckVerified}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.submitText}>인증 완료했어요</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setPendingEmail(null)}>
            <Text style={styles.secondaryText}>로그인으로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── 로그인 / 회원가입 폼 ────────────────────

  const inputStyle = (field: string) => [
    styles.input,
    focused === field && styles.inputFocused,
  ];

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
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'login' && styles.tabBtnActive]}
              onPress={() => switchTab('login')}
            >
              <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>로그인</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tab === 'signup' && styles.tabBtnActive]}
              onPress={() => switchTab('signup')}
            >
              <Text style={[styles.tabText, tab === 'signup' && styles.tabTextActive]}>회원가입</Text>
            </TouchableOpacity>
          </View>

          {/* 폼 카드 */}
          <View style={styles.card}>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={inputStyle('email')}
                placeholder="example@email.com"
                placeholderTextColor={theme.colors.warm.edge}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.label}>비밀번호</Text>
              <TextInput
                style={inputStyle('password')}
                placeholder="6자 이상"
                placeholderTextColor={theme.colors.warm.edge}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="next"
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
            </View>

            {tab === 'signup' && (
              <>
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>비밀번호 확인</Text>
                  <TextInput
                    style={inputStyle('passwordConfirm')}
                    placeholder="비밀번호를 다시 입력하세요"
                    placeholderTextColor={theme.colors.warm.edge}
                    value={passwordConfirm}
                    onChangeText={setPasswordConfirm}
                    secureTextEntry
                    returnKeyType="next"
                    onFocus={() => setFocused('passwordConfirm')}
                    onBlur={() => setFocused(null)}
                  />
                </View>

                <View style={styles.fieldWrap}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>닉네임</Text>
                    <Text style={styles.labelHint}>{nickname.length} / 10자</Text>
                  </View>
                  <TextInput
                    style={inputStyle('nickname')}
                    placeholder="예: 도토리, 아내, 남편"
                    placeholderTextColor={theme.colors.warm.edge}
                    value={nickname}
                    onChangeText={setNickname}
                    autoCorrect={false}
                    maxLength={10}
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                    onFocus={() => setFocused('nickname')}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, loading && { opacity: 0.5 }]}
              onPress={tab === 'login' ? handleLogin : handleSignup}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.submitText}>{tab === 'login' ? '로그인' : '회원가입'}</Text>
              }
            </TouchableOpacity>

            {tab === 'login' && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.secondaryText}>비밀번호를 잊으셨나요?</Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.warm.cream },
  content: { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 60 },

  // 로고
  logoArea: { alignItems: 'center', marginBottom: 36 },
  appName: { fontSize: 30, fontWeight: '700', color: theme.colors.warm.dark, letterSpacing: -1, marginTop: 10 },
  appDesc: { fontSize: 13, color: theme.colors.warm.oak, fontWeight: '500', marginTop: 4 },

  // 탭
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.warm.edge,
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 14, fontWeight: '700', color: theme.colors.warm.oak },
  tabTextActive: { color: theme.colors.warm.dark },

  // 카드
  card: {
    backgroundColor: theme.colors.warm.ivory,
    borderRadius: 20,
    padding: 22,
    gap: 14,
    shadowColor: theme.colors.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  // 필드
  fieldWrap: { gap: 0 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.warm.oak, marginBottom: 7 },
  labelHint: { fontSize: 11, color: theme.colors.warm.lightOak, fontWeight: '500' },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: theme.colors.warm.dark,
    borderWidth: 1,
    borderColor: theme.colors.warm.edge,
  },
  inputFocused: {
    borderColor: theme.colors.brand,
    borderWidth: 1.5,
  },

  // 버튼
  submitBtn: {
    backgroundColor: theme.colors.brand,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 10 },
  secondaryText: { fontSize: 13, color: theme.colors.warm.oak, fontWeight: '600' },

  // 이메일 인증 대기
  pendingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 0 },
  pendingTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.warm.dark, marginTop: 28, marginBottom: 14, textAlign: 'center' },
  pendingDesc: { fontSize: 14, color: theme.colors.warm.oak, textAlign: 'center', lineHeight: 26, marginBottom: 36 },
});

export default AuthScreen;
