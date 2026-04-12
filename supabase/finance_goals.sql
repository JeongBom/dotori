-- ============================================================
-- 재무/목표 관리 테이블 (도토리 앱)
-- Supabase SQL Editor에서 실행
-- ============================================================

-- ① assets: 자산 테이블
-- 가족 단위로 자산을 관리하며, 누가 등록했는지도 user_id로 기록
CREATE TABLE IF NOT EXISTS assets (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE, -- 가족 삭제 시 자산도 삭제
  user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 담당자 (null이면 파트너 소유)
  category  TEXT NOT NULL
    CHECK (category IN ('예금', '적금', '주식', '부동산', '기타')),
  name      TEXT NOT NULL,             -- 자산명 (예: 국민은행 적금, 삼성전자 주식)
  amount    BIGINT NOT NULL DEFAULT 0 CHECK (amount >= 0), -- 원 단위 정수 (소수점 불필요)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- assets updated_at 자동 갱신 트리거
DROP TRIGGER IF EXISTS assets_updated_at ON assets;
CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at(); -- setup_all.sql에서 이미 생성된 함수 재사용

-- 가족별 자산 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_assets_family ON assets(family_id);

ALTER TABLE assets DISABLE ROW LEVEL SECURITY;


-- ② asset_histories: 자산 변경 히스토리
-- 자산 금액이 바뀔 때마다 이전/이후 금액과 변경 이유를 기록
-- MySQL의 변경 로그 테이블과 같은 역할
CREATE TABLE IF NOT EXISTS asset_histories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id         UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE, -- 자산 삭제 시 히스토리도 삭제
  previous_amount  BIGINT NOT NULL DEFAULT 0, -- 변경 전 금액
  new_amount       BIGINT NOT NULL DEFAULT 0, -- 변경 후 금액
  memo             TEXT,                       -- 변경 이유 (예: 월급 입금, 주식 매수)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 특정 자산의 히스토리 시간순 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_asset_histories_asset ON asset_histories(asset_id, created_at DESC);

ALTER TABLE asset_histories DISABLE ROW LEVEL SECURITY;


-- ③ goals: 목표 테이블
-- 자산과 독립적으로 관리 (목표 달성 여부를 자산 잔액과 직접 연결하지 않음)
-- 사용자가 직접 목표 항목을 입력해서 진행률을 트래킹
CREATE TABLE IF NOT EXISTS goals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,              -- 목표명 (예: 유럽 여행, 비상금 마련)
  target_amount BIGINT NOT NULL DEFAULT 0 CHECK (target_amount >= 0), -- 목표 금액
  deadline      DATE,                       -- 목표 달성 기한 (NULL이면 기한 없음)
  memo          TEXT,                       -- 목표 메모
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_family ON goals(family_id);

ALTER TABLE goals DISABLE ROW LEVEL SECURITY;


-- ④ goal_items: 목표 항목
-- 목표를 구성하는 세부 항목 (사용자가 직접 이름/금액 입력)
-- 예: "유럽 여행" 목표 → A계좌(50만원), B적금(30만원), 현금(20만원)
CREATE TABLE IF NOT EXISTS goal_items (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id  UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE, -- 목표 삭제 시 항목도 삭제
  name     TEXT NOT NULL,   -- 항목명 (예: A계좌, 비상금 통장)
  amount   BIGINT NOT NULL DEFAULT 0 CHECK (amount >= 0), -- 해당 항목에 모인 금액
  memo     TEXT             -- 항목 메모
);

CREATE INDEX IF NOT EXISTS idx_goal_items_goal ON goal_items(goal_id);

ALTER TABLE goal_items DISABLE ROW LEVEL SECURITY;
