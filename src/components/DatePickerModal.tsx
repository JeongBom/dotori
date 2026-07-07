// 날짜 선택 모달 — 음식 구입일/유통기한 선택 (AddFridgeItemScreen 전용)
// 플랫폼별 분기: 웹=직접 입력, 안드로이드=시스템 달력, iOS=인라인 달력
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Modal, Platform, Dimensions,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { theme } from '../theme';
import { todayStr, isValidDate } from '../lib/dateUtils';

// ── 날짜 선택 모달 ────────────────────────────

export interface DatePickerModalProps {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
  title: string;
  minimumDate?: Date;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({ visible, value, onConfirm, onCancel, title, minimumDate }) => {
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [webInput, setWebInput] = useState(''); // 웹 전용 직접 입력값

  useEffect(() => {
    if (visible) {
      setTempDate(value && isValidDate(value) ? new Date(value) : new Date());
      setWebInput(value && isValidDate(value) ? value : todayStr());
    }
  }, [visible, value]);

  const toDateStr = (d: Date) => d.toISOString().split('T')[0];

  const onChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'set' && selected) onConfirm(toDateStr(selected));
      else onCancel();
    } else {
      if (selected) setTempDate(selected);
    }
  };

  if (!visible) return null;

  // 웹: 네이티브 달력 위젯이 없으므로 직접 입력 모달로 대체
  if (Platform.OS === 'web') {
    const confirmWeb = () => {
      const v = webInput.trim();
      if (!isValidDate(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
        Alert.alert('알림', '날짜를 YYYY-MM-DD 형식으로 입력해주세요. 예) 2026-07-15');
        return;
      }
      onConfirm(v);
    };
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={dpStyles.overlay}>
          <View style={[dpStyles.container, { width: 320, paddingHorizontal: 16 }]}>
            <Text style={dpStyles.title}>{title}</Text>
            <TextInput
              style={dpStyles.webInput}
              value={webInput}
              onChangeText={setWebInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.warm.lightOak}
              autoFocus
              onSubmitEditing={confirmWeb}
            />
            <View style={dpStyles.actions}>
              <TouchableOpacity style={dpStyles.cancelBtn} onPress={onCancel}>
                <Text style={dpStyles.cancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={dpStyles.confirmBtn} onPress={confirmWeb}>
                <Text style={dpStyles.confirmText}>확인</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={tempDate}
        mode="date"
        display="calendar"
        onChange={onChange}
        minimumDate={minimumDate}
      />
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const calendarWidth = screenWidth - 32;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={dpStyles.overlay}>
        <View style={[dpStyles.container, { width: calendarWidth }]}>
          <Text style={dpStyles.title}>{title}</Text>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="inline"
            onChange={onChange}
            locale="ko-KR"
            style={{ width: calendarWidth - 16, alignSelf: 'center' }}
            accentColor={theme.colors.brand}
            minimumDate={minimumDate}
          />
          <View style={dpStyles.actions}>
            <TouchableOpacity style={dpStyles.cancelBtn} onPress={onCancel}>
              <Text style={dpStyles.cancelText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dpStyles.confirmBtn} onPress={() => onConfirm(toDateStr(tempDate))}>
              <Text style={dpStyles.confirmText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: theme.colors.warm.ivory, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 16 },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.warm.dark, textAlign: 'center', marginBottom: 4 },
  webInput: {
    backgroundColor: theme.colors.warm.cream, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.warm.edge,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 10,
    fontSize: 16, color: theme.colors.warm.dark, textAlign: 'center',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12, paddingHorizontal: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.warm.edge, alignItems: 'center' },
  cancelText: { color: theme.colors.brand, fontWeight: '600' },
  confirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.colors.brand, alignItems: 'center' },
  confirmText: { color: '#FFFFFF', fontWeight: '700' },
});

export default DatePickerModal;
