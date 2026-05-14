// 프로필 설정 화면 (회원가입 직후 1회)
// - 닉네임 입력만 받고 다음으로 넘어감
// - 역할(owner/member) 선택 없음: 누구나 가족을 만들고 나중에 초대 가능

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation';
import { theme } from '../../theme';
import TextField from '../../components/design-system/TextField';
import PrimaryButton from '../../components/design-system/PrimaryButton';

const AcornMark = ({ size = 48 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 52 60" fill="none">
    <Path d="M12 30 Q11 52 26 52 Q41 52 40 30 Z" fill={theme.colors.brand} />
    <Rect x="8" y="18" width="36" height="16" rx="7" fill={theme.colors.warm.deep} />
    <Circle cx="17" cy="26" r="1.5" fill="rgba(255,255,255,0.22)" />
    <Circle cx="26" cy="26" r="1.5" fill="rgba(255,255,255,0.22)" />
    <Circle cx="35" cy="26" r="1.5" fill="rgba(255,255,255,0.22)" />
    <Path d="M26 18 Q29 11 33 7" stroke={theme.colors.warm.deep} strokeWidth="2.5" strokeLinecap="round" />
  </Svg>
);

type NavProp = NativeStackNavigationProp<RootStackParamList, 'ProfileSetup'>;
type RouteType = RouteProp<RootStackParamList, 'ProfileSetup'>;

const ProfileSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const [userId, setUserId] = useState<string>(route.params?.userId ?? '');
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

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

          <TextField
            label="닉네임"
            labelHint={`${nickname.length} / 10자`}
            value={nickname}
            onChangeText={setNickname}
            placeholder="예: 도토리, 아내, 남편"
            autoCorrect={false}
            maxLength={10}
            returnKeyType="done"
            autoFocus
          />

          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              <AcornMark size={48} />
            </View>
            {nickname.trim() ? (
              <Text style={styles.avatarName}>{nickname.trim()}</Text>
            ) : null}
          </View>

          <View style={styles.btnWrap}>
            <PrimaryButton
              label="다음"
              onPress={handleNext}
              loading={saving}
            />
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.bg },
  content: { flex: 1, padding: theme.spacing.screenHorizontal, paddingTop: 48 },

  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.warm.dark,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xxl + theme.spacing.sm,
  },

  avatarWrap: { alignItems: 'center', marginTop: 28, marginBottom: theme.spacing.sm },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.bg,
    borderWidth: 2, borderColor: theme.colors.warm.edge,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarName: {
    marginTop: 10,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.brand,
  },

  btnWrap: { marginTop: 'auto', marginBottom: theme.spacing.sm },
});

export default ProfileSetupScreen;
