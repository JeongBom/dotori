-- ============================================================
-- is_active 소프트 삭제 컬럼 추가 마이그레이션
-- 가족 합류/나가기 시 데이터를 실제 삭제하지 않고 숨김 처리
-- ============================================================

-- ① 기존 테이블에 is_active 추가
ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE assets       ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE goals        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE goal_items   ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ② user_profiles에 personal_family_id 추가
-- 가족 합류 시 기존 family_id를 저장해뒀다가 나가기 시 복구에 사용
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS personal_family_id UUID REFERENCES families(id) ON DELETE SET NULL;

-- ③ 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_fridge_active   ON fridge_items(family_id, is_active);
CREATE INDEX IF NOT EXISTS idx_assets_active   ON assets(family_id, is_active);
CREATE INDEX IF NOT EXISTS idx_goals_active    ON goals(family_id, is_active);
