// 메모 목록 화면

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Note } from '../types';
import { RootStackParamList } from '../navigation';

// ── 디자인 토큰 ────────────────────────────────

const C = {
  brown:    '#8B5E3C',
  warmOak:  '#A87850',
  lightOak: '#C49A6C',
  ivory:    '#FFF8F0',
  cream:    '#FDF6EC',
  edge:     '#DEC8A8',
  dark:     '#5C3D1E',
  fab:      '#A07A5C',
} as const;

const CARD_COLORS = ['#FFF8F0', '#FAEFD8', '#EBE5F4', '#FDF1E4', '#EBF4F8', '#EEF5EE'];

// ── 날짜 포맷 ──────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

// ── SVG 아이콘 ──────────────────────────────────

const SvgSearch = ({ active }: { active: boolean }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={active ? C.brown : C.dark} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="7" />
    <Path d="M20 20l-3.5-3.5" />
  </Svg>
);

const SvgPencil = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Svg>
);

const SvgEmpty = () => (
  <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke={C.lightOak} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </Svg>
);

// ── 노트 카드 ──────────────────────────────────

interface NoteCardProps {
  note: Note;
  index: number;
  onPress: () => void;
}

const NoteCard: React.FC<NoteCardProps> = ({ note, index, onPress }) => {
  const bg = CARD_COLORS[index % CARD_COLORS.length];
  const preview = note.content.replace(/https?:\/\/[^\s]+/g, '🔗').slice(0, 80);

  return (
    <TouchableOpacity style={[card.wrap, { backgroundColor: bg }]} onPress={onPress} activeOpacity={0.75}>
      <Text style={card.title} numberOfLines={2}>{note.title || '제목 없음'}</Text>
      {preview ? <Text style={card.body} numberOfLines={5}>{preview}</Text> : null}
      <Text style={card.date}>{formatDate(note.updated_at)}</Text>
    </TouchableOpacity>
  );
};

const card = StyleSheet.create({
  wrap: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: `${C.edge}55`,
    shadowColor: C.brown,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  title: { fontSize: 13, fontWeight: '800', color: C.dark, letterSpacing: -0.2, marginBottom: 5 },
  body: { fontSize: 11, color: C.warmOak, lineHeight: 16, marginBottom: 8 },
  date: { fontSize: 10, color: C.lightOak, fontWeight: '500' },
});

// ── 메인 화면 ──────────────────────────────────

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const NotesScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const loadNotes = useCallback(async () => {
    const familyId = await getOrCreateFamilyId();
    if (!familyId) { setLoading(false); return; }
    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('family_id', familyId)
      .order('updated_at', { ascending: false });
    setNotes(data ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadNotes();
  }, [loadNotes]));

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const handleNew = async () => {
    const familyId = await getOrCreateFamilyId();
    if (!familyId) return;
    const { data } = await supabase
      .from('notes')
      .insert({ family_id: familyId, title: '', content: '' })
      .select()
      .single();
    if (data) navigation.navigate('NoteDetail', { noteId: data.id });
  };

  const renderNote = ({ item, index }: ListRenderItemInfo<Note>) => (
    <NoteCard
      note={item}
      index={index}
      onPress={() => navigation.navigate('NoteDetail', { noteId: item.id })}
    />
  );

  return (
    <SafeAreaView style={s.safeArea}>
      {/* 헤더 */}
      <View style={s.header}>
        <View>
          <Text style={s.subLabel}>가족 공유</Text>
          <Text style={s.title}>메모</Text>
        </View>
        <TouchableOpacity
          onPress={() => { setShowSearch(v => !v); if (showSearch) setSearch(''); }}
          style={[s.iconBtn, showSearch && s.iconBtnActive]}
        >
          <SvgSearch active={showSearch} />
        </TouchableOpacity>
      </View>

      {/* 검색 */}
      {showSearch && (
        <View style={s.searchBox}>
          <TextInput
            style={s.searchInput}
            placeholder="메모 검색"
            placeholderTextColor={C.lightOak}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      )}

      {/* 컨텐츠 */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.brown} />
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <SvgEmpty />
          <Text style={s.emptyText}>{search ? '검색 결과 없음' : '메모가 없어요'}</Text>
          <Text style={s.emptySubText}>{search ? '다른 키워드로 검색해 보세요' : '연필 버튼으로 첫 메모를 작성해 보세요'}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderNote}
          numColumns={2}
          columnWrapperStyle={s.columnWrapper}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={handleNew} activeOpacity={0.85}>
        <SvgPencil />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.cream },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  subLabel: { fontSize: 12, color: C.lightOak, fontWeight: '600', marginBottom: 2 },
  title: { fontSize: 26, fontWeight: '800', color: C.dark, letterSpacing: -0.5 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.ivory,
    borderWidth: 1, borderColor: C.edge,
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnActive: { backgroundColor: '#EDD9C0', borderColor: C.warmOak },
  searchBox: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: C.ivory, borderRadius: 12,
    borderWidth: 1, borderColor: C.edge,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { fontSize: 15, color: C.dark, padding: 0 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  columnWrapper: { gap: 8, marginBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.warmOak },
  emptySubText: { fontSize: 13, color: C.lightOak, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24, right: 24,
    backgroundColor: C.fab,
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.fab,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
});

export default NotesScreen;
