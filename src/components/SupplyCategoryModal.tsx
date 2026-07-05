// 생필품 카테고리 추가/수정 바텀시트 (SuppliesScreen 전용)
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Modal, Pressable, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SupplyCategoryEntry } from '../types';
import { theme } from '../theme';

interface SupplyCategoryModalProps {
  visible: boolean;
  editing: SupplyCategoryEntry | null;
  onClose: () => void;
  onSave: (name: string, id?: string) => Promise<void>;
  onDelete: (cat: SupplyCategoryEntry) => void;
}

const SupplyCategoryModal: React.FC<SupplyCategoryModalProps> = ({ visible, editing, onClose, onSave, onDelete }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setName(editing?.name ?? ''); }, [visible, editing]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('알림', '카테고리 이름을 입력해주세요.'); return; }
    setSaving(true);
    await onSave(name.trim(), editing?.id);
    setSaving(false);
  };

  const handleClose = () => { Keyboard.dismiss(); onClose(); };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert('카테고리 삭제', `'${editing.name}' 카테고리를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => { handleClose(); onDelete(editing); } },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={cm.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={cm.sheet}>
          <View style={cm.handle} />
          <View style={cm.headerRow}>
            <Text style={cm.title}>{editing ? '카테고리 수정' : '카테고리 추가'}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {editing && (
                <TouchableOpacity onPress={handleDelete}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={theme.colors.status.danger} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClose}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={theme.colors.brand} strokeWidth={2} strokeLinecap="round" />
                </Svg>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={cm.label}>이름</Text>
          <View style={cm.inputBox}>
            <TextInput
              style={cm.input}
              placeholder="예) 욕실용품, 세탁용품"
              placeholderTextColor={theme.colors.warm.lightOak}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              maxLength={12}
            />
          </View>
          <TouchableOpacity style={[cm.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            <Text style={cm.saveBtnText}>{saving ? '저장 중...' : editing ? '수정 완료' : '저장'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const cm = StyleSheet.create({
  kav:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:     { backgroundColor: theme.colors.warm.ivory, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12 },
  handle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.warm.edge, alignSelf: 'center', marginBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title:     { fontSize: 17, fontWeight: '700', color: theme.colors.warm.dark },
  label:     { fontSize: 13, fontWeight: '600', color: theme.colors.brand, marginBottom: 8 },
  inputBox:  { backgroundColor: theme.colors.warm.cream, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.warm.edge },
  input:     { fontSize: 16, color: theme.colors.warm.dark, padding: 0 },
  saveBtn:   { backgroundColor: theme.colors.brand, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export default SupplyCategoryModal;
