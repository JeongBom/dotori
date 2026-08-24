// 공용 유틸 함수

// undefined 값인 키를 제거한다 — 스프레드 병합 시 기본값을 undefined로 덮어쓰는 사고 방지
// 예: { ...defaults, ...stripUndefined(prefill) }
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

// 배열을 2개씩 묶는다 — 데스크톱 웹 2열 리스트 렌더링용
// 예: [a,b,c] → [[a,b],[c]]
export function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    out.push(arr.slice(i, i + 2));
  }
  return out;
}
