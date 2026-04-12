// 설정 화면
// - 닉네임 / 가족 이름 수정
// - 유통기한 알림 설정
// - 초대 코드 확인 및 공유
// - 초대 코드로 가족 참여 (기존 데이터 소프트 삭제)
// - 가족 나가기 (기존 데이터 복구)

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
  ScrollView,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { User, Bell, ChevronLeft, Check, Users, LogOut } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId, joinFamily, leaveFamily } from '../lib/supabase';
import { UserProfile } from '../types';
import { RootStackParamList } from '../navigation';

type SettingsNav = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export const STORAGE_KEY_FAMILY_NAME      = '@home_manager:family_name';
export const STORAGE_KEY_NICKNAME         = '@home_manager:nickname';
export const STORAGE_KEY_NOTIFY_DAYS      = '@home_manager:notify_days_before';
export const STORAGE_KEY_ENABLED_FEATURES = '@home_manager:enabled_features';

export const ALL_FEATURES = ['Fridge', 'Supplies', 'Finance', 'Chores'] as const;
type FeatureKey = typeof ALL_FEATURES[number];

const FEATURE_LABELS: Record<FeatureKey, string> = {
  Fridge:   '음식',
  Supplies: '생필품',
  Finance:  '자산',
  Chores:   '루틴',
};

const NOTIFY_OPTIONS = [1, 2, 3, 5, 7] as const;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsNav>();

  const [familyName, setFamilyName] = useState('우리 가족');
  const [nickname, setNickname]     = useState('');
  const [notifyDays, setNotifyDays] = useState<1|2|3|5|7>(3);
  const [familyId, setFamilyId]     = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [profile, setProfile]       = useState<UserProfile | null>(null);
  const [saved, setSaved]           = useState(false);

  // 기능 활성화 상태
  const [enabledFeatures, setEnabledFeatures] = useState<string[]>([...ALL_FEATURES]);

  // 가족 참여 관련 상태
  const [joinCode, setJoinCode]     = useState('');
  const [joining, setJoining]       = useState(false);
  const [leaving, setLeaving]       = useState(false);

  // 초기 로드
  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const storedNickname = await AsyncStorage.getItem(STORAGE_KEY_NICKNAME);
    const storedDays     = await AsyncStorage.getItem(STORAGE_KEY_NOTIFY_DAYS);
    const storedFeatures = await AsyncStorage.getItem(STORAGE_KEY_ENABLED_FEATURES);
    if (storedNickname) setNickname(storedNickname);
    if (storedDays)     setNotifyDays(parseInt(storedDays) as 1|2|3|5|7);
    if (storedFeatures) setEnabledFeatures(JSON.parse(storedFeatures));

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (prof) {
        setProfile(prof as UserProfile);
        setNickname(prof.nickname ?? storedNickname ?? '');
      }
    }

    const fid = await getOrCreateFamilyId();
    if (fid) {
      setFamilyId(fid);
      const { data: famData } = await supabase
        .from('families')
        .select('name, invite_code')
        .eq('id', fid)
        .single();
      if (famData) {
        setFamilyName(famData.name);
        setInviteCode(famData.invite_code ?? null);
      }
      const { data: settings } = await supabase
        .from('user_settings')
        .select('notify_days_before')
        .eq('family_id', fid)
        .maybeSingle();
      if (settings) {
        setNotifyDays(settings.notify_days_before as 1|2|3|5|7);
        await AsyncStorage.setItem(STORAGE_KEY_NOTIFY_DAYS, String(settings.notify_days_before));
      }
    }
  };

  const handleSave = async () => {
    if (!familyName.trim()) { Alert.alert('알림', '가족 이름을 입력해주세요.'); return; }

    await AsyncStorage.setItem(STORAGE_KEY_FAMILY_NAME, familyName.trim());
    await AsyncStorage.setItem(STORAGE_KEY_NICKNAME, nickname.trim());
    await AsyncStorage.setItem(STORAGE_KEY_NOTIFY_DAYS, String(notifyDays));

    if (familyId) {
      await supabase.from('families').update({ name: familyName.trim() }).eq('id', familyId);
      await supabase.from('user_settings').upsert(
        { family_id: familyId, notify_days_before: notifyDays },
        { onConflict: 'family_id' },
      );
    }
    if (profile) {
      await supabase.from('user_profiles').update({ nickname: nickname.trim() }).eq('id', profile.id);
    }

    setSaved(true);
    setTimeout(() => { setSaved(false); navigation.goBack(); }, 800);
  };

  const handleToggleFeature = async (key: string) => {
    const next = enabledFeatures.includes(key)
      ? enabledFeatures.filter(f => f !== key)
      : [...enabledFeatures, key];
    // 최소 1개는 활성화 유지
    if (next.length === 0) return;
    setEnabledFeatures(next);
    await AsyncStorage.setItem(STORAGE_KEY_ENABLED_FEATURES, JSON.stringify(next));
  };

  const handleNotifyDayChange = async (days: 1|2|3|5|7) => {
    setNotifyDays(days);
    await AsyncStorage.setItem(STORAGE_KEY_NOTIFY_DAYS, String(days));
    if (familyId) {
      await supabase.from('user_settings').upsert(
        { family_id: familyId, notify_days_before: days },
        { onConflict: 'family_id' },
      );
    }
  };

  // ── 초대 코드로 가족 참여 ──────────────────────

  const handleJoin = async () => {
    const trimmed = joinCode.trim().toUpperCase();
    if (trimmed.length !== 6) {
      Alert.alert('알림', '6자리 초대 코드를 입력해주세요.');
      return;
    }

    const { data: targetFamily, error } = await supabase
      .from('families')
      .select('id, name')
      .eq('invite_code', trimmed)
      .single();

    if (error || !targetFamily) {
      Alert.alert('알림', '코드를 다시 확인해주세요.\n일치하는 가족을 찾지 못했어요.');
      return;
    }

    if (targetFamily.id === familyId) {
      Alert.alert('알림', '이미 이 가족에 속해 있어요.');
      return;
    }

    Alert.alert(
      `'${targetFamily.name}'에 합류할까요?`,
      '합류하면 내 기존 데이터는 보이지 않게 됩니다.\n가족을 나가면 다시 복구돼요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '합류하기',
          onPress: async () => {
            if (!profile || !familyId) return;
            setJoining(true);
            try {
              const err = await joinFamily(profile.id, familyId, targetFamily.id);
              if (err) throw err;
              Alert.alert('완료', `'${targetFamily.name}'에 합류했어요.`);
              setJoinCode('');
              await loadAll();
            } catch (e) {
              Alert.alert('오류', '합류에 실패했습니다.');
              console.error(e);
            } finally {
              setJoining(false);
            }
          },
        },
      ],
    );
  };

  // ── 가족 나가기 ───────────────────────────────

  const handleLeaveFamily = () => {
    if (!profile?.personal_family_id) return;

    Alert.alert(
      '가족 나가기',
      '나가면 이 가족의 공유 데이터가 보이지 않아요.\n내 기존 데이터는 복구돼요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true);
            try {
              const err = await leaveFamily(profile.id, profile.personal_family_id!);
              if (err) throw err;
              await loadAll();
            } catch (e) {
              Alert.alert('오류', '가족 나가기에 실패했습니다.');
              console.error(e);
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  };

  // ── 렌더 ────────────────────────────────────

  const isInOtherFamily = !!profile?.personal_family_id;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft color="#5C3D1E" size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>설정</Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          {saved
            ? <Check color="#8B5E3C" size={22} strokeWidth={2.5} />
            : <Text style={styles.saveText}>저장</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>

          {/* ── 계정 정보 ── */}
          <View style={styles.sectionHeader}>
            <User color="#8B5E3C" size={16} strokeWidth={1.8} />
            <Text style={styles.sectionTitle}>계정 정보</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>가족 이름</Text>
              <TextInput
                style={styles.input} value={familyName} onChangeText={setFamilyName}
                placeholder="우리 가족" placeholderTextColor="#C49A6C" maxLength={20}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>내 닉네임</Text>
              <TextInput
                style={styles.input} value={nickname} onChangeText={setNickname}
                placeholder="예) 엄마, 아빠, 홍길동" placeholderTextColor="#C49A6C" maxLength={12}
              />
            </View>
          </View>

          {/* ── 초대 코드 ── */}
          {inviteCode && !isInOtherFamily && (
            <>
              <View style={styles.sectionHeader}>
                <Users color="#8B5E3C" size={16} strokeWidth={1.8} />
                <Text style={styles.sectionTitle}>가족 초대</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>초대 코드</Text>
                  <Text style={styles.fieldDesc}>파트너에게 코드를 공유하면 함께 앱을 사용할 수 있어요</Text>
                  <View style={styles.inviteRow}>
                    <Text style={styles.inviteCode}>{inviteCode}</Text>
                    <TouchableOpacity
                      style={styles.shareBtn}
                      onPress={() => Share.share({ message: `도토리 초대 코드: ${inviteCode}` })}
                    >
                      <Text style={styles.shareBtnText}>공유</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* ── 가족 참여 (코드 입력) ── */}
          {!isInOtherFamily && (
            <>
              <View style={styles.sectionHeader}>
                <Users color="#8B5E3C" size={16} strokeWidth={1.8} />
                <Text style={styles.sectionTitle}>다른 가족에 참여</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>초대 코드 입력</Text>
                  <Text style={styles.fieldDesc}>파트너에게 받은 코드를 입력하면 가족에 합류해요</Text>
                  <View style={styles.joinRow}>
                    <TextInput
                      style={styles.joinInput}
                      value={joinCode}
                      onChangeText={text => setJoinCode(text.toUpperCase())}
                      placeholder="A1B2C3"
                      placeholderTextColor="#C49A6C"
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={6}
                    />
                    <TouchableOpacity
                      style={[styles.joinBtn, joining && { opacity: 0.5 }]}
                      onPress={handleJoin}
                      disabled={joining}
                    >
                      {joining
                        ? <ActivityIndicator color="#FFFFFF" size="small" />
                        : <Text style={styles.joinBtnText}>참여</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* ── 알림 설정 ── */}
          <View style={styles.sectionHeader}>
            <Bell color="#8B5E3C" size={16} strokeWidth={1.8} />
            <Text style={styles.sectionTitle}>알림 설정</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>유통기한 알림</Text>
              <Text style={styles.fieldDesc}>선택한 일수 전에 푸시 알림을 받아요</Text>
              <View style={styles.notifyRow}>
                {NOTIFY_OPTIONS.map(d => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.notifyChip, notifyDays === d && styles.notifyChipActive]}
                    onPress={() => handleNotifyDayChange(d)}
                  >
                    <Text style={[styles.notifyChipText, notifyDays === d && styles.notifyChipTextActive]}>
                      {d}일 전
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* ── 기능 설정 ── */}
          <View style={styles.sectionHeader}>
            <Bell color="#8B5E3C" size={16} strokeWidth={1.8} />
            <Text style={styles.sectionTitle}>사용할 기능</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldDesc}>사용할 기능을 선택하면 하단 탭과 홈 화면에 반영돼요</Text>
              <View style={styles.featureGrid}>
                {(ALL_FEATURES as readonly string[]).map((key) => {
                  const isOn = enabledFeatures.includes(key);
                  const isLast = enabledFeatures.length === 1 && isOn;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.featureChip, isOn && styles.featureChipActive]}
                      onPress={() => handleToggleFeature(key)}
                      activeOpacity={isLast ? 1 : 0.7}
                    >
                      <Text style={[styles.featureChipText, isOn && styles.featureChipTextActive]}>
                        {FEATURE_LABELS[key as FeatureKey]}
                      </Text>
                      {isOn && <Check color="#FFFFFF" size={13} strokeWidth={2.5} style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── 가족 나가기 (다른 가족에 합류한 경우만 표시) ── */}
          {isInOtherFamily && (
            <>
              <View style={styles.sectionHeader}>
                <LogOut color="#D95F4B" size={16} strokeWidth={1.8} />
                <Text style={[styles.sectionTitle, { color: '#D95F4B' }]}>가족 나가기</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldDesc}>
                    나가면 이 가족의 공유 데이터가 보이지 않아요.{'\n'}
                    내 기존 데이터는 자동으로 복구돼요.
                  </Text>
                  <TouchableOpacity
                    style={[styles.leaveBtn, leaving && { opacity: 0.5 }]}
                    onPress={handleLeaveFamily}
                    disabled={leaving}
                  >
                    {leaving
                      ? <ActivityIndicator color="#D95F4B" size="small" />
                      : <Text style={styles.leaveBtnText}>가족 나가기</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* ── 계정 ── */}
          <View style={styles.sectionHeader}>
            <LogOut color="#8B5E3C" size={16} strokeWidth={1.8} />
            <Text style={styles.sectionTitle}>계정</Text>
          </View>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => {
                Alert.alert('로그아웃', '로그아웃 하시겠어요?', [
                  { text: '취소', style: 'cancel' },
                  { text: '로그아웃', onPress: () => supabase.auth.signOut() },
                ]);
              }}
            >
              <Text style={styles.logoutText}>로그아웃</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#DEC8A8',
  },
  backButton: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#5C3D1E' },
  saveButton: { width: 40, alignItems: 'flex-end' },
  saveText: { fontSize: 15, fontWeight: '600', color: '#8B5E3C' },

  content: { padding: 24 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#8B5E3C',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  card: {
    backgroundColor: '#FFF8F0', borderRadius: 16, paddingHorizontal: 18, marginBottom: 28,
    shadowColor: '#8B5E3C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  fieldGroup: { paddingVertical: 14 },
  fieldLabel: { fontSize: 12, color: '#8B5E3C', fontWeight: '600', marginBottom: 6 },
  fieldDesc: { fontSize: 12, color: '#C49A6C', marginBottom: 10, lineHeight: 18 },
  input: { fontSize: 16, color: '#5C3D1E', fontWeight: '500', padding: 0 },
  divider: { height: 1, backgroundColor: '#DEC8A8' },

  // 초대 코드
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  inviteCode: { fontSize: 22, fontWeight: '800', color: '#5C3D1E', letterSpacing: 4 },
  shareBtn: { backgroundColor: '#8B5E3C', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  shareBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // 가족 참여
  joinRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  joinInput: {
    flex: 1, backgroundColor: '#FDF6EC', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 18, fontWeight: '800', color: '#5C3D1E',
    borderWidth: 1, borderColor: '#DEC8A8', letterSpacing: 4, textAlign: 'center',
  },
  joinBtn: {
    backgroundColor: '#8B5E3C', borderRadius: 10,
    paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center',
  },
  joinBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // 알림 칩
  notifyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  notifyChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#FDF6EC', borderWidth: 1, borderColor: '#DEC8A8',
  },
  notifyChipActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  notifyChipText: { fontSize: 13, color: '#8B5E3C', fontWeight: '600' },
  notifyChipTextActive: { color: '#FFFFFF' },

  // 가족 나가기
  leaveBtn: {
    marginTop: 8, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#D95F4B', borderRadius: 10,
  },
  leaveBtnText: { color: '#D95F4B', fontWeight: '700', fontSize: 14 },

  logoutBtn: { paddingVertical: 16, alignItems: 'center' },
  logoutText: { fontSize: 15, fontWeight: '600', color: '#D95F4B' },

  // 기능 선택 칩
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FDF6EC',
    borderWidth: 1,
    borderColor: '#DEC8A8',
  },
  featureChipActive: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  featureChipText: { fontSize: 14, fontWeight: '600', color: '#8B5E3C' },
  featureChipTextActive: { color: '#FFFFFF' },
});

export default SettingsScreen;
