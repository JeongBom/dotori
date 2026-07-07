-- 웹 푸시 구독 저장 테이블 (v2)
-- Supabase SQL Editor에서 실행
--
-- 각 기기(브라우저)가 발급받은 푸시 구독증을 저장.
-- 발송은 Edge Function(service role)이 수행하므로 RLS는 본인/가족 관리용.

CREATE TABLE push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,   -- 브라우저가 발급한 푸시 주소
  p256dh     TEXT NOT NULL,          -- 암호화 공개키
  auth       TEXT NOT NULL,          -- 인증 시크릿
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can access their push_subscriptions"
  ON push_subscriptions FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM user_profiles WHERE id = auth.uid()
    )
  );
