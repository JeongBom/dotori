import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { theme } from '../../theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  loading = false,
  disabled = false,
  fullWidth = true,
}) => {
  const isInactive = loading || disabled;

  return (
    <TouchableOpacity
      style={[s.btn, !fullWidth && s.narrow, isInactive && s.dimmed]}
      onPress={onPress}
      disabled={isInactive}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color="#FFFFFF" size="small" />
        : <Text style={s.label}>{label}</Text>
      }
    </TouchableOpacity>
  );
};

const s = StyleSheet.create({
  btn: {
    height: 44,
    backgroundColor: theme.colors.brand,
    borderRadius: theme.radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  narrow: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.xl,
  },
  dimmed: {
    opacity: 0.45,
  },
  label: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
});

export default PrimaryButton;
