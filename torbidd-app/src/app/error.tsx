'use client';

// =============================================================================
// app/error.tsx - Next.js App Router Segment Error Boundary
// SEC-22: Fail-Secure Error Handling (ASVS req_id 16.5.1 & 16.5.4)
// Displays a generic error message to consumers without leaking stack traces.
// =============================================================================

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log sanitized error message without exposing raw error stack to DOM
    console.error('[Application Error Boundary caught an unhandled error]:', error?.message || 'Unknown error');
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '12px',
          padding: '2.5rem 2rem',
          maxWidth: '520px',
          width: '100%',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div
          style={{
            fontSize: '3rem',
            marginBottom: '1rem',
          }}
        >
          ⚠️
        </div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-main, #1e293b)',
            margin: '0 0 0.75rem 0',
          }}
        >
          เกิดข้อผิดพลาดในการประมวลผล (Internal Server Error)
        </h1>
        {/* ASVS V16.5.1: Generic message only, zero exposed stack traces or DB queries */}
        <p
          style={{
            color: 'var(--text-muted, #64748b)',
            fontSize: '0.95rem',
            lineHeight: 1.5,
            margin: '0 0 1.5rem 0',
          }}
        >
          ระบบพบข้อผิดพลาดที่ไม่คาดคิดในการประมวลผลคำขอของคุณ กรุณาลองใหม่อีกครั้ง หรือกลับสู่หน้าหลัก
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'var(--primary, #059669)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 500,
              fontSize: '0.95rem',
              cursor: 'pointer',
            }}
          >
            ลองใหม่อีกครั้ง (Try Again)
          </button>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.625rem 1.25rem',
              background: 'transparent',
              color: 'var(--text-main, #1e293b)',
              border: '1px solid var(--border-color, #cbd5e1)',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: '0.95rem',
            }}
          >
            กลับสู่หน้าหลัก (Home)
          </Link>
        </div>
      </div>
    </div>
  );
}
