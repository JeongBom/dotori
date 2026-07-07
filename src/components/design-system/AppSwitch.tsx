// 공용 스위치 — 갈색(브랜드) 트랙 + 청록 썸 조합
import React from 'react';
import { Switch, Platform } from 'react-native';
import { theme } from '../../theme';

interface AppSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

// react-native-web 전용 prop(켜짐 상태 썸 색)이라 타입에 없음 → 스프레드로 전달
const webOnlyProps: Record<string, string> = Platform.OS === 'web' ? { activeThumbColor: theme.colors.teal } : {};

const AppSwitch: React.FC<AppSwitchProps> = ({ value, onValueChange, disabled }) => (
  <Switch
    value={value}
    onValueChange={onValueChange}
    disabled={disabled}
    trackColor={{ false: theme.colors.warm.edge, true: theme.colors.brand }}
    thumbColor={Platform.OS === 'web' ? '#FFFFFF' : theme.colors.teal}
    {...webOnlyProps}
  />
);

export default AppSwitch;
