// 아침 브리핑 Edge Function — 매일 KST 9시에 pg_cron이 호출
// 푸시 구독이 있는 가족마다 "부족 생필품 + 유통기한 임박 음식"을 계산해 발송한다.
// 알릴 내용이 없는 가족은 건너뜀.
//
// 보안: JWT 검증 없이 배포(--no-verify-jwt)하는 대신
//       x-cron-secret 헤더가 CRON_SECRET 시크릿과 일치해야 동작.
//
// 필요 시크릿: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// 배포: npx supabase functions deploy daily-briefing --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

function kstDateStr(offsetDays = 0): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000); // KST
  now.setDate(now.getDate() + offsetDays);
  return now.toISOString().split('T')[0];
}

Deno.serve(async (req: Request) => {
  // 크론 시크릿 검증
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  try {
    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    );

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 구독이 있는 가족 목록
    const { data: subRows } = await admin.from('push_subscriptions').select('family_id');
    const familyIds = [...new Set((subRows ?? []).map(r => r.family_id))];

    let familiesNotified = 0;

    for (const familyId of familyIds) {
      // 가족별 알림 일수 설정 (기본 3일)
      const { data: settings } = await admin
        .from('user_settings').select('notify_days_before').eq('family_id', familyId).maybeSingle();
      const notifyDays = settings?.notify_days_before ?? 3;

      const today = kstDateStr();
      const soon = kstDateStr(notifyDays);

      // 부족 생필품 (알림 켠 품목, 수량 0 = 사용완료 제외)
      const { data: lowSupplies } = await admin
        .from('supplies')
        .select('name, quantity, low_stock_threshold, notify_low_stock')
        .eq('family_id', familyId).eq('is_active', true).gt('quantity', 0);
      const low = (lowSupplies ?? []).filter(
        s => (s.notify_low_stock ?? true) && s.quantity <= (s.low_stock_threshold ?? 1),
      );

      // 유통기한 임박/초과 음식
      const { data: expFoods } = await admin
        .from('fridge_items')
        .select('name, expiry_date')
        .eq('family_id', familyId).eq('is_consumed', false)
        .not('expiry_date', 'is', null).lte('expiry_date', soon)
        .order('expiry_date').limit(5);

      // 문장형 안내: 한 줄에 한 항목씩
      const lines: string[] = [];
      for (const s of low.slice(0, 4)) {
        lines.push(`'${s.name}'의 재고가 부족합니다.`);
      }
      for (const f of (expFoods ?? []).slice(0, 4)) {
        const diff = Math.ceil((new Date(f.expiry_date).getTime() - new Date(today).getTime()) / 86400000);
        lines.push(
          diff < 0
            ? `'${f.name}'의 유통기한이 ${Math.abs(diff)}일 지났습니다.`
            : `'${f.name}'의 유통기한이 ${diff}일 남았습니다.`,
        );
      }

      // 알릴 내용 없으면 스킵
      if (lines.length === 0) continue;

      const extra = low.length + (expFoods ?? []).length - lines.length;
      if (extra > 0) lines.push(`외 ${extra}건이 더 있어요.`);

      const payload = JSON.stringify({
        title: '🌰 오늘의 도토리 브리핑',
        body: lines.join('\n'),
        url: '/',
      });

      // 가족 구독 전체로 발송 (만료 구독 정리 포함)
      const { data: subs } = await admin
        .from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('family_id', familyId);
      const staleIds: string[] = [];
      await Promise.all((subs ?? []).map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) staleIds.push(sub.id);
        }
      }));
      if (staleIds.length > 0) {
        await admin.from('push_subscriptions').delete().in('id', staleIds);
      }
      familiesNotified += 1;
    }

    return new Response(JSON.stringify({ families: familyIds.length, notified: familiesNotified }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('daily-briefing error:', e);
    return new Response(JSON.stringify({ error: '브리핑 처리 실패' }), { status: 500 });
  }
});
