-- ============================================================
-- 포근 앱 전체 DB 세팅 (테스트용 - RLS 비활성화 포함)
-- Supabase SQL Editor에서 한 번에 실행
-- ============================================================

-- ① updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ② families
CREATE TABLE IF NOT EXISTS families (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE families DISABLE ROW LEVEL SECURITY;

-- ③ fridge_items (기존 테이블 삭제 후 재생성)
DROP TABLE IF EXISTS fridge_items CASCADE;
CREATE TABLE fridge_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT '기타'
    CHECK (category IN ('잎채소','뿌리채소','과일','육류','해산물','유제품','가공식품','기타')),
  storage_type  TEXT NOT NULL DEFAULT '냉장'
    CHECK (storage_type IN ('냉장','냉동')),
  stored_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date   DATE,
  is_consumed   BOOLEAN NOT NULL DEFAULT FALSE,
  consumed_at   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS fridge_items_updated_at ON fridge_items;
CREATE TRIGGER fridge_items_updated_at
  BEFORE UPDATE ON fridge_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE INDEX IF NOT EXISTS idx_fridge_expiry ON fridge_items(family_id, expiry_date, is_consumed);
ALTER TABLE fridge_items DISABLE ROW LEVEL SECURITY;

-- ④ food_database
DROP TABLE IF EXISTS food_database CASCADE;
CREATE TABLE food_database (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  category     TEXT NOT NULL
    CHECK (category IN ('잎채소','뿌리채소','과일','육류','해산물','유제품','가공식품','기타')),
  fridge_days  INTEGER,
  freezer_days INTEGER
);
ALTER TABLE food_database DISABLE ROW LEVEL SECURITY;

-- ⑤ user_settings
DROP TABLE IF EXISTS user_settings CASCADE;
CREATE TABLE user_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID NOT NULL UNIQUE REFERENCES families(id) ON DELETE CASCADE,
  notify_days_before  INTEGER NOT NULL DEFAULT 3
    CHECK (notify_days_before IN (1,2,3,5,7)),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
ALTER TABLE user_settings DISABLE ROW LEVEL SECURITY;

-- ⑥ 기본 가족 데이터 삽입 (없을 때만)
INSERT INTO families (name)
SELECT '우리 가족'
WHERE NOT EXISTS (SELECT 1 FROM families LIMIT 1);

-- ⑦ food_database 기준 데이터 200개
INSERT INTO food_database (name, category, fridge_days, freezer_days) VALUES
('사과','과일',21,NULL),('배','과일',7,NULL),('포도','과일',5,60),
('딸기','과일',3,60),('바나나','과일',5,NULL),('귤','과일',14,NULL),
('복숭아','과일',5,60),('수박','과일',3,NULL),('참외','과일',4,NULL),
('블루베리','과일',5,60),('체리','과일',5,60),('키위','과일',7,NULL),
('망고','과일',4,60),('파인애플','과일',4,60),('레몬','과일',14,NULL),
('오렌지','과일',14,NULL),('자몽','과일',14,NULL),('감','과일',7,60),
('무화과','과일',2,60),('메론','과일',5,NULL),('체리토마토','과일',7,NULL),
('방울토마토','과일',7,NULL),('토마토','과일',7,NULL),('자두','과일',5,NULL),
('아보카도','과일',5,NULL),('석류','과일',14,NULL),('살구','과일',5,NULL),
('리치','과일',5,NULL),('대추','과일',14,NULL),
('시금치','잎채소',3,NULL),('상추','잎채소',3,NULL),('깻잎','잎채소',3,NULL),
('양상추','잎채소',5,NULL),('배추','잎채소',7,NULL),('브로콜리','잎채소',7,90),
('케일','잎채소',5,NULL),('쑥갓','잎채소',3,NULL),('청경채','잎채소',4,NULL),
('파슬리','잎채소',5,NULL),('아욱','잎채소',3,NULL),('미나리','잎채소',3,NULL),
('부추','잎채소',3,NULL),('냉이','잎채소',3,NULL),('취나물','잎채소',3,NULL),
('고수','잎채소',3,NULL),('루꼴라','잎채소',3,NULL),('시소','잎채소',3,NULL),
('적상추','잎채소',3,NULL),('열무','잎채소',3,NULL),('쌈채소','잎채소',3,NULL),
('비타민채','잎채소',3,NULL),('치커리','잎채소',3,NULL),('겨자잎','잎채소',3,NULL),
('당근','뿌리채소',14,NULL),('무','뿌리채소',14,NULL),('감자','뿌리채소',14,NULL),
('고구마','뿌리채소',14,NULL),('양파','뿌리채소',7,NULL),('마늘','뿌리채소',14,NULL),
('생강','뿌리채소',14,NULL),('비트','뿌리채소',14,NULL),('파','뿌리채소',7,NULL),
('대파','뿌리채소',7,NULL),('쪽파','뿌리채소',5,NULL),('셀러리','뿌리채소',7,NULL),
('오이','뿌리채소',7,NULL),('가지','뿌리채소',5,NULL),('애호박','뿌리채소',7,NULL),
('피망','뿌리채소',7,NULL),('파프리카','뿌리채소',7,NULL),('양배추','뿌리채소',14,NULL),
('콜라비','뿌리채소',14,NULL),('아스파라거스','뿌리채소',3,90),('버섯','뿌리채소',7,NULL),
('표고버섯','뿌리채소',7,90),('새송이버섯','뿌리채소',7,NULL),('느타리버섯','뿌리채소',5,NULL),
('팽이버섯','뿌리채소',7,NULL),('고추','뿌리채소',7,NULL),('옥수수','뿌리채소',3,90),
('콩나물','뿌리채소',3,NULL),('숙주','뿌리채소',3,NULL),('두릅','뿌리채소',3,NULL),
('단호박','뿌리채소',7,NULL),('우엉','뿌리채소',14,NULL),('토란','뿌리채소',7,NULL),
('청양고추','뿌리채소',7,NULL),
('소고기','육류',4,90),('돼지고기','육류',4,90),('닭고기','육류',2,90),
('오리고기','육류',2,90),('양고기','육류',3,90),('다진소고기','육류',2,90),
('다진돼지고기','육류',2,90),('삼겹살','육류',4,90),('목살','육류',4,90),
('안심','육류',4,90),('등심','육류',4,90),('갈비','육류',4,90),
('닭가슴살','육류',2,90),('닭다리','육류',2,90),('닭날개','육류',2,90),
('소시지','육류',7,60),('햄','육류',7,60),('베이컨','육류',30,60),
('런천미트','육류',14,60),('차돌박이','육류',4,90),('우삼겹','육류',4,90),
('사태','육류',4,90),('소불고기','육류',3,90),('돼지불고기','육류',3,90),
('생연어','해산물',2,90),('생고등어','해산물',2,90),('생갈치','해산물',2,90),
('생조기','해산물',2,90),('생삼치','해산물',2,90),('새우','해산물',2,90),
('오징어','해산물',2,90),('조개','해산물',2,90),('굴','해산물',2,90),
('게','해산물',2,90),('낙지','해산물',2,90),('문어','해산물',2,90),
('꽃게','해산물',2,90),('전복','해산물',3,90),('홍합','해산물',2,90),
('바지락','해산물',2,90),('가리비','해산물',2,90),('참치캔','해산물',30,NULL),
('멸치건어물','해산물',30,180),('황태','해산물',30,180),('생태','해산물',2,90),
('명란젓','해산물',14,60),('고등어캔','해산물',30,NULL),('연어알','해산물',3,60),
('꽁치','해산물',2,90),
('우유','유제품',7,NULL),('두유','유제품',7,NULL),('요거트','유제품',14,NULL),
('플레인요거트','유제품',14,NULL),('체다치즈','유제품',21,90),
('슬라이스치즈','유제품',14,90),('크림치즈','유제품',14,NULL),
('리코타치즈','유제품',10,NULL),('버터','유제품',30,180),('생크림','유제품',5,NULL),
('휘핑크림','유제품',5,NULL),('달걀','유제품',35,NULL),('두부','유제품',3,90),
('연두부','유제품',3,NULL),('모짜렐라치즈','유제품',7,90),
('파르메산치즈','유제품',30,NULL),('연유','유제품',14,NULL),
('발효유','유제품',14,NULL),('순두부','유제품',3,NULL),('아몬드밀크','유제품',7,NULL),
('어묵','가공식품',5,90),('맛살','가공식품',7,90),('게맛살','가공식품',7,90),
('만두','가공식품',NULL,90),('떡국떡','가공식품',NULL,90),('순대','가공식품',NULL,60),
('핫도그','가공식품',NULL,60),('치킨너겟','가공식품',NULL,90),
('냉동피자','가공식품',NULL,90),('냉동새우','가공식품',NULL,90),
('냉동오징어','가공식품',NULL,90),('냉동밥','가공식품',NULL,30),
('떡볶이떡','가공식품',NULL,90),('김치','가공식품',30,NULL),
('된장','가공식품',90,NULL),('고추장','가공식품',90,NULL),
('간장','가공식품',365,NULL),('참기름','가공식품',90,NULL),
('쌈장','가공식품',90,NULL),('마요네즈','가공식품',90,NULL),
('케찹','가공식품',90,NULL),('머스터드','가공식품',90,NULL),
('굴소스','가공식품',90,NULL),('떡','가공식품',3,30),('유부','가공식품',3,30),
('곤약','가공식품',7,NULL),('낫또','가공식품',7,30),('미역','가공식품',7,NULL),
('다시마','가공식품',7,NULL),('김','가공식품',30,NULL),('과일잼','가공식품',30,NULL),
('딸기잼','가공식품',30,NULL),('스팸','가공식품',14,NULL),('식혜','가공식품',3,NULL),
('수정과','가공식품',3,NULL),('생면','가공식품',3,30),('우동면','가공식품',3,30),
('냉동완자','가공식품',NULL,60),('피클','가공식품',30,NULL),
('올리브','가공식품',30,NULL),('두반장','가공식품',90,NULL),
('미소된장','가공식품',90,NULL),('남은반찬','가공식품',3,NULL)
ON CONFLICT (name) DO NOTHING;
