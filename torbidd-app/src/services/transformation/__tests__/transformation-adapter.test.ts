/**
 * @jest-environment node
 */
// =============================================================================
// services/transformation/__tests__/transformation-adapter.test.ts
// Unit tests for ETL Transformation Adapter covering diverse agency payload variations
// =============================================================================

import { TransformationAdapter } from '../transformation-adapter';
import { RawAgencyPayload } from '../types';

describe('ETL Transformation Adapter', () => {
  let adapter: TransformationAdapter;

  beforeEach(() => {
    adapter = new TransformationAdapter();
  });

  // ─── 1. Diverse Agency Variations ─────────────────────────────────────────

  it('1. should normalize standard e-GP central procurement payload', () => {
    const egpPayload: RawAgencyPayload = {
      project_id: '67059199407',
      project_name: 'โครงการจัดซื้ออุปกรณ์คอมพิวเตอร์และระบบเครือข่าย',
      dept_name: 'การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย',
      year: 2568,
      sum_price_agree: 8500000,
      publish_date: '2024-05-15T08:30:00.000Z',
      transaction_sub_type_name: 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)',
      source_url: 'https://process5.gprocurement.go.th/...',
    };

    const result = adapter.transform(egpPayload);

    expect(result.status).toBe('VALID');
    expect(result.data).toBeDefined();
    expect(result.data!.externalProjectId).toBe('67059199407');
    expect(result.data!.projectName).toBe('โครงการจัดซื้ออุปกรณ์คอมพิวเตอร์และระบบเครือข่าย');
    expect(result.data!.agencyName).toBe('การไฟฟ้าฝ่ายผลิตแห่งประเทศไทย');
    expect(result.data!.budget).toBe(8500000);
    expect(result.data!.fiscalYear).toBe(2568);
    expect(result.data!.publishDate).toBe('2024-05-15T08:30:00.000Z');
    expect(result.data!.contentHash).toHaveLength(64);
  });

  it('2. should normalize Bangkok Metropolitan Administration (BMA) payload with Thai dates & currency strings', () => {
    const bmaPayload: RawAgencyPayload = {
      projectId: '67119538991',
      title: 'โครงการพัฒนาระบบเทคโนโลยีสารสนเทศ กรุงเทพมหานคร',
      department: 'สำนักยุทธศาสตร์และประเมินผล',
      budget: '฿ 12,500,000.00 บาท',
      publishDate: '15 ส.ค. 2567', // Thai Buddhist Era date
      fiscalYear: '2568',
      procurementType: 'จ้างพัฒนา',
      documents: [
        { fileName: 'TOR.pdf', fileUrl: 'https://bma.go.th/docs/tor.pdf' },
      ],
    };

    const result = adapter.transform(bmaPayload);

    expect(result.status).toBe('VALID');
    expect(result.data).toBeDefined();
    expect(result.data!.budget).toBe(12500000);
    expect(result.data!.publishDate).toBe('2024-08-15T00:00:00.000Z'); // Successfully converted to ISO-8601
    expect(result.data!.documentLinks).toContain('https://bma.go.th/docs/tor.pdf');
  });

  it('3. should normalize Provincial/Regional agency payload with compact date & Thai multiplier budget', () => {
    const regionalPayload: RawAgencyPayload = {
      externalId: '67089452103',
      projectName: '   โครงการปรับปรุงระบบประปาชนบท  \t',
      agencyName: 'องค์การบริหารส่วนจังหวัดเชียงใหม่',
      price: '5.2 ล้านบาท', // Thai multiplier
      announce_date: '25670801', // Compact YYYYMMDD in BE
      year: 2567,
    };

    const result = adapter.transform(regionalPayload);

    expect(result.status).toBe('VALID');
    expect(result.data).toBeDefined();
    expect(result.data!.projectName).toBe('โครงการปรับปรุงระบบประปาชนบท');
    expect(result.data!.budget).toBe(5200000);
    expect(result.data!.publishDate).toBe('2024-08-01T00:00:00.000Z');
  });

  // ─── 2. Schema Validation: Reject Malformed Payloads ───────────────────────

  it('4. should reject malformed payload with negative budget and provide error details', () => {
    const invalidPayload: RawAgencyPayload = {
      project_id: '67119538991',
      project_name: 'โครงการที่มีงบประมาณติดลบ',
      dept_name: 'สำนักการแพทย์',
      budget: '-1500000', // Negative budget!
    };

    const result = adapter.transform(invalidPayload);

    expect(result.status).toBe('REJECTED');
    expect(result.data).toBeUndefined();
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some((e) => e.field === 'budget')).toBe(true);
    expect(result.errors.find((e) => e.field === 'budget')?.message).toContain('Budget must not be negative');
  });

  it('5. should reject malformed payload missing mandatory project ID or title', () => {
    const missingTitlePayload: RawAgencyPayload = {
      project_id: '',
      project_name: '', // Empty title
      agency_name: 'สำนักอนามัย',
      budget: 1000000,
    };

    const result = adapter.transform(missingTitlePayload);

    expect(result.status).toBe('REJECTED');
    expect(result.errors.some((e) => e.field === 'externalProjectId')).toBe(true);
    expect(result.errors.some((e) => e.field === 'projectName')).toBe(true);
  });

  // ─── 3. Schema Validation: Flag Anomalies (Warnings) ─────────────────────

  it('6. should flag payloads with non-standard project ID length or zero budget', () => {
    const flaggedPayload: RawAgencyPayload = {
      project_id: 'BMA-2024-001', // Valid string but non-standard (not 11 digits)
      project_name: 'โครงการทดสอบระบบเสมือน',
      agency_name: 'กรุงเทพมหานคร',
      budget: 0, // 0 budget -> should be flagged
    };

    const result = adapter.transform(flaggedPayload);

    expect(result.status).toBe('FLAGGED');
    expect(result.data).toBeDefined();
    expect(result.flags.length).toBeGreaterThan(0);
    expect(result.flags.some((f) => f.includes('Non-standard project ID length'))).toBe(true);
    expect(result.flags.some((f) => f.includes('Budget is 0 THB'))).toBe(true);
  });

  // ─── 4. Batch Transformation & Summary ───────────────────────────────────

  it('7. should process batch agency payloads and aggregate summary statistics', () => {
    const batchList: RawAgencyPayload[] = [
      // 1. Valid e-GP item
      {
        project_id: '67059199407',
        project_name: 'ระบบเซิร์ฟเวอร์หลัก',
        dept_name: 'สวทช.',
        budget: 5000000,
        publish_date: '2024-05-01',
      },
      // 2. Flagged item (0 budget)
      {
        project_id: '67059199408',
        project_name: 'โครงการความร่วมมือทางวิชาการ',
        dept_name: 'จุฬาลงกรณ์มหาวิทยาลัย',
        budget: 0,
        publish_date: '2024-05-01',
      },
      // 3. Rejected item (empty project ID & title)
      {
        project_id: '',
        project_name: '',
        dept_name: 'กรมทางหลวง',
      },
    ];

    const summary = adapter.transformBatch(batchList);

    expect(summary.total).toBe(3);
    expect(summary.validCount).toBe(1);
    expect(summary.flaggedCount).toBe(1);
    expect(summary.rejectedCount).toBe(1);
    expect(summary.validProjects).toHaveLength(2); // valid + flagged are accepted into validProjects
  });
});
