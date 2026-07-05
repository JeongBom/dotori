// 비밀번호 재설정 화면
// - 이메일 링크 클릭 후 dotori:// 딥링크로 앱 복귀 시 표시
// - 새 비밀번호 입력 → supabase.auth.updateUser()

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';
import { theme } from '../../theme';
import TextField from '../../components/design-system/TextField';

interface ResetPasswordScreenProps {
  onDone: () => void;
}

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ onDone }) => {
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password || !passwordConfirm) {
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

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      // Supabase 실제 에러를 구분해서 안내 (원인 숨기지 않기)
      const msg = /different from the old/i.test(error.message)
        ? '기존 비밀번호와 다른 비밀번호를 입력해주세요.'
        : /session|jwt|token|expired/i.test(error.message)
          ? '링크가 만료됐어요.\n재설정 메일을 다시 요청해주세요.'
          : `비밀번호 변경에 실패했습니다.\n(${error.message})`;
      Alert.alert('오류', msg);
      return;
    }

    Alert.alert('완료', '비밀번호가 변경됐어요.', [
      { text: '로그인하기', onPress: () => { supabase.auth.signOut(); onDone(); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>

          <Text style={styles.emoji}>🔐</Text>
          <Text style={styles.title}>새 비밀번호 설정</Text>
          <Text style={styles.desc}>6자 이상의 새 비밀번호를 입력해주세요.</Text>

          <View style={{ gap: theme.spacing.cardGap }}>
            <TextField
              label="새 비밀번호"
              value={password}
              onChangeText={setPassword}
              placeholder="6자 이상"
              secureTextEntry
              autoFocus
              returnKeyType="next"
            />

            <TextField
              label="비밀번호 확인"
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              placeholder="비밀번호를 다시 입력하세요"
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.5 }]}
            onPress={handleReset}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.submitText}>변경하기</Text>
            }
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.warm.cream },
  content: { flex: 1, padding: 24, paddingTop: 60 },

  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 8 },
  desc: { fontSize: 14, color: theme.colors.brand, lineHeight: 22, marginBottom: 32 },

  submitBtn: {
    backgroundColor: theme.colors.brand,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default ResetPasswordScreen;
