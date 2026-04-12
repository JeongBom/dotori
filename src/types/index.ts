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
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';
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
  category: FridgeCategory;
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

// ---- 집안일 ----

export interface Chore {
  id: string;
  family_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  recurrence: RecurrenceType;
  recurrence_day: number | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  // JOIN으로 붙어오는 담당자 정보
  assignee?: Pick<FamilyMember, 'display_name' | 'avatar_color'>;
}

export type NewChore = Omit<Chore, 'id' | 'created_at' | 'is_completed' | 'completed_at' | 'completed_by' | 'assignee'>;

// ---- 생필품 ----

export type SupplyCategory = '청소용품' | '세면용품' | '주방용품' | '의약품' | '반려동물' | '기타';

export interface Supply {
  id: string;
  family_id: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  category: SupplyCategory;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type NewSupply = Omit<Supply, 'id' | 'created_at' | 'updated_at'>;

// ---- 재무/목표 관리 ----

// 자산 카테고리
export type AssetCategory = '예금' | '적금' | '주식' | '부동산' | '기타';

// assets 테이블 타입
export interface Asset {
  id: string;
  family_id: string;
  user_id: string | null; // 담당자 auth UID. null이면 파트너 소유
  category: AssetCategory;
  name: string;           // 자산명 (예: 국민은행 적금)
  amount: number;         // 원 단위
  updated_at: string;
}

// 자산 등록/수정 시 사용 (id, updated_at은 DB가 자동 생성)
export type NewAsset = Omit<Asset, 'id' | 'updated_at'>;

// asset_histories 테이블 타입
export interface AssetHistory {
  id: string;
  asset_id: string;
  previous_amount: number; // 변경 전 금액
  new_amount: number;      // 변경 후 금액
  memo: string | null;     // 변경 이유 (예: 월급 입금, 주식 매수)
  created_at: string;
}

// goals 테이블 타입
export interface Goal {
  id: string;
  family_id: string;
  title: string;          // 목표명 (예: 유럽 여행)
  target_amount: number;  // 목표 금액
  deadline: string | null; // "YYYY-MM-DD" or null (기한 없음)
  memo: string | null;
  created_at: string;
  // JOIN으로 붙어오는 항목 목록 (optional)
  goal_items?: GoalItem[];
}

export type NewGoal = Omit<Goal, 'id' | 'created_at' | 'goal_items'>;

// goal_items 테이블 타입
export interface GoalItem {
  id: string;
  goal_id: string;
  name: string;   // 항목명 (예: A계좌, 비상금 통장)
  amount: number; // 해당 항목에 모인 금액
  memo: string | null;
}

export type NewGoalItem = Omit<GoalItem, 'id'>;

// ---- 대시보드 요약 데이터 (홈 화면용) ----

export interface DashboardSummary {
  fridge: {
    totalItems: number;
    expiringCount: number;   // D-3 이내 만료 예정 항목 수
    expiredCount: number;    // 이미 만료된 항목 수
  };
  finance: {
    thisMonthExpense: number; // 이번달 총 지출
    thisMonthIncome: number;  // 이번달 총 수입
  };
  chores: {
    pendingCount: number;     // 미완료 집안일 수
    overdueCount: number;     // 기한 지난 집안일 수
  };
  supplies: {
    lowStockCount: number;    // 재고 부족 항목 수
  };
}
