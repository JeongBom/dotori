-- 루틴/할일 기능 테이블
-- chore_tags: 사용자 정의 태그
-- chores: 루틴 및 할일 항목

-- ── 태그 ──────────────────────────────────────────────────────

CREATE TABLE chore_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id  UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chore_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can access their chore_tags"
  ON chore_tags FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ── 루틴/할일 ──────────────────────────────────────────────────

CREATE TABLE chores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  tag_id          UUID REFERENCES chore_tags(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES user_profiles(id) ON DELETE SET NULL, -- null = 모두
  repeat_type     TEXT NOT NULL DEFAULT 'none'
                  CHECK (repeat_type IN ('none', 'daily', 'weekly', 'monthly', 'custom')),
  repeat_interval INT CHECK (repeat_interval > 0), -- days (custom 전용)
  due_date        DATE,           -- 마감일 (선택)
  last_done_at    DATE,           -- 마지막 완료일 (반복 추적)
  is_done         BOOLEAN NOT NULL DEFAULT FALSE,  -- none 타입 전용
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "family members can access their chores"
  ON chores FOR ALL
  USING (
    family_id IN (
      SELECT family_id FROM user_profiles WHERE id = auth.uid()
    )
  );
