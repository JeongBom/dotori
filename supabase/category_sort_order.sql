-- 카테고리/구입처 태그 순서 변경 지원
-- Supabase SQL Editor에서 실행
-- sort_order가 NULL인 행(새로 추가된 것)은 목록 맨 뒤에 등록순으로 붙는다.

ALTER TABLE supply_categories ADD COLUMN IF NOT EXISTS sort_order INTEGER;
ALTER TABLE store_tags        ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- 기존 데이터는 등록순으로 1, 2, 3… 백필
UPDATE supply_categories sc SET sort_order = t.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY family_id ORDER BY created_at) AS rn
  FROM supply_categories
) t
WHERE sc.id = t.id AND sc.sort_order IS NULL;

UPDATE store_tags st SET sort_order = t.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY family_id ORDER BY created_at) AS rn
  FROM store_tags
) t
WHERE st.id = t.id AND st.sort_order IS NULL;
