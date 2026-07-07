-- 생필품 재고 부족 알림 on/off (v2)
-- Supabase SQL Editor에서 실행
--
-- notify_low_stock: 수량이 알림 기준 이하로 떨어질 때 알림을 보낼지 여부 (기본 ON)

ALTER TABLE supplies
  ADD COLUMN IF NOT EXISTS notify_low_stock BOOLEAN NOT NULL DEFAULT TRUE;
