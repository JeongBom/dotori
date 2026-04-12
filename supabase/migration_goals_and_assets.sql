-- ============================================================
-- 통합 마이그레이션 (도토리 앱)
-- Supabase SQL Editor에서 실행
-- ============================================================

-- ① assets 누락 컬럼 추가
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN     NOT NULL DEFAULT TRUE;

-- ② goals 누락 컬럼 추가
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN     NOT NULL DEFAULT TRUE;

-- ③ goal_items 누락 컬럼 추가
--    asset_id: 어떤 자산에서 목표 금액을 지정했는지 (자산 삭제 시 null로)
ALTER TABLE goal_items
  ADD COLUMN IF NOT EXISTS asset_id    UUID REFERENCES assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN     NOT NULL DEFAULT TRUE;
