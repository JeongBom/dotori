-- 재고 → 장보기 자동 연동 (v2)
-- Supabase SQL Editor에서 실행
--
-- auto_add_to_shopping: 다 쓰면(임계점 이하/수량 0) 장보기에 자동 추가할지 여부 (기본 ON)
-- default_store_tag:    자동 추가 시 붙일 기본 구입처 태그 (빈 값 = 미분류, optional)

ALTER TABLE supplies
  ADD COLUMN IF NOT EXISTS auto_add_to_shopping BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS default_store_tag    TEXT    NOT NULL DEFAULT '';

ALTER TABLE fridge_items
  ADD COLUMN IF NOT EXISTS auto_add_to_shopping BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS default_store_tag    TEXT    NOT NULL DEFAULT '';
