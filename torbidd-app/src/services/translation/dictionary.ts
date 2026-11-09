// =============================================================================
// services/translation/dictionary.ts
// Official English translations and pattern translators for Thai government
// agencies, BMA departments, 50 district offices, and procurement project titles.
// =============================================================================

/** Standard BMA Departments */
export const BMA_DEPARTMENTS: Record<string, string> = {
  'สำนักยุทธศาสตร์และประเมินผล': 'Strategy and Evaluation Department',
  'สำนักการศึกษา': 'Education Department',
  'สำนักสิ่งแวดล้อม': 'Environment Department',
  'สำนักวัฒนธรรม กีฬา และการท่องเที่ยว': 'Culture, Sports and Tourism Department',
  'สำนักอนามัย': 'Health Department',
  'สำนักการแพทย์': 'Medical Services Department',
  'สำนักพัฒนาสังคม': 'Social Development Department',
  'สำนักการคลัง': 'Finance Department',
  'สำนักการจราจรและขนส่ง': 'Traffic and Transportation Department',
  'สำนักการระบายน้ำ': 'Department of Drainage and Sewerage',
  'สำนักการโยธา': 'Department of Public Works',
  'สำนักป้องกันและบรรเทาสาธารณภัย': 'Department of Disaster Prevention and Mitigation',
  'สำนักเทศกิจ': 'City Law Enforcement Department',
  'สำนักผังเมือง': 'Department of City Planning',
  'สำนักการวางผังและพัฒนาเมือง': 'Department of City Planning and Urban Development',
  'สำนักงบประมาณกรุงเทพมหานคร': 'BMA Budget Bureau',
  'สำนักงานเลขานุการผู้ว่าราชการกรุงเทพมหานคร': 'Office of the Secretary to the Governor of Bangkok',
  'สำนักงานคณะกรรมการข้าราชการกรุงเทพมหานคร': 'Office of the Bangkok Civil Service Commission',
  'สำนักงานเลขาธิการสภากรุงเทพมหานคร': 'Office of the Bangkok Metropolitan Council',
  'กรุงเทพมหานคร': 'Bangkok Metropolitan Administration',
  'ศาลาว่าการกรุงเทพมหานคร': 'Bangkok City Hall',
};

/** Known 50 Bangkok District Offices transliterated */
export const BMA_DISTRICTS: Record<string, string> = {
  'คลองเตย': 'Khlong Toei',
  'คลองสาน': 'Khlong San',
  'คลองสามวา': 'Khlong Sam Wa',
  'คันนายาว': 'Khan Na Yao',
  'จตุจักร': 'Chatuchak',
  'จอมทอง': 'Chom Thong',
  'ดอนเมือง': 'Don Mueang',
  'ดินแดง': 'Din Daeng',
  'ดุสิต': 'Dusit',
  'ตลิ่งชัน': 'Taling Chan',
  'ทวีวัฒนา': 'Thawi Watthana',
  'ทุ่งครุ': 'Thung Khru',
  'ธนบุรี': 'Thon Buri',
  'บางเขน': 'Bang Khen',
  'บางแค': 'Bang Khae',
  'บางกะปิ': 'Bang Kapi',
  'บางกอกใหญ่': 'Bangkok Yai',
  'บางกอกน้อย': 'Bangkok Noi',
  'บางขุนเทียน': 'Bang Khun Thian',
  'บางคอแหลม': 'Bang Kho Laem',
  'บางซื่อ': 'Bang Sue',
  'บางนา': 'Bang Na',
  'บางบอน': 'Bang Bon',
  'บางพลัด': 'Bang Phlat',
  'บางรัก': 'Bang Rak',
  'บึงกุ่ม': 'Bueng Kum',
  'ปทุมวัน': 'Pathum Wan',
  'ประเวศ': 'Prawet',
  'ป้อมปราบศัตรูพ่าย': 'Pom Prap Sattru Phai',
  'พญาไท': 'Phaya Thai',
  'พระโขนง': 'Phra Khanong',
  'พระนคร': 'Phra Nakhon',
  'ภาษีเจริญ': 'Phasi Charoen',
  'มีนบุรี': 'Min Buri',
  'ยานนาวา': 'Yannawa',
  'ราชเทวี': 'Ratchathewi',
  'ราษฎร์บูรณะ': 'Rat Burana',
  'ลาดกระบัง': 'Lat Krabang',
  'ลาดพร้าว': 'Lat Phrao',
  'วังทองหลาง': 'Wang Thonglang',
  'วัฒนา': 'Watthana',
  'สวนหลวง': 'Suan Luang',
  'สะพานสูง': 'Saphan Sung',
  'สัมพันธวงศ์': 'Samphanthawong',
  'สาทร': 'Sathon',
  'สายไหม': 'Sai Mai',
  'หนองจอก': 'Nong Chok',
  'หนองแขม': 'Nong Khaem',
  'หลักสี่': 'Lak Si',
  'ห้วยขวาง': 'Huai Khwang',
};

/** Common Ministries & State Agencies */
export const STATE_AGENCIES: Record<string, string> = {
  'กระทรวงดิจิทัลเพื่อเศรษฐกิจและสังคม': 'Ministry of Digital Economy and Society',
  'สำนักงานพัฒนารัฐบาลดิจิทัล (องค์การมหาชน)': 'Digital Government Development Agency (Public Organization)',
  'กรมบัญชีกลาง': 'The Comptroller General Department',
  'สำนักงานหลักประกันสุขภาพแห่งชาติ': 'National Health Security Office',
  'สำนักงานตำรวจแห่งชาติ': 'Royal Thai Police',
  'การประปานครหลวง': 'Metropolitan Waterworks Authority',
  'การไฟฟ้านครหลวง': 'Metropolitan Electricity Authority',
  'การทางพิเศษแห่งประเทศไทย': 'Expressway Authority of Thailand',
  'การรถไฟฟ้าขนส่งมวลชนแห่งประเทศไทย': 'Mass Rapid Transit Authority of Thailand',
  'สำนักงานปลัดกรุงเทพมหานคร': 'Office of the Permanent Secretary for BMA',
};

/**
 * Translates a Thai department or agency name into English.
 */
export function translateDepartment(deptTh: string | undefined | null): string {
  if (!deptTh || typeof deptTh !== 'string') return '';
  const trimmed = deptTh.trim();
  if (!trimmed) return '';

  // Direct lookup in known BMA departments
  if (BMA_DEPARTMENTS[trimmed]) {
    return BMA_DEPARTMENTS[trimmed];
  }

  // Direct lookup in known state agencies
  if (STATE_AGENCIES[trimmed]) {
    return STATE_AGENCIES[trimmed];
  }

  // District office pattern: สำนักงานเขต[ชื่อเขต]
  const districtMatch = trimmed.match(/^สำนักงานเขต\s*([ก-๙a-zA-Z]+)/);
  if (districtMatch) {
    const rawName = districtMatch[1];
    const englishName = BMA_DISTRICTS[rawName] || rawName;
    return `${englishName} District Office`;
  }

  // Department pattern: สำนัก[ชื่อ]
  for (const [th, en] of Object.entries(BMA_DEPARTMENTS)) {
    if (trimmed.includes(th)) {
      return en;
    }
  }

  // Hospital pattern: โรงพยาบาล[ชื่อ]
  if (trimmed.startsWith('โรงพยาบาล')) {
    const hospName = trimmed.replace(/^โรงพยาบาล\s*/, '');
    return `${hospName} Hospital`;
  }

  // College / University: มหาวิทยาลัย / วิทยาลัย
  if (trimmed.startsWith('มหาวิทยาลัย')) {
    const uniName = trimmed.replace(/^มหาวิทยาลัย\s*/, '');
    return `${uniName} University`;
  }

  // If already Latin characters, keep as-is
  if (!/[\u0E00-\u0E7F]/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Translates a Thai procurement project title into English using structured heuristics,
 * pattern recognition, and English acronym preservation.
 */
export function translateProjectTitle(titleTh: string | undefined | null): string {
  if (!titleTh || typeof titleTh !== 'string') return '';
  const trimmed = titleTh.trim();
  if (!trimmed) return '';

  // If already predominantly English / Latin text, return trimmed
  if (!/[\u0E00-\u0E7F]/.test(trimmed)) {
    return trimmed;
  }

  // Extract English title inside parentheses if present (e.g. "(BMA e-Service Smart Portal)")
  const parenMatch = trimmed.match(/\(([^)]*[a-zA-Z]{3,}[^)]*)\)/);
  const englishParen = parenMatch ? parenMatch[1].trim() : '';

  // Detect project type keywords
  let action = 'Project';
  if (trimmed.includes('พัฒนาระบบ') || trimmed.includes('พัฒนาโปรแกรม') || trimmed.includes('พัฒนาซอฟต์แวร์')) {
    action = 'System Development Project';
  } else if (trimmed.includes('ปรับปรุงระบบ') || trimmed.includes('ยกระดับระบบ')) {
    action = 'System Upgrade & Enhancement Project';
  } else if (trimmed.includes('บำรุงรักษา') || trimmed.includes('ซ่อมบำรุง')) {
    action = 'Maintenance and Support Project';
  } else if (trimmed.includes('จัดซื้อ') || trimmed.includes('จัดหา')) {
    action = 'Procurement Project';
  } else if (trimmed.includes('จ้างเหมา') || trimmed.includes('จ้างบริการ')) {
    action = 'Services Procurement Project';
  } else if (trimmed.includes('เช่า')) {
    action = 'Leasing and Service Project';
  } else if (trimmed.includes('ติดตั้ง')) {
    action = 'Installation & Deployment Project';
  }

  // If there's an English name inside parentheses, combine it naturally
  if (englishParen) {
    if (englishParen.toLowerCase().includes('project')) {
      return englishParen;
    }
    return `${englishParen} ${action}`;
  }

  // Common IT topics in Thai procurement
  const topicMap: Array<[RegExp, string]> = [
    [/ศูนย์สื่อการเรียนรู้ออนไลน์|ห้องเรียนออนไลน์|lms/i, 'BMA Online Learning Management System (LMS)'],
    [/แอปพลิเคชันบริการประชาชน|mobile app|แอปพลิเคชันบนมือถือ/i, 'BMA Citizen Mobile Application'],
    [/ห้องสมุดเพื่อการเรียนรู้/i, 'BMA Digital Learning Library System'],
    [/การจัดการขยะ|คัดแยกขยะ|ขยะมูลฝอย/i, 'Smart Waste Management and Tracking System'],
    [/การแพทย์ทางไกล|telemedicine|สุขภาพ/i, 'Telemedicine and Public Health Intelligence System'],
    [/สวัสดิการผู้สูงอายุ|ผู้สูงอายุ/i, 'Senior Citizen Welfare & Subsidy Management System'],
    [/คำนวณเงินบำเหน็จบำนาญ|บำเหน็จบำนาญ|การเงิน/i, 'BMA Pension & Financial Benefits Calculation System'],
    [/สัญญาณไฟจราจรอัจฉริยะ|จราจร/i, 'Smart Traffic Light Control & Surveillance System'],
    [/กล้องโทรทัศน์วงจรปิด|cctv/i, 'CCTV Video Analytics & Security Surveillance System'],
    [/ทะเบียนราษฎร|บัตรประชาชน/i, 'Civil Registration & Citizen Identity Verification System'],
    [/สารบรรณอิเล็กทรอนิกส์|e-document/i, 'Electronic Document Management System (e-Saraban)'],
    [/ภาษีที่ดินและสิ่งปลูกสร้าง|ภาษี/i, 'Land and Building Tax Assessment & Collection System'],
    [/ฐานข้อมูลรวมศูนย์|data warehouse|คลังข้อมูล/i, 'Centralized Data Warehouse and Analytics Platform'],
    [/คลาวด์|cloud/i, 'Government Cloud Infrastructure & SaaS Platform'],
    [/ปัญญาประดิษฐ์|ai/i, 'Artificial Intelligence Platform'],
  ];

  for (const [pattern, englishTopic] of topicMap) {
    if (pattern.test(trimmed)) {
      return `${englishTopic} ${action}`;
    }
  }

  // Fallback: clean the Thai prefix and label
  const cleaned = trimmed
    .replace(/^โครงการจ้างเหมาพัฒนาระบบ\s*/, '')
    .replace(/^โครงการพัฒนาระบบ\s*/, '')
    .replace(/^โครงการจัดซื้อ\s*/, '')
    .replace(/^โครงการจ้าง\s*/, '')
    .replace(/^โครงการ\s*/, '')
    .replace(/^จ้าง\s*/, '');

  return `${cleaned} - ${action}`;
}

