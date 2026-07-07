// 홈 대시보드 데이터 조회
// DashboardScreen에서 사용하는 요약 데이터 타입과 패치 함수

import { supabase } from './supabase';

// ── 날짜 헬퍼 ─────────────────────────────────
function localDate(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── 데이터 타입 ───────────────────────────────
export interface Member { id: string; nickname: string }
export interface UrgentItem { name: string; type: 'expired' | 'expiring' | 'lowstock'; dday?: string }
export interface StockItem { name: string; qty: number; min_qty: number; notify: boolean }
export interface NoteItem { id: string; title: string }
export interface ShoppingLite { id: string; name: string; store_tag: string }
export interface ActivityItem {
  id: string;
  type: 'food' | 'supply' | 'note';
  action: string;
  name: string;
  timestamp: string;
  emoji: string;
}

export interface DashboardData {
  fridgeTotal: number;
  fridgeExpiring: number;
  fridgeExpired: number;
  stockItems: StockItem[];
  lowStockCount: number;
  shoppingTodo: ShoppingLite[];
  shoppingTodoCount: number;
  recentNotes: NoteItem[];
  urgentItems: UrgentItem[];
  members: Member[];
  activities: ActivityItem[];
}

// ── 데이터 패치 ───────────────────────────────
export async function fetchDashboard(familyId: string, notifyDays: number): Promise<DashboardData> {
  const today = localDate();
  const sooner = localDate(notifyDays);

  const [
    fridgeTotalRes, fridgeExpiringRes, fridgeExpiredRes, fridgeExpItemsRes,
    suppliesRes, notesRes, membersRes,
    recentFridgeRes, shoppingRes,
  ] = await Promise.all([
    supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_consumed', false),
    supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_consumed', false).gte('expiry_date', today).lte('expiry_date', sooner),
    supabase.from('fridge_items').select('id', { count: 'exact', head: true }).eq('family_id', familyId).eq('is_consumed', false).lt('expiry_date', today),
    supabase.from('fridge_items').select('food_name, expiry_date').eq('family_id', familyId).eq('is_consumed', false).lte('expiry_date', sooner).order('expiry_date').limit(5),
    // 수량 0(사용완료) 제외
    supabase.from('supplies').select('id, name, quantity, low_stock_threshold, notify_low_stock, created_at').eq('family_id', familyId).eq('is_active', true).gt('quantity', 0).limit(6),
    supabase.from('notes').select('id, title, updated_at').eq('family_id', familyId).order('updated_at', { ascending: false }).limit(4),
    supabase.from('user_profiles').select('id, nickname').eq('family_id', familyId).limit(4),
    supabase.from('fridge_items').select('id, food_name, created_at').eq('family_id', familyId).eq('is_consumed', false).order('created_at', { ascending: false }).limit(4),
    supabase.from('shopping_items').select('id, name, store_tag', { count: 'exact' }).eq('family_id', familyId).eq('is_active', true).eq('is_checked', false).order('created_at', { ascending: false }).limit(3),
  ]);

  const stockItems: StockItem[] = (suppliesRes.data ?? []).map(s => ({
    name: s.name,
    qty: s.quantity,
    min_qty: s.low_stock_threshold ?? 1,
    notify: s.notify_low_stock ?? true,
  }));
  // 부족 카운트: 알림이 켜진 품목만
  const lowStockCount = stockItems.filter(s => s.notify && s.qty <= s.min_qty).length;

  const shoppingTodo: ShoppingLite[] = (shoppingRes.data ?? []).map(it => ({
    id: it.id,
    name: it.name,
    store_tag: it.store_tag ?? '',
  }));

  const recentNotes: NoteItem[] = (notesRes.data ?? []).map(n => ({
    id: n.id,
    title: n.title ?? '(제목 없음)',
  }));

  const members: Member[] = (membersRes.data ?? []).map(m => ({
    id: m.id,
    nickname: m.nickname ?? '?',
  }));

  const urgentItems: UrgentItem[] = [];
  for (const item of (fridgeExpItemsRes.data ?? [])) {
    const diff = Math.ceil((new Date(item.expiry_date).getTime() - new Date(today).getTime()) / 86400000);
    if (diff < 0) urgentItems.push({ name: item.food_name, type: 'expired', dday: `D+${Math.abs(diff)}` });
    else urgentItems.push({ name: item.food_name, type: 'expiring', dday: diff === 0 ? 'D-day' : `D-${diff}` });
  }
  for (const s of stockItems.filter(s => s.notify && s.qty <= s.min_qty).slice(0, 3)) {
    urgentItems.push({ name: s.name, type: 'lowstock' });
  }

  const allActivities: ActivityItem[] = [];
  for (const f of (recentFridgeRes.data ?? [])) {
    allActivities.push({ id: f.id, type: 'food', action: '추가됨', name: f.food_name, timestamp: f.created_at, emoji: '🥬' });
  }
  const sortedSupplies = [...(suppliesRes.data ?? [])]
    .filter(s => s.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);
  for (const s of sortedSupplies) {
    allActivities.push({ id: s.id ?? s.name, type: 'supply', action: '추가됨', name: s.name, timestamp: s.created_at, emoji: '🧴' });
  }
  for (const n of (notesRes.data ?? [])) {
    if (n.updated_at) {
      allActivities.push({ id: n.id, type: 'note', action: '작성/수정됨', name: n.title ?? '(제목 없음)', timestamp: n.updated_at, emoji: '📝' });
    }
  }
  const activities = allActivities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  return {
    fridgeTotal: fridgeTotalRes.count ?? 0,
    fridgeExpiring: fridgeExpiringRes.count ?? 0,
    fridgeExpired: fridgeExpiredRes.count ?? 0,
    stockItems, lowStockCount,
    shoppingTodo, shoppingTodoCount: shoppingRes.count ?? 0,
    recentNotes, urgentItems, members, activities,
  };
}
