// Screen 3: 금액 입력 (numeric keypad)
function Screen3Amount() {
  const keys = [
    ['1','2','3'],['4','5','6'],['7','8','9'],['000','0','⌫'],
  ];
  return (
    <Phone bg="#FFFFFF">
      {/* Nav */}
      <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BackIcon />
        </div>
        <div style={{ fontSize: 12, color: DOTORI.textLight, fontWeight: 600 }}>2 / 4</div>
        <div style={{ width: 36 }}/>
      </div>

      {/* Progress */}
      <div style={{ padding: '8px 24px 0' }}>
        <div style={{ height: 3, background: DOTORI.cream, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: '50%', height: '100%', background: DOTORI.brown, borderRadius: 2 }}/>
        </div>
      </div>

      {/* Context card */}
      <div style={{ margin: '20px 20px 0', background: DOTORI.cream, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: DOTORI.depositBlue + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>🏦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: DOTORI.textDark }}>카카오뱅크 주계좌</div>
          <div style={{ fontSize: 10, color: DOTORI.textLight, marginTop: 1 }}>현재 금액 3,240,000원</div>
        </div>
      </div>

      {/* Title */}
      <div style={{ padding: '24px 24px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -0.5, lineHeight: 1.3 }}>얼마로<br/>바뀌었나요?</div>
      </div>

      {/* +/- toggle */}
      <div style={{ padding: '18px 24px 0', display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: DOTORI.success + '15', border: `1.5px solid ${DOTORI.success}`, textAlign: 'center', fontSize: 13, fontWeight: 700, color: DOTORI.success }}>+ 추가</div>
        <div style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: DOTORI.ivory, border: `1px solid ${DOTORI.edge}`, textAlign: 'center', fontSize: 13, fontWeight: 600, color: DOTORI.textMid }}>− 감소</div>
      </div>

      {/* Amount display */}
      <div style={{ padding: '30px 24px 6px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -1.5, fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: DOTORI.success }}>+</span> 1,200,000<span style={{ fontSize: 24, color: DOTORI.textMid, fontWeight: 700 }}> 원</span>
        </div>
        <div style={{ fontSize: 12, color: DOTORI.textLight, marginTop: 8, fontWeight: 600 }}>변경 후 <span style={{ color: DOTORI.textDark, fontWeight: 700 }}>4,440,000원</span></div>
      </div>

      {/* Quick amount chips */}
      <div style={{ padding: '16px 24px 0', display: 'flex', gap: 6, justifyContent: 'center' }}>
        {['+10만','+50만','+100만','+500만'].map(q => (
          <div key={q} style={{ padding: '5px 10px', borderRadius: 10, background: DOTORI.cream, fontSize: 11, color: DOTORI.textMid, fontWeight: 600, border: `1px solid ${DOTORI.edge}` }}>{q}</div>
        ))}
      </div>

      {/* Keypad */}
      <div style={{ position: 'absolute', bottom: 100, left: 0, right: 0, padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', rowGap: 4 }}>
          {keys.flat().map((k, i) => (
            <div key={i} style={{
              padding: '10px 0', textAlign: 'center',
              fontSize: 22, fontWeight: 600, color: DOTORI.textDark,
              fontFamily: '-apple-system, system-ui',
            }}>{k}</div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ position: 'absolute', bottom: 34, left: 0, right: 0, padding: '10px 20px' }}>
        <div style={{
          background: DOTORI.brown, borderRadius: 14, padding: '15px 0',
          textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#fff',
          boxShadow: '0 8px 20px rgba(139,94,60,0.3)',
        }}>다음</div>
      </div>
    </Phone>
  );
}

window.Screen3Amount = Screen3Amount;
