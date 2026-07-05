// 메모 목록 화면

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, ListRenderItemInfo, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Circle } from 'react-native-svg';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Note } from '../types';
import { RootStackParamList } from '../navigation';
import { theme } from '../theme';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import SelectionBar from '../components/SelectionBar';
import { ListChecks } from 'lucide-react-native';

const REALTIME_TABLES = ['notes'] as const;

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
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={active ? theme.colors.brand : theme.colors.warm.dark} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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
  <Svg width={52} height={52} viewBox="0 0 24 24" fill="none" stroke={theme.colors.warm.lightOak} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </Svg>
);

// ── 노트 카드 ──────────────────────────────────

interface NoteCardProps {
  note: Note;
  index: number;
  onPress: () => void;
  selected?: boolean; // 다중 선택 모드에서 선택됨
}

const NoteCard: React.FC<NoteCardProps> = ({ note, index, onPress, selected }) => {
  const bg = theme.colors.noteCards[index % theme.colors.noteCards.length];
  const preview = note.content.replace(/https?:\/\/[^\s]+/g, '🔗').slice(0, 80);

  return (
    <TouchableOpacity
      style={[card.wrap, { backgroundColor: bg }, selected && card.wrapSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
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
    borderColor: `${theme.colors.warm.edge}55`,
    shadowColor: theme.colors.brand,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  wrapSelected: { borderWidth: 1.5, borderColor: theme.colors.brand },
  title: { fontSize: 13, fontWeight: '700', color: theme.colors.warm.dark, letterSpacing: -0.2, marginBottom: 5 },
  body: { fontSize: 11, color: theme.colors.warm.oak, lineHeight: 16, marginBottom: 8 },
  date: { fontSize: 10, color: theme.colors.warm.lightOak, fontWeight: '500' },
});

// ── 메인 화면 ──────────────────────────────────

type NavProp = NativeStackNavigationProp<RootStackParamList>;

const NotesScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  useRealtimeRefresh(REALTIME_TABLES, loadNotes); // 가족이 바꾸면 즉시 갱신

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  // ── 다중 선택 ─────────────────────────────────
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };

  const handleSelect = (note: Note) => {
    setSelectedIds(prev => prev.includes(note.id) ? prev.filter(id => id !== note.id) : [...prev, note.id]);
  };

  const handleSelectAll = () => {
    setSelectedIds(prev => prev.length === filtered.length ? [] : filtered.map(n => n.id));
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    Alert.alert('선택 삭제', `${selectedIds.length}개 메모를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('notes').delete().in('id', selectedIds);
          if (error) { Alert.alert('오류', `삭제에 실패했습니다.\n(${error.message})`); return; }
          setNotes(prev => prev.filter(n => !selectedIds.includes(n.id)));
          exitSelectMode();
        },
      },
    ]);
  };

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
      selected={selectedIds.includes(item.id)}
      onPress={() => selectMode ? handleSelect(item) : navigation.navigate('NoteDetail', { noteId: item.id })}
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
        <View style={s.headerBtns}>
          <TouchableOpacity
            onPress={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            style={[s.iconBtn, selectMode && s.iconBtnActive]}
          >
            <ListChecks color={selectMode ? theme.colors.brand : theme.colors.warm.dark} size={18} strokeWidth={1.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setShowSearch(v => !v); if (showSearch) setSearch(''); }}
            style={[s.iconBtn, showSearch && s.iconBtnActive]}
          >
            <SvgSearch active={showSearch} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 검색 */}
      {showSearch && (
        <View style={s.searchBox}>
          <TextInput
            style={s.searchInput}
            placeholder="메모 검색"
            placeholderTextColor={theme.colors.warm.lightOak}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      )}

      {/* 컨텐츠 */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.brand} />
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

      {/* FAB (선택 모드에선 숨김) */}
      {!selectMode && (
        <TouchableOpacity style={s.fab} onPress={handleNew} activeOpacity={0.85}>
          <SvgPencil />
        </TouchableOpacity>
      )}

      {/* 다중 선택 하단 바 */}
      {selectMode && (
        <SelectionBar
          count={selectedIds.length}
          allSelected={filtered.length > 0 && selectedIds.length === filtered.length}
          onSelectAll={handleSelectAll}
          onDelete={handleBulkDelete}
        />
      )}
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.warm.cream },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
  },
  subLabel: { fontSize: 12, color: theme.colors.warm.lightOak, fontWeight: '600', marginBottom: 2 },
  title: { fontSize: 26, fontWeight: '700', color: theme.colors.warm.dark, letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.warm.ivory,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnActive: { backgroundColor: theme.colors.warm.edge, borderColor: theme.colors.warm.oak },
  searchBox: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: theme.colors.warm.ivory, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
    paddingHorizontal: 14, paddingVertical: 11,
  },
  searchInput: { fontSize: 15, color: theme.colors.warm.dark, padding: 0 },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  columnWrapper: { gap: 8, marginBottom: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 60 },
  emptyText: { fontSize: 16, fontWeight: '700', color: theme.colors.warm.oak },
  emptySubText: { fontSize: 13, color: theme.colors.warm.lightOak, textAlign: 'center' },
  fab: {
    position: 'absolute',
    bottom: 24, right: 24,
    backgroundColor: theme.colors.warm.oak,
    width: 52, height: 52, borderRadius: 26,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: theme.colors.warm.oak,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 6,
  },
});

export default NotesScreen;
