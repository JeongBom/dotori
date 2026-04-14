// 메모 목록 화면

import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, Search, FileText } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

import { supabase, getOrCreateFamilyId } from '../lib/supabase';
import { Note } from '../types';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return `${diffDays}일 전`;
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

function detectLinks(text: string): boolean {
  return /https?:\/\/[^\s]+/.test(text);
}

const NotesScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const renderNote = ({ item }: { item: Note }) => {
    const hasLink = detectLinks(item.content);
    const preview = item.content.replace(/https?:\/\/[^\s]+/g, '🔗 링크').slice(0, 80);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('NoteDetail', { noteId: item.id })}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title || '제목 없음'}
          </Text>
          <Text style={styles.cardDate}>{formatDate(item.updated_at)}</Text>
        </View>
        {item.content ? (
          <Text style={styles.cardPreview} numberOfLines={2}>{preview}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.title}>메모</Text>
        <TouchableOpacity style={styles.addBtn} onPress={handleNew} activeOpacity={0.7}>
          <Plus color="#FFFFFF" size={22} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* 검색 */}
      <View style={styles.searchBox}>
        <Search color="#A87850" size={16} strokeWidth={1.5} />
        <TextInput
          style={styles.searchInput}
          placeholder="검색"
          placeholderTextColor="#C49A6C"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#8B5E3C" />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <FileText color="#C49A6C" size={48} strokeWidth={1} />
          <Text style={styles.emptyText}>메모가 없습니다</Text>
          <Text style={styles.emptySubText}>우측 상단 + 버튼으로 추가하세요</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderNote}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#5C3D1E', letterSpacing: -0.5 },
  addBtn: {
    backgroundColor: '#8B5E3C',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#EDD9C0',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#5C3D1E' },
  list: { paddingHorizontal: 24, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#8B5E3C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#5C3D1E', flex: 1, marginRight: 8 },
  cardDate: { fontSize: 12, color: '#A87850', fontWeight: '500' },
  cardPreview: { fontSize: 14, color: '#8B5E3C', lineHeight: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#8B5E3C' },
  emptySubText: { fontSize: 14, color: '#C49A6C' },
});

export default NotesScreen;
