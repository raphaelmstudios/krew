import { useEffect, useState } from 'react';

// Placeholder screen for Task d1-1 (scaffold) / d1-3 (deploy a live hello-world).
// Real screens replace this one task by task, starting with Task d1-4
// (registration form) — build each against the matching HTML preview already
// approved in the design pass.
export default function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'unreachable' }));
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          background: 'var(--surface-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '40px 48px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>
          KRE<span style={{ color: 'var(--purple)' }}>W</span>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: 14, margin: 0 }}>
          Scaffold is live. API:{' '}
          <strong style={{ color: health?.status === 'ok' ? 'var(--green)' : 'var(--red)' }}>
            {health ? health.status : 'checking…'}
          </strong>
        </p>
      </div>
    </div>
  );
}
