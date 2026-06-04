import React, { useEffect, useState } from 'react';
import { useToast } from '../context/ToastContext';

const ICONS = {
  success: 'bx-check-circle',
  error:   'bx-x-circle',
  warning: 'bx-error',
  info:    'bx-info-circle',
};

const COLORS = {
  success: { bg: 'rgba(48,209,88,0.12)',  border: 'rgba(48,209,88,0.25)',  text: '#30d158' },
  error:   { bg: 'rgba(255,59,48,0.12)',  border: 'rgba(255,59,48,0.25)',  text: '#ff3b30' },
  warning: { bg: 'rgba(255,214,10,0.12)', border: 'rgba(255,214,10,0.25)', text: '#ffd60a' },
  info:    { bg: 'rgba(50,173,230,0.12)', border: 'rgba(50,173,230,0.25)', text: '#32ade6' },
};

function ToastItem({ id, message, type, duration }) {
  const { removeToast } = useToast();
  const [exiting, setExiting] = useState(false);
  const c = COLORS[type] || COLORS.info;

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => removeToast(id), 300);
  };

  useEffect(() => {
    if (duration > 0) {
      const t = setTimeout(() => dismiss(), duration - 350);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div
      onClick={dismiss}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 18px',
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '14px',
        backdropFilter: 'blur(30px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        minWidth: '280px', maxWidth: '420px',
        opacity: exiting ? 0 : 1,
        transform: exiting ? 'translateX(30px)' : 'translateX(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        animation: 'slideInRight 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <i className={`bx ${ICONS[type]}`} style={{ fontSize: '1.3rem', color: c.text, flexShrink: 0 }} />
      <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 500, lineHeight: 1.4, flex: 1 }}>
        {message}
      </span>
      <i className='bx bx-x' style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.1rem', flexShrink: 0 }} />
      {duration > 0 && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0,
          height: '2px', background: c.text, opacity: 0.6,
          animation: `shrink ${duration}ms linear forwards`,
          borderRadius: '0 0 14px 14px',
        }} />
      )}
    </div>
  );
}

export default function ToastStack() {
  const { toasts } = useToast();

  return (
    <>
      <style>{`
        @keyframes slideInRight { from { opacity:0; transform: translateX(30px); } to { opacity:1; transform: translateX(0); } }
        @keyframes shrink { from { width:100%; } to { width:0%; } }
      `}</style>
      <div style={{
        position: 'fixed', bottom: '28px', right: '28px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        zIndex: 9999, pointerEvents: toasts.length ? 'auto' : 'none',
      }}>
        {toasts.map(t => <ToastItem key={t.id} {...t} />)}
      </div>
    </>
  );
}
