// 설정 화면
// - 닉네임 / 가족 이름 수정
// - 유통기한 알림 설정
// - 초대 코드 확인 및 공유
// - 초대 코드로 가족 참여 (기존 데이터 소프트 삭제)
// - 가족 나가기 (기존 데이터 복구)

import React, { useState, useEffect, useCallback, useRef } from 'react';
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

export const ALL_FEATURES = ['Fridge', 'Supplies', 'Finance', 'Chores', 'Notes'] as const;
type FeatureKey = typeof ALL_FEATURES[number];

const FEATURE_LABELS: Record<FeatureKey, string> = {
  Fridge:   '음식',
  Supplies: '생필품',
  Finance:  '자산',
  Chores:   '일정',
  Notes:    '메모',
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
  const [joinCode, setJoinCode]         = useState('');
  const [joining, setJoining]           = useState(false);
  const [leaving, setLeaving]           = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [joinRequests, setJoinRequests] = useState<{ id: string; requester_nickname: string; requester_id: string }[]>([]);
  const [familyMembers, setFamilyMembers] = useState<{ id: string; nickname: string; role: string }[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 초기 로드
  useEffect(() => {
    loadAll();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // 가족장: 대기 중인 가입 요청 로드
  const loadJoinRequests = useCallback(async (fid: string) => {
    const { data } = await supabase
      .from('family_join_requests')
      .select('id, requester_nickname, requester_id')
      .eq('family_id', fid)
      .eq('status', 'pending');
    setJoinRequests(data ?? []);
  }, []);

  // 요청자: 내 요청 승인 여부 폴링
  const startPolling = useCallback((requestId: string, currentFamilyId: string, targetFamilyId: string, userId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('family_join_requests')
        .select('status')
        .eq('id', requestId)
        .single();
      if (data?.status === 'approved') {
        clearInterval(pollRef.current!);
        setPendingRequestId(null);
        await joinFamily(userId, currentFamilyId, targetFamilyId);
        await loadAll();
      } else if (data?.status === 'rejected') {
        clearInterval(pollRef.current!);
        setPendingRequestId(null);
        Alert.alert('거절됨', '가입 요청이 거절되었습니다.');
      }
    }, 5000);
  }, []);

  const loadAll = async () => {
    const storedNickname = await AsyncStorage.getItem(STORAGE_KEY_NICKNAME);
    const storedDays     = await AsyncStorage.getItem(STORAGE_KEY_NOTIFY_DAYS);
    const storedFeatures = await AsyncStorage.getItem(STORAGE_KEY_ENABLED_FEATURES);
    if (storedNickname) setNickname(storedNickname);
    if (storedDays)     setNotifyDays(parseInt(storedDays) as 1|2|3|5|7);
    if (storedFeatures) setEnabledFeatures(JSON.parse(storedFeatures));

    let loadedProfile: UserProfile | null = null;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (prof) {
        loadedProfile = prof as UserProfile;
        setProfile(loadedProfile);
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
      // 가족장이면 대기 중인 가입 요청 로드
      if (loadedProfile?.role === 'owner') {
        await loadJoinRequests(fid);
      }

      // 가족 구성원 로드
      const { data: members } = await supabase
        .from('user_profiles')
        .select('id, nickname, role')
        .eq('family_id', fid);
      setFamilyMembers(members ?? []);
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

  // ── 초대 코드로 가족 참여 (가족장 승인 방식) ──────────────────────

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
      `'${targetFamily.name}'에 합류 요청할까요?`,
      '가족장이 승인하면 합류가 완료돼요.\n합류하면 내 기존 데이터는 보이지 않게 됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '요청하기',
          onPress: async () => {
            if (!profile || !familyId) return;
            setJoining(true);
            try {
              const { data: request, error: reqErr } = await supabase
                .from('family_join_requests')
                .insert({
                  family_id: targetFamily.id,
                  requester_id: profile.id,
                  requester_nickname: nickname.trim() || profile.nickname || '알 수 없음',
                })
                .select()
                .single();
              if (reqErr) throw reqErr;
              if (request) {
                setPendingRequestId(request.id);
                setJoinCode('');
                startPolling(request.id, familyId, targetFamily.id, profile.id);
                Alert.alert('요청 완료', `'${targetFamily.name}' 가족장의 승인을 기다리고 있어요.`);
              }
            } catch (e) {
              Alert.alert('오류', '요청에 실패했습니다.');
              console.error(e);
            } finally {
              setJoining(false);
            }
          },
        },
      ],
    );
  };

  // ── 가족 합류 요청 승인/거절 (가족장) ───────────────────────────

  const handleApprove = async (requestId: string, requesterId: string) => {
    try {
      const { data: requesterProfile } = await supabase
        .from('user_profiles')
        .select('family_id')
        .eq('id', requesterId)
        .single();
      if (!requesterProfile) throw new Error('requester not found');

      await joinFamily(requesterId, requesterProfile.family_id, familyId!);

      await supabase
        .from('family_join_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (familyId) await loadJoinRequests(familyId);
      Alert.alert('완료', '합류 요청을 승인했어요.');
    } catch (e) {
      Alert.alert('오류', '승인에 실패했습니다.');
      console.error(e);
    }
  };

  const handleReject = async (requestId: string) => {
    await supabase
      .from('family_join_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    if (familyId) await loadJoinRequests(familyId);
  };

  // ── 가족 나가기 ───────────────────────────────

  const handleLeaveFamily = () => {
    if (!profile) return;

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
              if (profile.personal_family_id) {
                // 기존 개인 가족으로 복귀
                const err = await leaveFamily(profile.id, profile.personal_family_id);
                if (err) throw err;
              } else {
                // personal_family_id가 없으면 새 가족 생성 후 이동
                const { data: newFamily, error: familyErr } = await supabase
                  .from('families')
                  .insert({ name: '내 가족' })
                  .select()
                  .single();
                if (familyErr) throw familyErr;
                const { error: profileErr } = await supabase
                  .from('user_profiles')
                  .update({ family_id: newFamily.id, personal_family_id: null, role: 'owner' })
                  .eq('id', profile.id);
                if (profileErr) throw profileErr;
              }
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

  const isInOtherFamily = profile?.role === 'member';

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

          {/* ── 초대 코드 (모든 멤버에게 보임) ── */}
          {inviteCode && (
            <>
              <View style={styles.sectionHeader}>
                <Users color="#8B5E3C" size={16} strokeWidth={1.8} />
                <Text style={styles.sectionTitle}>가족 초대</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>초대 코드</Text>
                  <Text style={styles.fieldDesc}>가족에게 코드를 공유하면 함께 앱을 사용할 수 있어요</Text>
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

          {/* ── 가족 구성원 ── */}
          {familyMembers.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Users color="#8B5E3C" size={16} strokeWidth={1.8} />
                <Text style={styles.sectionTitle}>가족 구성원</Text>
              </View>
              <View style={styles.card}>
                {familyMembers.map((member, idx) => (
                  <View key={member.id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.memberRow}>
                      <Text style={styles.memberNickname}>
                        {member.nickname || '(닉네임 없음)'}
                        {member.id === profile?.id ? '  (나)' : ''}
                      </Text>
                      <View style={[styles.memberRoleBadge, member.role === 'owner' && styles.memberRoleBadgeOwner]}>
                        <Text style={[styles.memberRoleText, member.role === 'owner' && styles.memberRoleTextOwner]}>
                          {member.role === 'owner' ? '가족장' : '멤버'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── 가족장: 대기 중인 합류 요청 ── */}
          {!isInOtherFamily && joinRequests.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Users color="#8B5E3C" size={16} strokeWidth={1.8} />
                <Text style={styles.sectionTitle}>합류 요청</Text>
              </View>
              <View style={styles.card}>
                {joinRequests.map((req, idx) => (
                  <View key={req.id}>
                    {idx > 0 && <View style={styles.divider} />}
                    <View style={styles.requestRow}>
                      <Text style={styles.requestNickname}>{req.requester_nickname}</Text>
                      <View style={styles.requestBtns}>
                        <TouchableOpacity
                          style={styles.rejectBtn}
                          onPress={() => handleReject(req.id)}
                        >
                          <Text style={styles.rejectBtnText}>거절</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.approveBtn}
                          onPress={() => handleApprove(req.id, req.requester_id)}
                        >
                          <Text style={styles.approveBtnText}>승인</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* ── 다른 가족에 참여 (코드 입력 or 대기 중 안내) ── */}
          {!isInOtherFamily && (
            <>
              <View style={styles.sectionHeader}>
                <Users color="#8B5E3C" size={16} strokeWidth={1.8} />
                <Text style={styles.sectionTitle}>다른 가족에 참여</Text>
              </View>
              <View style={styles.card}>
                <View style={styles.fieldGroup}>
                  {pendingRequestId ? (
                    <>
                      <Text style={styles.fieldLabel}>대기 중</Text>
                      <Text style={styles.fieldDesc}>가족장의 승인을 기다리고 있어요.{'\n'}승인되면 자동으로 합류돼요.</Text>
                      <TouchableOpacity
                        style={styles.cancelRequestBtn}
                        onPress={async () => {
                          if (pollRef.current) clearInterval(pollRef.current);
                          await supabase
                            .from('family_join_requests')
                            .update({ status: 'rejected' })
                            .eq('id', pendingRequestId);
                          setPendingRequestId(null);
                        }}
                      >
                        <Text style={styles.cancelRequestText}>요청 취소</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.fieldLabel}>초대 코드 입력</Text>
                      <Text style={styles.fieldDesc}>파트너에게 받은 코드를 입력하면 가족에 합류 요청해요</Text>
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
                            : <Text style={styles.joinBtnText}>요청</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
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

          {/* ── 일정 안내 ── */}
          <View style={styles.sectionHeader}>
            <Bell color="#8B5E3C" size={16} strokeWidth={1.8} />
            <Text style={styles.sectionTitle}>일정 안내</Text>
          </View>
          <View style={styles.card}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldDesc}>
                반복 일정은 올해 12월 31일까지만 표시돼요.{'\n'}
                새해가 되면 자동으로 다음 해 일정이 생성됩니다.
              </Text>
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

  // 가족 구성원
  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12,
  },
  memberNickname: { fontSize: 15, fontWeight: '500', color: '#5C3D1E', flex: 1 },
  memberRoleBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: '#F0E6D9', borderWidth: 1, borderColor: '#DEC8A8',
  },
  memberRoleBadgeOwner: { backgroundColor: '#8B5E3C', borderColor: '#8B5E3C' },
  memberRoleText: { fontSize: 12, fontWeight: '600', color: '#8B5E3C' },
  memberRoleTextOwner: { color: '#FFFFFF' },

  // 합류 요청 (가족장 승인 UI)
  requestRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12,
  },
  requestNickname: { fontSize: 15, fontWeight: '600', color: '#5C3D1E', flex: 1 },
  requestBtns: { flexDirection: 'row', gap: 8 },
  rejectBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: '#D95F4B',
  },
  rejectBtnText: { fontSize: 13, fontWeight: '600', color: '#D95F4B' },
  approveBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: '#8B5E3C',
  },
  approveBtnText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

  // 요청 취소
  cancelRequestBtn: {
    marginTop: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#DEC8A8', borderRadius: 10,
  },
  cancelRequestText: { fontSize: 14, fontWeight: '600', color: '#8B5E3C' },

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
