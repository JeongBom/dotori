// TypeScript 타입 정의
// DB 테이블 구조와 1:1 대응되도록 작성
// MySQL에서 테이블 컬럼 타입을 정의하는 것과 같은 역할

// ---- 공통 ----

export type UserRole = 'owner' | 'member';

// ---- 인증/사용자 ----

// user_profiles 테이블 타입
export interface UserProfile {
  id: string;
  family_id: string | null;
  personal_family_id: string | null; // 타인 가족 합류 전 내 원래 family_id (나가기 시 복구용)
  nickname: string;
  role: UserRole;
  created_at: string;
}
export type TransactionType = 'expense' | 'income';

// ---- 가족 ----

export interface Family {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  display_name: string;
  role: UserRole;
  avatar_color: string;
  created_at: string;
}

// ---- 냉장고 ----

export type FridgeCategory = '잎채소' | '뿌리채소' | '과일' | '육류' | '해산물' | '유제품' | '가공식품' | '기타';
export type StorageType = '냉장' | '냉동' | '실온';

export interface FridgeItem {
  id: string;
  family_id: string;
  name: string;
  category: string; // fridge_categories.name 참조 (기본값: FridgeCategory)
  storage_type: StorageType;
  quantity: number;
  stored_date: string;        // "YYYY-MM-DD"
  expiry_date: string | null; // "YYYY-MM-DD" or null
  is_consumed: boolean;
  consumed_at: string | null; // "YYYY-MM-DD" or null
  created_at: string;
  updated_at: string;
}

export type NewFridgeItem = Omit<FridgeItem, 'id' | 'created_at' | 'updated_at'>;

// food_database 테이블 타입
export interface FoodEntry {
  id: number;
  name: string;
  category: FridgeCategory;
  fridge_days: number | null;
  freezer_days: number | null;
  room_days: number | null;
}

// 가족이 직접 등록한 자주 쓰는 음식
export interface FamilyFood {
  id: string;
  family_id: string;
  name: string;
  fridge_days: number | null;
  freezer_days: number | null;
  room_days: number | null;
}

// user_settings 테이블 타입
export interface UserSettings {
  id: string;
  family_id: string;
  notify_days_before: 1 | 2 | 3 | 5 | 7;
}

// ---- 가계부 ----

export type TransactionCategory = '식비' | '교통' | '의료/건강' | '교육' | '여가/문화' | '쇼핑' | '주거/관리비' | '기타';

export interface Transaction {
  id: string;
  family_id: string;
  member_id: string | null;
  amount: number;
  category: TransactionCategory;
  description: string | null;
  transaction_date: string; // ISO date string
  type: TransactionType;
  created_at: string;
  // JOIN 결과에서 추가로 붙어오는 필드 (optional)
  family_members?: Pick<FamilyMember, 'display_name' | 'avatar_color'>;
}

export type NewTransaction = Omit<Transaction, 'id' | 'created_at' | 'family_members'>;

// ---- 생필품 ----

// 카테고리는 사용자가 직접 추가 (supply_categories 테이블)
export interface SupplyCategoryEntry {
  id: string;
  family_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Supply {
  id: string;
  family_id: string;
  name: string;
  quantity: number;
  low_stock_threshold: number;
  category: string; // supply_categories.name 참조
  note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type NewSupply = Omit<Supply, 'id' | 'created_at' | 'updated_at'>;

// ---- 메모 ----

export interface Note {
  id: string;
  family_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export type NewNote = Omit<Note, 'id' | 'created_at' | 'updated_at'>;

// ---- 대시보드 요약 데이터 (홈 화면용) ----

export interface DashboardSummary {
  fridge: {
    totalItems: number;
    expiringCount: number;   // D-3 이내 만료 예정 항목 수
    expiredCount: number;    // 이미 만료된 항목 수
  };
  supplies: {
    lowStockCount: number;    // 재고 부족 항목 수
  };
}
