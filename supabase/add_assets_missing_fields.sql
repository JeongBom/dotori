-- assets 테이블 누락 컬럼 추가
-- Supabase SQL Editor에서 실행

-- created_at 컬럼 추가 (없을 경우에만)
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- is_active 컬럼 추가 (소프트 삭제용, 없을 경우에만)
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
