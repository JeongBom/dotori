// 비밀번호 찾기 화면
// - 이메일 입력 → Supabase가 재설정 링크 발송
// - 링크 클릭 시 dotori:// 딥링크로 앱 복귀 → ResetPasswordScreen

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
      redirectTo: 'dotori://',
    });
    setLoading(false);

    if (error) {
      Alert.alert('오류', '메일 발송에 실패했습니다. 이메일을 확인해주세요.');
      return;
    }

    setSent(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft color="#8B5E3C" size={24} strokeWidth={1.5} />
          </TouchableOpacity>

          <Text style={styles.title}>비밀번호 재설정</Text>

          {sent ? (
            // ── 발송 완료 ───────────────────────────────
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
            // ── 이메일 입력 ─────────────────────────────
            <>
              <Text style={styles.desc}>
                가입한 이메일을 입력하면{'\n'}
                비밀번호 재설정 링크를 보내드려요.
              </Text>

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
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  content: { flex: 1, padding: 24, paddingTop: 16 },

  backBtn: { marginBottom: 24, alignSelf: 'flex-start', padding: 4 },

  title: { fontSize: 26, fontWeight: '800', color: '#5C3D1E', marginBottom: 8 },
  desc: { fontSize: 14, color: '#8B5E3C', lineHeight: 22, marginBottom: 32 },

  label: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginBottom: 8 },
  input: {
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#5C3D1E',
    borderWidth: 1,
    borderColor: '#DEC8A8',
    marginBottom: 24,
  },

  submitBtn: {
    backgroundColor: '#8B5E3C',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // 발송 완료
  sentBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
  sentEmoji: { fontSize: 56, marginBottom: 16 },
  sentTitle: { fontSize: 22, fontWeight: '800', color: '#5C3D1E', marginBottom: 12 },
  sentDesc: { fontSize: 15, color: '#8B5E3C', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  backToLoginBtn: { paddingVertical: 12, paddingHorizontal: 24 },
  backToLoginText: { fontSize: 15, color: '#8B5E3C', fontWeight: '600' },
});

export default ForgotPasswordScreen;
