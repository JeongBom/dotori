// 장보기 추가/수정 화면 — 음식/생필품 추가와 동일한 스텝 위저드 스타일
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Check } from 'lucide-react-native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { fetchStoreTagOptions, ensureStoreTag } from '../lib/storeTags';
import { RootStackParamList } from '../navigation';
import { theme } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AddShoppingItem'>;
type RouteType = RouteProp<RootStackParamList, 'AddShoppingItem'>;

const TOTAL_STEPS = 2;

// 단계(라우트) 인스턴스 간 공유되는 입력값 초안
// 각 단계를 별도 라우트로 push하므로(뒤로가기 = 전 단계), 입력값은 모듈 스코프에 보관해 이어받는다.
type ShoppingDraft = { name: string; storeTag: string };
const emptyShoppingDraft = (): ShoppingDraft => ({ name: '', storeTag: '' });
let draft: ShoppingDraft = emptyShoppingDraft();

const AddShoppingItemScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteType>();

  const itemId = route.params?.itemId ?? null;
  const isEditing = !!itemId;

  const step = route.params?.step ?? 1;

  // 위저드 진입(1단계 첫 렌더) 시 초안 초기화
  const firstRender = useRef(true);
  if (firstRender.current) {
    firstRender.current = false;
    if (step === 1) draft = emptyShoppingDraft();
  }

  const [done, setDone] = useState(false);
  const doneOpacity = useRef(new Animated.Value(0)).current;
  const doneScale = useRef(new Animated.Value(0.85)).current;
  const nameInputRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isEditing) {
        const t = setTimeout(() => nameInputRef.current?.focus(), 600);
        return () => clearTimeout(t);
      }
    }, [isEditing])
  );

  const [familyId, setFamilyId] = useState<string | null>(route.params?.familyId ?? null);
  const [name, setName] = useState(draft.name);
  const [storeTag, setStoreTag] = useState(draft.storeTag);
  const [storeTagOptions, setStoreTagOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // 입력값을 초안에 반영 — 다음/이전 단계 인스턴스가 이어받는다
  useEffect(() => { draft.name = name; }, [name]);
  useEffect(() => { draft.storeTag = storeTag; }, [storeTag]);

  // 기존 구입처 태그 목록 (제안 칩용)
  useEffect(() => {
    (async () => {
      const fid = familyId ?? await getOrCreateFamilyId();
      if (!fid) return;
      if (!familyId) setFamilyId(fid);
      setStoreTagOptions(await fetchStoreTagOptions(fid));
    })();
  }, [familyId]);

  // 수정 모드: 기존 항목 로드 (1단계 인스턴스에서만 — 이후 단계는 초안에서 이어받음)
  useEffect(() => {
    if (!itemId || step > 1) return;
    (async () => {
      const { data } = await supabase.from('shopping_items').select('*').eq('id', itemId).single();
      if (!data) return;
      setName(data.name);
      setStoreTag(data.store_tag ?? '');
      setFamilyId(data.family_id);
    })();
  }, [itemId]);

  const goNext = () => {
    if (step === 1 && !name.trim()) {
      Alert.alert('알림', '품목 이름을 입력해주세요.');
      return;
    }
    // 다음 단계를 같은 화면 라우트로 push — 뒤로가기가 자연스럽게 전 단계로 간다
    if (step < TOTAL_STEPS) navigation.push('AddShoppingItem', { ...route.params, step: step + 1 });
    else handleSave();
  };

  const handleSave = async () => {
    const fid = familyId ?? await getOrCreateFamilyId();
    if (!fid) { Alert.alert('오류', '가족 정보를 생성할 수 없습니다.'); return; }

    setSaving(true);
    try {
      // 새 구입처면 태그로 등록 — 장보기 필터에 바로 나타남
      if (storeTag.trim()) await ensureStoreTag(fid, storeTag.trim());

      if (isEditing && itemId) {
        const { error } = await supabase
          .from('shopping_items')
          .update({ name: name.trim(), store_tag: storeTag.trim() })
          .eq('id', itemId);
        if (error) throw error;
        navigation.pop(step); // 위저드 단계 전부 빠져나가 목록으로
      } else {
        const { error } = await supabase.from('shopping_items').insert({
          family_id: fid,
          name: name.trim(),
          store_tag: storeTag.trim(),
          source_type: 'manual',
        });
        if (error) throw error;

        setDone(true);
        Animated.parallel([
          Animated.spring(doneScale, { toValue: 1, useNativeDriver: true }),
          Animated.timing(doneOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      Alert.alert('오류', `저장에 실패했습니다.\n(${msg})`);
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ── 완료 화면 ────────────────────────────────

  if (done) {
    return (
      <SafeAreaView style={s.safeArea}>
        <Animated.View style={[s.doneWrap, { opacity: doneOpacity, transform: [{ scale: doneScale }] }]}>
          <View style={s.doneCircle}>
            <Check color="#FFFFFF" size={36} strokeWidth={2.5} />
          </View>
          <Text style={s.doneTitle}>장보기에 추가했어요!</Text>
          <Text style={s.doneSub}>{name} 이(가) 등록됐어요</Text>
          <TouchableOpacity style={s.doneBtn} onPress={() => navigation.pop(step)}>
            <Text style={s.doneBtnText}>확인</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // 진행 바 — 지나온 단계 세그먼트를 누르면 그 단계로 되돌아간다
  const Progress = () => (
    <View style={s.progressRow}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <TouchableOpacity
          key={i}
          style={[s.progressSeg, i + 1 <= step ? s.progressSegActive : s.progressSegInactive]}
          onPress={() => navigation.pop(step - (i + 1))}
          disabled={i + 1 >= step}
          hitSlop={{ top: 12, bottom: 12 }}
        />
      ))}
    </View>
  );

  const renderStep = () => {
    if (step === 1) {
      return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.stepQuestion}>무엇을 사야 하나요?</Text>
            <View style={s.inputBox}>
              <TextInput
                ref={nameInputRef}
                style={s.input}
                placeholder="예) 휴지, 우유, 두부"
                placeholderTextColor={theme.colors.warm.lightOak}
                value={name}
                onChangeText={setName}
                autoCorrect={false}
                returnKeyType="done"
                maxLength={30}
                keyboardAppearance="light"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    // step 2
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.stepContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.stepQuestion}>어디서 구입하나요? <Text style={s.labelOptional}>(선택)</Text></Text>
          <View style={s.inputBox}>
            <TextInput
              style={s.input}
              placeholder="예) 이마트, 쿠팡, 동네마트"
              placeholderTextColor={theme.colors.warm.lightOak}
              value={storeTag}
              onChangeText={setStoreTag}
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={goNext}
              keyboardAppearance="light"
            />
          </View>
          {storeTagOptions.length > 0 && (
            <View style={s.tagSuggestRow}>
              {storeTagOptions.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.tagChip, storeTag === t && s.tagChipActive]}
                  onPress={() => setStoreTag(storeTag === t ? '' : t)}
                >
                  <Text style={[s.tagChipText, storeTag === t && s.tagChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  const ctaLabel = () => {
    if (saving) return '저장 중...';
    if (step < TOTAL_STEPS) return '다음';
    return isEditing ? '수정 완료' : '저장';
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <ChevronLeft color={theme.colors.warm.dark} size={24} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing ? '장보기 수정' : '장보기 추가'}</Text>
        <View style={s.headerRight} />
      </View>

      <Progress />

      <View style={{ flex: 1 }}>
        {renderStep()}
      </View>

      <View style={s.bottomBar}>
        <TouchableOpacity
          style={[s.ctaBtn, saving && { opacity: 0.5 }]}
          onPress={goNext}
          disabled={saving}
          activeOpacity={0.85}
        >
          <Text style={s.ctaBtnText}>{ctaLabel()}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.card },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.warm.dark },
  headerRight: { width: 40 },

  progressRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 6, marginBottom: 4 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  progressSegActive: { backgroundColor: theme.colors.brand },
  progressSegInactive: { backgroundColor: theme.colors.warm.edge },

  stepContent: { padding: 24, paddingBottom: 32 },
  stepQuestion: { fontSize: 22, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 32, lineHeight: 30 },
  labelOptional: { fontSize: 12, fontWeight: '400', color: theme.colors.warm.lightOak },

  inputBox: {
    backgroundColor: theme.colors.warm.ivory, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  input: { fontSize: 17, color: theme.colors.warm.dark, padding: 0 },

  tagSuggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tagChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
    backgroundColor: theme.colors.warm.ivory, borderWidth: 1, borderColor: theme.colors.warm.edge,
  },
  tagChipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  tagChipText: { fontSize: 13, color: theme.colors.brand, fontWeight: '500' },
  tagChipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  bottomBar: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: theme.colors.card },
  ctaBtn: {
    backgroundColor: theme.colors.brand, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  ctaBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  doneCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: theme.colors.brand, alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  doneTitle: { fontSize: 24, fontWeight: '700', color: theme.colors.warm.dark, marginBottom: 10 },
  doneSub: { fontSize: 15, color: theme.colors.warm.oak, textAlign: 'center', lineHeight: 22, marginBottom: 48 },
  doneBtn: {
    backgroundColor: theme.colors.brand, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 48,
  },
  doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default AddShoppingItemScreen;
