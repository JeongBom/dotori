// 가족 웹 푸시 발송 Edge Function
// body: { familyId, title, body, url? }
// - 호출자가 해당 가족 구성원인지 검증 (JWT)
// - 가족의 모든 구독으로 발송, 만료된 구독(404/410)은 정리
//
// 필요 시크릿:
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (mailto:주소)
// 배포: npx supabase functions deploy send-push

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // 브라우저(웹앱) 호출을 위한 CORS 사전 검사 응답
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: CORS_HEADERS });
  }

  try {
    const { familyId, title, body, url } = await req.json();
    if (!familyId || !title) {
      return new Response(JSON.stringify({ error: 'familyId, title이 필요합니다' }), { status: 400, headers: CORS_HEADERS });
    }

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
    if (!vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: 'VAPID 키가 설정되지 않았습니다' }), { status: 500, headers: CORS_HEADERS });
    }
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    // service role 클라이언트 (구독 조회/정리용)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 호출자 검증: JWT의 유저가 familyId 소속인지
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '');
    const { data: userData } = await admin.auth.getUser(jwt);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: '인증 실패' }), { status: 401, headers: CORS_HEADERS });
    }
    const { data: profile } = await admin
      .from('user_profiles').select('family_id').eq('id', userData.user.id).single();
    if (profile?.family_id !== familyId) {
      return new Response(JSON.stringify({ error: '가족 구성원이 아닙니다' }), { status: 403, headers: CORS_HEADERS });
    }

    // 가족 전체 구독 조회
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('family_id', familyId);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...CORS_HEADERS, 'content-type': 'application/json' } });
    }

    const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/' });
    let sent = 0;
    const staleIds: string[] = [];

    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) staleIds.push(sub.id); // 만료된 구독
        else console.error('push send error:', sub.endpoint.slice(0, 40), status);
      }
    }));

    if (staleIds.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', staleIds);
    }

    return new Response(JSON.stringify({ sent, cleaned: staleIds.length }), {
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('send-push error:', e);
    return new Response(JSON.stringify({ error: '발송 처리 실패' }), { status: 500, headers: CORS_HEADERS });
  }
});
