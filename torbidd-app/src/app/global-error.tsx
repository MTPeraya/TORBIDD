'use client';

// =============================================================================
// app/global-error.tsx - Next.js Root Global Error Boundary
// SEC-22: Fail-Secure Error Handling (ASVS req_id 16.5.1 & 16.5.4)
// Catches unhandled errors that occur in the root layout.
// =============================================================================

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Root Global Error Boundary]:', error?.message || 'Fatal system error');
  }, [error]);

  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          color: '#1e293b',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            textAlign: 'center',
            padding: '2rem',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
            เกิดข้อผิดพลาดระดับระบบ (System Error)
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>
            ขออภัย ระบบพบข้อผิดพลาดที่ไม่สามารถประมวลผลต่อได้ กรุณาลองใหม่อีกครั้ง
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '0.625rem 1.25rem',
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            ลองใหม่อีกครั้ง (Retry)
          </button>
        </div>
      </body>
    </html>
  );
}
