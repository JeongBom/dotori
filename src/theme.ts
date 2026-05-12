// 도토리 디자인 토큰
// CLAUDE.md 디자인 시스템 기준
// 컴포넌트에서 색상/여백/폰트를 직접 쓰지 말고 이 파일을 통해 참조할 것

export const theme = {
  colors: {
    // ── 베이스 ─────────────────────────────────
    bg:      '#FAFAF8',   // 살짝 따뜻한 오프화이트
    card:    '#FFFFFF',
    divider: '#EEEEEE',

    // ── 텍스트 ────────────────────────────────
    text: {
      primary:   '#1A1A1A',
      secondary: '#6B6B6B',
    },

    // ── 브랜드 (도토리 브라운) ─────────────────
    // CTA, 핵심 아이콘에만 사용
    brand: '#8B5E3C',

    // ── 상태 ──────────────────────────────────
    status: {
      safe:   '#2D9D5C',  // 안전/신선 (잎사귀 그린)
      warn:   '#E89B3C',  // 주의/임박 (호박)
      danger: '#DC4C4C',  // 위험/만료 (단풍)
    },

    // ── 워밍 팔레트 (브랜드 확장) ──────────────
    // 화면 내 계층/강조에 사용
    warm: {
      oak:      '#A87850',  // 브랜드보다 밝은 갈색 (보조 강조)
      lightOak: '#C49A6C',  // 비활성 탭, 서브 레이블
      ivory:    '#FFF8F0',  // 카드 배경 변형
      cream:    '#FDF6EC',  // 화면 배경 변형
      sand:     '#F0E6D9',  // 뱃지/칩 배경 (ivory보다 진한 베이지)
      edge:     '#DEC8A8',  // 테두리, 구분선
      dark:     '#5C3D1E',  // 텍스트 강조 (브라운 계열)
      deep:     '#6B4226',  // 다크 강조
    },

    // ── 알림 배경/전경 ────────────────────────
    alert: {
      dangerBg:     '#FDECEA',  // 위험 알림 pill/배너 배경
      dangerBorder: '#F5C2BB',  // 위험 알림 카드 테두리
      warnBg:       '#FCF2E0',  // 경고 알림 pill 배경
      warnFg:       '#B67628',  // 경고 알림 pill 텍스트
    },

    // ── 보관 유형 칩 ──────────────────────────
    storage: {
      fridge:   { bg: '#EDD9C0', fg: '#8B5E3C' },  // 냉장
      frozen:   { bg: '#C8D8F0', fg: '#5A7EC9' },  // 냉동
      roomTemp: { bg: '#F0E8D4', fg: '#A07840' },  // 실온
    },

    // ── 기타 ──────────────────────────────────
    purple:    '#9478C9',    // 아바타 등 보조 포인트 컬러
    neutral:   '#9EA8B0',    // 비활성 칩/뱃지 (cool gray)
    link:      '#4A90D9',    // 인라인 URL 하이퍼링크
    noteCards: ['#FFF8F0', '#FAEFD8', '#EBE5F4', '#FDF1E4', '#EBF4F8', '#EEF5EE'],

    // ── 아이콘 기본 ───────────────────────────
    icon: '#8B5E3C',
  },

  // ── 여백 ──────────────────────────────────────
  spacing: {
    xs:               4,
    sm:               8,
    md:               12,
    lg:               16,
    xl:               24,
    xxl:              32,
    screenHorizontal: 24,  // 화면 좌우 패딩
    cardGap:          16,  // 카드 사이 간격
  },

  // ── 모서리 반경 ────────────────────────────────
  radius: {
    sm:     6,
    button: 8,    // 버튼
    card:   12,   // 카드
    lg:     14,
    xl:     18,
    full:   9999, // 알약/뱃지
  },

  // ── 폰트 크기 ─────────────────────────────────
  fontSize: {
    xs:   9,
    sm:   10,
    body: 12,
    md:   14,
    lg:   16,
    xl:   20,
    xxl:  26,
  },

  // ── 폰트 굵기 ─────────────────────────────────
  // 800~900 사용 금지 (code-style.md)
  fontWeight: {
    regular:  '400' as const,
    semibold: '600' as const,
    bold:     '700' as const,
  },
} as const;

export type Theme = typeof theme;
