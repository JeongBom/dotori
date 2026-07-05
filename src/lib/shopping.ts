// 재고 → 장보기 자동 연동 헬퍼
// 생필품(임계점 이하)·음식(수량 0) 시점에 호출되어 장보기 리스트에 자동 추가함.
// 같은 원본(source_id)의 미완료 항목이 이미 있으면 중복 추가하지 않는다.

import { supabase } from './supabase';
import { ShoppingSourceType } from '../types';

export async function autoAddToShopping(
  familyId: string,
  name: string,
  sourceType: ShoppingSourceType,
  sourceId: string,
  storeTag: string = '',   // 품목의 default_store_tag (빈 값 = 미분류)
): Promise<void> {
  try {
    // 이미 장보기에 미완료로 올라가 있으면 스킵
    const { data: existing } = await supabase
      .from('shopping_items')
      .select('id')
      .eq('family_id', familyId)
      .eq('source_id', sourceId)
      .eq('is_active', true)
      .eq('is_checked', false)
      .limit(1);
    if (existing && existing.length > 0) return;

    await supabase.from('shopping_items').insert({
      family_id: familyId,
      name,
      source_type: sourceType,
      source_id: sourceId,
      store_tag: storeTag,
    });
  } catch (e) {
    // 자동 연동 실패가 재고 수량 변경 자체를 막으면 안 되므로 로그만 남김
    console.error('autoAddToShopping error:', e);
  }
}
