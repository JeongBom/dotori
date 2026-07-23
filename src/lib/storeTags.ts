// 구입처 태그 헬퍼
// 태그는 store_tags 테이블에 영구 보관되어, 장보기 항목이 전부 비워져도 남는다.
// 생필품/음식/장보기 화면에서 구입처를 입력·선택하면 ensureStoreTag로 자동 등록된다.

import { supabase } from './supabase';

/**
 * 구입처 태그 제안 목록.
 * store_tags 테이블(등록순) + 아직 테이블에 없는 활성 장보기 항목의 태그를 합쳐 반환.
 * (마이그레이션 전 데이터도 누락 없이 보여주기 위한 합집합)
 */
export async function fetchStoreTagOptions(familyId: string): Promise<string[]> {
  const [tagsRes, itemsRes] = await Promise.all([
    supabase.from('store_tags').select('name').eq('family_id', familyId)
      .order('sort_order', { ascending: true, nullsFirst: false }) // NULL(새 태그)은 맨 뒤
      .order('created_at', { ascending: true }),
    supabase.from('shopping_items').select('store_tag').eq('family_id', familyId).eq('is_active', true),
  ]);
  const fromTable = (tagsRes.data ?? []).map(t => t.name as string);
  const fromItems = (itemsRes.data ?? []).map(t => t.store_tag as string).filter(Boolean);
  return [...new Set([...fromTable, ...fromItems])];
}

/** 태그가 없으면 등록 (이미 있으면 무시). 실패해도 저장 흐름을 막지 않도록 로그만 남김. */
export async function ensureStoreTag(familyId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  try {
    await supabase.from('store_tags').upsert(
      { family_id: familyId, name: trimmed },
      { onConflict: 'family_id,name', ignoreDuplicates: true },
    );
  } catch (e) {
    console.error('ensureStoreTag error:', e);
  }
}

/** 태그 이름 변경 — 장보기 항목·생필품/음식의 기본 구입처까지 함께 갱신 */
export async function renameStoreTag(familyId: string, oldName: string, newName: string): Promise<void> {
  await supabase.from('store_tags').update({ name: newName }).eq('family_id', familyId).eq('name', oldName);
  // 테이블에 없던 옛 태그(마이그레이션 전 데이터)여도 새 이름은 보장
  await ensureStoreTag(familyId, newName);
  await Promise.all([
    supabase.from('shopping_items').update({ store_tag: newName }).eq('family_id', familyId).eq('store_tag', oldName),
    supabase.from('supplies').update({ default_store_tag: newName }).eq('family_id', familyId).eq('default_store_tag', oldName),
    supabase.from('fridge_items').update({ default_store_tag: newName }).eq('family_id', familyId).eq('default_store_tag', oldName),
  ]);
}

/** 태그 순서 저장 — 아직 테이블에 없던 태그(마이그레이션 전 데이터)도 함께 등록됨 */
export async function saveStoreTagOrder(familyId: string, orderedNames: string[]): Promise<void> {
  await supabase.from('store_tags').upsert(
    orderedNames.map((name, i) => ({ family_id: familyId, name, sort_order: i + 1 })),
    { onConflict: 'family_id,name' },
  );
}

/** 태그 삭제 — 해당 태그를 쓰던 항목들은 '미분류'(빈 값)로 되돌림 */
export async function deleteStoreTag(familyId: string, name: string): Promise<void> {
  await supabase.from('store_tags').delete().eq('family_id', familyId).eq('name', name);
  await Promise.all([
    supabase.from('shopping_items').update({ store_tag: '' }).eq('family_id', familyId).eq('store_tag', name),
    supabase.from('supplies').update({ default_store_tag: '' }).eq('family_id', familyId).eq('default_store_tag', name),
    supabase.from('fridge_items').update({ default_store_tag: '' }).eq('family_id', familyId).eq('default_store_tag', name),
  ]);
}
