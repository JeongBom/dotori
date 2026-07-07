-- 아침 9시(KST) 정기 브리핑 크론 등록
-- Supabase SQL Editor에서 실행
--
-- ⚠️ 실행 전: 아래 <CRON_SECRET>을 터미널에서 등록한 값과 똑같이 바꿔주세요.
--    (npx supabase secrets set CRON_SECRET=... 으로 등록한 값)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 매일 UTC 00:00 = 한국시간 오전 9시
SELECT cron.schedule(
  'dotori-daily-briefing',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://cpdtpmpixxiqtrepqrqv.supabase.co/functions/v1/daily-briefing',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- 등록 확인
SELECT jobname, schedule FROM cron.job WHERE jobname = 'dotori-daily-briefing';
