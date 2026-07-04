-- ============================================================
-- 신규 유저 생성 시 user_profiles 자동 생성 트리거
-- Supabase SQL Editor에서 실행
-- ============================================================

-- auth.users 테이블에 새 row가 insert될 때 자동으로 user_profiles를 생성
-- nickname은 signUp 시 options.data로 전달한 user metadata에서 읽어옴
-- SECURITY DEFINER: 트리거가 함수 소유자 권한으로 실행 (RLS 우회 가능)

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, nickname, role, family_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', ''),
    'owner',
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
