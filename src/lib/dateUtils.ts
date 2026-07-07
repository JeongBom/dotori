// 날짜 공용 유틸 — 음식 관리(유통기한/구입일)에서 사용
import { theme } from '../theme';

export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !isNaN(new Date(s).getTime());
}

// D-day 계산 (음식 리스트/통계 공용)
export type DDayStatus = 'expired' | 'soon' | 'ok' | 'none';
export interface DDayInfo { label: string; color: string; status: DDayStatus }

export function getDDay(expiryDate: string | null): DDayInfo {
  if (!expiryDate) return { label: '기한없음', color: theme.colors.warm.lightOak, status: 'none' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
  const diff = Math.round((expiry.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, color: theme.colors.status.danger, status: 'expired' };
  if (diff === 0) return { label: 'D-day', color: theme.colors.status.danger, status: 'soon' };
  if (diff <= 3)  return { label: `D-${diff}`,  color: theme.colors.status.danger, status: 'soon' };
  if (diff <= 7)  return { label: `D-${diff}`,  color: theme.colors.status.warn,   status: 'soon' };
  return { label: `D-${diff}`, color: theme.colors.brand, status: 'ok' };
}
