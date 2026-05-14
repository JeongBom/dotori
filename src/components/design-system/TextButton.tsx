import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

interface TextButtonProps {
  label: string;
  onPress: () => void;
}

const TextButton: React.FC<TextButtonProps> = ({ label, onPress }) => (
  <TouchableOpacity style={s.btn} onPress={onPress} activeOpacity={0.6}>
    <Text style={s.label}>{label}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  btn: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.secondary,
    letterSpacing: -0.1,
  },
});

export default TextButton;
