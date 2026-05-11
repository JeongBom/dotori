// Screen 6: 자산 내역 (asset detail / history)
function Screen6History() {
  const histories = [
    { date: '4월 21일', time: '14:32', delta: +1200000, memo: '4월 월급 입금', by: '민수', byColor: DOTORI.brown },
    { date: '3월 24일', time: '09:12', delta: +1200000, memo: '3월 월급 입금', by: '민수', byColor: DOTORI.brown },
    { date: '3월 10일', time: '18:45', delta: -350000, memo: '부모님 용돈', by: '지영', byColor: '#9478C9' },
    { date: '2월 28일', time: '20:03', delta: +80000, memo: '이자 입금', by: '민수', byColor: DOTORI.brown },
  ];

  return (
    <Phone bg="#FFFFFF">
      {/* Nav */}
      <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BackIcon />
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: DOTORI.textDark }}>자산 내역</div>
        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textDark} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="1.5" fill={DOTORI.textDark}/><circle cx="12" cy="6" r="1.5" fill={DOTORI.textDark}/><circle cx="12" cy="18" r="1.5" fill={DOTORI.textDark}/></svg>
        </div>
      </div>

      {/* Segmented tabs */}
      <div style={{ padding: '12px 20px 0', display: 'flex', gap: 20, borderBottom: `1px solid ${DOTORI.edge}55` }}>
        <div style={{ paddingBottom: 10, fontSize: 13, color: DOTORI.textDark, fontWeight: 700, borderBottom: `2px solid ${DOTORI.brown}`, marginBottom: -1 }}>내역</div>
        <div style={{ paddingBottom: 10, fontSize: 13, color: DOTORI.textLight, fontWeight: 600 }}>추이</div>
      </div>

      {/* Big amount card */}
      <div style={{ margin: '16px 16px 0', background: DOTORI.brown, borderRadius: 18, padding: '18px 18px 16px', boxShadow: '0 8px 24px rgba(139,94,60,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>카카오뱅크 주계좌</div>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.18)', fontSize: 10, color: '#fff', fontWeight: 700 }}>수정</div>
        </div>
        <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: -0.8, marginTop: 10 }}>4,440,000원</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: 500 }}>지난 달 대비 <span style={{ color: '#C8E6D0', fontWeight: 700 }}>+37%</span></div>

        {/* mini sparkline */}
        <svg width="100%" height="40" viewBox="0 0 300 40" style={{ marginTop: 10 }}>
          <path d="M0 30 L40 28 L80 25 L120 26 L160 18 L200 20 L240 12 L300 8"
            fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
          <path d="M0 30 L40 28 L80 25 L120 26 L160 18 L200 20 L240 12 L300 8 L300 40 L0 40 Z"
            fill="rgba(255,255,255,0.15)"/>
        </svg>
      </div>

      {/* Filter strip */}
      <div style={{ padding: '16px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: DOTORI.textLight, fontWeight: 600 }}>최근 6개월</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: DOTORI.textMid, fontWeight: 600 }}>
          최신순
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textMid} strokeWidth="2"><path d="M6 9l6 6 6-6" strokeLinecap="round"/></svg>
        </div>
      </div>

      {/* History list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {histories.map((h, i) => {
          const pos = h.delta > 0;
          return (
            <div key={i} style={{ padding: '11px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 16,
                background: pos ? DOTORI.success + '18' : DOTORI.danger + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={pos ? DOTORI.success : DOTORI.danger} strokeWidth="2.5" strokeLinecap="round">
                  {pos ? <path d="M12 5v14M5 12h14"/> : <path d="M5 12h14"/>}
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: DOTORI.textDark }}># {h.memo}</div>
                <div style={{ fontSize: 10, color: DOTORI.textLight, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span>{h.date} · {h.time}</span>
                  <span style={{ padding: '1px 5px', borderRadius: 4, background: h.byColor + '22', color: h.byColor, fontWeight: 700 }}>{h.by}</span>
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: pos ? DOTORI.success : DOTORI.danger, fontVariantNumeric: 'tabular-nums' }}>
                {pos ? '+' : ''}{h.delta.toLocaleString('ko-KR')}
              </div>
            </div>
          );
        })}
      </div>

      <DotoriTabBar active="자산" />
    </Phone>
  );
}

window.Screen6History = Screen6History;
