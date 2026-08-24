// 재고 → 장보기 자동 연동 헬퍼
// 생필품(임계점 이하)·음식(수량 0) 시점에 호출되어 장보기 리스트에 자동 추가함.
// 같은 원본(source_id)의 미완료 항목이 이미 있으면 중복 추가하지 않는다.

import { supabase } from './supabase';
import { ReceiptCategory, ReceiptMatch, ShoppingItem, ShoppingSourceType, StorageType } from '../types';
import {
  loadInventoryForMatching, matchSingleReceiptItem,
  isSameItem, isSimilarItem,
} from './receipt';

export async function autoAddToShopping(
  familyId: string,
  name: string,
  sourceType: ShoppingSourceType,
  sourceId: string,
  storeTag: string = '',   // 품목의 default_store_tag (빈 값 = 미분류)
): Promise<void> {
  try {
    // 이미 장보기에 미완료로 올라가 있으면 스킵
    // — 같은 원본(source_id)뿐 아니라, 직접 추가한 같은 이름(공백 무시)도 중복으로 간주
    const { data: existing } = await supabase
      .from('shopping_items')
      .select('id, name, source_id')
      .eq('family_id', familyId)
      .eq('is_active', true)
      .eq('is_checked', false);
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
    const isDuplicate = (existing ?? []).some(
      e => e.source_id === sourceId || normalize(e.name) === normalize(name),
    );
    if (isDuplicate) return;

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

// ── 장보기 → 재고 역방향 반영 ──────────────────
// 장보기 항목을 체크(구매 완료)했을 때 음식/생필품 재고에 추가하기 위한 분류 헬퍼.
// 실제 등록/수정은 기존 위저드 화면(AddFridgeItem/AddSupply)이 담당한다.

export interface InventoryAddPlan {
  category: ReceiptCategory;    // 추정 분류: 'food' = 음식(fridge_items), 'supply' = 생필품(supplies)
  matched: ReceiptMatch | null; // 이름이 완전히 같은 기존 품목 (있으면 수정 모드 + 개수 +1로 연다)
  // 자동 연동 원본의 이전 설정 — 새 품목으로 다시 등록할 때 그대로 이어받는다
  prefill?: {
    storageType?: StorageType; // 음식 전용
    category?: string;         // 생필품 전용 (카테고리 이름)
    autoAdd?: boolean;
    threshold?: number;
    storeTag?: string;
  };
}

// 어느 쪽 재고에 추가할지 판단 (최종 선택은 사용자가 시트에서 바꿀 수 있음)
// ① 자동 연동 항목이면 출처 그대로 + 원본 설정을 prefill로
// ② 직접 추가한 항목은 기존 재고와 이름 매칭
// ③ 둘 다 아니면 food_database에 있는 이름 = 음식, 그 외 = 생필품
export async function planInventoryAdd(familyId: string, item: ShoppingItem): Promise<InventoryAddPlan> {
  const inventory = await loadInventoryForMatching(familyId);

  if (item.source_type === 'fridge' && item.source_id) {
    const { matched } = matchSingleReceiptItem(item.name, 'food', inventory, true);
    if (matched) return { category: 'food', matched };
    // 원본이 이미 먹은 처리라 매칭에서 빠진 경우 — 보관법·구입처 등 이전 설정을 이어받는다
    const { data } = await supabase.from('fridge_items')
      .select('storage_type, auto_add_to_shopping, low_stock_threshold, default_store_tag')
      .eq('id', item.source_id).single();
    return {
      category: 'food',
      matched: null,
      prefill: data ? {
        storageType: data.storage_type as StorageType,
        autoAdd: data.auto_add_to_shopping ?? true,
        threshold: data.low_stock_threshold ?? 0,
        storeTag: (data.default_store_tag as string) || item.store_tag,
      } : undefined,
    };
  }

  if (item.source_type === 'supplies' && item.source_id) {
    const { matched } = matchSingleReceiptItem(item.name, 'supply', inventory, true);
    if (matched) return { category: 'supply', matched };
    const { data } = await supabase.from('supplies')
      .select('category, auto_add_to_shopping, low_stock_threshold, default_store_tag')
      .eq('id', item.source_id).single();
    return {
      category: 'supply',
      matched: null,
      prefill: data ? {
        category: (data.category as string) ?? '',
        autoAdd: data.auto_add_to_shopping ?? true,
        threshold: data.low_stock_threshold ?? 1,
        storeTag: (data.default_store_tag as string) || item.store_tag,
      } : undefined,
    };
  }

  const { matched, suggestion, category } = matchSingleReceiptItem(item.name, 'food', inventory);
  if (suggestion) return { category, matched };

  const { data } = await supabase.from('food_database').select('name');
  const isFood = (data ?? []).some(
    f => isSameItem(f.name as string, item.name) || isSimilarItem(f.name as string, item.name),
  );
  return { category: isFood ? 'food' : 'supply', matched: null };
}
