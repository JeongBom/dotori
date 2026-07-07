// 공용 유틸 함수

// 배열을 2개씩 묶는다 — 데스크톱 웹 2열 리스트 렌더링용
// 예: [a,b,c] → [[a,b],[c]]
export function chunkPairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) {
    out.push(arr.slice(i, i + 2));
  }
  return out;
}
