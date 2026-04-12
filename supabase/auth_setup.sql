-- ============================================================
-- 인증/사용자 프로필 세팅 (도토리 앱)
-- Supabase SQL Editor에서 실행
-- ============================================================

-- ① families 테이블에 invite_code 컬럼 추가
-- 가족 참여 시 사용하는 6자리 초대 코드
ALTER TABLE families ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

-- 기존 가족 데이터에 초대 코드 자동 생성 (없는 경우)
UPDATE families
SET invite_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6))
WHERE invite_code IS NULL;

-- 이후 신규 가족 생성 시 invite_code 자동 생성 트리거
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS families_invite_code ON families;
CREATE TRIGGER families_invite_code
  BEFORE INSERT ON families
  FOR EACH ROW EXECUTE FUNCTION generate_invite_code();

-- ② user_profiles: 로그인한 유저의 닉네임/역할/가족 정보
-- Supabase Auth(auth.users)와 1:1 연결
CREATE TABLE IF NOT EXISTS user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- auth.users.id와 동일
  family_id  UUID REFERENCES families(id) ON DELETE SET NULL, -- 가족 탈퇴해도 계정 유지
  nickname   TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'member')), -- owner: 가족 생성자, member: 참여자
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- ③ user_profiles updated_at 트리거 (필요 시)
-- user_profiles는 nickname/role 변경이 드물어 updated_at 생략
