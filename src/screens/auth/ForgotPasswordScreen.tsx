// 비밀번호 찾기 화면
// - 이메일 입력 → Supabase가 재설정 링크 발송
// - 링크 클릭 시 웹은 현재 도메인, 네이티브는 dotori:// 딥링크로 앱 복귀 → ResetPasswordScreen

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft } from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation';
import { theme } from '../../theme';

// RN 타입 환경에는 DOM 타입이 없어서 필요한 부분만 선언 (webAlert.ts와 같은 패턴)
declare const window: { location: { origin: string } };

// 재설정 링크가 돌아올 주소 — 웹(PWA)은 지금 접속한 도메인, 네이티브 앱은 딥링크
const getRedirectTo = (): string =>
  Platform.OS === 'web' ? window.location.origin : 'dotori://';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('알림', '이메일을 입력해주세요.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: getRedirectTo(),
    });
    setLoading(false);

    if (error) {
      // Supabase 실제 에러를 구분해서 안내 (원인 숨기지 않기)
      const msg = error.status === 429 || /rate limit/i.test(error.message)
        ? '메일 발송 한도에 걸렸어요.\n1시간 뒤에 다시 시도해주세요.'
        : /security purposes|seconds/i.test(error.message)
          ? '요청이 너무 잦아요.\n1분 뒤에 다시 시도해주세요.'
          : `메일 발송에 실패했습니다.\n(${error.message})`;
      Alert.alert('오류', msg);
      return;
    }

    setSent(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft color={theme.colors.brand} size={24} strokeWidth={1.5} />
          </TouchableOpacity>

          <Text style={styles.title}>비밀번호 재설정</Text>

          {sent ? (
            <View style={styles.sentBox}>
              <Text style={styles.sentEmoji}>📬</Text>
              <Text style={styles.sentTitle}>메일을 확인해주세요</Text>
              <Text style={styles.sentDesc}>
                {email.trim()}{'으로\n'}
                비밀번호 재설정 링크를 보냈어요.{'\n'}
                링크를 클릭하면 앱으로 돌아와요.
              </Text>
              <TouchableOpacity style={styles.backToLoginBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.backToLoginText}>로그인으로 돌아가기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.desc}>
                가입한 이메일을 입력하면{'\n'}
                비밀번호 재설정 링크를 보내드려요.
              </Text>

              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={styles.input}
                placeholder="example@email.com"
                placeholderTextColor={theme.colors.warm.lightOak}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSend}
              />

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.5 }]}
                onPress={handleSend}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.submitText}>재설정 메일 보내기</Text>
                }
              </TouchableOpacity>
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.warm.cream },
  content: { flex: 1, padding: 24, paddingTop: 16 },

  backBtn: { marginBottom: 24, alignSelf: 'flex-start', padding: 4 },

  title: { fontSize: 26, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 8 },
  desc: { fontSize: 14, color: theme.colors.brand, lineHeight: 22, marginBottom: 32 },

  label: { fontSize: 13, fontWeight: '600', color: theme.colors.brand, marginBottom: 8 },
  input: {
    backgroundColor: theme.colors.warm.ivory,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: theme.colors.warm.dark,
    borderWidth: 1,
    borderColor: theme.colors.warm.edge,
    marginBottom: 24,
  },

  submitBtn: {
    backgroundColor: theme.colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  sentBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  sentEmoji: { fontSize: 56, marginBottom: 16 },
  sentTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 12 },
  sentDesc: { fontSize: 15, color: theme.colors.brand, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  backToLoginBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  backToLoginText: { fontSize: 15, color: theme.colors.brand, fontWeight: '600' },
});

export default ForgotPasswordScreen;
