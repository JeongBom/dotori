// Screen 2: 자산 선택 (category/asset picker)
function Screen2Select() {
  const categories = ['예금', '적금', '주식', '부동산'];
  const items = [
    { cat: '예금', color: DOTORI.depositBlue, emoji: '🏦', name: '카카오뱅크 주계좌', amount: 3240000, owner: '민수', ownerColor: DOTORI.brown, selected: true },
    { cat: '예금', color: DOTORI.depositBlue, emoji: '🏦', name: '토스 비상금', amount: 1500000, owner: '지영', ownerColor: '#9478C9' },
    { cat: '적금', color: DOTORI.savingsGreen, emoji: '💵', name: '주택청약 적금', amount: 12400000, owner: '민수', ownerColor: DOTORI.brown },
    { cat: '주식', color: DOTORI.stockPink, emoji: '📈', name: '키움증권 ISA', amount: 8950000, owner: '지영', ownerColor: '#9478C9' },
  ];

  return (
    <Phone bg="#FFFFFF">
      {/* Nav */}
      <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BackIcon />
        </div>
        <div style={{ fontSize: 12, color: DOTORI.textLight, fontWeight: 600 }}>1 / 4</div>
        <div style={{ width: 36 }}/>
      </div>

      {/* Progress */}
      <div style={{ padding: '8px 24px 0' }}>
        <div style={{ height: 3, background: DOTORI.cream, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: '25%', height: '100%', background: DOTORI.brown, borderRadius: 2 }}/>
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: '24px 24px 20px' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -0.6, lineHeight: 1.3 }}>어떤 자산을<br/>업데이트할까요?</div>
        <div style={{ fontSize: 13, color: DOTORI.textLight, marginTop: 8, fontWeight: 500 }}>변동이 있는 항목을 선택해주세요</div>
      </div>

      {/* Category chips */}
      <div style={{ padding: '0 24px', display: 'flex', gap: 6, marginBottom: 16 }}>
        <div style={{ padding: '6px 12px', borderRadius: 14, background: DOTORI.textDark, fontSize: 11, color: '#fff', fontWeight: 700 }}>전체</div>
        {categories.map(c => (
          <div key={c} style={{ padding: '6px 12px', borderRadius: 14, background: DOTORI.cream, fontSize: 11, color: DOTORI.textMid, fontWeight: 600, border: `1px solid ${DOTORI.edge}` }}>{c}</div>
        ))}
      </div>

      {/* Section label */}
      <div style={{ padding: '0 24px 8px', fontSize: 11, color: DOTORI.textLight, fontWeight: 700, letterSpacing: 0.3 }}>내 자산 4개</div>

      {/* Asset list */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            background: it.selected ? DOTORI.ivory : '#fff',
            border: `1.5px solid ${it.selected ? DOTORI.brown : DOTORI.edge + '66'}`,
            borderRadius: 14, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: it.selected ? '0 4px 12px rgba(139,94,60,0.15)' : 'none',
          }}>
            {/* radio */}
            <div style={{
              width: 20, height: 20, borderRadius: 10,
              border: `2px solid ${it.selected ? DOTORI.brown : DOTORI.edge}`,
              background: it.selected ? DOTORI.brown : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {it.selected && <div style={{ width: 8, height: 8, borderRadius: 4, background: '#fff' }}/>}
            </div>
            {/* icon */}
            <div style={{
              width: 36, height: 36, borderRadius: 10, background: it.color + '22',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, flexShrink: 0,
            }}>{it.emoji}</div>
            {/* info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: DOTORI.textDark }}>{it.name}</span>
                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: it.ownerColor + '22', color: it.ownerColor, fontWeight: 700 }}>{it.owner}</span>
              </div>
              <div style={{ fontSize: 10, color: DOTORI.textLight, fontWeight: 500 }}>{it.cat} · {formatAmount(it.amount)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div style={{ position: 'absolute', bottom: 34, left: 0, right: 0, padding: '16px 20px', background: 'linear-gradient(to top, #fff 70%, rgba(255,255,255,0))' }}>
        <div style={{
          background: DOTORI.brown, borderRadius: 14, padding: '15px 0',
          textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#fff',
          boxShadow: '0 8px 20px rgba(139,94,60,0.3)',
        }}>다음</div>
      </div>
    </Phone>
  );
}

window.Screen2Select = Screen2Select;
