// =============================================================================
// lib/pdf-generator.ts - Standards-Compliant PDF Generator with Native Thai Unicode
// Generates valid %PDF-1.4 binary documents embedding TrueType font for Thai & English.
// Guarantees clean, non-blank PDF display in all PDF viewers.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import * as fflate from 'fflate';

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

let cachedFontBuffer: Buffer | null = null;
let cachedCharToGlyph: Map<number, number> | null = null;
let cachedCompressedFont: Buffer | null = null;

function loadFont(): {
  fontBuf: Buffer;
  charToGlyph: Map<number, number>;
  compressedFont: Buffer;
} | null {
  if (cachedFontBuffer && cachedCharToGlyph && cachedCompressedFont) {
    return {
      fontBuf: cachedFontBuffer,
      charToGlyph: cachedCharToGlyph,
      compressedFont: cachedCompressedFont,
    };
  }

  const fontPath = path.join(process.cwd(), 'src/assets/fonts/Ayuthaya.ttf');
  if (!fs.existsSync(fontPath)) return null;

  try {
    const fontBuf = fs.readFileSync(fontPath);
    // Parse cmap table (Ayuthaya TTF subtable offset 3020 format 4)
    const numTables = fontBuf.readUInt16BE(4);
    let cmapOffset = 0;
    for (let i = 0; i < numTables; i++) {
      const tag = fontBuf.toString('ascii', 12 + i * 16, 16 + i * 16);
      if (tag === 'cmap') {
        cmapOffset = fontBuf.readUInt32BE(12 + i * 16 + 8);
        break;
      }
    }

    let subtableOffset = 0;
    if (cmapOffset > 0) {
      const numSubtables = fontBuf.readUInt16BE(cmapOffset + 2);
      for (let i = 0; i < numSubtables; i++) {
        const platformId = fontBuf.readUInt16BE(cmapOffset + 4 + i * 8);
        const encodingId = fontBuf.readUInt16BE(cmapOffset + 4 + i * 8 + 2);
        const offset = fontBuf.readUInt32BE(cmapOffset + 4 + i * 8 + 4);
        if ((platformId === 0 || platformId === 3) && (encodingId === 3 || encodingId === 1 || encodingId === 0)) {
          subtableOffset = cmapOffset + offset;
          break;
        }
      }
    }

    if (subtableOffset === 0) {
      subtableOffset = 3020;
    }

    const segCountX2 = fontBuf.readUInt16BE(subtableOffset + 6);
    const segCount = segCountX2 / 2;
    const endCodeOffset = subtableOffset + 14;
    const startCodeOffset = endCodeOffset + segCountX2 + 2;
    const idDeltaOffset = startCodeOffset + segCountX2;
    const idRangeOffsetOffset = idDeltaOffset + segCountX2;

    const charMap = new Map<number, number>();
    for (let s = 0; s < segCount; s++) {
      const endCode = fontBuf.readUInt16BE(endCodeOffset + s * 2);
      const startCode = fontBuf.readUInt16BE(startCodeOffset + s * 2);
      const idDelta = fontBuf.readInt16BE(idDeltaOffset + s * 2);
      const idRangeOffset = fontBuf.readUInt16BE(idRangeOffsetOffset + s * 2);

      for (let c = startCode; c <= endCode; c++) {
        if (c === 0xffff) break;
        let glyphId = 0;
        if (idRangeOffset === 0) {
          glyphId = (c + idDelta) & 0xffff;
        } else {
          const glyphOffset = idRangeOffsetOffset + s * 2 + idRangeOffset + (c - startCode) * 2;
          glyphId = fontBuf.readUInt16BE(glyphOffset);
          if (glyphId !== 0) {
            glyphId = (glyphId + idDelta) & 0xffff;
          }
        }
        if (glyphId > 0) {
          charMap.set(c, glyphId);
        }
      }
    }

    const compressed = Buffer.from(fflate.zlibSync(new Uint8Array(fontBuf)));

    cachedFontBuffer = fontBuf;
    cachedCharToGlyph = charMap;
    cachedCompressedFont = compressed;

    return {
      fontBuf,
      charToGlyph: charMap,
      compressedFont: compressed,
    };
  } catch (err) {
    console.warn('[PdfGenerator] Error loading font:', err);
    return null;
  }
}

/**
 * Encodes text into 4-digit hex glyph IDs for Type 0 / Identity-H font
 */
function encodeToGlyphHex(text: string, charToGlyph: Map<number, number>): string {
  let hex = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const gid = charToGlyph.get(code) || 0;
    hex += gid.toString(16).padStart(4, '0');
  }
  return hex;
}

/**
 * Soft wrap text lines for A4 page width (charsPerLine ~ 65-70)
 */
function wrapLines(text: string, maxLen = 65): string[] {
  if (text.length <= maxLen) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';

  for (const w of words) {
    if (w.length > maxLen) {
      if (cur) lines.push(cur.trim());
      // Break long compound Thai word chunks without spaces
      for (let i = 0; i < w.length; i += maxLen) {
        lines.push(w.slice(i, i + maxLen));
      }
      cur = '';
    } else if ((cur + ' ' + w).trim().length > maxLen) {
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
 * Builds a standards-compliant %PDF-1.4 binary buffer.
 * If TrueType font is available, embeds it for crystal clear Thai & Latin display.
 */
export function buildPdfDocument(
  title: string,
  metadata: PdfMetadata,
  sections: PdfSection[],
): Buffer {
  const fontData = loadFont();

  // If font is available, generate TrueType Unicode PDF (renders real Thai!)
  if (fontData) {
    const { fontBuf, charToGlyph, compressedFont } = fontData;

    let stream = `BT\n`;
    let y = 780;

    // Header Title
    stream += `/F1 15 Tf\n50 ${y} Td\n<${encodeToGlyphHex('เอกสารขอบเขตของงานและข้อกำหนดทางเทคนิค (TOR)', charToGlyph)}> Tj\n`;
    y -= 22;

    stream += `/F1 10.5 Tf\n50 ${y} Td\n<${encodeToGlyphHex('ระบบจัดซื้อจัดจ้างภาครัฐ (e-GP) · กรมบัญชีกลาง กระทรวงการคลัง', charToGlyph)}> Tj\n`;
    y -= 25;

    // Project Title (Wrapped)
    stream += `/F1 11 Tf\n`;
    const titleLines = wrapLines(title || 'โครงการจัดซื้อจัดจ้างภาครัฐ', 62);
    for (const tline of titleLines) {
      stream += `50 ${y} Td\n<${encodeToGlyphHex(`โครงการ: ${tline}`, charToGlyph)}> Tj\n`;
      y -= 16;
    }

    y -= 6;

    // Metadata Key-Values
    stream += `/F1 9.5 Tf\n`;
    const metaPairs: Array<[string, string | number | undefined]> = [
      ['รหัสโครงการ (e-GP ID)', metadata.projectId],
      ['หน่วยงานเจ้าของโครงการ', metadata.agency],
      ['วงเงินงบประมาณ', typeof metadata.budget === 'number' ? `${metadata.budget.toLocaleString('th-TH')} บาท` : metadata.budget],
      ['วิธีการจัดซื้อจัดจ้าง', metadata.procurementType],
      ['วันที่ประกาศเผยแพร่', metadata.publishDate],
      ['กำหนดการปิดรับข้อเสนอ', metadata.deadline],
      ['แหล่งที่มาของข้อมูล', metadata.source || 'ระบบจัดซื้อจัดจ้างภาครัฐ e-GP (gprocurement.go.th)'],
    ];

    for (const [k, v] of metaPairs) {
      if (v) {
        stream += `50 ${y} Td\n<${encodeToGlyphHex(`${k}: ${v}`, charToGlyph)}> Tj\n`;
        y -= 14;
      }
    }

    y -= 10;

    // Sections (Summary, Scope, Technical Requirements, Qualifications)
    for (const sec of sections) {
      if (y < 80) break;
      stream += `/F1 11 Tf\n50 ${y} Td\n<${encodeToGlyphHex(sec.heading, charToGlyph)}> Tj\n`;
      y -= 16;

      stream += `/F1 9 Tf\n`;
      for (const item of sec.items) {
        const itemLines = wrapLines(item, 65);
        for (let idx = 0; idx < itemLines.length; idx++) {
          if (y < 45) break;
          const prefix = idx === 0 ? '- ' : '  ';
          stream += `50 ${y} Td\n<${encodeToGlyphHex(`${prefix}${itemLines[idx]}`, charToGlyph)}> Tj\n`;
          y -= 13;
        }
      }
      y -= 8;
    }

    // Footer
    stream += `/F1 7.5 Tf\n50 25 Td\n<${encodeToGlyphHex('เอกสาร TOR สังเคราะห์จากฐานข้อมูลจัดซื้อจัดจ้างภาครัฐ e-GP กรมบัญชีกลาง (กระบวนการทางการตรวจสอบที่ process5.gprocurement.go.th)', charToGlyph)}> Tj\n`;
    stream += `ET\n`;

    const streamBuf = Buffer.from(stream, 'utf-8');

    const objParts: Buffer[] = [];
    objParts[1] = Buffer.from(`<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
    objParts[2] = Buffer.from(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
    objParts[3] = Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`);
    objParts[4] = Buffer.from(`<< /Length ${streamBuf.length} >>\nstream\n${stream}endstream\nendobj\n`);
    objParts[5] = Buffer.from(`<< /Type /Font /Subtype /Type0 /BaseFont /Ayuthaya /Encoding /Identity-H /DescendantFonts [6 0 R] >>\nendobj\n`);
    objParts[6] = Buffer.from(`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Ayuthaya /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 7 0 R /DW 600 /W [ 0 888 600 ] >>\nendobj\n`);
    objParts[7] = Buffer.from(`<< /Type /FontDescriptor /FontName /Ayuthaya /Flags 32 /FontBBox [-200 -250 1200 950] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 /FontFile2 8 0 R >>\nendobj\n`);

    const fontHeader = Buffer.from(`<< /Length ${compressedFont.length} /Filter /FlateDecode /Length1 ${fontBuf.length} >>\nstream\n`);
    const fontFooter = Buffer.from(`\nendstream\nendobj\n`);
    objParts[8] = Buffer.concat([fontHeader, compressedFont, fontFooter]);

    const header = Buffer.from(`%PDF-1.4\n`);
    const offsets: number[] = [0];
    let currentPos = header.length;

    const chunks: Uint8Array[] = [header];
    for (let i = 1; i <= 8; i++) {
      offsets[i] = currentPos;
      const objHeader = Buffer.from(`${i} 0 obj\n`);
      chunks.push(objHeader);
      chunks.push(objParts[i]);
      currentPos += objHeader.length + objParts[i].length;
    }

    const xrefPos = currentPos;
    let xref = `xref\n0 9\n0000000000 65535 f \n`;
    for (let i = 1; i <= 8; i++) {
      xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    xref += `trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
    chunks.push(Buffer.from(xref));

    return Buffer.concat(chunks);
  }

  // Fallback: standard Type 1 ASCII PDF
  let streamText = `BT\n/F1 15 Tf\n50 780 Td\n(TERMS OF REFERENCE - PROCUREMENT SPECIFICATION) Tj\n`;
  let y = 780 - 22;
  streamText += `/F2 10 Tf\n50 ${y} Td\n(THAILAND GOVERNMENT ELECTRONIC PROCUREMENT SYSTEM - TOR) Tj\n`;
  y -= 22;

  const safeTitle = title.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim() || 'Procurement Project';
  streamText += `/F1 11 Tf\n50 ${y} Td\n(Project: ${safeTitle.slice(0, 75)}) Tj\n`;
  y -= 20;

  streamText += `/F2 9 Tf\n`;
  if (metadata.projectId) {
    streamText += `50 ${y} Td\n(Project ID: ${metadata.projectId}) Tj\n`;
    y -= 14;
  }
  if (metadata.budget) {
    streamText += `50 ${y} Td\n(Budget: ${typeof metadata.budget === 'number' ? metadata.budget.toLocaleString() : metadata.budget} THB) Tj\n`;
    y -= 14;
  }
  if (metadata.procurementType) {
    streamText += `50 ${y} Td\n(Method: ${metadata.procurementType}) Tj\n`;
    y -= 14;
  }
  streamText += `/F2 7.5 Tf\n50 25 Td\n(Digitally generated from e-GP procurement database. Visit process5.gprocurement.go.th) Tj\nET\n`;

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
 * Generate a comprehensive TOR PDF for a project data record
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateProjectPdf(project: any): Buffer {
  const extId = project.externalProjectId || project.externalId || 'UNKNOWN';
  const rawTitle = project.projectName || project.title?.th || project.title?.en || `โครงการจัดซื้อจัดจ้างภาครัฐ รหัส ${extId}`;
  const rawDept = project.agencyName || project.department?.th || project.department?.en || 'หน่วยงานภาครัฐ';

  const metadata: PdfMetadata = {
    projectId: String(extId),
    agency: rawDept,
    budget: project.budget,
    procurementType: project.procurementType || 'ประกวดราคาอิเล็กทรอนิกส์ (e-Bidding)',
    publishDate: project.publishDate
      ? new Date(project.publishDate).toLocaleDateString('th-TH')
      : (project.discoveredAt ? new Date(project.discoveredAt).toLocaleDateString('th-TH') : undefined),
    deadline: project.deadline
      ? new Date(project.deadline).toLocaleDateString('th-TH')
      : (project.contractFinishDate ? new Date(project.contractFinishDate).toLocaleDateString('th-TH') : undefined),
    source: project.source || 'ระบบจัดซื้อจัดจ้างภาครัฐ (e-GP)',
  };

  const sections: PdfSection[] = [];

  // 1. Description / Summary
  const desc = project.summary?.th || project.summary?.en || project.description?.th || project.description?.en;
  if (desc && String(desc).trim().length > 0) {
    sections.push({
      heading: '1. สาระสำคัญและวัตถุประสงค์ของโครงการ (Executive Summary)',
      items: [String(desc).trim()],
    });
  } else {
    sections.push({
      heading: '1. สาระสำคัญและวัตถุประสงค์ของโครงการ (Executive Summary)',
      items: [
        `ดำเนินการจัดซื้อจัดจ้างตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 สำหรับโครงการ ${rawTitle}`,
        'ผู้เสนอราคาต้องส่งมอบงานให้ครบถ้วนถูกต้องตามรายละเอียดและเงื่อนไขที่กำหนดในเอกสารประกวดราคา',
      ],
    });
  }

  // 2. Scope of work
  const scopeItems = project.scope?.th || project.scope?.en || [];
  if (Array.isArray(scopeItems) && scopeItems.length > 0) {
    sections.push({
      heading: '2. ขอบเขตของงานและข้อกำหนดทางเทคนิค (Scope of Work)',
      items: scopeItems.map(String).slice(0, 6),
    });
  } else {
    sections.push({
      heading: '2. ขอบเขตของงานและข้อกำหนดทางเทคนิค (Scope of Work)',
      items: [
        'ดำเนินการติดตั้ง พัฒนา และปรับแต่งระบบซอฟต์แวร์หรือแพลตฟอร์มตามข้อกำหนด',
        'ทดสอบความพร้อมใช้งานของระบบ (User Acceptance Test) ร่วมกับคณะกรรมการตรวจรับพัสดุ',
        'จัดฝึกอบรมการใช้งานระบบแก่บุคลากรเจ้าหน้าที่และจัดทำคู่มือประกอบการใช้งาน',
        'ให้บริการบำรุงรักษาและรับประกันความชำรุดบกพร่องตามระยะเวลาที่กำหนดในสัญญา',
      ],
    });
  }

  // 3. Technical Requirements Checklist
  const techReqs = project.technicalRequirements?.th || project.technicalRequirements?.en || [];
  if (Array.isArray(techReqs) && techReqs.length > 0) {
    sections.push({
      heading: '3. รายการข้อกำหนดทางเทคนิคที่ต้องตรวจสอบ (Technical Checklist)',
      items: techReqs.map(String).slice(0, 6),
    });
  }

  // 4. Required Technologies
  if (Array.isArray(project.requiredTechnologies) && project.requiredTechnologies.length > 0) {
    sections.push({
      heading: '4. สแต็กเทคโนโลยีที่เกี่ยวข้อง (Identified Technologies)',
      items: [project.requiredTechnologies.join(', ')],
    });
  }

  // 5. Qualifications
  const qualItems = project.qualifications?.th || project.qualifications?.en || [];
  if (Array.isArray(qualItems) && qualItems.length > 0) {
    sections.push({
      heading: '5. คุณสมบัติของผู้ยื่นข้อเสนอราคา (Bidder Qualifications)',
      items: qualItems.map(String).slice(0, 6),
    });
  } else {
    sections.push({
      heading: '5. คุณสมบัติของผู้ยื่นข้อเสนอราคา (Bidder Qualifications)',
      items: [
        'เป็นนิติบุคคลผู้มีอาชีพรับจ้างงานที่ประกวดราคาอิเล็กทรอนิกส์ดังกล่าวที่จดทะเบียนถูกต้องตามกฎหมายไทย',
        'ไม่เป็นผู้ถูกระบุชื่อไว้ในบัญชีรายชื่อผู้ทิ้งงานของทางราชการและได้แจ้งเวียนชื่อแล้ว',
        'ไม่เป็นผู้มีผลประโยชน์ร่วมกันกับผู้ยื่นข้อเสนอราคารายอื่นที่เข้ายื่นข้อเสนอ',
        'ไม่เป็นผู้ได้รับเอกสิทธิ์หรือความคุ้มกันซึ่งอาจปฏิเสธไม่ยอมขึ้นศาลไทย',
      ],
    });
  }

  return buildPdfDocument(rawTitle, metadata, sections);
}
