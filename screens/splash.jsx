// Splash — Minimal Warm direction, family theme
// A1 (still) + A2, A3 with animations. Shared SplashReplay wrapper.

function FamilyAcorn({ size = 60, color = DOTORI.brown, leafColor = '#9AB87A', tilt = 0, face = 'neutral', offsetY = 0, withLeaf = true }) {
  const w = size;
  const h = size * 1.2;
  return (
    <svg width={w} height={h} viewBox="0 0 100 120" fill="none" style={{ transform: `translateY(${offsetY}px) rotate(${tilt}deg)`, overflow: 'visible' }}>
      {withLeaf && (
        <>
          <path d="M52 18 C 60 8, 74 6, 82 12 C 78 22, 68 26, 58 24 C 54 23, 52 21, 52 18 Z" fill={leafColor}/>
          <path d="M52 18 Q 62 16, 78 14" stroke={leafColor} strokeOpacity="0.55" strokeWidth="1" strokeLinecap="round" fill="none"/>
          <path d="M50 24 L 50 18" stroke="#6B4226" strokeWidth="2" strokeLinecap="round"/>
        </>
      )}
      <path d="M14 36 C 14 30, 18 24, 24 24 L 76 24 C 82 24, 86 30, 86 36 L 86 42 C 86 46, 83 48, 80 48 L 20 48 C 17 48, 14 46, 14 42 Z" fill={color}/>
      <g fill={DOTORI.deepBrown} opacity="0.22">
        <circle cx="26" cy="34" r="1.6"/><circle cx="36" cy="40" r="1.6"/><circle cx="46" cy="34" r="1.6"/>
        <circle cx="56" cy="40" r="1.6"/><circle cx="66" cy="34" r="1.6"/><circle cx="76" cy="40" r="1.6"/>
        <circle cx="31" cy="42" r="1.4"/><circle cx="51" cy="42" r="1.4"/><circle cx="71" cy="42" r="1.4"/>
      </g>
      <path d="M18 48 L 82 48 C 82 78, 68 106, 50 106 C 32 106, 18 78, 18 48 Z" fill={color} opacity="0.72"/>
      <ellipse cx="34" cy="68" rx="6" ry="14" fill="#fff" opacity="0.2"/>
      {face === 'happy' && (
        <g fill={DOTORI.deepBrown}>
          <circle cx="40" cy="72" r="2.2"/><circle cx="60" cy="72" r="2.2"/>
          <path d="M42 82 Q 50 88, 58 82" stroke={DOTORI.deepBrown} strokeWidth="2" strokeLinecap="round" fill="none"/>
          <circle cx="34" cy="80" r="2.2" fill="#E8A5A5" opacity="0.55"/>
          <circle cx="66" cy="80" r="2.2" fill="#E8A5A5" opacity="0.55"/>
        </g>
      )}
      {face === 'smile' && (
        <g>
          <circle cx="40" cy="74" r="1.8" fill={DOTORI.deepBrown}/>
          <circle cx="60" cy="74" r="1.8" fill={DOTORI.deepBrown}/>
          <path d="M43 82 Q 50 86, 57 82" stroke={DOTORI.deepBrown} strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        </g>
      )}
      {face === 'baby' && (
        <g>
          <circle cx="42" cy="76" r="1.5" fill={DOTORI.deepBrown}/>
          <circle cx="58" cy="76" r="1.5" fill={DOTORI.deepBrown}/>
          <circle cx="50" cy="82" r="1.8" fill="#E8A5A5" opacity="0.7"/>
        </g>
      )}
    </svg>
  );
}

function SplashBar({ dark }) {
  const c = dark ? '#fff' : DOTORI.textDark;
  return (
    <div style={{ height: 54, padding: '21px 28px 0', display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 5 }}>
      <span style={{ fontFamily: '-apple-system, system-ui', fontWeight: 600, fontSize: 16, color: c }}>9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="11" viewBox="0 0 18 11">
          <rect x="0" y="7" width="3" height="4" rx="0.5" fill={c}/>
          <rect x="5" y="5" width="3" height="6" rx="0.5" fill={c}/>
          <rect x="10" y="2" width="3" height="9" rx="0.5" fill={c}/>
          <rect x="15" y="0" width="3" height="11" rx="0.5" fill={c}/>
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12">
          <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke={c} strokeOpacity="0.4" fill="none"/>
          <rect x="2" y="2" width="18" height="8" rx="1.5" fill={c}/>
        </svg>
      </div>
    </div>
  );
}

function SplashPhone({ children, bg = DOTORI.cream, dark = false }) {
  return (
    <div style={{
      width: 380, height: 780, borderRadius: 44, overflow: 'hidden',
      position: 'relative', background: bg,
      fontFamily: '"Pretendard", -apple-system, "Apple SD Gothic Neo", system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <Island />
      <SplashBar dark={dark}/>
      {children}
      <HomeBar dark={dark}/>
    </div>
  );
}

// ── Shared keyframes block ──────────────────────────────────────
const SPLASH_KEYFRAMES = `
  @keyframes dotori-fade-up {
    0% { opacity: 0; transform: translateY(12px) scale(0.96); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes dotori-pop {
    0% { opacity: 0; transform: translateY(20px) scale(0.6); }
    60% { opacity: 1; transform: translateY(-4px) scale(1.08); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes dotori-pop-drop {
    0% { opacity: 0; transform: translateY(-40px) scale(0.7); }
    70% { opacity: 1; transform: translateY(6px) scale(1.05); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes dotori-sway-a { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
  @keyframes dotori-sway-b { 0%,100% { transform: rotate(-6deg); } 50% { transform: rotate(-2deg); } }
  @keyframes dotori-sway-c { 0%,100% { transform: rotate(5deg); } 50% { transform: rotate(10deg); } }
  @keyframes dotori-sway-d { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(1deg); } }
  @keyframes dotori-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
  @keyframes dotori-orbit { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes dotori-orbit-rev { 0% { transform: rotate(360deg); } 100% { transform: rotate(0deg); } }
  @keyframes dotori-dots { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
  @keyframes dotori-leaf-fall {
    0% { opacity: 0; transform: translateY(-20px) rotate(0deg); }
    30% { opacity: 0.5; }
    100% { opacity: 0.3; transform: translateY(500px) rotate(180deg); }
  }
  @keyframes dotori-walk {
    0%,100% { transform: translateX(0) translateY(0); }
    25% { transform: translateX(2px) translateY(-2px); }
    50% { transform: translateX(0) translateY(0); }
    75% { transform: translateX(-2px) translateY(-2px); }
  }
  @keyframes dotori-dash {
    0% { stroke-dashoffset: 400; }
    100% { stroke-dashoffset: 0; }
  }
  @keyframes dotori-circle-grow {
    0% { transform: translateX(-50%) scale(0); opacity: 0; }
    100% { transform: translateX(-50%) scale(1); opacity: 1; }
  }
`;

// ── A1 · Family cluster (still) ──────────────────────────────────
function SplashA1() {
  return (
    <SplashPhone bg={DOTORI.cream}>
      <div style={{ height: 726, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ marginTop: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ marginRight: -8, zIndex: 1 }}>
            <FamilyAcorn size={78} color={DOTORI.warmOak} leafColor="#C8D89A" tilt={-6} face="smile"/>
          </div>
          <div style={{ zIndex: 3, marginBottom: 4 }}>
            <FamilyAcorn size={106} color={DOTORI.brown} leafColor="#9AB87A" face="happy"/>
          </div>
          <div style={{ marginLeft: -8, zIndex: 2 }}>
            <FamilyAcorn size={58} color={DOTORI.lightOak} leafColor="#B4C98A" tilt={8} face="baby"/>
          </div>
        </div>
        <div style={{ width: 220, height: 10, borderRadius: 5, background: DOTORI.edge, opacity: 0.45, marginTop: -4, filter: 'blur(3px)' }}/>
        <div style={{ marginTop: 44, textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: DOTORI.textDark, letterSpacing: -2, lineHeight: 1 }}>도토리</div>
          <div style={{ fontSize: 13, color: DOTORI.textMid, fontWeight: 600, marginTop: 14, letterSpacing: -0.2 }}>우리 집을 모아두는 곳</div>
        </div>
        <div style={{ position: 'absolute', bottom: 86, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: DOTORI.brown, opacity: i === 1 ? 1 : 0.3 }}/>
          ))}
        </div>
      </div>
    </SplashPhone>
  );
}

// ── A2 · Animated centered parent with orbiting babies ──────────
function SplashA2Animated({ replayKey }) {
  return (
    <SplashPhone bg={DOTORI.ivory}>
      <style>{SPLASH_KEYFRAMES + `
        .a2-circle {
          animation: dotori-circle-grow 0.8s cubic-bezier(0.2,0.8,0.3,1) both;
          animation-delay: 0.1s;
        }
        .a2-orbit {
          animation: dotori-fade-up 0.8s ease-out both;
          animation-delay: 0.3s;
        }
        .a2-parent {
          animation: dotori-pop 0.8s cubic-bezier(0.34,1.56,0.64,1) both;
          animation-delay: 0.4s;
          transform-origin: bottom center;
        }
        .a2-parent-float {
          animation: dotori-float 3s ease-in-out infinite;
          animation-delay: 1.3s;
        }
        .a2-baby-wrap {
          transform-origin: 190px 350px;
          animation: dotori-pop-drop 0.7s cubic-bezier(0.34,1.56,0.64,1) both, dotori-orbit 24s linear infinite;
          animation-delay: 0s, 2s;
        }
        .a2-baby-1 { animation-delay: 0.6s, 2s; }
        .a2-baby-2 { animation-delay: 0.75s, 2s; }
        .a2-baby-3 { animation-delay: 0.9s, 2s; }
        .a2-baby-4 { animation-delay: 1.05s, 2s; }
        .a2-baby-counter {
          animation: dotori-orbit-rev 24s linear infinite;
          animation-delay: 2s;
          transform-origin: center;
        }
        .a2-title { animation: dotori-fade-up 0.7s cubic-bezier(0.2,0.8,0.3,1) both; animation-delay: 1.1s; }
        .a2-sub   { animation: dotori-fade-up 0.7s cubic-bezier(0.2,0.8,0.3,1) both; animation-delay: 1.25s; }
        .a2-cap   { animation: dotori-fade-up 0.7s cubic-bezier(0.2,0.8,0.3,1) both; animation-delay: 1.4s; }
      `}</style>
      <div key={replayKey} style={{ height: 726, position: 'relative' }}>
        <div className="a2-circle" style={{
          position: 'absolute', top: 190, left: '50%',
          width: 260, height: 260, borderRadius: 130,
          background: DOTORI.cream, transformOrigin: 'center',
        }}/>
        <svg className="a2-orbit" width="300" height="300" viewBox="0 0 300 300" style={{ position: 'absolute', top: 170, left: 40 }}>
          <circle cx="150" cy="150" r="140" stroke={DOTORI.warmOak} strokeOpacity="0.25" strokeWidth="1.2" strokeDasharray="3 5" fill="none"/>
        </svg>

        <div className="a2-parent" style={{ position: 'absolute', top: 245, left: '50%', marginLeft: -65 }}>
          <div className="a2-parent-float">
            <FamilyAcorn size={130} color={DOTORI.brown} face="happy"/>
          </div>
        </div>

        {/* Orbit wrap — babies rotate around parent center (190, 350) */}
        <div className="a2-baby-wrap a2-baby-1" style={{ position: 'absolute', top: 215, left: 65 }}>
          <div className="a2-baby-counter"><FamilyAcorn size={44} color={DOTORI.warmOak} leafColor="#C8D89A" face="smile"/></div>
        </div>
        <div className="a2-baby-wrap a2-baby-2" style={{ position: 'absolute', top: 215, right: 65, transformOrigin: '-125px 135px' }}>
          <div className="a2-baby-counter"><FamilyAcorn size={40} color={DOTORI.lightOak} leafColor="#B4C98A" face="baby"/></div>
        </div>
        <div className="a2-baby-wrap a2-baby-3" style={{ position: 'absolute', top: 430, left: 90, transformOrigin: '100px -80px' }}>
          <div className="a2-baby-counter"><FamilyAcorn size={36} color={DOTORI.warmOak} leafColor="#C8D89A" face="baby" withLeaf={false}/></div>
        </div>
        <div className="a2-baby-wrap a2-baby-4" style={{ position: 'absolute', top: 425, right: 95, transformOrigin: '-95px -75px' }}>
          <div className="a2-baby-counter"><FamilyAcorn size={42} color={DOTORI.lightOak} leafColor="#9AB87A" face="smile"/></div>
        </div>

        <div className="a2-title" style={{ position: 'absolute', bottom: 130, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 900, color: DOTORI.textDark, letterSpacing: -1.5, lineHeight: 1 }}>도토리</div>
        </div>
        <div className="a2-sub" style={{ position: 'absolute', bottom: 110, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: DOTORI.textLight, fontWeight: 700, letterSpacing: 3 }}>DOTORI</div>
        </div>
        <div className="a2-cap" style={{ position: 'absolute', bottom: 78, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: DOTORI.textMid, fontWeight: 600 }}>온 가족이 함께 모으는 우리 집 살림</div>
        </div>
      </div>
    </SplashPhone>
  );
}

// ── A3 · Animated horizon walk ──────────────────────────────────
function SplashA3Animated({ replayKey }) {
  return (
    <SplashPhone bg={DOTORI.cream}>
      <style>{SPLASH_KEYFRAMES + `
        .a3-kicker { animation: dotori-fade-up 0.7s ease-out both; animation-delay: 0.1s; }
        .a3-title  { animation: dotori-fade-up 0.7s cubic-bezier(0.2,0.8,0.3,1) both; animation-delay: 0.25s; }
        .a3-leaf-a { animation: dotori-leaf-fall 5s ease-in infinite; animation-delay: 0.4s; }
        .a3-leaf-b { animation: dotori-leaf-fall 5s ease-in infinite; animation-delay: 2.2s; }

        .a3-horizon {
          animation: dotori-fade-up 0.7s ease-out both;
          animation-delay: 0.4s;
        }
        .a3-trail {
          stroke-dasharray: 2 5;
          stroke-dashoffset: 400;
          animation: dotori-dash 2s ease-out 0.6s forwards;
        }
        .a3-ground { animation: dotori-fade-up 0.8s ease-out both; animation-delay: 0.5s; }

        .a3-acorn-wrap {
          animation: dotori-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
          transform-origin: bottom center;
        }
        .a3-acorn-1 { animation-delay: 0.7s; }
        .a3-acorn-2 { animation-delay: 0.85s; }
        .a3-acorn-3 { animation-delay: 1.0s; }
        .a3-acorn-4 { animation-delay: 1.15s; }

        .a3-acorn-idle-1 { animation: dotori-sway-d 2.6s ease-in-out infinite 1.6s; transform-origin: bottom center; }
        .a3-acorn-idle-2 { animation: dotori-sway-a 3.0s ease-in-out infinite 1.7s; transform-origin: bottom center; }
        .a3-acorn-idle-3 { animation: dotori-sway-c 2.3s ease-in-out infinite 1.8s; transform-origin: bottom center; }
        .a3-acorn-idle-4 { animation: dotori-walk 2.0s ease-in-out infinite 1.9s; transform-origin: bottom center; }

        .a3-cap { animation: dotori-fade-up 0.7s ease-out both; animation-delay: 1.3s; }
      `}</style>
      <div key={replayKey} style={{ height: 726, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 130, left: 0, right: 0, textAlign: 'center' }}>
          <div className="a3-kicker" style={{ fontSize: 11, color: DOTORI.textLight, fontWeight: 700, letterSpacing: 4 }}>TOGETHER SINCE TODAY</div>
          <div className="a3-title" style={{ fontSize: 54, fontWeight: 900, color: DOTORI.textDark, letterSpacing: -2, marginTop: 14, lineHeight: 1 }}>도토리</div>
        </div>

        <svg className="a3-leaf-a" width="18" height="18" viewBox="0 0 40 40" style={{ position: 'absolute', top: 80, left: 70 }}>
          <path d="M20 5 C 30 8, 34 20, 28 32 C 16 34, 6 22, 12 10 Z" fill="#9AB87A"/>
        </svg>
        <svg className="a3-leaf-b" width="14" height="14" viewBox="0 0 40 40" style={{ position: 'absolute', top: 60, right: 80 }}>
          <path d="M20 5 C 30 8, 34 20, 28 32 C 16 34, 6 22, 12 10 Z" fill="#C8A47A"/>
        </svg>

        <div className="a3-horizon" style={{ position: 'absolute', bottom: 200, left: 0, right: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end', paddingLeft: 30, paddingRight: 30, marginBottom: -2, position: 'relative', zIndex: 2 }}>
            <div className="a3-acorn-wrap a3-acorn-1">
              <div className="a3-acorn-idle-1"><FamilyAcorn size={54} color={DOTORI.warmOak} leafColor="#C8D89A" tilt={-4} face="smile"/></div>
            </div>
            <div className="a3-acorn-wrap a3-acorn-2">
              <div className="a3-acorn-idle-2"><FamilyAcorn size={74} color={DOTORI.brown} leafColor="#9AB87A" face="happy"/></div>
            </div>
            <div className="a3-acorn-wrap a3-acorn-3">
              <div className="a3-acorn-idle-3"><FamilyAcorn size={48} color={DOTORI.lightOak} leafColor="#B4C98A" tilt={5} face="baby"/></div>
            </div>
            <div className="a3-acorn-wrap a3-acorn-4">
              <div className="a3-acorn-idle-4"><FamilyAcorn size={38} color={DOTORI.warmOak} leafColor="#C8D89A" face="baby" withLeaf={false}/></div>
            </div>
          </div>
          <div style={{ height: 1.5, background: DOTORI.textLight, opacity: 0.35 }}/>
          <div className="a3-ground" style={{ height: 100, background: `linear-gradient(${DOTORI.edge}, transparent)`, opacity: 0.4 }}/>
        </div>

        <svg width="380" height="40" viewBox="0 0 380 40" style={{ position: 'absolute', bottom: 194, left: 0 }}>
          <path className="a3-trail" d="M20 20 Q 190 10, 360 20" stroke={DOTORI.warmOak} strokeWidth="1.2" fill="none" opacity="0.45"/>
        </svg>

        <div className="a3-cap" style={{ position: 'absolute', bottom: 90, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: DOTORI.textMid, fontWeight: 600, letterSpacing: -0.2 }}>한 알 한 알, 우리 집 이야기</div>
        </div>
      </div>
    </SplashPhone>
  );
}

// ── Original animated (cluster) ─────────────────────────────────
function SplashAnimated({ replayKey }) {
  return (
    <SplashPhone bg={DOTORI.cream}>
      <style>{SPLASH_KEYFRAMES + `
        .sp-cluster-wrap { animation: dotori-fade-up 0.8s cubic-bezier(0.34,1.56,0.64,1) both; animation-delay: 0.1s; }
        .sp-parent { animation: dotori-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) both; animation-delay: 0.3s; transform-origin: bottom center; }
        .sp-parent-sway { animation: dotori-sway-a 3s ease-in-out infinite; animation-delay: 1.2s; transform-origin: bottom center; }
        .sp-child  { animation: dotori-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both; animation-delay: 0.5s; transform-origin: bottom center; }
        .sp-child-sway { animation: dotori-sway-b 2.8s ease-in-out infinite; animation-delay: 1.3s; transform-origin: bottom center; }
        .sp-baby   { animation: dotori-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) both; animation-delay: 0.7s; transform-origin: bottom center; }
        .sp-baby-sway { animation: dotori-sway-c 2.5s ease-in-out infinite; animation-delay: 1.5s; transform-origin: bottom center; }
        .sp-shadow { animation: dotori-fade-up 0.6s ease-out both; animation-delay: 0.8s; }
        .sp-title  { animation: dotori-fade-up 0.7s cubic-bezier(0.2,0.8,0.3,1) both; animation-delay: 1.0s; }
        .sp-sub    { animation: dotori-fade-up 0.7s cubic-bezier(0.2,0.8,0.3,1) both; animation-delay: 1.15s; }
        .sp-dot    { animation: dotori-dots 1.4s ease-in-out infinite; }
        .sp-dot-1 { animation-delay: 0s; } .sp-dot-2 { animation-delay: 0.2s; } .sp-dot-3 { animation-delay: 0.4s; }
        .sp-leaf   { animation: dotori-leaf-fall 4s ease-in infinite; }
        .sp-leaf-1 { animation-delay: 0.6s; left: 60px; } .sp-leaf-2 { animation-delay: 2.4s; left: 290px; }
      `}</style>
      <div key={replayKey} style={{ height: 726, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
        <svg className="sp-leaf sp-leaf-1" width="20" height="20" viewBox="0 0 40 40" style={{ position: 'absolute', top: 60 }}>
          <path d="M20 5 C 30 8, 34 20, 28 32 C 16 34, 6 22, 12 10 Z" fill="#9AB87A"/>
        </svg>
        <svg className="sp-leaf sp-leaf-2" width="16" height="16" viewBox="0 0 40 40" style={{ position: 'absolute', top: 60 }}>
          <path d="M20 5 C 30 8, 34 20, 28 32 C 16 34, 6 22, 12 10 Z" fill="#C8A47A"/>
        </svg>
        <div className="sp-cluster-wrap" style={{ marginTop: 200, display: 'flex', alignItems: 'flex-end' }}>
          <div className="sp-child" style={{ marginRight: -8, zIndex: 1 }}>
            <div className="sp-child-sway"><FamilyAcorn size={78} color={DOTORI.warmOak} leafColor="#C8D89A" face="smile"/></div>
          </div>
          <div className="sp-parent" style={{ zIndex: 3, marginBottom: 4 }}>
            <div className="sp-parent-sway"><FamilyAcorn size={106} color={DOTORI.brown} leafColor="#9AB87A" face="happy"/></div>
          </div>
          <div className="sp-baby" style={{ marginLeft: -8, zIndex: 2 }}>
            <div className="sp-baby-sway"><FamilyAcorn size={58} color={DOTORI.lightOak} leafColor="#B4C98A" face="baby"/></div>
          </div>
        </div>
        <div className="sp-shadow" style={{ width: 220, height: 10, borderRadius: 5, background: DOTORI.edge, opacity: 0.45, marginTop: -4, filter: 'blur(3px)' }}/>
        <div className="sp-title" style={{ marginTop: 44, textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 900, color: DOTORI.textDark, letterSpacing: -2, lineHeight: 1 }}>도토리</div>
        </div>
        <div className="sp-sub" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: DOTORI.textMid, fontWeight: 600, marginTop: 14, letterSpacing: -0.2 }}>우리 집을 모아두는 곳</div>
        </div>
        <div style={{ position: 'absolute', bottom: 86, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
          <div className="sp-dot sp-dot-1" style={{ width: 6, height: 6, borderRadius: 3, background: DOTORI.brown }}/>
          <div className="sp-dot sp-dot-2" style={{ width: 6, height: 6, borderRadius: 3, background: DOTORI.brown }}/>
          <div className="sp-dot sp-dot-3" style={{ width: 6, height: 6, borderRadius: 3, background: DOTORI.brown }}/>
        </div>
      </div>
    </SplashPhone>
  );
}

// Generic replay wrapper — takes a component
function SplashReplay({ Comp }) {
  const [key, setKey] = React.useState(0);
  return (
    <div style={{ position: 'relative' }}>
      <Comp replayKey={key}/>
      <button
        onClick={() => setKey(k => k + 1)}
        style={{
          position: 'absolute', bottom: -44, left: '50%', transform: 'translateX(-50%)',
          padding: '8px 18px', borderRadius: 999, border: `1px solid ${DOTORI.edge}`,
          background: '#fff', color: DOTORI.textDark, fontSize: 12, fontWeight: 700,
          fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
        ↻ 다시 재생
      </button>
    </div>
  );
}

function SplashA1WithReplay() { return <SplashReplay Comp={SplashAnimated}/>; }
function SplashA2WithReplay() { return <SplashReplay Comp={SplashA2Animated}/>; }
function SplashA3WithReplay() { return <SplashReplay Comp={SplashA3Animated}/>; }

window.SplashA1 = SplashA1;
window.SplashA2 = SplashA2Animated;
window.SplashA3 = SplashA3Animated;
window.SplashA1WithReplay = SplashA1WithReplay;
window.SplashA2WithReplay = SplashA2WithReplay;
window.SplashA3WithReplay = SplashA3WithReplay;
window.SplashAnimatedWithReplay = SplashA1WithReplay;
