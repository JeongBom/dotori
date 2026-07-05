-- Realtime 구독 활성화 (v2)
-- Supabase SQL Editor에서 실행
--
-- ① supabase_realtime publication에 테이블 추가 → 변경 이벤트가 클라이언트로 방송됨
-- ② REPLICA IDENTITY FULL → 삭제/수정 이벤트에도 family_id가 실려서
--    가족 단위 필터(family_id=eq.xxx)가 정상 동작함

ALTER PUBLICATION supabase_realtime ADD TABLE fridge_items;
ALTER PUBLICATION supabase_realtime ADD TABLE supplies;
ALTER PUBLICATION supabase_realtime ADD TABLE supply_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_items;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;

ALTER TABLE fridge_items      REPLICA IDENTITY FULL;
ALTER TABLE supplies          REPLICA IDENTITY FULL;
ALTER TABLE supply_categories REPLICA IDENTITY FULL;
ALTER TABLE shopping_items    REPLICA IDENTITY FULL;
ALTER TABLE notes             REPLICA IDENTITY FULL;
