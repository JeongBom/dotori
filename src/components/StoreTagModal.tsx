// 구입처 태그 추가/수정 바텀시트 (ShoppingScreen 전용)
// SupplyCategoryModal과 동일한 규격
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Modal, Pressable, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { theme } from '../theme';

interface StoreTagModalProps {
  visible: boolean;
  editing: string | null; // 수정 중인 태그 이름 (null = 추가)
  onClose: () => void;
  onSave: (name: string, oldName?: string) => Promise<void>;
  onDelete: (name: string) => void;
}

const StoreTagModal: React.FC<StoreTagModalProps> = ({ visible, editing, onClose, onSave, onDelete }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setName(editing ?? ''); }, [visible, editing]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('알림', '구입처 이름을 입력해주세요.'); return; }
    setSaving(true);
    await onSave(name.trim(), editing ?? undefined);
    setSaving(false);
  };

  const handleClose = () => { Keyboard.dismiss(); onClose(); };

  const handleDelete = () => {
    if (!editing) return;
    Alert.alert('구입처 삭제', `'${editing}' 구입처를 삭제할까요?\n이 구입처를 쓰던 항목은 미분류가 돼요.`, [
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
            <Text style={cm.title}>{editing ? '구입처 수정' : '구입처 추가'}</Text>
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
              placeholder="예) 이마트, 쿠팡, 동네마트"
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

export default StoreTagModal;
