-- fridge_items에 quantity 컬럼 추가
ALTER TABLE fridge_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
