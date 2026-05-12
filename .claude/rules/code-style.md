# 코드 스타일 규칙

도토리 프로젝트의 코드 일관성을 위한 규칙입니다.
이 규칙들은 v1에서 발견된 실제 문제들을 막기 위해 정의되었습니다.

## 디자인 토큰 (가장 중요)

### 절대 금지
- 컴포넌트 코드 안에 색상 값을 직접 쓰지 않는다.
  - 잘못된 예: `backgroundColor: '#8B5E3C'`
  - 잘못된 예: `const C = { primary: '#8B5E3C', ... }` (지역 상수로 복붙)
- 색상은 반드시 `theme.ts`의 디자인 토큰을 통해 참조한다.
  - 올바른 예: `backgroundColor: theme.colors.brand`
  - 올바른 예: `color: theme.colors.text.primary`

### 폰트 크기, 여백, borderRadius 등
- 매직 넘버 직접 사용 지양.
- 가능하면 `theme.ts`의 토큰을 통해 참조한다.
  - 예: `theme.spacing.md`, `theme.radius.card`, `theme.fontSize.body`

## 아이콘

### 절대 금지
- 이모지를 UI 아이콘 대용으로 사용하지 않는다.
  - 잘못된 예: `<Text>🥬 식재료</Text>`
  - 잘못된 예: `<Text>📅 일정</Text>`
- 화면 내 모든 아이콘은 `lucide-react-native` 사용.
  - 올바른 예: `<Apple size={24} strokeWidth={1.5} />`

### 스타일 통일
- strokeWidth: 1.5
- size: 기본 24px, 작은 곳은 16~20px
- 색상은 `theme.colors.icon` 토큰 사용

## 타입스크립트

### 절대 금지
- `as any` 사용 금지.
  - 타입 단언이 필요하면 명확한 타입 사용: `as User`, `as { id: string }`
  - 진짜 알 수 없는 경우만 `as unknown` 사용 후 좁히기

### 권장
- props는 항상 interface로 정의.
- export하는 함수는 반환 타입 명시.

## 컴포넌트 작성

### 절대 금지
- 한 파일에 컴포넌트가 너무 길어지면 안 됨 (500줄 이상 = 분리 필요).
  - v1의 FinanceScreen.tsx가 2,542줄이었음. 이런 사고 방지.
- 한 파일에 여러 페이지 컴포넌트를 넣지 않는다.
  - 보조 컴포넌트(작은 카드, 버튼 등)는 같은 파일 OK.

### 권장
- 함수형 컴포넌트만 사용.
- 한 파일 = 한 메인 컴포넌트 + 그 컴포넌트만 쓰는 보조 컴포넌트들.
- 여러 화면에서 쓰는 컴포넌트는 `components/` 폴더로 분리.

## 유틸 함수 (가장 중요한 v1 교훈)

### 절대 금지
- 같은 로직을 여러 파일에 복사해서 쓰지 않는다.
  - v1에서 choreUtils.ts를 만들어놓고 ChoresScreen.tsx에서 같은 함수를 
    다시 구현한 사고가 있었음. 이런 일이 다시 발생하면 안 됨.
- 새 함수 작성 전에 반드시 기존 utils 폴더에 같은 기능이 있는지 확인.

### 권장
- 공통 로직은 `lib/utils/` 또는 `utils/` 폴더에 함수로 추출.
- 함수명은 동사로 시작 (calculateDday, formatDate, generateId 등).

## 네이밍

- **컴포넌트**: PascalCase (예: `InventoryCard`, `ShoppingListItem`)
- **함수/변수**: camelCase (예: `getUserFamily`, `isExpiring`)
- **상수**: SCREAMING_SNAKE_CASE (예: `MAX_INVENTORY_COUNT`)
- **파일명**:
  - 컴포넌트 파일: `PascalCase.tsx` (예: `InventoryCard.tsx`)
  - 유틸/훅 파일: `camelCase.ts` (예: `useFamily.ts`, `dateUtils.ts`)

## 폰트 굵기

세련된 톤을 위해 fontWeight를 절제한다.
- 본문 텍스트: 400 (Regular)
- 강조 텍스트: 600 (Semibold)
- 제목: 700 (Bold)
- 800~900은 사용하지 않는다 (v1에서 700~800 남발 사고 방지)

## 상태 관리

- 사용자 프로필, 가족 정보 등 전역 데이터는 Context로 관리.
- v1의 "탭 전환할 때마다 Supabase 재쿼리" 사고 방지.
- AsyncStorage는 캐시 용도로만 사용 (소스 오브 트루스로 쓰지 말 것).

## Supabase

- 쿼리 함수는 `lib/supabase/` 폴더에 모은다.
- 컴포넌트 안에 직접 supabase.from() 호출하지 않는다.
- `is_active` 컬럼이 있는 테이블은 항상 `.eq('is_active', true)` 필터링.
