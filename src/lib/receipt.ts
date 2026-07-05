// 영수증 스캔 → 재고 반영 로직
// ① parseReceipt: Edge Function 호출 (이미지 → 품목 목록)
// ② matchReceiptItems: 인식된 품목을 기존 재고와 이름 매칭
// ③ applyReceiptItems: 확인 화면에서 수정된 결과를 DB에 반영
//    (기존 품목은 수량 증가, 없던 품목은 새로 추가)

import { supabase } from './supabase';
import { ParsedReceiptItem, ReceiptReviewItem } from '../types';

// ── ① 영수증 파싱 (Edge Function 호출) ─────────
export async function parseReceipt(imageBase64: string, mimeType: string): Promise<ParsedReceiptItem[]> {
  const { data, error } = await supabase.functions.invoke('parse-receipt', {
    body: { image: imageBase64, mimeType },
  });
  if (error) throw new Error(error.message ?? '영수증 분석 요청에 실패했습니다');
  if (data?.error) throw new Error(data.error);
  return (data?.items ?? []) as ParsedReceiptItem[];
}

// ── 매칭용 기존 재고 로드 ───────────────────────
interface FridgeLite { id: string; name: string; quantity: number; is_consumed: boolean }
interface SupplyLite { id: string; name: string; quantity: number }

export interface InventorySnapshot {
  fridge: FridgeLite[];
  supplies: SupplyLite[];
}

export async function loadInventoryForMatching(familyId: string): Promise<InventorySnapshot> {
  const [fridgeRes, suppliesRes] = await Promise.all([
    // 소진된(is_consumed) 음식도 포함 — 다 먹은 걸 다시 사오는 경우가 흔해서 부활 대상
    supabase.from('fridge_items').select('id, name, quantity, is_consumed').eq('family_id', familyId),
    supabase.from('supplies').select('id, name, quantity').eq('family_id', familyId).eq('is_active', true),
  ]);
  return {
    fridge: (fridgeRes.data ?? []) as FridgeLite[],
    supplies: (suppliesRes.data ?? []) as SupplyLite[],
  };
}

// ── ② 이름 매칭 ────────────────────────────────
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

// 정규화 후 동일하거나, 한쪽이 다른 쪽을 포함(2자 이상)하면 같은 품목으로 간주
function isSameItem(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 2 && nb.length >= 2 && (na.includes(nb) || nb.includes(na))) return true;
  return false;
}

export function matchReceiptItems(
  parsed: ParsedReceiptItem[],
  inventory: InventorySnapshot,
): ReceiptReviewItem[] {
  return parsed.map((p, i) => {
    const fridgeHit = inventory.fridge.find(f => isSameItem(f.name, p.name));
    const supplyHit = inventory.supplies.find(s => isSameItem(s.name, p.name));

    // AI 분류와 같은 쪽 매칭을 우선, 없으면 반대쪽도 허용
    let matched: ReceiptReviewItem['matched'] = null;
    if (p.category === 'food' && fridgeHit) {
      matched = { table: 'fridge', id: fridgeHit.id, name: fridgeHit.name, quantity: fridgeHit.is_consumed ? 0 : fridgeHit.quantity };
    } else if (p.category === 'supply' && supplyHit) {
      matched = { table: 'supplies', id: supplyHit.id, name: supplyHit.name, quantity: supplyHit.quantity };
    } else if (fridgeHit) {
      matched = { table: 'fridge', id: fridgeHit.id, name: fridgeHit.name, quantity: fridgeHit.is_consumed ? 0 : fridgeHit.quantity };
    } else if (supplyHit) {
      matched = { table: 'supplies', id: supplyHit.id, name: supplyHit.name, quantity: supplyHit.quantity };
    }

    return {
      key: `receipt-${i}`,
      name: p.name,
      quantity: p.quantity,
      // 매칭됐으면 매칭된 테이블 기준으로 분류 고정
      category: matched ? (matched.table === 'fridge' ? 'food' : 'supply') : p.category,
      matched,
      excluded: false,
    };
  });
}

// ── ③ 반영 ─────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export interface ApplyResult {
  applied: number;
  failed: number;
}

export async function applyReceiptItems(familyId: string, items: ReceiptReviewItem[]): Promise<ApplyResult> {
  let applied = 0;
  let failed = 0;

  for (const item of items) {
    if (item.excluded || !item.name.trim()) continue;
    try {
      if (item.matched?.table === 'fridge') {
        // 기존 음식: 수량 증가 + 소진 상태였다면 부활
        const { error } = await supabase.from('fridge_items').update({
          quantity: item.matched.quantity + item.quantity,
          is_consumed: false,
          consumed_at: null,
          stored_date: todayStr(),
        }).eq('id', item.matched.id);
        if (error) throw error;
      } else if (item.matched?.table === 'supplies') {
        // 기존 생필품: 수량 증가
        const { error } = await supabase.from('supplies').update({
          quantity: item.matched.quantity + item.quantity,
        }).eq('id', item.matched.id);
        if (error) throw error;
      } else if (item.category === 'food') {
        // 신규 음식 (보관 냉장, 유통기한 미정 — 상세는 나중에 수정 가능)
        const { error } = await supabase.from('fridge_items').insert({
          family_id: familyId,
          name: item.name.trim(),
          storage_type: '냉장',
          quantity: item.quantity,
          stored_date: todayStr(),
          expiry_date: null,
          is_consumed: false,
          consumed_at: null,
        });
        if (error) throw error;
      } else {
        // 신규 생필품
        const { error } = await supabase.from('supplies').insert({
          family_id: familyId,
          name: item.name.trim(),
          category: '',
          quantity: item.quantity,
          low_stock_threshold: 1,
          is_active: true,
        });
        if (error) throw error;
      }
      applied += 1;
    } catch (e) {
      console.error('applyReceiptItems error:', item.name, e);
      failed += 1;
    }
  }

  return { applied, failed };
}
