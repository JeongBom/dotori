// Screen 5: 완료 (success)
function Screen5Done() {
  return (
    <Phone bg={DOTORI.cream}>
      <div style={{ padding: '60px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Success mark */}
        <div style={{ position: 'relative', marginTop: 30 }}>
          <div style={{
            width: 110, height: 110, borderRadius: 55,
            background: DOTORI.brown,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 14px 30px rgba(139,94,60,0.35)',
          }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 10-11"/></svg>
          </div>
          {/* floating acorns */}
          <div style={{ position: 'absolute', top: -10, right: -20, opacity: 0.8 }}><AcornMark size={24} color={DOTORI.warmOak}/></div>
          <div style={{ position: 'absolute', bottom: 0, left: -24, opacity: 0.6 }}><AcornMark size={18} color={DOTORI.lightOak}/></div>
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, color: DOTORI.textDark, marginTop: 28, textAlign: 'center', letterSpacing: -0.5, lineHeight: 1.3 }}>
          카카오뱅크 주계좌에<br/>1,200,000원을 더했어요
        </div>
        <div style={{ fontSize: 13, color: DOTORI.textLight, marginTop: 8, fontWeight: 500 }}>히스토리에 기록했습니다</div>

        {/* Detail card */}
        <div style={{ width: '100%', background: '#fff', borderRadius: 16, padding: 16, marginTop: 26, border: `1px solid ${DOTORI.edge}66` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 600 }}>변경 후 금액</span>
            <span style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 500 }}>4월 21일 14:32</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: DOTORI.textDark, letterSpacing: -0.8, marginBottom: 14 }}>4,440,000원</div>
          <div style={{ borderTop: `1px solid ${DOTORI.edge}55`, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: DOTORI.textLight }}>이전</span>
              <span style={{ color: DOTORI.textMid, fontWeight: 600 }}>3,240,000원</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: DOTORI.textLight }}>변동</span>
              <span style={{ color: DOTORI.success, fontWeight: 700 }}>+1,200,000원</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: DOTORI.textLight }}>이유</span>
              <span style={{ color: DOTORI.textMid, fontWeight: 600 }}># 4월 월급 입금</span>
            </div>
          </div>
        </div>

        {/* Family notification strip */}
        <div style={{ width: '100%', marginTop: 14, padding: '10px 14px', background: DOTORI.ivory, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${DOTORI.edge}55` }}>
          <div style={{ width: 24, height: 24, borderRadius: 12, background: '#9478C9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>지</div>
          <span style={{ fontSize: 11, color: DOTORI.textMid, fontWeight: 500, flex: 1 }}>지영님에게 알림을 보냈어요</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={DOTORI.textLight} strokeWidth="2"><path d="M5 12l5 5 10-11" strokeLinecap="round"/></svg>
        </div>
      </div>

      {/* CTAs */}
      <div style={{ position: 'absolute', bottom: 34, left: 0, right: 0, padding: '16px 20px' }}>
        <div style={{
          background: DOTORI.brown, borderRadius: 14, padding: '15px 0',
          textAlign: 'center', fontSize: 15, fontWeight: 700, color: '#fff',
          boxShadow: '0 8px 20px rgba(139,94,60,0.3)', marginBottom: 8,
        }}>확인</div>
        <div style={{ textAlign: 'center', fontSize: 12, color: DOTORI.textMid, fontWeight: 600, padding: '10px 0' }}>히스토리 보기</div>
      </div>
    </Phone>
  );
}

window.Screen5Done = Screen5Done;
