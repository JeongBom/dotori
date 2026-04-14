// 메모 상세/편집 화면

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Linking, KeyboardAvoidingView, Platform, Keyboard, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Trash2, Save } from 'lucide-react-native';

import { supabase } from '../lib/supabase';
import { Note } from '../types';
import { RootStackParamList } from '../navigation';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'NoteDetail'>;

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// 텍스트를 일반 텍스트 + URL 파트로 분리
function splitByUrls(text: string): { text: string; isUrl: boolean }[] {
  const parts = text.split(URL_REGEX);
  return parts.map(part => ({ text: part, isUrl: URL_REGEX.test(part) }));
}

// URL이 포함된 내용을 하이퍼링크로 렌더링
function ContentWithLinks({ text, style }: { text: string; style: object }) {
  const parts = splitByUrls(text);
  return (
    <Text style={style}>
      {parts.map((part, i) =>
        part.isUrl ? (
          <Text
            key={i}
            style={styles.inlineLink}
            onPress={() => Linking.openURL(part.text)}
          >
            {part.text}
          </Text>
        ) : (
          <Text key={i}>{part.text}</Text>
        )
      )}
    </Text>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const NoteDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteT>();
  const { noteId } = route.params;

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isEditingContent, setIsEditingContent] = useState(false);

  const titleRef = useRef(title);
  const contentRef = useRef(content);
  titleRef.current = title;
  contentRef.current = content;

  useEffect(() => {
    loadNote();
  }, [noteId]);

  const loadNote = async () => {
    const { data } = await supabase.from('notes').select('*').eq('id', noteId).single();
    if (data) {
      setNote(data);
      setTitle(data.title);
      setContent(data.content);
      // 새 메모면 바로 편집 모드
      if (!data.title && !data.content) setIsEditingContent(true);
    }
  };

  const saveNote = useCallback(async () => {
    const t = titleRef.current.trim();
    const c = contentRef.current.trim();
    if (!t && !c) {
      await supabase.from('notes').delete().eq('id', noteId);
      return;
    }
    await supabase
      .from('notes')
      .update({ title: t, content: c, updated_at: new Date().toISOString() })
      .eq('id', noteId);
  }, [noteId]);

  const handleSave = async () => {
    await saveNote();
    navigation.goBack();
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      saveNote();
    });
    return unsubscribe;
  }, [navigation, saveNote]);

  const handleDelete = () => {
    Alert.alert('메모 삭제', '이 메모를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive', onPress: async () => {
          await supabase.from('notes').delete().eq('id', noteId);
          navigation.goBack();
        },
      },
    ]);
  };

  const hasUrl = URL_REGEX.test(content);
  // 정규식은 stateful이므로 매번 리셋
  URL_REGEX.lastIndex = 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 상단 바 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color="#8B5E3C" size={26} strokeWidth={1.5} />
            <Text style={styles.backText}>메모</Text>
          </TouchableOpacity>
          <View style={styles.topBarRight}>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.7}>
              <Save color="#8B5E3C" size={20} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} activeOpacity={0.7}>
              <Trash2 color="#D95F4B" size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          <Pressable onPress={Keyboard.dismiss}>
          {/* 날짜 */}
          {note && <Text style={styles.dateText}>{formatDate(note.updated_at)}</Text>}

          {/* 제목 */}
          <TextInput
            style={styles.titleInput}
            placeholder="제목"
            placeholderTextColor="#C49A6C"
            value={title}
            onChangeText={setTitle}
            multiline
          />

          <View style={styles.divider} />

          {/* 내용: 편집 중이면 TextInput, 아니면 하이퍼링크 렌더링 */}
          {isEditingContent ? (
            <TextInput
              style={styles.contentInput}
              placeholder="내용을 입력하세요..."
              placeholderTextColor="#C49A6C"
              value={content}
              onChangeText={setContent}
              multiline
              textAlignVertical="top"
              autoFocus
              onBlur={() => setIsEditingContent(false)}
            />
          ) : (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setIsEditingContent(true)}
              style={styles.contentViewArea}
            >
              {content ? (
                <ContentWithLinks text={content} style={styles.contentText} />
              ) : (
                <Text style={styles.contentPlaceholder}>내용을 입력하세요...</Text>
              )}
            </TouchableOpacity>
          )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FDF6EC' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 17, color: '#8B5E3C', fontWeight: '600' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  saveBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 60 },
  dateText: { fontSize: 12, color: '#A87850', marginBottom: 12, textAlign: 'center' },
  titleInput: {
    fontSize: 22,
    fontWeight: '800',
    color: '#5C3D1E',
    marginBottom: 12,
    lineHeight: 30,
  },
  divider: { height: 1, backgroundColor: '#EDD9C0', marginBottom: 16 },
  contentInput: {
    fontSize: 16,
    color: '#5C3D1E',
    lineHeight: 26,
    minHeight: 300,
  },
  contentViewArea: {
    minHeight: 300,
  },
  contentText: {
    fontSize: 16,
    color: '#5C3D1E',
    lineHeight: 26,
  },
  contentPlaceholder: {
    fontSize: 16,
    color: '#C49A6C',
    lineHeight: 26,
  },
  inlineLink: {
    color: '#4A90D9',
    textDecorationLine: 'underline',
  },
});

export default NoteDetailScreen;
