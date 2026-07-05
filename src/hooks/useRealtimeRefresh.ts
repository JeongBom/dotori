// Supabase Realtime 구독 훅
// 지정한 테이블들의 우리 가족(family_id) 데이터가 바뀌면 onChange를 호출한다.
// 가족 구성원이 다른 폰에서 수량을 바꿔도 내 화면이 즉시 갱신되게 하는 용도.
//
// 사용 규칙:
// - tables는 컴포넌트 밖 모듈 상수로 선언할 것 (렌더마다 새 배열이면 재구독됨)
// - onChange는 useCallback으로 감싼 안정된 함수일 것

import { useEffect } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, getOrCreateFamilyId } from '../lib/supabase';

export function useRealtimeRefresh(tables: readonly string[], onChange: () => void): void {
  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    // 연속 이벤트(수량 연타 등)를 하나의 리로드로 묶음
    const debouncedChange = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(onChange, 300);
    };

    (async () => {
      const fid = await getOrCreateFamilyId();
      if (!fid || cancelled) return;

      channel = supabase.channel(`rt:${tables.join(',')}:${fid}`);
      for (const table of tables) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `family_id=eq.${fid}` },
          debouncedChange,
        );
      }
      channel.subscribe();
    })();

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [tables, onChange]);
}
