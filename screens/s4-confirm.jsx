// Screen 4: 확인 (reason + confirm)
function Screen4Confirm() {
  return (
    <Phone bg="#FFFFFF">
      {/* Nav */}
      <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BackIcon />
        </div>
        <div style={{ fontSize: 12, color: DOTORI.textLight, fontWeight: 600 }}>3 / 4</div>
        <div style={{ width: 36 }}/>
      </div>

      {/* Progress */}
      <div style={{ padding: '8px 24px 0' }}>
        <div style={{ height: 3, background: DOTORI.cream, borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: '75%', height: '100%', background: DOTORI.brown, borderRadius: 2 }}/>
        </div>
      </div>

      {/* Summary card */}
      <div style={{ margin: '24px 20px 0', background: DOTORI.ivory, borderRadius: 18, padding: '18px 18px 16px', border: `1px solid ${DOTORI.edge}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: DOTORI.depositBlue + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏦</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: DOTORI.textDark }}>카카오뱅크 주계좌</div>
            <div style={{ fontSize: 11, color: DOTORI.textLight, marginTop: 1 }}>예금 · 민수</div>
          </div>
          <div style={{ padding: '3px 8px', borderRadius: 8, background: DOTORI.success + '22', fontSize: 10, color: DOTORI.success, fontWeight: 700 }}>+ 추가</div>
        </div>

        <div style={{ borderTop: `1px dashed ${DOTORI.edge}`, paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 600 }}>변동 금액</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: DOTORI.success, letterSpacing: -0.5 }}>+1,200,000원</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11 }}>
            <span style={{ color: DOTORI.textLight }}>이전 금액</span>
            <span style={{ color: DOTORI.textMid, fontWeight: 600 }}>3,240,000원</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12 }}>
            <span style={{ color: DOTORI.textMid, fontWeight: 600 }}>변경 후</span>
            <span style={{ color: DOTORI.textDark, fontWeight: 800 }}>4,440,000원</span>
          </div>
        </div>
      </div>

      {/* Reason input */}
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: DOTORI.textMid, marginBottom: 8 }}>변경 이유</div>
        <div style={{
          background: DOTORI.cream, borderRadius: 12, padding: '14px 14px',
          border: `1.5px solid ${DOTORI.brown}`,
          fontSize: 14, color: DOTORI.textDark, fontWeight: 500,
        }}>4월 월급 입금</div>

        {/* Tag chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {['월급', '보너스', '이자', '주식 매도'].map(t => (
            <div key={t} style={{ padding: '4px 10px', borderRadius: 10, background: DOTORI.ivory, fontSize: 10, color: DOTORI.textMid, fontWeight: 600, border: `1px solid ${DOTORI.edge}` }}># {t}</div>
          ))}
        </div>
      </div>

      {/* Info row */}
      <div style={{ margin: '20px 20px 0', padding: '10px 12px', background: DOTORI.cream, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DOTORI.warmOak} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        <span style={{ fontSize: 10, color: DOTORI.textLight, fontWeight: 500, lineHeight: 1.4 }}>가족 구성원에게 <b style={{color: DOTORI.textMid}}>변동 알림</b>이 전송돼요</span>
      </div>

      {/* CTA */}
      <div style={{ position: 'absolute', bottom: 34, left: 0, right: 0, padding: '16px 20px' }}>
        <div style={{
          background: DOTORI.brown, borderRadius: 14, padding: '15px 0',
          textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#fff',
          boxShadow: '0 8px 20px rgba(139,94,60,0.3)',
        }}>업데이트 완료</div>
      </div>
    </Phone>
  );
}

window.Screen4Confirm = Screen4Confirm;
