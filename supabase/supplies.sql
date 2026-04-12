-- 생필품 카테고리 테이블 (사용자 정의)
CREATE TABLE supply_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#9EA8B0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supply_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can access their supply_categories"
  ON supply_categories FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- 생필품 테이블
CREATE TABLE supplies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  category            TEXT NOT NULL DEFAULT '',
  quantity            INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 1,
  note                TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can access their supplies"
  ON supplies FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM user_profiles WHERE id = auth.uid()
    )
  );
