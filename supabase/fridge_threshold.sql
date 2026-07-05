-- 음식 장보기 기준 수량 (v2)
-- Supabase SQL Editor에서 실행
--
-- low_stock_threshold: 이 수량 이하가 되면 장보기 자동 추가.
--   0 (기본값) = 다 쓰면(수량 0/다 먹음) 추가 → 기존 동작 유지

ALTER TABLE fridge_items
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 0;
