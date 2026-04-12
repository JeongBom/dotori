// 프로필 설정 화면 (회원가입 직후 1회)
// - 닉네임 입력만 받고 다음으로 넘어감
// - 역할(owner/member) 선택 없음: 누구나 가족을 만들고 나중에 초대 가능

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ProfileSetup'>;
type RouteType = RouteProp<RootStackParamList, 'ProfileSetup'>;

const ProfileSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const [userId, setUserId] = useState<string>(route.params?.userId ?? '');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  // params 없이 진입한 경우 (로그인 후 자동 전환) → 직접 세션에서 userId 조회
  useEffect(() => {
    if (!userId) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
    }
  }, []);

  const handleNext = async () => {
    if (!userId) return;
    if (!nickname.trim()) {
      Alert.alert('알림', '닉네임을 입력해주세요.');
      return;
    }
    if (nickname.trim().length > 10) {
      Alert.alert('알림', '닉네임은 10자 이내로 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      // user_profiles 생성 (family_id는 다음 화면에서 설정)
      const { error } = await supabase
        .from('user_profiles')
        .insert({ id: userId, nickname: nickname.trim(), role: 'owner', family_id: null });

      if (error) throw error;

      navigation.navigate('FamilySetup', { userId });
    } catch (e) {
      Alert.alert('오류', '프로필 저장에 실패했습니다.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>

          <Text style={styles.title}>반가워요! 👋</Text>
          <Text style={styles.subtitle}>앱에서 사용할 닉네임을 설정해요</Text>

          <Text style={styles.label}>닉네임</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 도토리, 아내, 남편"
            placeholderTextColor="#C49A6C"
            value={nickname}
            onChangeText={setNickname}
            autoCorrect={false}
            maxLength={10}
            returnKeyType="done"
            autoFocus
          />
          <Text style={styles.inputHint}>{nickname.length} / 10자</Text>

          <TouchableOpacity
            style={[styles.nextBtn, saving && { opacity: 0.5 }]}
            onPress={handleNext}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.nextBtnText}>다음</Text>
            }
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  content: { flex: 1, padding: 24, paddingTop: 48 },

  title: { fontSize: 28, fontWeight: '800', color: '#5C3D1E', marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#8B5E3C', marginBottom: 36 },

  label: { fontSize: 13, fontWeight: '600', color: '#8B5E3C', marginBottom: 10 },
  input: {
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#5C3D1E',
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#DEC8A8',
  },
  inputHint: { fontSize: 12, color: '#D4B896', textAlign: 'right', marginTop: 4 },

  nextBtn: {
    backgroundColor: '#8B5E3C',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 8,
  },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default ProfileSetupScreen;
