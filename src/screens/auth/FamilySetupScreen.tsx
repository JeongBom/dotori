// 가족 설정 화면
// - 기본: 가족 이름 입력 → 생성 → 초대 코드 표시 (혼자도 바로 시작 가능)
// - "이미 초대 코드가 있어요" 링크로 참여 모드로 전환 가능
// - 초대 코드는 나중에 설정에서도 언제든 볼 수 있음

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp } from '@react-navigation/native';

import { supabase, joinFamily } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation';

type RouteType = RouteProp<RootStackParamList, 'FamilySetup'>;

type Mode = 'create' | 'join';

const FamilySetupScreen: React.FC = () => {
  const route = useRoute<RouteType>();
  const [userId, setUserId] = useState<string>(route.params?.userId ?? '');
  const [mode, setMode] = useState<Mode>('create');

  // params 없이 진입한 경우(로그인 후 자동 전환) → 세션에서 직접 조회
  useEffect(() => {
    if (!userId) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
    }
  }, []);

  // family_id 설정 완료 → updateUser로 USER_UPDATED 이벤트 발생
  // → AppNavigator의 onAuthStateChange가 감지 → loadProfile → MainTabs 전환
  const handleDone = async () => {
    await supabase.auth.updateUser({ data: { setup_complete: true } });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {mode === 'create'
        ? <CreateFamily userId={userId} onDone={handleDone} onSwitchToJoin={() => setMode('join')} />
        : <JoinFamily userId={userId} onDone={handleDone} onSwitchToCreate={() => setMode('create')} />
      }
    </SafeAreaView>
  );
};

// ── 가족 만들기 ────────────────────────────────

interface CreateFamilyProps {
  userId: string;
  onDone: () => void;
  onSwitchToJoin: () => void;
}

const CreateFamily: React.FC<CreateFamilyProps> = ({ userId, onDone, onSwitchToJoin }) => {
  const [familyName, setFamilyName] = useState('우리 가족');
  const [saving, setSaving] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!familyName.trim()) {
      Alert.alert('알림', '가족 이름을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const { data: family, error: familyError } = await supabase
        .from('families')
        .insert({ name: familyName.trim() })
        .select()
        .single();

      if (familyError) throw familyError;

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ family_id: family.id, role: 'owner' })
        .eq('id', userId);

      if (profileError) throw profileError;

      setInviteCode(family.invite_code);
    } catch (e) {
      Alert.alert('오류', '가족 생성에 실패했습니다.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!inviteCode) return;
    await Share.share({ message: `도토리 초대 코드: ${inviteCode}` });
  };

  // 가족 생성 완료 → 초대 코드 표시
  if (inviteCode) {
    return (
      <View style={styles.content}>
        <Text style={styles.title}>시작할 준비가 됐어요! 🎉</Text>
        <Text style={styles.subtitle}>
          혼자 써도 되고, 파트너에게 코드를 공유하면{'\n'}함께 사용할 수 있어요
        </Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>초대 코드</Text>
          <Text style={styles.codeText}>{inviteCode}</Text>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareBtnText}>코드 공유하기</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.codeHint}>
          코드는 설정 화면에서도 언제든 확인할 수 있어요
        </Text>

        <TouchableOpacity style={styles.startBtn} onPress={onDone}>
          <Text style={styles.startBtnText}>시작하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.content}>
      <Text style={styles.title}>가족 이름을 정해요 🏠</Text>
      <Text style={styles.subtitle}>혼자 시작해도 괜찮아요{'\n'}나중에 파트너를 초대할 수 있어요</Text>

      <Text style={styles.label}>가족 이름</Text>
      <TextInput
        style={styles.input}
        value={familyName}
        onChangeText={setFamilyName}
        placeholder="우리 가족"
        placeholderTextColor="#C49A6C"
        autoCorrect={false}
        maxLength={20}
        returnKeyType="done"
        autoFocus
      />

      <TouchableOpacity
        style={[styles.startBtn, saving && { opacity: 0.5 }]}
        onPress={handleCreate}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={styles.startBtnText}>시작하기</Text>
        }
      </TouchableOpacity>

      {/* 이미 코드가 있으면 참여 모드로 전환 */}
      <TouchableOpacity style={styles.switchLink} onPress={onSwitchToJoin}>
        <Text style={styles.switchLinkText}>이미 초대 코드가 있어요</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── 가족 참여하기 ──────────────────────────────

interface JoinFamilyProps {
  userId: string;
  onDone: () => void;
  onSwitchToCreate: () => void;
}

const JoinFamily: React.FC<JoinFamilyProps> = ({ userId, onDone, onSwitchToCreate }) => {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      Alert.alert('알림', '6자리 초대 코드를 입력해주세요.');
      return;
    }
    setJoining(true);
    try {
      // 먼저 코드로 가족 조회
      const { data: family, error } = await supabase
        .from('families')
        .select('id, name')
        .eq('invite_code', trimmed)
        .single();

      if (error || !family) {
        Alert.alert('알림', '코드를 다시 확인해주세요.\n일치하는 가족을 찾지 못했어요.');
        setJoining(false);
        return;
      }

      // 현재 내 profile 조회 (기존 family_id 파악용)
      const { data: myProfile } = await supabase
        .from('user_profiles')
        .select('family_id')
        .eq('id', userId)
        .single();

      // ⚠️ 합류 전 경고 팝업
      Alert.alert(
        `'${family.name}'에 합류할까요?`,
        '합류하면 내 기존 데이터는 보이지 않게 됩니다.\n가족을 나가면 다시 복구돼요.',
        [
          { text: '취소', style: 'cancel', onPress: () => setJoining(false) },
          {
            text: '합류하기',
            onPress: async () => {
              try {
                const err = await joinFamily(userId, myProfile?.family_id ?? '', family.id);
                if (err) throw err;
                Alert.alert('환영해요! 🎉', `'${family.name}'에 참여했어요.`, [
                  { text: '시작하기', onPress: onDone },
                ]);
              } catch (e) {
                Alert.alert('오류', '참여에 실패했습니다.');
                console.error(e);
              } finally {
                setJoining(false);
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert('오류', '오류가 발생했습니다.');
      console.error(e);
      setJoining(false);
    }
  };

  return (
    <View style={styles.content}>
      <Text style={styles.title}>코드로 참여하기 🤝</Text>
      <Text style={styles.subtitle}>파트너에게 받은 6자리 코드를 입력해요</Text>

      <Text style={styles.label}>초대 코드</Text>
      <TextInput
        style={[styles.input, styles.codeInput]}
        value={code}
        onChangeText={text => setCode(text.toUpperCase())}
        placeholder="A1B2C3"
        placeholderTextColor="#C49A6C"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        returnKeyType="done"
        autoFocus
      />

      <TouchableOpacity
        style={[styles.startBtn, joining && { opacity: 0.5 }]}
        onPress={handleJoin}
        disabled={joining}
      >
        {joining
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={styles.startBtnText}>참여하기</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity style={styles.switchLink} onPress={onSwitchToCreate}>
        <Text style={styles.switchLinkText}>← 가족 새로 만들기</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── 스타일 ─────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  content: { flex: 1, padding: 24, paddingTop: 48 },

  title: { fontSize: 26, fontWeight: '800', color: '#5C3D1E', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8B5E3C', marginBottom: 36, lineHeight: 22 },

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
  codeInput: {
    letterSpacing: 6,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
  },

  // 초대 코드 카드
  codeCard: {
    backgroundColor: '#8B5E3C',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  codeLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  codeText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 8,
  },
  shareBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 4,
  },
  shareBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  codeHint: {
    fontSize: 13,
    color: '#8B5E3C',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 20,
  },

  startBtn: {
    backgroundColor: '#8B5E3C',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 8,
  },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // 모드 전환 링크
  switchLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLinkText: { fontSize: 14, color: '#8B5E3C', fontWeight: '500' },
});

export default FamilySetupScreen;
