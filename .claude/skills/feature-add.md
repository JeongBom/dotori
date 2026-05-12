<!-- 이 파일의 위치: .claude/skills/feature-add.md -->

# 새 기능 추가 워크플로우

도토리에 새 기능을 안전하게 추가하는 표준 절차입니다.
이 절차는 "한 번에 너무 많이 만들어서 디버깅 지옥" 사고를 막기 위해 정의되었습니다.

## 사용 시점

다음 작업을 할 때 이 워크플로우를 따른다:
- MVP의 신규 기능 구현 (메모, 장보기, 자동 연동 등)
- 기존 기능 강화 (유통기한 알림 강화 등)
- 사용자가 "X 기능 추가해줘"라고 명시한 경우

## 사전 조건 체크

작업 시작 전 반드시 확인:

- [ ] git status가 clean한가? (커밋되지 않은 변경사항 없음)
- [ ] 현재 작업 브랜치가 main이 아닌가? (전용 브랜치 사용)
- [ ] PM 페르소나로 사전 검토를 받았는가? (@.claude/agents/pm.md)
- [ ] scope.md의 Non-goals에 위배되지 않는가?
- [ ] CLAUDE.md에 해당 기능 명세가 있는가?

위 조건 중 하나라도 만족하지 않으면 작업 중단 후 사용자에게 알린다.

## 절차

### Step 1: PM 검토 (강제)

새 기능은 무조건 PM 페르소나로 먼저 검토받는다.

수행할 작업:
1. @.claude/agents/pm.md 페르소나 활성화
2. 기능 요구사항을 정리해서 PM 검토 요청
3. PM 추천 결과 확인:
   - "추가" → Step 2로 진행
   - "보류" → 사용자에게 다시 확인
   - "거절" → 작업 중단

PM 검토 통과 없이 다음 단계로 진행하지 않는다.

### Step 2: Designer 검토 (UI 있는 기능만)

UI 변경이 있는 기능이라면 Designer 페르소나로 화면 설계를 먼저 한다.

수행할 작업:
1. @.claude/agents/designer.md 페르소나 활성화
2. 만들 화면의 와이어프레임을 텍스트로 작성
3. Designer 체크리스트 통과 확인

이 단계에서 Claude Design에서 만든 시안이 있다면 그것을 기준으로 한다.

### Step 3: DB 스키마 설계

새 데이터를 저장해야 한다면 가장 먼저 DB 스키마를 설계한다.

수행할 작업:
1. 필요한 Supabase 테이블/컬럼 정의
2. RLS 정책 작성 (가족 공유 정책 따라야 함)
3. SQL 파일로 작성: `migrations/[날짜]_add_[기능명].sql`

⚠️ **중요**: 클로드 코드가 production DB에 직접 마이그레이션을 실행하지 않는다.
SQL 파일을 사용자에게 보여주고, 사용자가 Supabase 대시보드에서 직접 실행한다.

출력 형식:

```
## DB 스키마 추가: [기능 이름]

### 새 테이블/컬럼
notes
- id, family_id, user_id
- title, content
- is_pinned, is_active
- created_at, updated_at

### RLS 정책
- SELECT: 같은 family_id 멤버만
- INSERT: 본인이 작성
- UPDATE/DELETE: 본인이 작성한 것만

### SQL 파일
migrations/2026-05-11_add_notes.sql 생성됨

⚠️ 다음을 사용자가 직접 실행해야 합니다:
1. Supabase 대시보드 > SQL Editor
2. 위 SQL 파일 내용 복사
3. Run 클릭
4. 실행 완료 후 "DB 설정 완료" 알려주세요.
```

사용자가 DB 설정 완료를 알릴 때까지 Step 4로 진행하지 않는다.

### Step 4: 타입 정의

DB 스키마에 맞춰 TypeScript 타입을 정의한다.

수행할 작업:
1. `types/` 폴더에 새 타입 추가
2. 기존 타입 컨벤션 따르기
3. Supabase 응답 타입 명확히

⚠️ `as any` 사용 금지 (code-style.md 규칙)

### Step 5: Supabase 쿼리 함수

데이터 입출력 함수를 먼저 만든다 (UI보다 먼저).

수행할 작업:
1. `lib/supabase/[기능명].ts` 파일 생성
2. CRUD 함수 작성 (create, read, update, delete)
3. `is_active` 필터링 포함 (소프트 삭제 패턴)
4. family_id 기반 쿼리 (가족 공유 정책)

⚠️ 컴포넌트 안에 직접 supabase.from() 호출 금지 (code-style.md 규칙)

함수 작성 후:
- 콘솔에서 직접 호출해보거나 임시 테스트로 동작 확인
- "DB ↔ 코드" 연결이 잘 되는지 검증

### Step 6: 상태 관리 (필요시)

전역으로 공유해야 하는 데이터라면 Context 추가.

수행할 작업:
1. `contexts/` 또는 적절한 위치에 Context 생성
2. Provider 컴포넌트 작성
3. 커스텀 훅으로 노출 (예: useNotes)

탭별로만 쓰이는 로컬 상태라면 컴포넌트 내부 useState로 충분.

### Step 7: UI 컴포넌트 (작은 것부터)

작은 컴포넌트부터 만들어 올라간다 (Bottom-up).

수행할 작업:
1. 가장 작은 단위 컴포넌트 먼저 (예: NoteCard)
2. 디자인 토큰 사용 (theme.ts) - 색상/여백/폰트 직접 코딩 금지
3. lucide-react-native 아이콘만 사용
4. props는 TypeScript interface로

⚠️ 한 파일이 500줄 넘지 않도록 주의 (code-style.md 규칙)

### Step 8: 화면 컴포넌트

작은 컴포넌트들을 조합해 화면을 만든다.

수행할 작업:
1. 화면 파일 생성 (예: NotesScreen.tsx)
2. 빈 상태(데이터 없음) 처리
3. 로딩 상태 처리
4. 에러 상태 처리

### Step 9: 라우터 등록

마지막에 화면을 라우터에 등록한다.

수행할 작업:
1. 네비게이션에 새 탭/화면 추가
2. 적절한 아이콘 (lucide)
3. 탭 활성 색상 (theme.colors.brand)

### Step 10: 검증 + 리뷰

전체 동작을 검증한다.

체크리스트:
- [ ] 빈 상태에서 화면이 정상인가?
- [ ] 데이터 추가/수정/삭제가 정상 동작하는가?
- [ ] 가족 멤버 간 실시간 동기화가 되는가?
- [ ] 네트워크 끊김 시 에러 처리가 되는가?
- [ ] 다른 기능에 부정적 영향이 없는가?

리뷰어 페르소나로 자동 검토 호출:
"@.claude/agents/reviewer.md 페르소나로 이번 추가 작업을 검토해줘"

### Step 11: 마무리 커밋

최종 커밋 메시지:

```
feat: [기능 이름] - [짧은 설명]

- DB: [추가된 테이블/컬럼]
- 새 화면: [화면명]
- 새 컴포넌트: [컴포넌트 N개]
- 영향: [영향받은 기존 기능]
```

## 절대 금지 사항

다음은 어떤 경우에도 하지 않는다:

- ❌ PM 검토 없이 새 기능 추가
- ❌ scope.md의 Non-goals 영역 기능 추가
- ❌ DB 마이그레이션 자동 실행 (사용자가 직접)
- ❌ UI부터 만들기 (DB → 백엔드 → UI 순서 유지)
- ❌ 색상/스타일 직접 코딩 (theme.ts 통하지 않기)
- ❌ 이모지를 UI 아이콘으로 사용
- ❌ `as any` 사용
- ❌ 한 컴포넌트 500줄 초과
- ❌ Step 10 검증 없이 완료 처리

## 출력 의무

각 Step 시작 시 사용자에게 알린다:
"이제 Step X를 진행합니다. [내용 요약]"

각 Step 완료 시 결과를 보고한다:
"Step X 완료. [수행한 내용]. 다음 단계로 진행할까요?"

사용자가 "yes" 또는 명시적 동의를 표할 때만 다음 단계 진행.

## 도토리 핵심 기능 추가 예시

### 가족 공유 메모 추가
```
Step 1: PM 검토 (CLAUDE.md 명시되어 있어 통과)
Step 2: Designer 검토 (메모 카드 UI 설계)
Step 3: notes 테이블 생성 SQL
Step 4: Note 타입 정의
Step 5: lib/supabase/notes.ts (CRUD)
Step 6: NotesContext (선택사항)
Step 7: NoteCard 컴포넌트
Step 8: NotesScreen
Step 9: 메모 탭 라우터 등록
Step 10: 가족 2명 계정으로 동기화 테스트
Step 11: 커밋
```

### 재고 → 장보기 자동 연동
```
Step 1: PM 검토
Step 2: Designer 검토 (자동 연동 UI 흐름)
Step 3: shopping_items 테이블에 source_type, source_id 컬럼 추가
Step 4: 타입 확장
Step 5: 자동 연동 트리거 함수 (재고 0개 시 장보기에 자동 추가)
Step 6: -
Step 7: 자동 추가 알림 토스트 컴포넌트
Step 8: 재고 화면에 연동 표시
Step 9: -
Step 10: 식재료/생필품 0개 만들고 장보기 자동 추가 확인
Step 11: 커밋
```
