// 가로 필터 칩 줄 (생필품 카테고리·장보기 구입처 공용)
// - 탭: onPressChip (필터 선택)
// - 길게 누르기: onLongPressChip (편집 시트 열기)
import React from 'react';
import { ScrollView, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';

interface ChipFilterRowProps {
  keys: string[];
  chipStyle: (key: string) => StyleProp<ViewStyle>;
  renderChipContent: (key: string) => React.ReactNode;
  onPressChip: (key: string) => void;
  onLongPressChip?: (key: string) => void;
  leading?: React.ReactNode;   // 앞 고정 칩 (예: 전체)
  trailing?: React.ReactNode;  // 뒤 고정 칩 (예: 사용완료, + 추가)
}

const ChipFilterRow: React.FC<ChipFilterRowProps> = ({
  keys, chipStyle, renderChipContent, onPressChip, onLongPressChip, leading, trailing,
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal: 16, gap: 6, alignItems: 'center' }}
  >
    {leading}
    {keys.map(key => (
      <TouchableOpacity
        key={key}
        style={chipStyle(key)}
        onPress={() => onPressChip(key)}
        onLongPress={onLongPressChip ? () => onLongPressChip(key) : undefined}
        delayLongPress={350}
      >
        {renderChipContent(key)}
      </TouchableOpacity>
    ))}
    {trailing}
  </ScrollView>
);

export default ChipFilterRow;
