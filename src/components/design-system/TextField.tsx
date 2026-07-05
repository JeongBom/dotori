import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { theme } from '../../theme';

interface TextFieldProps extends Pick<TextInputProps,
  | 'placeholder'
  | 'secureTextEntry'
  | 'keyboardType'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'maxLength'
  | 'keyboardAppearance'
  | 'autoFocus'
> {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  labelHint?: string;
  hint?: string;
  error?: string;
}

const TextField: React.FC<TextFieldProps> = ({
  value,
  onChangeText,
  label,
  labelHint,
  hint,
  error,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  returnKeyType,
  onSubmitEditing,
  maxLength,
  keyboardAppearance,
  autoFocus,
}) => {
  const [focused, setFocused] = useState(false);
  const [secureVisible, setSecureVisible] = useState(false);

  return (
    <View style={s.wrap}>
      {(label || labelHint) && (
        <View style={s.labelRow}>
          {label && <Text style={s.label}>{label}</Text>}
          {labelHint && <Text style={s.labelHint}>{labelHint}</Text>}
        </View>
      )}

      <View style={s.inputWrap}>
        <TextInput
          style={[
            s.input,
            secureTextEntry && s.inputSecure,
            focused && s.inputFocused,
            !!error && s.inputError,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.warm.lightOak}
          secureTextEntry={secureTextEntry && !secureVisible}
          keyboardType={keyboardType}
          autoCapitalize={secureTextEntry ? 'none' : autoCapitalize}
          autoCorrect={secureTextEntry ? false : autoCorrect}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          maxLength={maxLength}
          keyboardAppearance={keyboardAppearance}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={s.eyeBtn}
            onPress={() => setSecureVisible(v => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {secureVisible
              ? <EyeOff size={20} strokeWidth={1.5} color={theme.colors.warm.lightOak} />
              : <Eye size={20} strokeWidth={1.5} color={theme.colors.warm.lightOak} />
            }
          </TouchableOpacity>
        )}
      </View>

      {(error || hint) && (
        <Text style={error ? s.error : s.hint} numberOfLines={2}>
          {error ?? hint}
        </Text>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { gap: theme.spacing.sm },

  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text.secondary,
    letterSpacing: -0.2,
  },
  labelHint: {
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.warm.lightOak,
  },

  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.card,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: theme.fontSize.lg,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.divider,
  },
  inputSecure: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
  },
  inputFocused: {
    borderColor: theme.colors.brand,
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: theme.colors.status.danger,
    borderWidth: 1.5,
  },

  hint: {
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.text.secondary,
  },
  error: {
    fontSize: theme.fontSize.body,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.status.danger,
  },
});

export default TextField;
