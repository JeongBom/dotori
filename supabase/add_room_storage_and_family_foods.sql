-- ============================================================
-- 마이그레이션: 실온 보관 + 자주 쓰는 음식 등록 기능
-- Supabase SQL Editor에서 실행
-- ============================================================

-- 1. food_database에 room_days 컬럼 추가
ALTER TABLE food_database ADD COLUMN IF NOT EXISTS room_days INTEGER;

-- 2. fridge_items storage_type CHECK에 '실온' 추가
--    CHECK 제약 조건은 drop/recreate 필요
ALTER TABLE fridge_items DROP CONSTRAINT IF EXISTS fridge_items_storage_type_check;
ALTER TABLE fridge_items
  ADD CONSTRAINT fridge_items_storage_type_check
  CHECK (storage_type IN ('냉장', '냉동', '실온'));

-- 3. 가족이 직접 등록한 자주 쓰는 음식 테이블
CREATE TABLE IF NOT EXISTS family_foods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  fridge_days  INTEGER,
  freezer_days INTEGER,
  room_days    INTEGER,
  UNIQUE(family_id, name)
);
ALTER TABLE family_foods DISABLE ROW LEVEL SECURITY;
