-- ============================================================
-- 테스트용: RLS 비활성화 + 기본 가족 데이터 삽입
-- 인증(Auth) 붙이기 전까지만 사용. 실제 배포 시 제거할 것.
-- ============================================================

-- 1. 모든 테이블 RLS 비활성화 (anon 사용자도 자유롭게 접근 가능)
ALTER TABLE families        DISABLE ROW LEVEL SECURITY;
ALTER TABLE family_members  DISABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_items    DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    DISABLE ROW LEVEL SECURITY;
ALTER TABLE chores          DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplies        DISABLE ROW LEVEL SECURITY;

-- 2. fridge_update.sql에서 생성된 user_settings, food_database 테이블도 비활성화
ALTER TABLE user_settings   DISABLE ROW LEVEL SECURITY;
ALTER TABLE food_database   DISABLE ROW LEVEL SECURITY;

-- 3. 기본 가족 레코드 삽입 (없을 때만)
INSERT INTO families (name)
SELECT '우리 가족'
WHERE NOT EXISTS (SELECT 1 FROM families LIMIT 1);
