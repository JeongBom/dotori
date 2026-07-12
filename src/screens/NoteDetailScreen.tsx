// 메모 상세/편집 화면 — 노션 스타일 블록 편집기
// 보기/편집 모드 구분 없이 항상 바로 편집 가능. 한 줄 = 한 블록.
// 내용은 DB에 텍스트 한 덩어리로 저장하되, "- [ ]" / "- [x]" 마커 줄은
// 체크박스 블록으로 다룬다.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, Linking, KeyboardAvoidingView, Platform, Keyboard,
  NativeSyntheticEvent, TextInputKeyPressEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft, Trash2, Save, ListTodo, Square, SquareCheckBig, ExternalLink,
} from 'lucide-react-native';

import { supabase } from '../lib/supabase';
import { Note } from '../types';
import { RootStackParamList } from '../navigation';
import { theme } from '../theme';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type RouteT = RouteProp<RootStackParamList, 'NoteDetail'>;

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const CHECKBOX_REGEX = /^- \[( |x)\] ?(.*)$/;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── 블록 모델 ─────────────────────────────────

interface Block {
  id: string;
  kind: 'text' | 'check';
  checked: boolean; // text 블록에선 무시
  text: string;     // 줄바꿈 없는 한 줄
}

let blockCounter = 0;
function newBlockId(): string { return `blk-${++blockCounter}`; }

// 저장된 문자열 → 블록 배열 (한 줄 = 한 블록)
function parseBlocks(content: string): Block[] {
  return content.split('\n').map(line => {
    const match = line.match(CHECKBOX_REGEX);
    return match
      ? { id: newBlockId(), kind: 'check' as const, checked: match[1] === 'x', text: match[2] }
      : { id: newBlockId(), kind: 'text' as const, checked: false, text: line };
  });
}

// 블록 배열 → 저장용 문자열 (내용 없는 체크박스는 버림)
function serializeBlocks(blocks: Block[]): string {
  return blocks
    .filter(b => b.kind === 'text' || b.text.trim() !== '')
    .map(b => (b.kind === 'check' ? `- [${b.checked ? 'x' : ' '}] ${b.text}` : b.text))
    .join('\n');
}

// ── 메인 화면 ──────────────────────────────────

const NoteDetailScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteT>();
  const { noteId } = route.params;

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  // 웹의 multiline TextInput은 자동으로 안 늘어나서 내용 높이를 직접 반영
  const [heights, setHeights] = useState<Record<string, number>>({});
  const TITLE_KEY = 'title';

  const titleRef = useRef(title);
  const blocksRef = useRef(blocks);
  titleRef.current = title;
  blocksRef.current = blocks;

  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const focusedIdRef = useRef<string | null>(null);   // 마지막으로 포커스된 블록
  const pendingFocusRef = useRef<string | null>(null); // 새로 만든 블록 포커스 예약
  const selectionsRef = useRef<Record<string, { start: number; end: number }>>({}); // 커서 위치

  const setHeight = (key: string, h: number) =>
    setHeights(prev => (prev[key] === h ? prev : { ...prev, [key]: h }));

  // 예약된 블록에 포커스 (입력칸이 마운트된 다음 프레임에)
  useEffect(() => {
    const id = pendingFocusRef.current;
    if (!id) return;
    const t = setTimeout(() => {
      inputRefs.current[id]?.focus();
      pendingFocusRef.current = null;
    }, 50);
    return () => clearTimeout(t);
  }, [blocks]);

  useEffect(() => {
    loadNote();
  }, [noteId]);

  const loadNote = async () => {
    const { data } = await supabase.from('notes').select('*').eq('id', noteId).single();
    if (data) {
      setNote(data);
      setTitle(data.title);
      const parsed = parseBlocks(data.content);
      setBlocks(parsed);
      // 새 메모면 첫 블록에 바로 커서
      if (!data.title && !data.content) pendingFocusRef.current = parsed[0].id;
    }
  };

  const saveNote = useCallback(async () => {
    const t = titleRef.current.trim();
    const c = serializeBlocks(blocksRef.current).trim();
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

  // ── 블록 조작 ─────────────────────────────────

  // 체크 토글 + 즉시 저장 (가족 기기에 바로 반영)
  const toggleCheck = (id: string) => {
    const next = blocksRef.current.map(b =>
      b.id === id ? { ...b, checked: !b.checked } : b
    );
    setBlocks(next);
    supabase
      .from('notes')
      .update({ content: serializeBlocks(next).trim(), updated_at: new Date().toISOString() })
      .eq('id', noteId);
  };

  // 잘리거나 합쳐진 블록은 고정 높이를 지워서 다시 측정 (줄 간격 벌어짐 방지)
  const resetHeight = (id: string) => {
    setHeights(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  // 커서 위치에서 블록을 둘로 분리 (엔터)
  const splitBlockAtCursor = (id: string) => {
    const block = blocksRef.current.find(b => b.id === id);
    if (!block) return;
    // 빈 체크박스에서 엔터 → 일반 줄로 전환 (체크리스트 빠져나오기)
    if (block.kind === 'check' && block.text === '') {
      setBlocks(prev => prev.map(b => (b.id === id ? { ...b, kind: 'text' } : b)));
      pendingFocusRef.current = id;
      return;
    }
    const sel = selectionsRef.current[id];
    const start = sel?.start ?? block.text.length;
    const end = sel?.end ?? block.text.length;
    const item: Block = {
      id: newBlockId(), kind: block.kind, checked: false, text: block.text.slice(end),
    };
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...block, text: block.text.slice(0, start) };
      next.splice(idx + 1, 0, item);
      return next;
    });
    resetHeight(id);
    pendingFocusRef.current = item.id;
  };

  const handleChangeText = (id: string, text: string) => {
    const block = blocksRef.current.find(b => b.id === id);
    if (!block) return;

    if (!text.includes('\n')) {
      // 줄 맨 앞에 "[] " 입력하면 체크박스로 전환 (노션 단축키 스타일)
      if (block.kind === 'text' && (text === '[]' || text.startsWith('[] '))) {
        const rest = text === '[]' ? '' : text.slice(3);
        setBlocks(prev => prev.map(b =>
          b.id === id ? { ...b, kind: 'check', checked: false, text: rest } : b
        ));
        pendingFocusRef.current = id;
        return;
      }
      setBlocks(prev => prev.map(b => (b.id === id ? { ...b, text } : b)));
      return;
    }

    // 엔터(줄바꿈) → 새 블록으로 분리. 체크박스에서 엔터면 새 체크박스 (노션처럼)
    const parts = text.split('\n');
    if (block.kind === 'check' && parts.every(p => p === '')) {
      // 빈 체크박스에서 엔터 → 일반 줄로 전환 (체크리스트 빠져나오기)
      setBlocks(prev => prev.map(b => (b.id === id ? { ...b, kind: 'text', text: '' } : b)));
      pendingFocusRef.current = id;
      return;
    }
    const newBlocks: Block[] = parts.slice(1).map(p => ({
      id: newBlockId(), kind: block.kind, checked: false, text: p,
    }));
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...block, text: parts[0] };
      next.splice(idx + 1, 0, ...newBlocks);
      return next;
    });
    resetHeight(id);
    pendingFocusRef.current = newBlocks[newBlocks.length - 1].id;
  };

  const handleKeyPress = (id: string, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const key = e.nativeEvent.key;
    // 웹: 엔터의 기본 줄바꿈을 막고 블록 분리로 직접 처리
    // (줄바꿈이 입력칸에 들어가면 높이가 2줄로 측정·고정돼 줄 간격이 벌어짐)
    if (key === 'Enter' && Platform.OS === 'web') {
      e.preventDefault();
      splitBlockAtCursor(id);
      return;
    }
    // 빈 블록에서 백스페이스: 체크박스면 일반 줄로, 일반 줄이면 삭제 후 이전 줄로
    if (key !== 'Backspace') return;
    const list = blocksRef.current;
    const idx = list.findIndex(b => b.id === id);
    if (idx === -1 || list[idx].text !== '') return;
    if (list[idx].kind === 'check') {
      setBlocks(prev => prev.map(b => (b.id === id ? { ...b, kind: 'text' } : b)));
      pendingFocusRef.current = id;
    } else if (list.length > 1) {
      const prevBlock = list[idx - 1];
      setBlocks(prev => prev.filter(b => b.id !== id));
      if (prevBlock) pendingFocusRef.current = prevBlock.id;
    }
  };

  // 상단 툴바: 현재 줄을 체크박스 ↔ 일반 줄로 전환 (포커스 이력 없으면 맨 끝에 추가)
  const handleToolbarCheck = () => {
    const target = blocksRef.current.find(b => b.id === focusedIdRef.current);
    if (target) {
      setBlocks(prev => prev.map(b =>
        b.id === target.id
          ? { ...b, kind: b.kind === 'check' ? 'text' : 'check', checked: false }
          : b
      ));
      pendingFocusRef.current = target.id;
    } else {
      const item: Block = { id: newBlockId(), kind: 'check', checked: false, text: '' };
      setBlocks(prev => [...prev, item]);
      pendingFocusRef.current = item.id;
    }
  };

  // 본문 아래 빈 공간 탭 → 맨 끝에서 이어쓰기 (메모앱처럼)
  const handleFillerPress = () => {
    const list = blocksRef.current;
    const last = list[list.length - 1];
    if (last && last.kind === 'text' && last.text === '') {
      inputRefs.current[last.id]?.focus();
    } else {
      const item: Block = { id: newBlockId(), kind: 'text', checked: false, text: '' };
      setBlocks(prev => [...prev, item]);
      pendingFocusRef.current = item.id;
    }
  };

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

  // ── 렌더링 ────────────────────────────────────

  const renderCheckIcon = (checked: boolean) =>
    checked ? (
      <SquareCheckBig color={theme.colors.brand} size={20} strokeWidth={1.5} />
    ) : (
      <Square color={theme.colors.warm.oak} size={20} strokeWidth={1.5} />
    );

  const renderBlock = (block: Block) => {
    const commonProps = {
      ref: (r: TextInput | null) => { inputRefs.current[block.id] = r; },
      value: block.text,
      onChangeText: (t: string) => handleChangeText(block.id, t),
      onKeyPress: (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => handleKeyPress(block.id, e),
      onSelectionChange: (e: { nativeEvent: { selection: { start: number; end: number } } }) => {
        selectionsRef.current[block.id] = e.nativeEvent.selection;
      },
      onContentSizeChange: (e: { nativeEvent: { contentSize: { height: number } } }) =>
        setHeight(block.id, Math.ceil(e.nativeEvent.contentSize.height)),
      onFocus: () => { focusedIdRef.current = block.id; },
      multiline: true,
      scrollEnabled: false,
      placeholderTextColor: theme.colors.warm.lightOak,
    };

    if (block.kind === 'check') {
      return (
        <View key={block.id} style={[styles.blockRow, styles.checkRowGap]}>
          <TouchableOpacity
            onPress={() => toggleCheck(block.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            style={styles.checkIconBtn}
          >
            {renderCheckIcon(block.checked)}
          </TouchableOpacity>
          <TextInput
            {...commonProps}
            style={[
              styles.checkInput,
              { height: heights[block.id] ?? 24 },
              block.checked && styles.checkTextDone,
            ]}
            placeholder="할 일"
          />
        </View>
      );
    }

    // 링크가 있는 줄은 오른쪽에 열기 버튼 (입력칸 안 글자는 직접 탭 불가)
    const url = block.text.match(URL_REGEX)?.[0];
    return (
      <View key={block.id} style={styles.blockRow}>
        <TextInput
          {...commonProps}
          style={[styles.textInput, { height: heights[block.id] ?? 26 }]}
          placeholder={blocks.length === 1 ? '내용을 입력하세요...' : undefined}
        />
        {url ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(url)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            style={styles.linkBtn}
          >
            <ExternalLink color={theme.colors.link} size={16} strokeWidth={1.5} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* 상단 바 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color={theme.colors.brand} size={26} strokeWidth={1.5} />
            <Text style={styles.backText}>메모</Text>
          </TouchableOpacity>
          <View style={styles.topBarRight}>
            <TouchableOpacity onPress={handleToolbarCheck} style={styles.iconBtn} activeOpacity={0.7}>
              <ListTodo color={theme.colors.brand} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={styles.iconBtn} activeOpacity={0.7}>
              <Save color={theme.colors.brand} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.iconBtn} activeOpacity={0.7}>
              <Trash2 color={theme.colors.status.danger} size={20} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {/* 날짜 */}
          {note && <Text style={styles.dateText}>{formatDate(note.updated_at)}</Text>}

          {/* 제목 */}
          <TextInput
            style={[styles.titleInput, { height: heights[TITLE_KEY] ?? 30 * title.split('\n').length }]}
            placeholder="제목"
            placeholderTextColor={theme.colors.warm.lightOak}
            value={title}
            onChangeText={setTitle}
            onContentSizeChange={e => setHeight(TITLE_KEY, Math.ceil(e.nativeEvent.contentSize.height))}
            multiline
            scrollEnabled={false}
          />

          <View style={styles.divider} />

          {/* 본문 블록 */}
          {blocks.map(renderBlock)}

          {/* 아래 빈 공간 탭 → 이어쓰기 */}
          <TouchableOpacity activeOpacity={1} style={styles.editFiller} onPress={handleFillerPress} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.warm.cream },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: 17, color: theme.colors.brand, fontWeight: '600' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 8 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 60, flexGrow: 1 },
  dateText: { fontSize: 12, color: theme.colors.warm.oak, marginBottom: 12, textAlign: 'center' },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.warm.dark,
    marginBottom: 6,
    lineHeight: 30,
    minHeight: 30,
    padding: 0,
    outlineWidth: 0, // 웹: 포커스 시 네모 테두리 제거
  },
  divider: { height: 1, backgroundColor: theme.colors.warm.edge, marginBottom: 12 },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    // 세로 여백 없음 — 엔터로 나뉜 줄도 문단 안 줄바꿈과 같은 간격으로 보이게
  },
  checkRowGap: { paddingVertical: 3 },
  checkIconBtn: { paddingTop: 2 },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.warm.dark,
    lineHeight: 26,
    minHeight: 26,
    padding: 0,
    outlineWidth: 0,
  },
  checkInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.warm.dark,
    lineHeight: 24,
    minHeight: 24,
    padding: 0,
    outlineWidth: 0,
  },
  checkTextDone: {
    color: theme.colors.warm.lightOak,
    textDecorationLine: 'line-through',
  },
  linkBtn: { paddingTop: 5 },
  editFiller: { flexGrow: 1, minHeight: 120 },
});

export default NoteDetailScreen;
