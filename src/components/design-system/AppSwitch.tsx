// 공용 스위치 — 잎사귀 그린 트랙 + 흰 썸
// 웹에서 RN 기본 스위치의 활성 썸이 청록색으로 새는 문제(activeThumbColor)도 여기서 해결
import React from 'react';
import { Switch, Platform } from 'react-native';
import { theme } from '../../theme';

interface AppSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

// react-native-web 전용 prop이라 타입에 없음 → 스프레드로 전달
const webOnlyProps: Record<string, string> = Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {};

const AppSwitch: React.FC<AppSwitchProps> = ({ value, onValueChange, disabled }) => (
  <Switch
    value={value}
    onValueChange={onValueChange}
    disabled={disabled}
    trackColor={{ false: theme.colors.warm.edge, true: theme.colors.status.safe }}
    thumbColor="#FFFFFF"
    {...webOnlyProps}
  />
);

export default AppSwitch;
