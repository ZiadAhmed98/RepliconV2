import React from 'react';

const shimmerStyle = {
  background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeletonShimmer 1.6s infinite',
  borderRadius: '8px',
};

export function SkeletonBox({ width = '100%', height = '16px', radius = '8px', style = {} }) {
  return (
    <div style={{ ...shimmerStyle, width, height, borderRadius: radius, ...style }}>
      <style>{`@keyframes skeletonShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`}</style>
    </div>
  );
}

export function SkeletonKpiCard() {
  return (
    <div style={{
      background: 'rgba(35,35,40,0.4)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '32px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px',
    }}>
      <style>{`@keyframes skeletonShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`}</style>
      <SkeletonBox width="60%" height="10px" />
      <SkeletonBox width="40%" height="36px" />
      <SkeletonBox width="80%" height="10px" />
    </div>
  );
}

export function SkeletonChart({ height = '320px' }) {
  return (
    <div style={{
      background: 'rgba(35,35,40,0.4)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '32px', padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      <style>{`@keyframes skeletonShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`}</style>
      <SkeletonBox width="40%" height="16px" />
      <SkeletonBox width="100%" height={height} radius="16px" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div style={{
      background: 'rgba(35,35,40,0.4)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px',
    }}>
      <style>{`@keyframes skeletonShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '16px' }}>
          <SkeletonBox width="30px" height="30px" radius="50%" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SkeletonBox width={`${55 + (i % 3) * 15}%`} height="12px" />
            <SkeletonBox width={`${35 + (i % 4) * 10}%`} height="10px" />
          </div>
          <SkeletonBox width="60px" height="12px" style={{ flexShrink: 0 }} />
        </div>
      ))}
    </div>
  );
}

export default SkeletonBox;
