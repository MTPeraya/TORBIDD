import {
  translateDepartment,
  translateProjectTitle,
  translateProcurementType,
} from '../dictionary';

describe('Translation Dictionary & Heuristics', () => {
  describe('translateDepartment', () => {
    it('translates known BMA departments to official English names', () => {
      expect(translateDepartment('สำนักยุทธศาสตร์และประเมินผล')).toBe(
        'Strategy and Evaluation Department',
      );
      expect(translateDepartment('สำนักการศึกษา')).toBe('Education Department');
      expect(translateDepartment('สำนักสิ่งแวดล้อม')).toBe('Environment Department');
      expect(translateDepartment('สำนักอนามัย')).toBe('Health Department');
      expect(translateDepartment('สำนักการคลัง')).toBe('Finance Department');
      expect(translateDepartment('กรุงเทพมหานคร')).toBe('Bangkok Metropolitan Administration');
    });

    it('translates 50 BMA district offices according to transliteration rules', () => {
      expect(translateDepartment('สำนักงานเขตบางรัก')).toBe('Bang Rak District Office');
      expect(translateDepartment('สำนักงานเขตปทุมวัน')).toBe('Pathum Wan District Office');
      expect(translateDepartment('สำนักงานเขตจตุจักร')).toBe('Chatuchak District Office');
      expect(translateDepartment('สำนักงานเขตคลองเตย')).toBe('Khlong Toei District Office');
      expect(translateDepartment('สำนักงานเขตพระนคร')).toBe('Phra Nakhon District Office');
    });

    it('translates known public state agencies', () => {
      expect(translateDepartment('กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม')).toBe(
        'Ministry of Digital Economy and Society',
      );
      expect(translateDepartment('สำนักงานพัฒนารัฐบาลดิจิทัล (องค์การมหาชน)')).toBe(
        'Digital Government Development Agency (Public Organization)',
      );
    });

    it('handles hospital and university agency prefixes', () => {
      expect(translateDepartment('โรงพยาบาลศิริราช')).toBe('ศิริราช Hospital');
      expect(translateDepartment('มหาวิทยาลัยเกษตรศาสตร์')).toBe('เกษตรศาสตร์ University');
    });

    it('handles empty or missing inputs gracefully', () => {
      expect(translateDepartment('')).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(translateDepartment(null as any)).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(translateDepartment(undefined as any)).toBe('');
    });

    it('preserves already English strings', () => {
      expect(translateDepartment('Strategy and Evaluation Dept.')).toBe(
        'Strategy and Evaluation Dept.',
      );
    });
  });

  describe('translateProjectTitle', () => {
    it('extracts English names inside parentheses and structures project title', () => {
      expect(
        translateProjectTitle(
          'โครงการพัฒนาระบบรวมศูนย์การให้บริการประชาชน (BMA e-Service Smart Portal)',
        ),
      ).toBe('BMA e-Service Smart Portal System Development Project');

      expect(
        translateProjectTitle(
          'โครงการจ้างเหมาพัฒนาระบบศูนย์ควบคุมสัญญาณไฟจราจรอัจฉริยะ (Smart Traffic Control System)',
        ),
      ).toBe('Smart Traffic Control System System Development Project');
    });

    it('translates common government IT project topics', () => {
      expect(
        translateProjectTitle('โครงการพัฒนาระบบแอปพลิเคชันบริการประชาชน กทม. บนมือถือ'),
      ).toBe('BMA Citizen Mobile Application System Development Project');

      expect(
        translateProjectTitle('โครงการพัฒนาระบบศูนย์สื่อการเรียนรู้ออนไลน์'),
      ).toBe('BMA Online Learning Management System (LMS) System Development Project');
    });

    it('handles already English titles cleanly', () => {
      expect(translateProjectTitle('BMA Smart Portal System Upgrade')).toBe(
        'BMA Smart Portal System Upgrade',
      );
    });

    it('handles empty or null inputs gracefully', () => {
      expect(translateProjectTitle('')).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(translateProjectTitle(null as any)).toBe('');
    });
  });

  describe('translateProcurementType', () => {
    it('translates common Thai procurement method types', () => {
      expect(translateProcurementType('e-Bidding')).toBe('e-Bidding');
      expect(translateProcurementType('ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)')).toBe('e-Bidding');
      expect(translateProcurementType('วิธีเฉพาะเจาะจง')).toBe('Specific Method');
      expect(translateProcurementType('วิธีคัดเลือก')).toBe('Selective Method');
      expect(translateProcurementType('สอบราคา')).toBe('Price Inquiry');
      expect(translateProcurementType('ประกวดราคา')).toBe('Open Competitive Bidding');
      expect(translateProcurementType('ตลาดอิเล็กทรอนิกส์ (e-market)')).toBe('e-Market');
      expect(translateProcurementType('ตกลงราคา')).toBe('Agreed Price Method');
    });

    it('handles substrings and variations gracefully', () => {
      expect(translateProcurementType('จัดซื้อจัดจ้างโดยวิธีเฉพาะเจาะจง')).toBe('Specific Method Procurement');
      expect(translateProcurementType('จัดซื้อจัดจ้างโดยวิธีคัดเลือก')).toBe('Selective Method Procurement');
    });

    it('handles empty and null inputs', () => {
      expect(translateProcurementType('')).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(translateProcurementType(null as any)).toBe('');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(translateProcurementType(undefined as any)).toBe('');
    });
  });
});
