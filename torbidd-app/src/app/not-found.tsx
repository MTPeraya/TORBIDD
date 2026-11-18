import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 - Page Not Found | TORBIDD',
  description: 'The requested resource was not found on this server.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
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
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        }}
      >
        <h1
          style={{
            fontSize: '4rem',
            fontWeight: 800,
            color: 'var(--primary, #059669)',
            margin: '0 0 0.5rem 0',
          }}
        >
          404
        </h1>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--text-main, #1e293b)',
            margin: '0 0 1rem 0',
          }}
        >
          ไม่พบหน้าที่คุณต้องการ (Page Not Found)
        </h2>
        <p
          style={{
            color: 'var(--text-muted, #64748b)',
            fontSize: '0.95rem',
            lineHeight: 1.5,
            margin: '0 0 1.5rem 0',
          }}
        >
          ไม่พบหน้าที่คุณกำลังเรียกใช้งาน หรือทรัพยากรดังกล่าวอาจถูกย้าย ลบออก หรือไม่เคยมีอยู่บนเซิร์ฟเวอร์
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.625rem 1.25rem',
            background: 'var(--primary, #059669)',
            color: '#ffffff',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: '0.95rem',
            transition: 'background 0.2s',
          }}
        >
          กลับสู่หน้าหลัก (Back to Home)
        </Link>
      </div>
    </main>
  );
}
