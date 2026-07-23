-- 구입처 태그 테이블 (v2 신규)
-- Supabase SQL Editor에서 실행
-- 장보기 항목이 전부 비워져도(완료 항목 비우기 등) 태그가 사라지지 않도록
-- 태그를 별도 테이블에 영구 보관한다.

CREATE TABLE store_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, name)
);

ALTER TABLE store_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can access their store_tags"
  ON store_tags FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- 기존 데이터에 흩어져 있는 태그를 옮겨심기
-- (장보기 항목의 store_tag + 생필품/음식의 기본 구입처)
INSERT INTO store_tags (family_id, name)
SELECT DISTINCT family_id, store_tag        FROM shopping_items WHERE store_tag <> ''
UNION
SELECT DISTINCT family_id, default_store_tag FROM supplies      WHERE default_store_tag <> ''
UNION
SELECT DISTINCT family_id, default_store_tag FROM fridge_items  WHERE default_store_tag <> ''
ON CONFLICT (family_id, name) DO NOTHING;
