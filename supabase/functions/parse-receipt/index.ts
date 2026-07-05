// 영수증 파싱 Edge Function
// 클라이언트가 보낸 영수증 이미지를 Claude 비전으로 읽어
// 품목 목록 [{ name, quantity, category }] 을 반환한다.
//
// 원칙 (도토리 Non-goal 방어):
// - 품목명과 수량만 추출한다. 가격/합계/할인/포인트는 읽지도, 반환하지도 않는다.
//
// 배포:  npx supabase functions deploy parse-receipt
// 시크릿: npx supabase secrets set ANTHROPIC_API_KEY=<키>

const SYSTEM_PROMPT = `당신은 한국 마트/편의점 영수증에서 구매 품목을 추출하는 도우미입니다.

규칙:
1. 구매한 품목만 추출합니다. 가격, 합계, 할인, 포인트, 카드정보, 매장정보는 무시합니다.
2. name: 상품명을 짧고 일반적인 한국어 명사로 단순화합니다.
   예) "서울우유코주부1L" → "우유", "P_농심신라면멀티" → "신라면", "깨끗한나라순수두루마리30롤" → "두루마리 휴지"
3. quantity: 수량 열이 있으면 그 값, 없으면 1. 정수만.
4. category: 먹는 것(식재료, 음료, 간식 포함)이면 "food", 생활용품(세제, 휴지, 종량제 봉투, 위생용품 등)이면 "supply".
   무상 제공 쇼핑봉투처럼 상품이 아닌 줄만 제외합니다. 종량제 봉투는 구매 상품이므로 포함합니다.
5. 같은 품목이 여러 줄이면 수량을 합쳐 한 항목으로 만듭니다.
6. 영수증 인쇄가 흐릿해 글자가 애매할 때만, 실제로 존재하는 흔한 상품명으로 교정합니다.
   (예: "유지"처럼 상품명으로 어색한 단어 → "휴지")
   글자가 또렷하게 읽히는 상품명은 절대 다른 상품명으로 바꾸지 않습니다.
7. "기존 재고 목록"이 함께 주어지면:
   - 영수증 품목이 목록의 품목과 **같은 상품**일 때만 목록의 표기를 그대로 사용합니다.
   - **다른 상품을 목록의 이름으로 바꾸는 것은 절대 금지입니다.**
     (예: 영수증에 "종량제봉투"가 있으면 목록에 "휴지"가 있어도 "종량제 봉투"로 출력)
   - 목록에 없는 상품은 읽힌 그대로의 이름(단순화만 적용)으로 출력합니다.

반드시 아래 형식의 JSON 배열만 출력합니다. 다른 텍스트 금지:
[{"name":"우유","quantity":1,"category":"food"}]

영수증이 아니거나 품목을 읽을 수 없으면 [] 를 출력합니다.`;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  try {
    const { image, mimeType, knownNames } = await req.json();
    if (!image || typeof image !== 'string') {
      return new Response(JSON.stringify({ error: 'image (base64) is required' }), { status: 400 });
    }

    // 기존 재고 품목명 (오독 교정 힌트). 과도한 입력 방지를 위해 정제
    const names: string[] = (Array.isArray(knownNames) ? knownNames : [])
      .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      .map(n => n.trim().slice(0, 30))
      .slice(0, 100);
    const hint = names.length > 0 ? `\n\n기존 재고 목록: ${names.join(', ')}` : '';

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), { status: 500 });
    }

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType ?? 'image/jpeg', data: image },
            },
            { type: 'text', text: `이 영수증의 구매 품목을 JSON 배열로 추출해주세요.${hint}` },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, detail);
      return new Response(JSON.stringify({ error: `AI 호출 실패 (${anthropicRes.status})` }), { status: 502 });
    }

    const data = await anthropicRes.json();
    const text: string = data?.content?.[0]?.text ?? '[]';

    // 모델이 코드블록 등으로 감쌌을 경우 대비: 첫 '[' ~ 마지막 ']' 만 취해 파싱
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    let items: unknown = [];
    if (start !== -1 && end > start) {
      try { items = JSON.parse(text.slice(start, end + 1)); } catch { items = []; }
    }

    // 형식 검증 + 정제 (가격 등 다른 필드는 여기서 차단됨)
    const cleaned = (Array.isArray(items) ? items : [])
      .filter((it): it is { name: string; quantity?: number; category?: string } =>
        !!it && typeof (it as { name?: unknown }).name === 'string')
      .map(it => ({
        name: it.name.trim().slice(0, 30),
        quantity: Math.max(1, Math.min(99, Math.round(Number(it.quantity) || 1))),
        category: it.category === 'supply' ? 'supply' : 'food',
      }))
      .slice(0, 40);

    return new Response(JSON.stringify({ items: cleaned }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('parse-receipt error:', e);
    return new Response(JSON.stringify({ error: '요청 처리에 실패했습니다' }), { status: 500 });
  }
});
