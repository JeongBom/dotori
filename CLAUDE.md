# 도토리 앱 - Claude Code 가이드

> **도**란도란 **토**닥토닥 우리집 **리**빙 시스템
> 가족이 함께 사용하는 우리집 재고 관리 앱

---

## 앱 개요

- **앱 이름**: 도토리
- **목적**: 가족이 함께 쓰는 우리집 재고 관리 앱
- **핵심 가치**: 생필품이 떨어지기 전에, 음식이 상하기 전에 미리 알려줘서 불편과 낭비를 막아준다

### 핵심 메타포

다람쥐가 도토리를 모으듯, 우리집 살림을 하나씩 모으고 관리한다.

- 모으기 (재고 추가)
- 기억하기 (재고 추적)
- 미리 준비 (떨어지기 전 알림)
- 함께 나누기 (가족 공유)

### 사용자가 답을 얻고 싶은 질문

1. 지금 우리집에 뭐가 있나? (재고)
2. 곧 떨어지거나 상하는 게 뭐지? (알림)
3. 마트 가는 김에 뭐 사야 하지? (장보기)

---

## 기능 범위 (Scope)

### MVP 핵심 기능

- ✅ 식재료 재고 관리 (수량 단위 카운트)
- ✅ 생필품 재고 관리 (수량 단위 카운트)
- ✅ 유통기한 추적 + 임박 알림
- ✅ 재고 부족 알림 (임계점 도달 시)
  - MVP: 1개 이하면 알림 (단순 임계점)
  - 추후: 품목별 커스텀 임계점
- ✅ 장보기 리스트 + 구입처 태그
- ✅ 재고 → 장보기 자동 연동
- ✅ 가족 공유 메모 (와이파이 비번, 가족 사이즈 등)
- ✅ 가족 간 실시간 동기화
- ✅ 알림은 모든 가족에게 동시 발송
- ✅ 영수증 스캔으로 재고 일괄 등록 (품목·수량만 읽음, **가격은 파싱·저장하지 않음** — 가계부 Non-goal 방어. 자동 반영 금지, 확인 화면 필수)

### 핵심 사용 시나리오

1. **알림으로 불편 막기**: 휴지 1개 남음 → 마트 가는 길에 알림 → 사 옴
2. **알림으로 낭비 막기**: 두부 D-1 알림 → 오늘 두부찌개 → 안 버림
3. **마지막 새거 뜯는 순간**: 휴지 새거 뜯으면서 +/- 로 수량 변경
4. **가족과 동시 알림**: 우유 마지막 한 잔 마신 가족이 수량 변경 → 모두에게 알림
5. **마트 가기 직전**: 장보기 탭 열면 자동 누적된 리스트 확인

---

## 명시적으로 안 하는 것 (Non-goals)

다음 기능들은 도토리의 핵심 가치(불편/낭비 방지)와 무관하므로 추가하지 않는다.

- ❌ 가계부/자산 관리
- ❌ 일정/집안일 관리
- ❌ 레시피 추천
- ❌ 영양/칼로리 관리
- ❌ 자동 발주/쇼핑몰 연동
- ❌ 가격/지출 추적

### 추후 발전 가능 (MVP 이후)

- 🟡 바코드 스캔 입력
- 🟡 품목별 커스텀 알림 임계점
- 🟡 가족 알림 우선순위 (담당자 지정 등)

### 기능 추가 시 판단 기준

새로운 기능 제안이 들어오면 항상 묻는다:

> "이게 '재고 관리 + 미리 알림'이라는 핵심 가치에 직접 기여하는가?"

답이 "아니다"면 추가하지 않는다.

---

## 기술 스택

- **프레임워크**: Expo (React Native) + TypeScript
- **DB/인증**: Supabase (PostgreSQL, RLS)
- **아이콘**: lucide-react-native (strokeWidth 1.5, size 24)
- **빌드**: EAS CLI
- **테스트**: Expo Go (iPhone + iPad)

---

## 디자인 시스템

### 톤

미니멀하고 세련된 "프로 앱" 톤. 따뜻함은 한 가지 포인트 컬러(도토리 브라운)로만 표현. 토스/Linear 수준의 완성도 목표.

### 컬러 시스템

**베이스 (무채색)**

```
배경:        #FAFAF8 (살짝 따뜻한 오프화이트)
카드:        #FFFFFF (순백)
텍스트 진:   #1A1A1A (거의 검정)
텍스트 보조: #6B6B6B (그레이)
구분선:      #EEEEEE
```

**포인트 (도토리 정체성)**

```
브랜드 브라운: #8B5E3C  ← CTA, 핵심 아이콘에만 사용
```

**상태 컬러**

```
안전/신선:   #2D9D5C  (잎사귀 그린)
주의/임박:   #E89B3C  (호박)
위험/만료:   #DC4C4C  (단풍)
```

### 디자인 규칙

- **아이콘**: lucide-react-native만 사용 (이모지 금지)
- **색상 참조**: theme.ts 토큰으로만 (컴포넌트에 직접 색상 코드 금지)
- **borderRadius**: 카드 12px, 버튼 8px
- **여백**: 화면 좌우 24px, 카드 간격 16px
- **폰트 굵기**: 본문 400, 강조 600, 제목 700
- **그림자**: 거의 없거나 매우 옅게

---

## 화면 구조

4개 탭 네비게이션:

1. **식재료** — 카드 리스트, D-day, +/- 카운트
2. **생필품** — 카드 리스트, 수량, +/- 카운트
3. **장보기** — 체크리스트, 구입처 태그 필터
4. **메모** — 가족 공유 메모

---

## 가족(Family) 구조

- 한 사람은 하나의 가족에만 속함 (1인 1가족)
- 가족 생성 시 6자리 초대 코드 자동 생성
- 모든 데이터는 family_id 기반으로 공유

### 가족 합류 정책

- 초대 코드로 합류 시 → 초대한 사람의 family_id로 통합
- 합류하는 사람의 기존 데이터는 삭제가 아닌 **소프트 삭제** (is_active: false)
- 가족 나가기 시 → 기존 데이터 is_active: true 복구 + 새 family_id 자동 생성
- 완전 탈퇴 시 → DB에서 진짜 삭제

### 합류 플로우

```
초대 코드 입력
↓
⚠️ 팝업 안내
"OO님 가족에 합류하면 내 기존 데이터는
보이지 않게 됩니다. 가족을 나가면 복구돼요."
↓
[취소]  [합류하기]
↓
기존 데이터 is_active: false 처리
초대한 사람 family_id로 변경
```

### 설정 메뉴 옵션

- 가족 데이터 전체 초기화
- 가족 나가기 (기존 데이터 복구 + 새 family_id 생성)
- 완전 탈퇴 (진짜 삭제)

---

## 개발 현황

### v2 핵심 기능

- ✅ **음식 관리**: 완료 (v1) → v2에서 유통기한 알림 강화 예정
- ✅ **생필품 관리**: 완료 (v1) → v2에서 임계점 알림 추가 예정
- 🔲 **장보기 리스트**: 신규 (구입처 태그, 자동 연동)
- 🔲 **가족 공유 메모**: 신규
- 🔲 **알림 시스템**: 강화 (재고 부족 + 유통기한 임박)

### v1 잔재 (제거 대상)

- ❌ 재무/목표 관리: 제거 예정 (Non-goal)
- ❌ 루틴/집안일: 제거 예정 (Non-goal)

---

## DB 테이블 구조

### 유지 (v1 → v2)

**공통**

```sql
families
- id, name, invite_code, created_at

users
- id, nickname, role, family_id, created_at

user_settings
- user_id, family_id, notify_before_expiry, created_at
```

**음식 관리 (유지 + 알림 강화)**

```sql
food_database
- id, name, category, refrigerated_days, frozen_days

fridge_items
- id, family_id, user_id, food_name
- storage_type (refrigerated / frozen / room_temp)
- quantity, stored_at, expires_at, is_eaten
- is_active (소프트 삭제용, default: true)
- created_at
```

**생필품 관리 (유지 + 임계점 알림 추가)**

```sql
supplies
- id, family_id, name
- category (세제 / 욕실 / 주방 / 기타)
- quantity, min_quantity, memo
- is_active (소프트 삭제용, default: true)
- updated_at
```

### 신규 (v2에서 추가 예정)

**장보기 리스트**

```sql
shopping_items
- id, family_id
- name, source_type (fridge / supplies / manual)
- source_id (자동 연동된 원본 아이템 id)
- store_tag (구입처 태그: 이마트 / 쿠팡 / 동네마트 등)
- is_checked (체크 여부)
- is_active (소프트 삭제용, default: true)
- created_at, checked_at
```

**가족 공유 메모**

```sql
notes
- id, family_id, user_id
- title, content
- is_pinned (상단 고정 여부)
- is_active (소프트 삭제용, default: true)
- created_at, updated_at
```

### 보존 (당장 사용 안 하지만 DB에 유지)

다음 테이블들은 v2에서 사용하지 않지만, 데이터 보존을 위해 DB에서 삭제하지 않는다.

- assets, asset_histories, goals, goal_items (자산/목표 관리)
- routines (루틴/집안일)

가지치기 작업이 끝나고 안정화된 후 별도 결정.

---

## iOS 빌드 주의사항

### npx expo prebuild 후 반드시 실행

`npx expo prebuild --platform ios` 실행 시마다 `ios/Dotori/Dotori.entitlements`가 초기화되어 Push Notifications 권한이 추가됨.
무료 Apple 계정은 Push Notifications 미지원이므로 prebuild 후 아래처럼 반드시 초기화:

```xml
<!-- ios/Dotori/Dotori.entitlements -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
  </dict>
</plist>
```

그 다음 Xcode → Product → Clean Build Folder → ▶ 실행

---

## 작업 원칙

이 프로젝트는 1인 개발이다. 다음을 따른다:

1. **한 번에 하나의 기능만 작업한다.** 여러 기능을 동시에 건드리지 않는다.
2. **삭제는 단계적으로.** 한 번에 5개 이상 파일을 지우지 않는다.
3. **변경 전 사용자 확인.** 큰 변경(파일 삭제, 스키마 변경)은 반드시 확인받는다.
4. **음식 관리, 생필품 관리, 가족 관리 코드는 v2에서도 유지.** 디자인 토큰 적용과 알림 강화 외에는 핵심 로직 보존.
5. **새 컬러 시스템은 theme.ts 통해서만 적용.** 컴포넌트 내 색상 직접 코딩 금지.
6. **Supabase 쿼리는 기존 패턴 유지.** 새 테이블도 같은 패턴으로.
