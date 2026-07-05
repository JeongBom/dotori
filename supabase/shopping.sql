-- 장보기 리스트 테이블 (v2 신규)
-- Supabase SQL Editor에서 실행

CREATE TABLE shopping_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',  -- 'fridge' | 'supplies' | 'manual'
  source_id   UUID,                            -- 자동 연동된 원본 아이템 id (fridge_items.id 또는 supplies.id)
  store_tag   TEXT NOT NULL DEFAULT '',        -- 구입처 태그: 이마트 / 쿠팡 / 동네마트 등
  is_checked  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_at  TIMESTAMPTZ
);

ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can access their shopping_items"
  ON shopping_items FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM user_profiles WHERE id = auth.uid()
    )
  );
