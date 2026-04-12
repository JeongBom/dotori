-- 음식 카테고리 커스터마이징 테이블
-- 기본 카테고리(is_default=true)는 FridgeScreen 최초 로드 시 자동 삽입됨
-- 색상 변경 가능 / 커스텀 카테고리 추가·삭제 가능

CREATE TABLE fridge_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#9EA8B0',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE fridge_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can access their fridge_categories"
  ON fridge_categories FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM user_profiles WHERE id = auth.uid()
    )
  );
