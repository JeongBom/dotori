-- ============================================================
-- 홈 매니저 앱 - Supabase 테이블 설계
-- MySQL과 달리 Supabase는 PostgreSQL 기반이라
-- UUID, TIMESTAMPTZ(타임존 포함 시간), gen_random_uuid() 등을 사용함
-- ============================================================

-- [1] families: 가족 그룹 테이블
-- 여러 가족이 앱을 쓸 수 있도록 가족 단위로 데이터를 격리함
CREATE TABLE families (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- MySQL의 AUTO_INCREMENT 대신 UUID 사용
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- [2] family_members: 가족 구성원 테이블
-- Supabase Auth(로그인 시스템)의 user_id와 연결됨
-- 한 유저가 하나의 가족에 속하는 구조 (UNIQUE 제약)
CREATE TABLE family_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID REFERENCES families(id) ON DELETE CASCADE, -- 가족 삭제 시 구성원도 삭제
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Supabase Auth 유저 참조
  display_name TEXT NOT NULL,
  role         TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')), -- CHECK: MySQL의 ENUM과 유사
  avatar_color TEXT DEFAULT '#667EEA', -- 아바타 색상 (UI에서 구분용)
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id) -- 같은 가족에 중복 가입 방지
);

-- [3] fridge_items: 냉장고 식품 관리
-- expiry_date(유통기한)를 DATE 타입으로 저장해 만료 여부를 쉽게 계산 가능
CREATE TABLE fridge_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID REFERENCES families(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit        TEXT DEFAULT '개',         -- 개, g, ml, 봉지, 병 등
  expiry_date DATE,                      -- NULL이면 유통기한 없음(조미료 등)
  category    TEXT DEFAULT '기타'
    CHECK (category IN ('채소/과일', '육류/해산물', '유제품', '음료/주류', '조미료/소스', '기타')),
  note        TEXT,                      -- 메모 (예: "열어서 냄새 확인 필요")
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- fridge_items 업데이트 시 updated_at 자동 갱신 트리거
-- MySQL의 ON UPDATE CURRENT_TIMESTAMP와 같은 역할
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fridge_items_updated_at
  BEFORE UPDATE ON fridge_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- [4] transactions: 가계부 (지출/수입)
-- amount는 원 단위 정수로 저장 (소수점 불필요)
-- type으로 지출/수입 구분
CREATE TABLE transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id        UUID REFERENCES families(id) ON DELETE CASCADE,
  member_id        UUID REFERENCES family_members(id) ON DELETE SET NULL, -- 구성원 삭제해도 거래내역은 유지
  amount           INTEGER NOT NULL CHECK (amount > 0),
  category         TEXT NOT NULL
    CHECK (category IN ('식비', '교통', '의료/건강', '교육', '여가/문화', '쇼핑', '주거/관리비', '기타')),
  description      TEXT,                -- 거래 메모 (예: "마트 장보기")
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type             TEXT NOT NULL DEFAULT 'expense'
    CHECK (type IN ('expense', 'income')), -- expense: 지출, income: 수입
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 월별 통계 조회를 빠르게 하기 위한 인덱스
-- MySQL과 동일하게 자주 조회하는 컬럼에 인덱스 추가
CREATE INDEX idx_transactions_date ON transactions(family_id, transaction_date);

-- [5] chores: 집안일 To-Do
-- recurrence로 반복 주기 설정 (매일/매주/매월)
-- assigned_to로 가족 구성원에게 담당자 지정
CREATE TABLE chores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID REFERENCES families(id) ON DELETE CASCADE,
  assigned_to     UUID REFERENCES family_members(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  recurrence      TEXT DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
  -- weekly면 0=일,1=월,...,6=토 / monthly면 1~31일
  recurrence_day  INTEGER,
  is_completed    BOOLEAN DEFAULT FALSE,
  completed_at    TIMESTAMPTZ,           -- 완료한 시각 기록
  completed_by    UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- [6] supplies: 생필품 재고 관리
-- quantity가 low_stock_threshold 이하가 되면 앱에서 알림 표시
CREATE TABLE supplies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID REFERENCES families(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit                TEXT DEFAULT '개',
  low_stock_threshold INTEGER DEFAULT 1 CHECK (low_stock_threshold >= 0), -- 이 수량 이하면 "곧 부족" 알림
  category            TEXT DEFAULT '기타'
    CHECK (category IN ('청소용품', '세면용품', '주방용품', '의약품', '반려동물', '기타')),
  note                TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER supplies_updated_at
  BEFORE UPDATE ON supplies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security (RLS): 다른 가족의 데이터를 못 보게 막음
-- MySQL에는 없는 PostgreSQL/Supabase 기능
-- 각 유저는 자신이 속한 family_id의 데이터만 읽기/쓰기 가능
-- ============================================================

ALTER TABLE families        ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridge_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies        ENABLE ROW LEVEL SECURITY;

-- 내가 속한 가족만 조회 가능
CREATE POLICY "가족 구성원만 조회" ON families
  FOR ALL USING (
    id IN (
      SELECT family_id FROM family_members
      WHERE user_id = auth.uid() -- auth.uid(): 현재 로그인한 유저의 ID
    )
  );

-- 나머지 테이블도 동일하게 family_id 기준으로 접근 제어
CREATE POLICY "가족 데이터만 접근" ON family_members
  FOR ALL USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "가족 데이터만 접근" ON fridge_items
  FOR ALL USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "가족 데이터만 접근" ON transactions
  FOR ALL USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "가족 데이터만 접근" ON chores
  FOR ALL USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "가족 데이터만 접근" ON supplies
  FOR ALL USING (
    family_id IN (
      SELECT family_id FROM family_members WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 샘플 데이터 (개발/테스트용 - 실제 배포 시 제거)
-- ============================================================

-- 실제 사용 시엔 Supabase Auth로 가입 후 user_id를 아래에 넣으세요
-- INSERT INTO families (name) VALUES ('우리 가족');
