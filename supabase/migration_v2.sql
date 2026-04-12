-- ============================================================
-- 마이그레이션 v2 (도토리 앱)
-- Supabase SQL Editor에서 실행
-- ============================================================

-- ① assets 누락 컬럼 추가
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN     NOT NULL DEFAULT TRUE;

-- ② goals 누락 컬럼 추가 (시작/종료기간, 소프트삭제)
ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN  NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS start_date  DATE,
  ADD COLUMN IF NOT EXISTS end_date    DATE;

-- ③ goal_items 누락 컬럼 추가
ALTER TABLE goal_items
  ADD COLUMN IF NOT EXISTS asset_id    UUID REFERENCES assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS saved_date  DATE,
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE;

-- ④ RLS 비활성화 (테스트 환경)
ALTER TABLE goals       DISABLE ROW LEVEL SECURITY;
ALTER TABLE goal_items  DISABLE ROW LEVEL SECURITY;
ALTER TABLE assets      DISABLE ROW LEVEL SECURITY;
