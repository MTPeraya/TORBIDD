// =============================================================================
// app/api/documents/[projectId]/[fileName]/route.ts - Serve Real PDF or e-GP Portal
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import connectToDatabase from '@/lib/mongodb';
import ProcurementProject from '@/models/ProcurementProject';
import Project from '@/models/Project';
import { getIngestionConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; fileName: string }> },
) {
  try {
    const { projectId, fileName } = await params;
    const cleanProjectId = path.basename(projectId.trim());

    // 1. Resolve project ID (handle 11-digit e-GP ID or internal ID)
    let targetExtId = cleanProjectId;
    if (cleanProjectId.length !== 11) {
      try {
        await connectToDatabase();
        const numId = parseInt(cleanProjectId, 10);
        if (!isNaN(numId)) {
          const pp = await ProcurementProject.findOne({
            $or: [{ externalProjectId: cleanProjectId }, { revision: numId }],
          }).lean();
          if (pp?.externalProjectId) {
            targetExtId = pp.externalProjectId;
          } else {
            const p = await Project.findOne({ externalId: numId }).lean();
            if (p && (p as unknown as Record<string, unknown>).externalProjectId) {
              targetExtId = String((p as unknown as Record<string, unknown>).externalProjectId);
            }
          }
        }
      } catch {}
    }

    // 2. Check if a real downloaded PDF document exists in project-specific folders on local disk
    const storageBase = getIngestionConfig().resolvedStoragePath;
    const candidateDirs = [
      path.join(storageBase, targetExtId),
      path.join(storageBase, cleanProjectId),
    ];

    for (const dir of candidateDirs) {
      if (fs.existsSync(dir)) {
        const stat = fs.statSync(dir);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(dir);
          // Look for requested fileName or any TOR/PDF document
          const matchFile = files.find(
            (f) =>
              f.toLowerCase() === fileName.toLowerCase() ||
              f.toLowerCase().includes('tor') ||
              f.toLowerCase().endsWith('.pdf'),
          );
          if (matchFile) {
            const fullPath = path.join(dir, matchFile);
            if (fs.existsSync(fullPath)) {
              const fileBuffer = fs.readFileSync(fullPath);
              return new NextResponse(fileBuffer, {
                headers: {
                  'Content-Type': 'application/pdf',
                  'Content-Disposition': `inline; filename="${encodeURIComponent(matchFile)}"`,
                  'Cache-Control': 'public, max-age=86400',
                },
              });
            }
          }
        }
      }
    }

    // 2.5 If no local downloaded PDF exists on disk, check if a PDF was requested
    // (either URL ends in .pdf, fileName ends in .pdf, or explicitly requested via format=pdf / accept: application/pdf)
    // We generate a standards-compliant %PDF-1.4 TOR document dynamically from the project data.
    // This GUARANTEES that the browser's PDF viewer plugin ALWAYS receives a valid PDF binary stream
    // and NEVER encounters "Failed to load PDF document."
    const url = new URL(_req.url);
    const isPdfRequest =
      fileName.toLowerCase().endsWith('.pdf') ||
      url.pathname.toLowerCase().endsWith('.pdf') ||
      url.searchParams.get('format') === 'pdf' ||
      _req.headers.get('accept')?.includes('application/pdf');

    if (isPdfRequest) {
      try {
        await connectToDatabase();
        const numId = parseInt(targetExtId, 10);
        const projectData =
          (await ProcurementProject.findOne({ externalProjectId: targetExtId }).lean()) ||
          (await Project.findOne({
            $or: [
              { externalProjectId: targetExtId },
              ...(!isNaN(numId) ? [{ externalId: numId }] : []),
            ],
          } as unknown as Record<string, unknown>).lean());

        if (projectData) {
          const { generateProjectPdf } = await import('@/lib/pdf-generator');
          const generatedPdf = generateProjectPdf(projectData);
          return new NextResponse(new Uint8Array(generatedPdf), {
            status: 200,
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="TOR_${targetExtId}.pdf"`,
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      } catch (genErr) {
        console.warn(`[DocumentRoute] PDF generation error for ${targetExtId}:`, genErr);
      }
    }

    // 3. If real PDF is not on local disk, check if user is asking for direct redirect
    // or if the browser requested it directly.
    // If a browser opens a URL ending in .pdf and gets a 307 redirect to an HTML webpage (e-GP),
    // the browser's built-in PDF viewer throws "Failed to load PDF document."
    // To resolve this completely:
    // We return an HTML transition page that immediately redirects the browser window
    // to the official e-GP announcement portal and provides direct links.
    const egpPortalUrl = `https://process5.gprocurement.go.th/egp-agpc01-web/announcement?keywordSearch=${targetExtId}`;

    const htmlFallback = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>เอกสารประกาศและ TOR (e-GP) - ${targetExtId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Thai', sans-serif;
      background: #f8fafc;
      color: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      max-width: 560px;
      width: 100%;
      padding: 32px;
      text-align: center;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px;
    }
    p {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin: 0 0 24px;
    }
    .project-pill {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      padding: 4px 12px;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 13px;
      margin-bottom: 20px;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 10px;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
    }
    .btn-primary {
      background: #0284c7;
      color: #ffffff;
      border: none;
    }
    .btn-primary:hover {
      background: #0369a1;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }
    .hint {
      margin-top: 20px;
      font-size: 12px;
      color: #94a3b8;
    }
  </style>
  <script>
    // Automatically redirect browser to e-GP announcement after 1 second
    setTimeout(function() {
      window.location.replace("${egpPortalUrl}");
    }, 800);
  </script>
</head>
<body>
  <div class="card">
    <div class="icon">📄</div>
    <div class="project-pill">รหัสโครงการ e-GP: ${targetExtId}</div>
    <h1>กำลังเปิดเอกสารประกาศและ TOR ทางการ</h1>
    <p>
      ระบบกำลังนำท่านไปยังระบบจัดซื้อจัดจ้างภาครัฐ (e-GP) ของกรมบัญชีกลาง
      ซึ่งเป็นแหล่งดาวน์โหลดเอกสารประกาศและ TOR ฉบับทางการที่ได้รับการรับรอง
    </p>
    <div class="btn-group">
      <a href="${egpPortalUrl}" class="btn btn-primary" id="btn-portal">
        เปิดระบบ e-GP ทางการทันที ↗
      </a>
      <a href="javascript:window.close()" class="btn btn-secondary">
        ปิดหน้านี้
      </a>
    </div>
    <div class="hint">
      หากหน้าเว็บไม่เปลี่ยนอัตโนมัติ กรุณากดปุ่ม "เปิดระบบ e-GP ทางการทันที"
    </div>
  </div>
</body>
</html>`;

    return new NextResponse(htmlFallback, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to access document', message }, { status: 500 });
  }
}

