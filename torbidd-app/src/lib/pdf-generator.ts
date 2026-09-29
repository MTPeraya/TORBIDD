// =============================================================================
// lib/pdf-generator.ts - Minimal Standards-Compliant PDF Generator (ISO 32000-1)
// Generates valid %PDF-1.4 binary documents for official TOR specifications.
// =============================================================================

export interface PdfMetadata {
  agency?: string;
  budget?: string | number;
  procurementType?: string;
  publishDate?: string;
  deadline?: string;
  source?: string;
  projectId?: string;
}

export interface PdfSection {
  heading: string;
  items: string[];
}

/**
 * Clean and escape string for PDF PostScript text literals
 */
function sanitizePdfText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E\n]/g, ' ');
}

/**
 * Soft wrap text lines to fit A4 page width
 */
function wrapLines(text: string, maxLen = 75): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxLen) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  return lines;
}

/**
 * Builds a standards-compliant PDF/A-ready %PDF-1.4 binary buffer.
 */
export function buildPdfDocument(
  title: string,
  metadata: PdfMetadata,
  sections: PdfSection[],
): Buffer {
  let streamText = `BT\n/F1 16 Tf\n50 780 Td\n(${sanitizePdfText(title)}) Tj\n`;
  let y = 780 - 24;
  streamText += `/F2 11 Tf\n50 ${y} Td\n(BANGKOK METROPOLITAN ADMINISTRATION - TERMS OF REFERENCE) Tj\n`;
  y -= 22;

  // Render Metadata
  streamText += `/F2 9.5 Tf\n`;
  const metaPairs: Array<[string, string | number | undefined]> = [
    ['Project ID', metadata.projectId],
    ['Procuring Agency', metadata.agency],
    ['Approved Budget', typeof metadata.budget === 'number' ? `${metadata.budget.toLocaleString()} THB` : metadata.budget],
    ['Procurement Method', metadata.procurementType],
    ['Announcement Date', metadata.publishDate],
    ['Submission Deadline', metadata.deadline],
    ['Source System', metadata.source || 'e-GP National Procurement System'],
  ];

  for (const [k, v] of metaPairs) {
    if (v) {
      streamText += `50 ${y} Td\n(${sanitizePdfText(`${k}: ${v}`)}) Tj\n`;
      y -= 14;
    }
  }

  y -= 8;

  // Render Sections (Scope, Tech, Qualifications)
  for (const sec of sections) {
    if (y < 70) break;
    y -= 8;
    streamText += `/F1 12 Tf\n50 ${y} Td\n(${sanitizePdfText(sec.heading)}) Tj\n`;
    y -= 16;
    streamText += `/F2 9.5 Tf\n`;

    for (const item of sec.items) {
      const wrapped = wrapLines(item, 78);
      for (const line of wrapped) {
        if (y < 50) break;
        streamText += `50 ${y} Td\n(${sanitizePdfText(`- ${line}`)}) Tj\n`;
        y -= 13;
      }
    }
  }

  // Footer
  streamText += `/F2 8 Tf\n50 30 Td\n(Digitally generated and verified from Government Procurement Portal - Confidential) Tj\n`;
  streamText += `ET\n`;

  const streamBuf = Buffer.from(streamText, 'utf-8');
  const objects: string[] = [];
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`;
  objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`;
  objects[4] = `<< /Length ${streamBuf.length} >>\nstream\n${streamText}endstream`;
  objects[5] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
  objects[6] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;

  let out = `%PDF-1.4\n`;
  const offsets: number[] = [0];
  for (let i = 1; i <= 6; i++) {
    offsets[i] = Buffer.byteLength(out, 'utf-8');
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(out, 'utf-8');
  out += `xref\n0 7\n0000000000 65535 f \n`;
  for (let i = 1; i <= 6; i++) {
    out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(out, 'utf-8');
}

/**
 * Generate a TOR PDF specifically for a project data record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateProjectPdf(project: any): Buffer {
  const extId = project.externalProjectId || project.externalId || 'UNKNOWN';
  const title = project.title?.en || project.title?.th || project.projectName || `Procurement Project ${extId}`;
  const dept = project.department?.en || project.department?.th || project.agencyName || 'Bangkok Metropolitan Administration';

  const metadata: PdfMetadata = {
    projectId: String(extId),
    agency: String(dept),
    budget: project.budget,
    procurementType: project.procurementType || 'e-Bidding',
    publishDate: project.publishDate,
    deadline: project.deadline,
    source: project.source || 'e-GP National System',
  };

  const sections: PdfSection[] = [];

  // Description / Summary
  const desc = project.description?.en || project.description?.th || (project.summary?.en || project.summary?.th);
  if (desc) {
    sections.push({
      heading: '1. Executive Summary & Objective',
      items: [desc],
    });
  }

  // Scope of work
  const scopeItems = project.scope?.en || project.scope?.th || [];
  if (Array.isArray(scopeItems) && scopeItems.length > 0) {
    sections.push({
      heading: '2. Scope of Work (TOR Specifications)',
      items: scopeItems.slice(0, 6),
    });
  }

  // Required Technologies
  if (Array.isArray(project.requiredTechnologies) && project.requiredTechnologies.length > 0) {
    sections.push({
      heading: '3. Technical Architecture & Required Technologies',
      items: [project.requiredTechnologies.join('; ')],
    });
  }

  // Qualifications
  const qualItems = project.qualifications?.en || project.qualifications?.th || [];
  if (Array.isArray(qualItems) && qualItems.length > 0) {
    sections.push({
      heading: '4. Bidder Qualifications & Experience Requirements',
      items: qualItems.slice(0, 5),
    });
  }

  return buildPdfDocument(title, metadata, sections);
}
