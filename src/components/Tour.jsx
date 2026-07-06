import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// First-run product tour: a spotlight + comment box that walks new users through
// the app step by step. Remembers completion in localStorage; can be relaunched
// via the `mds:start-tour` window event (e.g. from Help & Support).
const TOUR_KEY = 'mds_tour_done_v1';

// Each step spotlights an element found by `selector`. `route` navigates first.
// If the element isn't found, the step's box is centered so the tour never breaks.
const STEPS = [
  { route: '/home', selector: null, title: 'Welcome aboard 👋',
    body: "This quick tour shows you around in under a minute. You can skip anytime and restart it later from Help." },
  { route: '/home', selector: '[data-tour="sidebar"]', placement: 'right', title: 'Your navigation',
    body: 'Everything lives here — your timesheet, projects, and (for admins) analytics and settings. You only see what you have access to.' },
  { route: '/home', selector: '[data-tour="mywork"]', placement: 'top', title: 'My Work board',
    body: 'Pick a project and drag your tasks across To Do → In Progress → Done. Start and finish dates are stamped automatically.' },
  { route: '/home', selector: '[data-tour="search"]', placement: 'bottom', title: 'Search anything',
    body: 'Jump to any project, client, or person instantly. Tip: press Ctrl/⌘ + K from anywhere.' },
  { route: '/home', selector: '[data-tour="notifications"]', placement: 'bottom', title: 'Notifications',
    body: "We surface what's relevant to you — overdue timesheets, tasks due soon, and (for approvers) things waiting on you." },
  { route: '/home', selector: '[data-tour="assistant"]', placement: 'left', title: 'AI Assistant',
    body: 'Ask questions about your work in plain language — “what’s due this week?”, “who can take a new project?”. It knows your live data.' },
  { route: '/my-timesheet', selector: null, title: 'Your timesheet',
    body: 'Log hours here each week and submit for approval. That’s the last stop — you’re all set. Enjoy!' },
];

const PAD = 8;

export default function Tour({ enabled }) {
  const [active, setActive] = useState(false);
  const [i, setI]           = useState(0);
  const [rect, setRect]     = useState(null);
  const navigate = useNavigate();
  const step = STEPS[i];

  // Auto-start once for first-time users; also allow manual relaunch.
  useEffect(() => {
    if (!enabled) return;
    const start = () => { setI(0); setActive(true); };
    if (!localStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(start, 900);
      window.addEventListener('mds:start-tour', start);
      return () => { clearTimeout(t); window.removeEventListener('mds:start-tour', start); };
    }
    window.addEventListener('mds:start-tour', start);
    return () => window.removeEventListener('mds:start-tour', start);
  }, [enabled]);

  const measure = useCallback(() => {
    if (!step) return;
    if (!step.selector) { setRect(null); return; }
    const el = document.querySelector(step.selector);
    if (!el) { setRect(null); return; }
    try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch {}
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!active || !step) return;
    if (step.route && window.location.pathname !== step.route) navigate(step.route);
    const id = setTimeout(measure, step.route && window.location.pathname !== step.route ? 400 : 60);
    const onMove = () => measure();
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => { clearTimeout(id); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true); };
  }, [active, i, measure, step, navigate]);

  const finish = () => { localStorage.setItem(TOUR_KEY, '1'); setActive(false); };
  const next   = () => (i < STEPS.length - 1 ? setI(i + 1) : finish());
  const back   = () => setI(Math.max(0, i - 1));

  if (!active || !step) return null;

  const spot = rect ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 } : null;

  // Tooltip position
  const TW = 320, TH = 190, GAP = 14, M = 12;
  let tip;
  if (!spot) {
    tip = { top: window.innerHeight / 2 - TH / 2, left: window.innerWidth / 2 - TW / 2 };
  } else if (step.placement === 'right') {
    tip = { top: spot.top, left: spot.left + spot.width + GAP };
  } else if (step.placement === 'left') {
    tip = { top: spot.top, left: spot.left - TW - GAP };
  } else if (step.placement === 'top') {
    tip = { top: spot.top - TH - GAP, left: spot.left + spot.width / 2 - TW / 2 };
  } else {
    tip = { top: spot.top + spot.height + GAP, left: spot.left + spot.width / 2 - TW / 2 };
  }
  tip.top  = Math.max(M, Math.min(tip.top,  window.innerHeight - TH - M));
  tip.left = Math.max(M, Math.min(tip.left, window.innerWidth  - TW - M));

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'none' }}>
      {/* Dimmer + spotlight (giant box-shadow cuts a hole around the target) */}
      {spot ? (
        <div style={{
          position: 'fixed', top: spot.top, left: spot.left, width: spot.width, height: spot.height,
          borderRadius: '12px', boxShadow: '0 0 0 9999px rgba(4,4,10,0.72)',
          outline: '2px solid rgba(139,92,246,0.7)', transition: 'all 0.3s cubic-bezier(0.2,0.8,0.2,1)',
          pointerEvents: 'none',
        }} />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,10,0.72)', pointerEvents: 'auto' }} />
      )}

      {/* Comment box */}
      <div style={{
        position: 'fixed', top: tip.top, left: tip.left, width: TW,
        background: 'rgba(16,16,24,0.98)', border: '1px solid rgba(139,92,246,0.3)',
        borderRadius: '16px', padding: '18px 18px 14px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.7), 0 0 30px rgba(124,58,237,0.2)',
        pointerEvents: 'auto', animation: 'tourPop 0.25s cubic-bezier(0.2,0.8,0.2,1)',
      }}>
        <style>{`@keyframes tourPop{from{opacity:0;transform:translateY(6px) scale(0.98)}to{opacity:1;transform:none}}`}</style>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className='bx bx-compass' style={{ color: '#fff', fontSize: '15px' }} />
          </div>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fafafa' }}>{step.title}</span>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: '0.83rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.65)' }}>{step.body}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '5px' }}>
            {STEPS.map((_, idx) => (
              <span key={idx} style={{ width: idx === i ? '18px' : '6px', height: '6px', borderRadius: '99px', background: idx === i ? '#a78bfa' : 'rgba(255,255,255,0.2)', transition: 'all 0.2s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {i > 0 && (
              <button onClick={back} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600 }}>Back</button>
            )}
            <button onClick={next} style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', border: 'none', borderRadius: '9px', padding: '7px 16px', cursor: 'pointer', color: '#fff', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600 }}>
              {i === STEPS.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        <button onClick={finish} style={{ position: 'absolute', top: '12px', right: '14px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit' }}>
          Skip tour
        </button>
      </div>
    </div>
  );
}
