// 일정 발생(Occurrence) 계산 유틸
// ChoresScreen과 DashboardScreen이 동일한 로직을 공유

import { Chore } from '../types';

// ── 날짜 헬퍼 ─────────────────────────────────

export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

export function addDays(base: string, n: number): string {
  const d = new Date(base + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export function thisMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function thisMonthEnd(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return localDateStr(last);
}

export function thisWeekRange(): [string, string] {
  const d = new Date();
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [localDateStr(monday), localDateStr(sunday)];
}

// ── Occurrence 타입 ───────────────────────────

export interface ChoreOccurrence {
  chore: Chore;
  date: string | null;
  isDone: boolean;
  isOverdue: boolean;
}

// ── 내부 헬퍼 ─────────────────────────────────

function getIntervalDays(chore: Chore): number | null {
  if (chore.repeat_type === 'none') return null;
  if (chore.repeat_type === 'daily') return 1;
  if (chore.repeat_type === 'weekly') return 7;
  if (chore.repeat_type === 'monthly') return 30;
  if (chore.repeat_type === 'custom') {
    if (chore.repeat_unit === 'week' || chore.repeat_unit === 'month') return null;
    return chore.repeat_interval ?? null;
  }
  return null;
}

function isOccurrenceDone(chore: Chore, occDate: string): boolean {
  if (!chore.last_done_at) return false;
  return chore.last_done_at >= occDate;
}

function generateWeeklyDayOccurrences(
  chore: Chore, fromDate: string, toDate: string,
  nWeeks: number, dayOfWeek: number,
): ChoreOccurrence[] {
  const today = todayStr();
  const result: ChoreOccurrence[] = [];
  const anchor = chore.due_date ?? chore.created_at.split('T')[0];
  const anchorDate = new Date(anchor + 'T00:00:00');
  const anchorDay = anchorDate.getDay();
  const diffToTarget = ((dayOfWeek - anchorDay) + 7) % 7;
  const firstOccDate = new Date(anchorDate);
  firstOccDate.setDate(anchorDate.getDate() + diffToTarget);
  const firstOcc = localDateStr(firstOccDate);
  const intervalDays = nWeeks * 7;
  const firstOccTime = new Date(firstOcc + 'T00:00:00').getTime();
  const fromTime = new Date(fromDate + 'T00:00:00').getTime();
  const nStart = Math.max(0, Math.floor((fromTime - firstOccTime) / (intervalDays * 86400000)));

  for (let n = nStart; ; n++) {
    const occDate = addDays(firstOcc, n * intervalDays);
    if (occDate > toDate) break;
    if (chore.end_date && occDate >= chore.end_date) break;
    if (occDate < fromDate) continue;
    if (occDate < today) continue; // 직접 반복: 오늘 이전 발생 제외
    if (chore.excluded_dates?.includes(occDate)) continue;
    const done = isOccurrenceDone(chore, occDate);
    result.push({ chore, date: occDate, isDone: done, isOverdue: !done && occDate < today });
  }
  return result;
}

function generateMonthlyDayOccurrences(
  chore: Chore, fromDate: string, toDate: string,
  nMonths: number, weekOfMonth: number, dayOfWeek: number,
): ChoreOccurrence[] {
  const today = todayStr();
  const result: ChoreOccurrence[] = [];
  const anchor = chore.due_date ?? chore.created_at.split('T')[0];
  const anchorD = new Date(anchor + 'T00:00:00');
  const anchorTotalMonths = anchorD.getFullYear() * 12 + anchorD.getMonth();
  const toD = new Date(toDate + 'T00:00:00');
  const toTotalMonths = toD.getFullYear() * 12 + toD.getMonth();
  const fromD = new Date(fromDate + 'T00:00:00');
  const fromTotalMonths = fromD.getFullYear() * 12 + fromD.getMonth();
  const nStart = Math.max(0, Math.floor((fromTotalMonths - anchorTotalMonths) / nMonths));

  for (let n = nStart; ; n++) {
    const totalMonths = anchorTotalMonths + n * nMonths;
    if (totalMonths > toTotalMonths + 1) break;
    const year = Math.floor(totalMonths / 12);
    const month = totalMonths % 12;
    const firstDay = new Date(year, month, 1);
    const firstDow = firstDay.getDay();
    const diff = ((dayOfWeek - firstDow) + 7) % 7;
    const dayNum = 1 + diff + (weekOfMonth - 1) * 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (dayNum > daysInMonth) continue;
    const occDate = localDateStr(new Date(year, month, dayNum));
    if (occDate > toDate) break;
    if (chore.end_date && occDate >= chore.end_date) break;
    if (occDate < fromDate) continue;
    if (occDate < today) continue; // 직접 반복: 오늘 이전 발생 제외
    if (chore.excluded_dates?.includes(occDate)) continue;
    const done = isOccurrenceDone(chore, occDate);
    result.push({ chore, date: occDate, isDone: done, isOverdue: !done && occDate < today });
  }
  return result;
}

// ── 메인 함수 ─────────────────────────────────

export function generateOccurrences(chores: Chore[], fromDate: string, toDate: string): ChoreOccurrence[] {
  const today = todayStr();
  const result: ChoreOccurrence[] = [];

  for (const chore of chores) {
    if (chore.repeat_type === 'custom' && chore.repeat_unit === 'week' && chore.repeat_day_of_week != null) {
      result.push(...generateWeeklyDayOccurrences(chore, fromDate, toDate, chore.repeat_interval ?? 1, chore.repeat_day_of_week));
      continue;
    }
    if (chore.repeat_type === 'custom' && chore.repeat_unit === 'month' && chore.repeat_day_of_week != null && chore.repeat_week_of_month != null) {
      result.push(...generateMonthlyDayOccurrences(chore, fromDate, toDate, chore.repeat_interval ?? 1, chore.repeat_week_of_month, chore.repeat_day_of_week));
      continue;
    }

    const interval = getIntervalDays(chore);

    if (interval === null) {
      // 단발 to-do
      if (!chore.due_date) {
        // 날짜 없는 단발은 전체 뷰에서만
      } else if (chore.due_date >= fromDate && chore.due_date <= toDate) {
        if (!chore.excluded_dates?.includes(chore.due_date)) {
          result.push({
            chore,
            date: chore.due_date,
            isDone: chore.is_done,
            isOverdue: !chore.is_done && chore.due_date < today,
          });
        }
      }
      continue;
    }

    const anchor = chore.due_date ?? chore.created_at.split('T')[0];
    const anchorTime = new Date(anchor + 'T00:00:00').getTime();
    const fromTime = new Date(fromDate + 'T00:00:00').getTime();
    const intervalMs = interval * 86400000;
    const nStart = Math.max(0, Math.ceil((fromTime - anchorTime) / intervalMs));

    for (let n = nStart; ; n++) {
      const occDate = addDays(anchor, n * interval);
      if (occDate > toDate) break;
      if (chore.end_date && occDate >= chore.end_date) break;
      if (chore.excluded_dates?.includes(occDate)) continue;
      const done = isOccurrenceDone(chore, occDate);
      result.push({ chore, date: occDate, isDone: done, isOverdue: !done && occDate < today });
    }
  }

  return result;
}
