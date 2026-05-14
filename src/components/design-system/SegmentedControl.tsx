import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../../theme';

interface SegmentedOption {
  label: string;
  value: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ options, value, onChange }) => (
  <View style={s.container}>
    {options.map(opt => {
      const isActive = opt.value === value;
      return (
        <TouchableOpacity
          key={opt.value}
          style={[s.segment, isActive && s.segmentActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <Text style={[s.label, isActive && s.labelActive]}>{opt.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.divider,
    borderRadius: theme.radius.lg,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius.card,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: theme.colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text.secondary,
  },
  labelActive: {
    color: theme.colors.text.primary,
  },
});

export default SegmentedControl;
