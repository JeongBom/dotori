# 도토리 앱 - Claude Code 가이드

> **도**란도란 **토**닥토닥 **리**빙 시스템
> 가족이 함께 사용하는 홈 매니저 앱

---

## 앱 개요

- **앱 이름**: 도토리
- **목적**: 부부/가족이 함께 쓰는 홈 매니저 앱
- **방향**: 관리/효율적이면서 감성적이고 세련된 느낌

---

## 기술 스택

- **프레임워크**: Expo (React Native) + TypeScript
- **DB/인증**: Supabase (PostgreSQL)
- **아이콘**: lucide-react-native (strokeWidth 1.5, size 24)
- **빌드**: EAS CLI
- **테스트**: Expo Go (iPhone + iPad)

---

## 디자인 시스템

```
메인 컬러:    #8B5E3C (도토리 브라운)
포인트 컬러:  #A87850 (웜 오크)
보조 컬러:    #C49A6C (라이트 오크)
카드 배경:    #FFF8F0 (아이보리)
페이지 배경:  #FDF6EC (크림)
텍스트(진한): #5C3D1E
텍스트(연한): #A87850
```

- 스타일: 토스 앱처럼 미니멀
- 카드: borderRadius 16, 여백 넉넉하게
- 아이콘: lucide-react-native, strokeWidth 1.5, 24px

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

- ✅ 음식 관리: 완료 (fridge_items, food_database 테이블 존재)
- 🔲 재무/목표 관리: 미개발
- 🔲 루틴/집안일: 미개발
- 🔲 생필품 관리: 미개발

---

## DB 테이블 구조

### 공통 (기존)
```sql
families
- id, name, invite_code, created_at

users
- id, nickname, role, family_id, created_at

user_settings
- user_id, family_id, notify_before_expiry, created_at
```

### 음식 관리 
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

### 자산/목표 관리 
```sql
-- 전체 자산 현황 (자산이랑 목표는 완전히 독립적)
assets
- id, family_id, user_id
- category (예금 / 적금 / 주식 / 부동산 / 기타)
- name, amount
- is_active (소프트 삭제용, default: true)
- updated_at

-- 자산 변경 히스토리 (증가/감소 이유 기록)
asset_histories
- id, asset_id
- previous_amount, new_amount
- memo (증가/감소 이유)
- created_at

-- 목표 (자산과 독립적으로 관리)
goals
- id, family_id, title, target_amount, deadline, memo
- is_active (소프트 삭제용, default: true)
- created_at

-- 목표 항목 (사용자가 직접 항목명/금액 입력)
goal_items
- id, goal_id
- name (예: A계좌, B계좌)
- amount, memo
- is_active (소프트 삭제용, default: true)
```

### 루틴/집안일 
```sql
routines
- id, family_id, title
- tag (routine / todo)
- assigned_to (user_id / both)
- type (once / repeat)
- repeat_interval (days) ← 7=매주, 14=격주, 30=매월
- next_date, last_done_at
- notify_before (days) ← 0=당일, 1=1일전, 2=2일전
- is_done
- is_active (소프트 삭제용, default: true)
- created_at
```

### 생필품 관리 
```sql
supplies
- id, family_id, name
- category (세제 / 욕실 / 주방 / 기타)
- quantity, min_quantity, memo
- is_active (소프트 삭제용, default: true)
- updated_at
```

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

## 주의사항

- 음식 관리 관련 기존 코드/테이블은 수정하지 말 것
- 새 기능 개발 시 기존 디자인 시스템 컬러/스타일 반드시 따를 것
- Supabase 쿼리는 기존 패턴 유지할 것