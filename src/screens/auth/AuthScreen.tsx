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

import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type AuthTab = 'login' | 'signup';

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
      if (session) clearInterval(interval); // onAuthStateChange가 자동으로 화면 전환
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
    // 성공 시 onAuthStateChange가 자동으로 화면 전환
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

    // 1. Auth 계정 생성
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

    // 이메일 인증 ON 상태에서 중복 이메일 → identities: []
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

    // 2. 닉네임 프로필 즉시 저장 (이메일 인증 전에도 저장 가능)
    await supabase
      .from('user_profiles')
      .insert({ id: data.user.id, nickname: nickname.trim(), role: 'owner', family_id: null });

    setLoading(false);

    if (!data.session) {
      // 이메일 인증 필요 → 안내 화면
      pendingPassword.current = password;
      setPendingEmail(email.trim().toLowerCase());
    } else {
      // 이메일 인증 OFF → onAuthStateChange가 자동 전환
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
      // 성공 시 onAuthStateChange가 자동으로 화면 전환
    };

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pendingBox}>
          <Text style={styles.pendingEmoji}>📬</Text>
          <Text style={styles.pendingTitle}>이메일을 확인해주세요</Text>
          <Text style={styles.pendingDesc}>
            <Text style={{ fontWeight: '700' }}>{pendingEmail}</Text>
            {'\n'}로 인증 메일을 보냈어요.{'\n\n'}
            1. 메일함에서 인증 링크를 클릭하세요{'\n'}
            2. 앱으로 돌아와 아래 버튼을 눌러주세요
          </Text>
          <TouchableOpacity
            style={[styles.verifiedBtn, loading && { opacity: 0.5 }]}
            onPress={handleCheckVerified}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.verifiedBtnText}>인증 완료했어요</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.pendingBackBtn} onPress={() => setPendingEmail(null)}>
            <Text style={styles.pendingBackText}>로그인으로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── 로그인 / 회원가입 폼 ────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          <View style={styles.logoArea}>
            <Text style={styles.logoEmoji}>🌰</Text>
            <Text style={styles.appName}>도토리</Text>
            <Text style={styles.appDesc}>가족이 함께 쓰는 홈 매니저</Text>
          </View>

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

          <View style={styles.card}>

            <Text style={styles.label}>이메일</Text>
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              placeholderTextColor="#C49A6C"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={[styles.label, { marginTop: 16 }]}>비밀번호</Text>
            <TextInput
              style={styles.input}
              placeholder="6자 이상"
              placeholderTextColor="#C49A6C"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
            />

            {tab === 'signup' && (
              <>
                <Text style={[styles.label, { marginTop: 16 }]}>비밀번호 확인</Text>
                <TextInput
                  style={styles.input}
                  placeholder="비밀번호를 다시 입력하세요"
                  placeholderTextColor="#C49A6C"
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  secureTextEntry
                  returnKeyType="next"
                />

                <Text style={[styles.label, { marginTop: 16 }]}>닉네임</Text>
                <TextInput
                  style={styles.input}
                  placeholder="예: 도토리, 아내, 남편 (10자 이내)"
                  placeholderTextColor="#C49A6C"
                  value={nickname}
                  onChangeText={setNickname}
                  autoCorrect={false}
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                />
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
                style={styles.forgotBtn}
                onPress={() => navigation.navigate('ForgotPassword')}
              >
                <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  content: { padding: 24, paddingTop: 40, paddingBottom: 60 },

  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 56, marginBottom: 8 },
  appName: { fontSize: 32, fontWeight: '800', color: '#5C3D1E', letterSpacing: -0.5 },
  appDesc: { fontSize: 14, color: '#8B5E3C', marginTop: 4, fontWeight: '500' },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#EDD9C0',
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 15, fontWeight: '600', color: '#8B5E3C' },
  tabTextActive: { color: '#5C3D1E' },

  card: {
    backgroundColor: '#FFF8F0',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#5C3D1E',
    borderWidth: 1,
    borderColor: '#DEC8A8',
  },
  submitBtn: {
    backgroundColor: '#8B5E3C',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  forgotBtn: { alignItems: 'center', paddingVertical: 14 },
  forgotText: { fontSize: 14, color: '#8B5E3C', fontWeight: '500' },

  pendingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  pendingEmoji: { fontSize: 56, marginBottom: 20 },
  pendingTitle: { fontSize: 22, fontWeight: '800', color: '#5C3D1E', marginBottom: 14 },
  pendingDesc: { fontSize: 15, color: '#8B5E3C', textAlign: 'center', lineHeight: 26, marginBottom: 40 },
  verifiedBtn: {
    backgroundColor: '#8B5E3C',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  verifiedBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  pendingBackBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  pendingBackText: { fontSize: 15, color: '#8B5E3C', fontWeight: '600' },
});

export default AuthScreen;
