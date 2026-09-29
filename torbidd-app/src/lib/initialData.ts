// =============================================================================
// lib/initialData.ts - Initial Static Dataset for Offline / Instant First Render
// =============================================================================

import { Project } from '@/types/project';
import { HistoricalProject } from '@/types/historical';
import { enrichProjectDetail } from '@/lib/projectDetailHelper';

export const INITIAL_DEPARTMENTS = [
  { th: 'สำนักยุทธศาสตร์และประเมินผล', en: 'Strategy and Evaluation Dept.' },
  { th: 'สำนักการศึกษา', en: 'Education Dept.' },
  { th: 'สำนักสิ่งแวดล้อม', en: 'Environment Dept.' },
  { th: 'สำนักวัฒนธรรม กีฬา และการท่องเที่ยว', en: 'Culture, Sports & Tourism Dept.' },
  { th: 'สำนักอนามัย', en: 'Health Dept.' },
  { th: 'สำนักการแพทย์', en: 'Medical Services Dept.' },
  { th: 'สำนักพัฒนาสังคม', en: 'Social Development Dept.' },
  { th: 'สำนักการคลัง', en: 'Finance Dept.' },
  { th: 'สำนักการจราจรและขนส่ง', en: 'Traffic and Transport Dept.' },
];

const RAW_PROJECTS: Project[] = [
  {
    externalId: 1,
    title: {
      th: 'โครงการพัฒนาระบบรวมศูนย์การให้บริการประชาชน (BMA e-Service Smart Portal)',
      en: 'BMA e-Service Smart Portal Centralized System Development Project',
    },
    department: INITIAL_DEPARTMENTS[0],
    budget: 53131650,
    publishDate: '2026-08-01',
    deadline: '2026-08-25',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการพัฒนาระบบรวมศูนย์พอร์ทัลการให้บริการประชาชนแบบครบวงจร เพื่อรองรับและบูรณาการงานบริการออนไลน์ของ 50 สำนักงานเขต โดยครอบคลุมระบบลงทะเบียนสมาชิกเดี่ยว (Single Sign-On) และระบบชำระเงินค่าธรรมเนียมออนไลน์ของกรุงเทพมหานคร',
      en: 'Development of BMA e-Service Smart Portal as a centralized portal integrating online citizen services across 50 districts. Includes BMA Single Sign-On and e-payment systems.',
    },
    scope: {
      th: [
        'ออกแบบและพัฒนาระบบ BMA e-Service Portal สำหรับประชาชน',
        'พัฒนาระบบยืนยันตัวตนรวมศูนย์ BMA Single Sign-On รองรับการจดจำผู้ใช้ผ่าน ThaID',
        'พัฒนาระบบชำระค่าธรรมเนียมและค่าภาษีท้องถิ่นผ่าน QR Code/บัตรเครดิต',
        'เชื่อมโยง API และฐานข้อมูลกับระบบบริการเดิมของ กทม. 25 ระบบ',
        'จัดทำระบบ Dashboard สรุปสถิติผู้เข้าใช้บริการสำหรับผู้บริหารแบบ Real-time',
      ],
      en: [
        'Design and develop the citizen-facing BMA e-Service Portal',
        'Develop centralized BMA Single Sign-On integrated with national ThaID system',
        'Develop local tax and fee payment systems supporting QR code and credit cards',
        'Integrate APIs and databases with 25 existing BMA service systems',
        'Develop real-time executive dashboard summarizing service usage statistics',
      ],
    },
    qualifications: {
      th: [
        'เป็นนิติบุคคลจดทะเบียนในประเทศไทย มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 10,000,000 บาท',
        'มีผลงานประเภทพัฒนาระบบสารสนเทศระดับองค์กร (Enterprise Portal) หรือ e-Government มูลค่าสัญญาเดียวไม่น้อยกว่า 15,000,000 บาท ภายใน 5 ปีย้อนหลัง',
        'ต้องได้รับใบรับรองมาตรฐาน ISO 27001 หรือ CMMI Level 3 ขึ้นไปด้านการพัฒนาซอฟต์แวร์',
        'มีบุคลากรประจำทีมที่ผ่านการอบรมหรือมีใบรับรองมาตรฐานการเขียนโปรแกรมความมั่นคงปลอดภัย',
      ],
      en: [
        'Legal entity registered in Thailand with paid-up capital of at least 10,000,000 THB',
        'Must have completed enterprise portal or e-Government systems development worth at least 15,000,000 THB in a single contract within the past 5 years',
        'Must possess ISO 27001 or CMMI Level 3 or higher certification in software development',
        'Development team must include certified secure programming professionals',
      ],
    },
    historicalAvg: 48000000,
    sourceDocument: 'BMA_eService_SmartPortal_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
  {
    externalId: 2,
    title: {
      th: 'โครงการจ้างเหมาพัฒนาระบบศูนย์สื่อการเรียนรู้ออนไลน์ (BMA Learning Hub)',
      en: 'BMA Learning Hub Online Classroom System Project',
    },
    department: INITIAL_DEPARTMENTS[1],
    budget: 14993300,
    publishDate: '2026-08-05',
    deadline: '2026-08-28',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: {
      th: 'พัฒนาซอฟต์แวร์และคอร์สแวร์บริหารจัดการการเรียนรู้ออนไลน์ (LMS) สำหรับคุณครู นักเรียน และบุคลากรทางการศึกษาของโรงเรียนในสังกัดกรุงเทพมหานคร',
      en: 'Develop an online Learning Management System (LMS) and courseware portal for teachers, students, and educational staff under BMA public schools.',
    },
    scope: {
      th: [
        'พัฒนาระบบจัดการบทเรียน แผนการเรียนรู้ และห้องเรียนเสมือนจริง (Virtual Classroom)',
        'พัฒนาคลังเก็บสื่อวิดีโอ เอกสารประกอบการสอน และระบบสอบวัดผลคะแนนออนไลน์',
        'ออกแบบระบบประเมินวิทยฐานะของครูผู้สอนผ่านผลสัมฤทธิ์ทางการศึกษา',
        'จัดให้มีระบบส่งข้อความแจ้งเตือนความคืบหน้าการเรียนไปยังกลุ่มผู้ปกครอง',
      ],
      en: [
        'Develop curriculum manager, learning tracks, and virtual classroom facilities',
        'Create media storage for educational videos, handouts, and online quiz managers',
        'Design teacher evaluation modules based on student education performance targets',
        'Establish automated push notifications tracking student progress for parents',
      ],
    },
    qualifications: {
      th: [
        'จดทะเบียนจัดตั้งประเภทนิติบุคคล มีทุนจดทะเบียนไม่น้อยกว่า 3,000,000 บาท',
        'มีผลงานจ้างพัฒนาระบบบริหารจัดการเรียนรู้ (LMS) หรือแพลตฟอร์มการศึกษาอิเล็กทรอนิกส์ให้กับสถาบันการศึกษาหรือรัฐ มูลค่าไม่น้อยกว่า 4,000,000 บาท',
      ],
      en: [
        'Registered corporate entity with capital of at least 3,000,000 THB',
        'Must have successfully deployed LMS or e-learning platforms for schools or government agencies worth at least 4,000,000 THB',
      ],
    },
    historicalAvg: 16500000,
    sourceDocument: 'BMA_LearningHub_Education_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
  {
    externalId: 3,
    title: {
      th: 'โครงการพัฒนาระบบแอปพลิเคชันบริการประชาชน กทม. บนมือถือ (BMA Smart Service Mobile App)',
      en: 'BMA Smart Service Citizen Mobile Application Project',
    },
    department: INITIAL_DEPARTMENTS[0],
    budget: 28500000,
    publishDate: '2026-08-03',
    deadline: '2026-08-27',
    category: 'Mobile App',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการจ้างออกแบบและพัฒนาแอปพลิเคชันบนอุปกรณ์สื่อสารเคลื่อนที่ (iOS และ Android) รวบรวมบริการสาธารณะ ภาษีที่ดิน ระบบจองคิวนัดหมายสำนักงานเขต และผสานงานระบบร้องเรียน Traffy Fondue เข้าไว้เป็นหนึ่งเดียว',
      en: 'Design and develop the BMA Smart Service mobile application on iOS and Android to aggregate public tax payments, local district booking queues, and Traffy Fondue complaints.',
    },
    scope: {
      th: [
        'ออกแบบ UI/UX แอปพลิเคชันตามแนวทางแบรนด์ กทม. รองรับทั้ง iOS และ Android',
        'พัฒนาโมดูลชำระภาษีที่ดินและสิ่งปลูกสร้าง พร้อมระบบเรียกดูประวัติใบเสร็จย้อนหลัง',
        'ผสานการทำงานเชื่อมต่อ API กับ Traffy Fondue เพื่อแสดงสถานะร้องเรียนแบบเรียลไทม์',
        'พัฒนาระบบจองคิวออนไลน์เพื่อขอรับบริการงานทะเบียนราษฎร ณ ที่ทำการเขต 50 เขต',
      ],
      en: [
        'Design mobile UI/UX in compliance with BMA branding guidelines for iOS and Android',
        'Develop real estate and local tax invoice payment features with payment history',
        'Integrate Traffy Fondue API to present real-time report feedback and tracking',
        'Develop online queue booking for civil registration services at all 50 district offices',
      ],
    },
    qualifications: {
      th: [
        'เป็นผู้มีอาชีพรับจ้างงานคอมพิวเตอร์และซอฟต์แวร์โดยตรง',
        'มีสัญญาผลงานพัฒนาแอปพลิเคชันบนมือถือที่เผยแพร่บน App Store และ Google Play Store ที่มีผู้ลงทะเบียนใช้งานมากกว่า 50,000 บัญชี',
        'มูลค่าสัญญาพัฒนาแอปพลิเคชันระบบสารสนเทศไม่ต่ำกว่า 10,000,000 บาท ภายในระยะเวลาไม่เกิน 5 ปี',
      ],
      en: [
        'Must be actively trading in software and computer development fields',
        'Must showcase mobile applications published on App Store/Google Play with at least 50,000 registered users',
        'Must have mobile or IT system project contracts worth at least 10,000,000 THB within the past 5 years',
      ],
    },
    historicalAvg: 25000000,
    sourceDocument: 'BMA_SmartService_MobileApp_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
  {
    externalId: 4,
    title: {
      th: 'โครงการจ้างเหมาพัฒนาระบบเทคโนโลยีสารสนเทศห้องสมุดเพื่อการเรียนรู้กรุงเทพมหานคร',
      en: 'BMA Learning Library Information Technology System Upgrade',
    },
    department: INITIAL_DEPARTMENTS[3],
    budget: 14502000,
    publishDate: '2026-07-28',
    deadline: '2026-08-18',
    category: 'Database',
    procurementType: 'e-Bidding',
    description: {
      th: 'จ้างเหมาปรับปรุงระบบฐานข้อมูลและซอฟต์แวร์จัดการห้องสมุดดิจิทัล เชื่อมต่อระบบยืม-คืนอัตโนมัติ ฐานข้อมูลสื่ออิเล็กทรอนิกส์ข้ามเครือข่ายห้องสมุดเพื่อการเรียนรู้ กทม. จำนวน 36 แห่ง',
      en: 'Upgrade database system and library management software to link automated check-in/out and digital books across 36 BMA Learning Library locations.',
    },
    scope: {
      th: [
        'ปรับปรุงระบบบริการยืม-คืนหนังสือและจองคิวใช้งานคอมพิวเตอร์ออนไลน์',
        'พัฒนาระบบค้นหารายการหนังสือรวมศูนย์ (OPAC) เชื่อมโยงทุกสาขาห้องสมุด',
        'บูรณาการระบบจัดการคลังเก็บสื่อสิ่งพิมพ์และ e-Book ลิขสิทธิ์เฉพาะ กทม.',
        'ติดตั้ง API เชื่อมต่อกับระบบยืนยันตัวตน BMA Single Sign-On',
      ],
      en: [
        'Upgrade check-in/check-out services and online research desk reservations',
        'Develop unified book search (OPAC) indexing library collections across branches',
        'Integrate media assets manager hosting publications and BMA-owned e-Books',
        'Deploy authentication API interfacing with BMA Single Sign-On database',
      ],
    },
    qualifications: {
      th: [
        'มีผลงานการพัฒนาระบบสารสนเทศห้องสมุดหรือระบบ OPAC ให้ส่วนราชการหรือสถาบันการศึกษา มูลค่าสัญญาเดียวไม่ต่ำกว่า 4,000,000 บาท',
        'ผ่านการรับรองระบบคุณภาพในการพัฒนาซอฟต์แวร์ตามมาตรฐานของรัฐ',
      ],
      en: [
        'Must possess completed library management system or OPAC portal contract worth at least 4,000,000 THB',
        'Must comply with software quality frameworks recognized by public bodies',
      ],
    },
    historicalAvg: 12000000,
    sourceDocument: 'BMA_LearningLibrary_IT_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
  {
    externalId: 5,
    title: {
      th: 'โครงการพัฒนาระบบสารสนเทศภูมิศาสตร์เพื่อการบริหารจัดการสารเคมี (BMA Chemical GIS System)',
      en: 'BMA Hazardous Chemical GIS System Development Project',
    },
    department: INITIAL_DEPARTMENTS[4],
    budget: 8200000,
    publishDate: '2026-08-09',
    deadline: '2026-09-02',
    category: 'AI',
    procurementType: 'e-Bidding',
    description: {
      th: 'พัฒนาระบบสารสนเทศภูมิศาสตร์ (GIS) สำหรับพล็อตและวิเคราะห์จุดพิกัดการจัดเก็บสารเคมีและวัตถุอันตรายภายในโรงงานและสถานประกอบการ เพื่อการระงับเหตุและประเมินภัยพิบัติเชิงรุก',
      en: 'Develop a Geographic Information System (GIS) mapping chemical storage sites in commercial zones to facilitate active hazard containment and disaster response.',
    },
    scope: {
      th: [
        'ออกแบบระบบแผนที่สารสนเทศภูมิศาสตร์ (GIS) บนเว็บบราวเซอร์หลัก',
        'พัฒนาระบบวิเคราะห์ประเมินทิศทางแก๊สรั่วและเขตรัศมีอพยพกรณีฉุกเฉิน (Plume Modeling AI)',
        'สร้างฐานข้อมูลรายการสารเคมีและวัตถุอันตรายครอบคลุมสถานประกอบการ 3,000 แห่ง',
        'พัฒนาระบบ Dashboard รายงานสถิติปริมาณสารเคมีควบคุมสำหรับกองอนามัยสิ่งแวดล้อม',
      ],
      en: [
        'Design web-based Geographic Information System (GIS) application',
        'Develop emergency chemical plume simulation modeling AI determining evacuation radii',
        'Create chemical substance inventory database covering 3,000 local manufacturing sites',
        'Build executive dashboard reporting toxic substances stats for Environment Health Division',
      ],
    },
    qualifications: {
      th: [
        'มีผลงานพัฒนาระบบเทคโนโลยีสารสนเทศภูมิศาสตร์ (GIS) หรือโปรแกรมประยุกต์ด้านการวางแผนป้องกันภัย มูลค่าสัญญาเดียวไม่ต่ำกว่า 2,500,000 บาท',
        'ผู้เสนอราคาต้องมีบุคลากรตำแหน่งนักวิเคราะห์ระบบจีไอเอสประจำโครงการ',
      ],
      en: [
        'Must have completed GIS software development or disaster prevention application worth at least 2,500,000 THB in a single contract',
        'Must allocate dedicated GIS Analyst personnel on team rosters',
      ],
    },
    historicalAvg: 7500000,
    sourceDocument: 'BMA_Health_Chemical_GIS_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
  {
    externalId: 6,
    title: {
      th: 'โครงการพัฒนาระบบโปรแกรมติดตามและตรวจสอบเวชระเบียนโรงพยาบาลในสังกัด กทม.',
      en: 'BMA Hospitals Medical Records Tracking and Verification System',
    },
    department: INITIAL_DEPARTMENTS[5],
    budget: 18500000,
    publishDate: '2026-08-10',
    deadline: '2026-09-12',
    category: 'Database',
    procurementType: 'e-Bidding',
    description: {
      th: 'จัดหาและพัฒนาซอฟต์แวร์สำหรับตรวจสอบความสมบูรณ์ของเวชระเบียนผู้ป่วยนอกและผู้ป่วยใน เพื่อรองรับการเบิกจ่ายค่ารักษาพยาบาลจากกองทุนหลักประกันสุขภาพได้อย่างถูกต้องรวดเร็ว',
      en: 'Procure and develop clinical software validating inpatient/outpatient electronic medical records (EMR) for healthcare reimbursement.',
    },
    scope: {
      th: [
        'พัฒนาระบบวิเคราะห์ความถูกต้องของการลงรหัสโรค (ICD-10/ICD-9-CM) บนเวชระเบียนอิเล็กทรอนิกส์',
        'พัฒนาโปรแกรมดึงข้อมูลเวชระเบียนและแปลงเป็นโครงสร้างแฟ้มข้อมูลมาตรฐานกระทรวงสาธารณสุข',
        'จัดทำระบบแจ้งเตือนกรณีตรวจพบรหัสโรคขัดแย้งกับบันทึกการรักษาพยาบาล',
        'เชื่อมต่อฐานข้อมูลร่วมกับระบบ HIS ของโรงพยาบาล กทม. 11 แห่ง',
      ],
      en: [
        'Develop clinical validation rules checking diagnosis codes (ICD-10/ICD-9-CM) in EMRs',
        'Build extractors transforming records to ministry-compliant health reporting standard files',
        'Deploy alerting modules flagging inconsistencies between code assignments and progress notes',
        'Establish direct integrations with HIS platforms across 11 BMA public hospitals',
      ],
    },
    qualifications: {
      th: [
        'มีผลงานจ้างเหมาพัฒนาระบบเทคโนโลยีสารสนเทศให้กับโรงพยาบาลรัฐหรือเอกชน มูลค่าไม่น้อยกว่า 5,000,000 บาท',
        'มีบุคลากรที่มีความเชี่ยวชาญด้านเวชสถิติหรือมีใบรับรองการลงรหัสโรคสากลประจำทีมพัฒนา',
      ],
      en: [
        'Must possess completed health IT systems contracts with state or private hospitals worth at least 5,000,000 THB',
        'Must assign medical coders or health information specialists to the software team',
      ],
    },
    historicalAvg: 20000000,
    sourceDocument: 'BMA_MedicalRecord_Verify_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
  {
    externalId: 7,
    title: {
      th: 'โครงการพัฒนาระบบข้อมูลการจัดการคุณภาพอากาศกรุงเทพมหานคร',
      en: 'BMA Air Quality Management Information System Project',
    },
    department: INITIAL_DEPARTMENTS[2],
    budget: 6800000,
    publishDate: '2026-08-04',
    deadline: '2026-08-25',
    category: 'Database',
    procurementType: 'e-Bidding',
    description: {
      th: 'ปรับปรุงฐานข้อมูลดัชนีคุณภาพอากาศ (Air Quality Index) พัฒนาระบบรวบรวมข้อมูลฝุ่นละออง PM2.5 ข้อมูลสภาพอากาศจากเซ็นเซอร์ 70 จุดของสำนักสิ่งแวดล้อม',
      en: 'Upgrade BMA Air Quality Index database and system collecting real-time PM2.5 and meteorological sensor data from 70 environmental stations.',
    },
    scope: {
      th: [
        'ปรับปรุง API ดึงข้อมูลมลพิษทางอากาศ PM2.5, PM10, O3, CO จากสถานีตรวจวัดแบบ Real-time',
        'พัฒนาโมดูลคำนวณดัชนีคุณภาพอากาศ (AQI) และพยากรณ์ปริมาณฝุ่นละอองล่วงหน้า 3 วัน',
        'ปรับปรุงความเสถียรของระบบส่งแจ้งเตือนคุณภาพอากาศผ่าน LINE Official Account',
        'จัดทำระบบสำรองข้อมูลและจัดการ API เพื่อให้หน่วยงานภายนอกนำข้อมูลไปพัฒนาต่อได้',
      ],
      en: [
        'Update API fetching real-time PM2.5, PM10, O3, and CO sensor readings',
        'Develop module calculating AQI and generating 3-day particulate forecast alerts',
        'Improve performance of air quality broadcast notifications via LINE Official Account',
        'Design data backup and developer API catalog supporting external data consumption',
      ],
    },
    qualifications: {
      th: [
        'มีทุนจดทะเบียนไม่น้อยกว่า 1,500,000 บาท',
        'มีผลงานพัฒนาระบบฐานข้อมูลเชิงสัมพัทธ์ หรือระบบเชื่อมโยง API มูลค่าสัญญาเดี่ยวไม่ต่ำกว่า 1,500,000 บาท',
      ],
      en: [
        'Paid-up capital must be at least 1,500,000 THB',
        'Must have completed relational database or API integration contract worth at least 1,500,000 THB',
      ],
    },
    historicalAvg: 5500000,
    sourceDocument: 'BMA_AirQuality_Management_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
  {
    externalId: 8,
    title: {
      th: 'โครงการพัฒนาแอปพลิเคชันศูนย์บริการคนพิการและผู้สูงอายุ กทม. (BMA Welfare Companion Mobile App)',
      en: 'BMA Welfare Companion Mobile Application Project',
    },
    department: INITIAL_DEPARTMENTS[6],
    budget: 11200000,
    publishDate: '2026-08-02',
    deadline: '2026-08-22',
    category: 'Mobile App',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการพัฒนาโปรแกรมประยุกต์บนสมาร์ทโฟนสำหรับอำนวยความสะดวกในการเข้าถึงข้อมูลเบี้ยยังชีพคนพิการและผู้สูงอายุ พร้อมฟีเจอร์แจ้งเตือนฉุกเฉิน (SOS) ส่งพิกัดตำแหน่งช่วยเหลือ',
      en: 'Develop a mobile smartphone application facilitating access to BMA welfare payouts and emergency SOS geo-location tracking for senior citizens and disabled persons.',
    },
    scope: {
      th: [
        'พัฒนา Mobile Application (iOS/Android) ที่เน้นการออกแบบสำหรับผู้สูงอายุ (Accessibility UX)',
        'พัฒนาระบบตรวจสอบยอดเงินเบี้ยยังชีพและประวัติการรับเงินโอนสวัสดิการสังคม',
        'ออกแบบระบบช่วยเหลือฉุกเฉิน (SOS Button) ส่งพิกัดจีพีเอสเข้าศูนย์ควบคุมสวัสดิการสังคม กทม.',
        'ติดตั้งระบบลงทะเบียนขอสิทธิ์กายอุปกรณ์ช่วยเหลือคนพิการออนไลน์',
      ],
      en: [
        'Develop smartphone app focusing on accessible UX principles for seniors and disabled users',
        'Develop payout ledger view showing monthly allowance distribution history',
        'Design SOS emergency button broadcasting GPS location to BMA command centers',
        'Establish online request forms for government-funded mobility aids and devices',
      ],
    },
    qualifications: {
      th: [
        'มีผลงานพัฒนาแอปพลิเคชันมือถือระบบบริการภาครัฐหรือสังคม มูลค่าสัญญารวมกันไม่น้อยกว่า 3,000,000 บาท',
        'ซอฟต์แวร์ต้องผ่านเกณฑ์ประเมินการออกแบบที่เป็นมิตรตามมาตรฐาน Web Content Accessibility Guidelines (WCAG) ระดับ AA',
      ],
      en: [
        'Must have completed mobile apps delivering government or public services totaling at least 3,000,000 THB',
        'Software design must comply with WCAG 2.1 Level AA accessibility regulations',
      ],
    },
    historicalAvg: 10000000,
    sourceDocument: 'BMA_Welfare_Companion_Mobile_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
  {
    externalId: 9,
    title: {
      th: 'โครงการจ้างพัฒนาระบบสารสนเทศสำหรับกองบำเหน็จบำนาญข้าราชการกรุงเทพมหานคร',
      en: 'BMA Pension and Retirement Benefits Management System Project',
    },
    department: INITIAL_DEPARTMENTS[7],
    budget: 9800000,
    publishDate: '2026-07-22',
    deadline: '2026-08-14',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการจัดหาและพัฒนาระบบสารสนเทศจัดการข้อมูลผู้เกษียณอายุ คำนวณเบี้ยหวัดบำเหน็จบำนาญ และค่าตอบแทนพิเศษข้าราชการ กทม. เพื่อแก้ปัญหาการอนุมัติและจ่ายเงินบำนาญล่าช้า',
      en: 'Development of retiree pension benefits calculations system for BMA to automate monthly retirement allocations and prevent approval bottlenecks.',
    },
    scope: {
      th: [
        'พัฒนาระบบยื่นคำขอรับบำเหน็จบำนาญออนไลน์ผ่านหน้าเว็บไซต์ข้าราชการ กทม.',
        'เขียนซอฟต์แวร์คำนวณเบี้ยหวัด บำเหน็จบำนาญ และเงินเบิกจ่ายช่วยพิเศษอัตโนมัติ',
        'เชื่อมต่อข้อมูลประวัติบุคลากรข้ามระบบ HR Database ของ กทม.',
        'จัดทำระบบรายงานทางการเงินเพื่อส่งให้ผู้ตรวจสอบบัญชีตรวจสอบรายปี',
      ],
      en: [
        'Develop online portal allowing retired staff to file pension paperwork electronically',
        'Implement automated calculators processing pension variables and tax withholdings',
        'Interface with BMA centralized HR Database to fetch salary histories',
        'Generate audit-compliant financial reports for external auditors review',
      ],
    },
    qualifications: {
      th: [
        'จดทะเบียนนิติบุคคลไม่ต่ำกว่า 3 ปี มีทุนจดทะเบียนไม่น้อยกว่า 2,000,000 บาท',
        'มีผลงานพัฒนาระบบบัญชีการคลัง หรือระบบการจ่ายผลประโยชน์ทางการเงินให้กับส่วนราชการ มูลค่าสัญญาเดียวไม่น้อยกว่า 3,000,000 บาท',
      ],
      en: [
        'Incorporated for at least 3 years with capital of at least 2,000,000 THB',
        'Must possess completed financial accounting or benefits payroll system contract worth at least 3,000,000 THB',
      ],
    },
    historicalAvg: 11500000,
    sourceDocument: 'BMA_Pension_Finance_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
  {
    externalId: 10,
    title: {
      th: 'โครงการจ้างเหมาพัฒนาระบบศูนย์ควบคุมสัญญาณไฟจราจรอัจฉริยะ (Smart Traffic Control System)',
      en: 'BMA Smart Traffic Light Control System Software Project',
    },
    department: INITIAL_DEPARTMENTS[8],
    budget: 42000000,
    publishDate: '2026-08-06',
    deadline: '2026-08-30',
    category: 'AI',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการจ้างเหมาติดตั้งระบบควบคุมวิเคราะห์สัญญาณไฟจราจรอัจฉริยะ (Adaptive Traffic Control) โดยใช้เทคโนโลยี AI วิเคราะห์ความหนาแน่นของรถยนต์ผ่านกล้อง เพื่อควบคุมสัญญาณไฟจราจรลดปัญหารถติดสะสม',
      en: 'Implement adaptive traffic light control software utilizing computer vision AI to measure vehicle queues and adjust green light cycles in real time.',
    },
    scope: {
      th: [
        'พัฒนา AI ซอฟต์แวร์ประมวลผลวิดีโอจากกล้องจราจร ณ ทางแยก 20 ทางแยกหลัก',
        'พัฒนาโมดูลคำนวณและปรับเปลี่ยนรอบสัญญาณไฟจราจรอัตโนมัติ (Green Time Optimization)',
        'พัฒนาระบบแจ้งเตือนภัยกรณีตรวจพบคอขวดหรืออุบัติเหตุกีดขวางทางจราจร',
        'ออกแบบแดชบอร์ดติดตามสถานะการจราจรแบบสด แผนที่ GIS สำหรับเจ้าหน้าที่ สจส.',
      ],
      en: [
        'Develop computer vision algorithms processing traffic camera streams across 20 junctions',
        'Program real-time adaptive green time optimization cycles based on queue lengths',
        'Establish automated notification alert for accidents and blockages',
        'Design real-time traffic GIS monitoring map dashboard for transport control centers',
      ],
    },
    qualifications: {
      th: [
        'เป็นนิติบุคคลจดทะเบียนในประเทศไทย มีทุนจดทะเบียนไม่น้อยกว่า 10,000,000 บาท',
        'มีผลงานพัฒนาหรือติดตั้งระบบประมวลผลคอมพิวเตอร์สำหรับการควบคุมจราจรทางบกให้กับรัฐ มูลค่าไม่น้อยกว่า 15,000,000 บาท ภายใน 5 ปี',
        'ทีมงานวิจัยต้องมี Data Scientist หรือ AI Specialist ที่มีประสบการณ์การทำงานระบบ Computer Vision',
      ],
      en: [
        'Must be legal entity registered in Thailand with capital of at least 10,000,000 THB',
        'Must possess completed computer systems for road traffic control contract worth at least 15,000,000 THB within 5 years',
        'Core development team must include AI/Computer Vision specialists',
      ],
    },
    historicalAvg: 38000000,
    sourceDocument: 'BMA_SmartTraffic_Control_TOR.pdf',
    processedDate: '2026-08-11',
    aiConfidence: 'High',
  },
];

export const INITIAL_PROJECTS: Project[] = RAW_PROJECTS.map(enrichProjectDetail);

export const INITIAL_HISTORICAL: HistoricalProject[] = [
  {
    title: {
      th: 'โครงการพัฒนาระบบบริหารจัดการกล้อง CCTV สำนักการจราจร กทม.',
      en: 'BMA CCTV Management Database System Project',
    },
    department: INITIAL_DEPARTMENTS[8],
    year: 2025,
    category: 'Database',
    budget: 34000000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท ดิจิทัล ทรานสปอร์ต ซิสเต็มส์ จำกัด', en: 'Digital Transport Systems Co., Ltd.' },
    description: {
      th: 'พัฒนาระบบฐานข้อมูลรวมศูนย์เชื่อมต่อกล้องโทรทัศน์วงจรปิด (CCTV) ทั่วกรุงเทพมหานครกว่า 15,000 จุด พร้อมระบบสตรีมมิงและจัดเก็บวิดีโอ',
      en: 'Centralized CCTV database connecting over 15,000 traffic cameras across Bangkok with video streaming and retention subsystems.',
    },
    scope: {
      th: [
        'ออกแบบสถาปัตยกรรมฐานข้อมูลแบบกระจายศูนย์ (Distributed Database Architecture)',
        'พัฒนาระบบ Video Management System (VMS) รองรับการเชื่อมต่อกล้อง IP Cameras',
        'สร้าง API Gateway ให้บริการข้อมูลภาพสตรีมมิ่งความหน่วงต่ำแก่หน่วยงานภาครัฐ',
        'ติดตั้งระบบสำรองข้อมูลอัตโนมัติบน Cloud Storage แบบ High Availability',
      ],
      en: [
        'Design distributed database architecture for high-throughput video streams',
        'Develop Video Management System (VMS) interfacing with 15,000+ IP cameras',
        'Build low-latency API Gateway streaming feeds to government incident centers',
        'Implement automated high-availability cloud backup storage solutions',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาเว็บไซต์และสื่อข้อมูลประวัติศาสตร์แหล่งท่องเที่ยวกรุงเทพฯ',
      en: 'BMA Historical Tourism Web Portal Project',
    },
    department: INITIAL_DEPARTMENTS[3],
    year: 2025,
    category: 'Website',
    budget: 4500000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท สยาม มีเดีย ครีเอทีฟ จำกัด', en: 'Siam Media Creative Co., Ltd.' },
    description: {
      th: 'พัฒนาเว็บพอร์ทัลรวบรวมมรดกทางวัฒนธรรม แผนที่ท่องเที่ยวเชิงประวัติศาสตร์ และระบบจองตั๋วพิพิธภัณฑ์ กทม. รองรับ 5 ภาษา',
      en: 'Develop multilingual cultural tourism web portal featuring interactive historic maps and museum ticketing for Bangkok city.',
    },
    scope: {
      th: [
        'พัฒนา Responsive Web Application รองรับอุปกรณ์มือถือและแท็บเล็ต',
        'ออกแบบระบบแผนที่อินเตอร์แอคทีฟแสดงตำแหน่งโบราณสถานและจุดท่องเที่ยว',
        'พัฒนาระบบบริหารจัดการเนื้อหา (CMS) รองรับ 5 ภาษา (ไทย อังกฤษ จีน ญี่ปุ่น ฝรั่งเศส)',
        'เชื่อมต่อระบบบัตรดิจิทัล e-Ticket เข้าชมพิพิธภัณฑ์และแหล่งเรียนรู้ กทม.',
      ],
      en: [
        'Develop responsive web application optimized for mobile and desktop views',
        'Design interactive historic heritage maps showing landmarks and walking routes',
        'Build CMS supporting 5 international languages (TH, EN, ZH, JA, FR)',
        'Integrate digital e-Ticket system for BMA cultural centers and museums',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาระบบโปรแกรมสารสนเทศงานบำเหน็จบำนาญข้าราชการ กทม. ระยะที่ 1',
      en: 'BMA Retiree Benefits Information System Phase I',
    },
    department: INITIAL_DEPARTMENTS[7],
    year: 2024,
    category: 'Website',
    budget: 7800000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท กสทช. ซอฟต์แวร์ โซลูชั่น จำกัด', en: 'KST Software Solutions Co., Ltd.' },
    description: {
      th: 'ระบบคำนวณและประมวลผลการจ่ายเบี้ยหวัด บำเหน็จ บำนาญ และค่ารักษาพยาบาลข้าราชการ กทม. ที่เกษียณอายุ',
      en: 'Retirement benefits calculation and payroll workflow software for retired BMA civil servants.',
    },
    scope: {
      th: [
        'พัฒนาระบบคำนวณเงินบำเหน็จบำนาญอัตโนมัติตามระเบียบกรุงเทพมหานคร',
        'สร้างโมดูลยื่นขอรับเงินสงเคราะห์และสวัสดิการค่ารักษาพยาบาลออนไลน์',
        'เชื่อมต่อระบบ Payroll ธนาคารกรุงไทยสำหรับโอนจ่ายเงินอัตโนมัติ',
        'จัดทำระบบ Audit Trail ตรวจสอบความถูกต้องและป้องกันการจ่ายเงินซ้ำซ้อน',
      ],
      en: [
        'Implement automated pension calculator obeying BMA civil service regulations',
        'Create self-service portal for retiree medical reimbursement filings',
        'Interface with Krungthai Bank payroll API for automated monthly disbursements',
        'Implement comprehensive audit logging and fraud prevention safeguards',
      ],
    },
  },
  {
    title: {
      th: 'โครงการจ้างพัฒนาแอปพลิเคชันรายงานข้อมูลการจราจรติดขัด กทม. แบบเรียลไทม์',
      en: 'BMA Live Traffic Conditions Mobile App',
    },
    department: INITIAL_DEPARTMENTS[8],
    year: 2024,
    category: 'Mobile App',
    budget: 8500000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท สมาร์ทโมบิลิตี้ กรุ๊ป จำกัด', en: 'Smart Mobility Group Co., Ltd.' },
    description: {
      th: 'แอปพลิเคชันสมาร์ทโฟนสำหรับประชาชนตรวจสอบสภาพการจราจร อุบัติเหตุ และภาพสดจากกล้อง CCTV ทั่วเมืองหลวง',
      en: 'Public mobile app displaying real-time traffic congestion, road incident alerts, and live CCTV feeds across Bangkok.',
    },
    scope: {
      th: [
        'พัฒนา Native Mobile App บนแพลตฟอร์ม iOS และ Android',
        'พัฒนาระบบประมวลผลข้อมูลจราจรแบบสดจากเซ็นเซอร์ตรวจวัดความเร็วและกล้องจราจร',
        'ออกแบบระบบแจ้งเตือนแบบ Push Notifications เมื่อมีอุบัติเหตุหรือปิดเส้นทาง',
        'เชื่อมต่อระบบแผนที่นำทางแบบ Dynamic Route Re-routing',
      ],
      en: [
        'Develop native iOS and Android mobile apps with modern ergonomic UI',
        'Process live speed sensor telemetry and junction camera traffic feeds',
        'Implement push notification engine broadcasting road hazard alerts',
        'Integrate dynamic detour suggestion engine based on live speed indices',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาระบบปัญญาประดิษฐ์วิเคราะห์ภาพกล้องวงจรปิดเพื่อตรวจจับระดับน้ำท่วมขัง',
      en: 'AI CCTV Image Flood Level Detection Project',
    },
    department: INITIAL_DEPARTMENTS[0],
    year: 2025,
    category: 'AI',
    budget: 18200000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท ปัญญาประดิษฐ์สยาม จำกัด', en: 'Siam Artificial Intelligence Co., Ltd.' },
    description: {
      th: 'พัฒนาระบบ Computer Vision วิเคราะห์ภาพจากกล้อง CCTV ริมถนนและคลอง เพื่อประเมินระดับน้ำท่วมขังและแจ้งเตือนสถานการณ์น้ำท่วมอัตโนมัติ',
      en: 'Computer Vision AI model analyzing urban roadside CCTV footage to measure water accumulation depths and trigger flood alerts.',
    },
    scope: {
      th: [
        'ฝึกฝนโมเดล Deep Learning (YOLOv8/Segmentation) สำหรับตรวจวัดระดับผิวน้ำ',
        'พัฒนาระบบประมวลผล Edge Computing ณ ตู้ควบคุมกล้อง 120 จุดเสี่ยง',
        'สร้าง Dashboard แผนที่ GIS แสดงระดับน้ำแบบเรียลไทม์สำหรับศูนย์ควบคุมระบายน้ำ',
        'เชื่อมต่อระบบส่ง SMS/LINE Notify แจ้งเตือนประชาชนและเจ้าหน้าที่ภาคสนาม',
      ],
      en: [
        'Train Deep Learning segmentation models estimating road surface water depths',
        'Deploy edge computing inference boxes across 120 flood-prone intersections',
        'Build GIS dashboard monitoring urban flooding in real time for Drainage Dept',
        'Integrate automated broadcast alert system via LINE Official and SMS gateways',
      ],
    },
  },
  {
    title: {
      th: 'โครงการจ้างพัฒนาระบบสารสนเทศติดตามเรื่องร้องเรียนกทม. (Traffy Fondue Platform)',
      en: 'BMA Traffy Fondue Complaint Tracking Database System',
    },
    department: INITIAL_DEPARTMENTS[0],
    year: 2023,
    category: 'Website',
    budget: 12500000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'สถาบันเทคโนโลยีและนวัตกรรมเมือง จำกัด', en: 'Urban Tech Innovation Co., Ltd.' },
    description: {
      th: 'พัฒนาระบบรับแจ้งปัญหาเส้นเลือดฝอยจากประชาชน จัดหมวดหมู่เรื่องร้องเรียนอัตโนมัติด้วย AI และกระจายงานสู่ 50 เขต',
      en: 'Citizen incident reporting platform categorizing urban issues via AI and dispatching tickets to all 50 Bangkok district offices.',
    },
    scope: {
      th: [
        'พัฒนาระบบจัดการตั๋วปัญหา (Ticketing Management System) รองรับ 50 สำนักงานเขต',
        'พัฒนาระบบ AI NLP จำแนกหมวดหมู่ปัญหาและหน่วยงานผู้รับผิดชอบจากข้อความร้องเรียน',
        'สร้างพอร์ทัลตรวจสอบความคืบหน้าแบบเรียลไทม์สำหรับประชาชน',
        'พัฒนาระบบสรุปผลเชิงสถิติ (Executive Analytics Dashboard) ประเมิน SLA การทำงาน',
      ],
      en: [
        'Develop ticket management system serving all 50 BMA municipal district offices',
        'Implement NLP algorithms automatically classifying citizen reports to agencies',
        'Build public incident tracking portal with before-and-after photo verification',
        'Deliver executive KPI dashboard measuring district resolution SLAs',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาระบบฐานข้อมูลกลางคนเมืองกทม. (BMA Citizen Profile)',
      en: 'BMA Centralized Citizen Profile Database System',
    },
    department: INITIAL_DEPARTMENTS[0],
    year: 2024,
    category: 'Database',
    budget: 22000000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท บิ๊กดาต้า เมโทรโพลิส จำกัด', en: 'Big Data Metropolis Co., Ltd.' },
    description: {
      th: 'พัฒนาระบบจัดเก็บและรวบรวมฐานข้อมูลประชากร ผู้มีสิทธิสวัสดิการ และประวัติการรับบริการภาครัฐแบบ Single Citizen View',
      en: 'Centralized urban citizen profile consolidating demographic, welfare, and municipal service records into a unified Single Citizen View.',
    },
    scope: {
      th: [
        'ออกแบบฐานข้อมูล Data Lakehouse รองรับระเบียนข้อมูลกว่า 10 ล้านรายการ',
        'พัฒนาระบบ Master Data Management (MDM) เพื่อทำ Data Cleansing และ Deduplication',
        'เชื่อมต่อระบบยืนยันตัวตนดิจิทัลผ่าน ThaiD DOPA Gateway ตามมาตรฐาน PDPA',
        'จัดทำระบบ Access Control และ Data Masking ป้องกันการเข้าถึงข้อมูลส่วนบุคคลโดยมิชอบ',
      ],
      en: [
        'Architect high-performance Data Lakehouse indexing over 10 million citizen profiles',
        'Deploy Master Data Management (MDM) pipelines for deduplication and identity resolution',
        'Interface with DOPA ThaiD digital ID gateway adhering strictly to PDPA standards',
        'Implement role-based access control and sensitive data masking mechanisms',
      ],
    },
  },
  {
    title: {
      th: 'โครงการระบบวิเคราะห์ข้อมูลสุขภาพผู้สูงอายุอัจฉริยะ (BMA Smart Health AI Model)',
      en: 'BMA Smart Health AI Analytics Model',
    },
    department: INITIAL_DEPARTMENTS[4],
    year: 2025,
    category: 'AI',
    budget: 9500000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท เมดิคอล เอไอ นวัตกรรม จำกัด', en: 'Medical AI Innovation Co., Ltd.' },
    description: {
      th: 'พัฒนาโมเดล AI คัดกรองความเสี่ยงโรคไม่ติดต่อเรื้อรัง (NCDs) และภาวะสมองเสื่อมในกลุ่มผู้สูงอายุของศูนย์บริการสาธารณสุข กทม.',
      en: 'Predictive health analytics model screening chronic disease risks (NCDs) and dementia indicators for elderly clinic visitors.',
    },
    scope: {
      th: [
        'พัฒนา Predictive ML Model ประเมินความเสี่ยงโรคเบาหวานและความดันโลหิตสูง',
        'สร้างเว็บแอปพลิเคชันสำหรับแพทย์และพยาบาลประจำศูนย์บริการสาธารณสุข 69 แห่ง',
        'พัฒนาระบบส่งต่อข้อมูลประวัติการรักษาไปยังโรงพยาบาลในสังกัดสำนักการแพทย์',
        'ติดตั้งระบบรักษาความปลอดภัยข้อมูลตามมาตรฐาน HL7 FHIR สำหรับเวชระเบียนสุขภาพ',
      ],
      en: [
        'Develop predictive ML algorithms scoring chronic hypertension and diabetes risk',
        'Build clinical web dashboard for medical staff across 69 public health clinics',
        'Establish automated referral records data exchange with BMA hospitals',
        'Implement HL7 FHIR medical data interchange and encryption protocols',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาระบบจัดซื้อจัดจ้างภาครัฐส่วนท้องถิ่น กทม. (e-GP BMA)',
      en: 'BMA Local e-Procurement Portal (e-GP BMA)',
    },
    department: INITIAL_DEPARTMENTS[7],
    year: 2024,
    category: 'Website',
    budget: 15200000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท คลาวด์ กอฟเวิร์นเมนท์ ซิสเต็มส์ จำกัด', en: 'Cloud Government Systems Co., Ltd.' },
    description: {
      th: 'พัฒนาระบบประกาศจัดซื้อจัดจ้าง เผยแพร่ร่าง TOR และรับฟังข้อเสนอแนะจากผู้ค้าภาครัฐ พร้อมระบบจับคู่ผู้ประกอบการ SMEs',
      en: 'Local e-procurement portal publishing tender announcements, draft TOR documents, and public critique channels for BMA.',
    },
    scope: {
      th: [
        'พัฒนาระบบเผยแพร่ประกาศจัดซื้อจัดจ้างและร่าง TOR ตาม พ.ร.บ. จัดซื้อจัดจ้าง 2560',
        'พัฒนาระบบรับฟังคำวิจารณ์และซักถามออนไลน์พร้อมระบบบันทึกเวลาที่ไม่อาจแก้ไขได้',
        'เชื่อมต่อระบบลงทะเบียนผู้ค้าภาครัฐกับกรมบัญชีกลาง',
        'จัดทำระบบรายงานความโปร่งใสและ Open Data สัญญาจัดซื้อจัดจ้างตามมาตรฐาน OCDS',
      ],
      en: [
        'Develop procurement publishing platform compliant with Public Procurement Act',
        'Implement tamper-evident online public feedback and query submission channels',
        'Interface with Comptroller General’s Department vendor credential database',
        'Publish Open Contracting Data Standard (OCDS) machine-readable tender feeds',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาแอปพลิเคชันตรวจสอบสิทธิสุขภาพพนักงาน กทม.',
      en: 'BMA Employees Healthcare Benefits Mobile App',
    },
    department: INITIAL_DEPARTMENTS[5],
    year: 2025,
    category: 'Mobile App',
    budget: 4800000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท เฮลท์แคร์ โซลูชั่นส์ จำกัด', en: 'Healthcare Solutions Co., Ltd.' },
    description: {
      th: 'แอปพลิเคชันมือถือสำหรับข้าราชการและลูกจ้าง กทม. ตรวจสอบสิทธิเบิกจ่ายค่ารักษาพยาบาล จองคิวตรวจสุขภาพ และตรวจสอบผลตรวจแล็บ',
      en: 'Mobile app enabling BMA staff to inspect healthcare subsidies, schedule medical appointments, and view laboratory test results.',
    },
    scope: {
      th: [
        'พัฒนา Mobile App (iOS / Android) รองรับผู้ใช้งานกว่า 80,000 คน',
        'พัฒนาระบบตรวจสอบสิทธิเบิกตรงค่ารักษาพยาบาลโรงพยาบาลในสังกัด กทม. 11 แห่ง',
        'ออกแบบโมดูลนัดหมายตรวจสุขภาพประจำปีและแสดงผลตรวจสุขภาพย้อนหลัง',
        'เชื่อมต่อระบบแจ้งเตือนผลแล็บและคำแนะนำสุขภาพเฉพาะบุคคล',
      ],
      en: [
        'Develop cross-platform iOS and Android mobile app serving 80,000+ staff',
        'Integrate direct medical billing verification across all 11 BMA municipal hospitals',
        'Design annual check-up scheduling module with longitudinal health trends',
        'Deliver push notification engine for personalized doctor recommendations',
      ],
    },
  },
  {
    title: {
      th: 'โครงการจ้างพัฒนาระบบภูมิสารสนเทศด้านสิ่งแวดล้อม กทม. (BMA Environment GIS)',
      en: 'BMA Environmental GIS Map Project',
    },
    department: INITIAL_DEPARTMENTS[2],
    year: 2024,
    category: 'AI',
    budget: 6100000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท จีไอเอส แอนด์ อีโค่เทค จำกัด', en: 'GIS & Ecotech Co., Ltd.' },
    description: {
      th: 'พัฒนาระบบแผนที่ดาวเทียมและ GIS เพื่อตรวจวัดพื้นที่สีเขียว คลื่นความร้อนในเมือง (Urban Heat Island) และจุดเผาไหม้ขยะ',
      en: 'Satellite remote sensing and GIS portal monitoring urban green spaces, heat island indices, and environmental violations.',
    },
    scope: {
      th: [
        'พัฒนาระบบประมวลผลภาพถ่ายดาวเทียม Sentinel-2 คำนวณดัชนีพืชพรรณ (NDVI)',
        'สร้างแผนที่ความร้อน Urban Heat Island ทั่วทั้ง 50 เขตแบบโต้ตอบได้',
        'พัฒนาระบบโมบายสำหรับเจ้าหน้าที่สิ่งแวดล้อมลงพื้นที่สำรวจต้นไม้ใหญ่และสวน 15 นาที',
        'สร้าง Dashboard สรุปความคืบหน้านโยบายปลูกต้นไม้ล้านต้นของกรุงเทพมหานคร',
      ],
      en: [
        'Process Sentinel-2 satellite imagery to compute NDVI vegetation canopy metrics',
        'Construct interactive multi-layer urban heat island heatmaps covering 50 districts',
        'Build mobile field inspector app cataloging municipal trees and public pocket parks',
        'Generate executive progress dashboard tracking million-tree planting initiatives',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาระบบวิเคราะห์ฐานข้อมูลครูโรงเรียนสังกัดกรุงเทพมหานคร',
      en: 'BMA Teachers Personnel Registry Database System',
    },
    department: INITIAL_DEPARTMENTS[1],
    year: 2025,
    category: 'Database',
    budget: 5200000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท เอดูเทค ซอฟต์แวร์ ซิสเต็มส์ จำกัด', en: 'EdTech Software Systems Co., Ltd.' },
    description: {
      th: 'พัฒนาระบบทะเบียนประวัติ จัดสรรอัตรากำลังครู และประเมินวิทยฐานะสำหรับโรงเรียนสังกัด กทม. 437 แห่ง',
      en: 'Human capital registry, staffing allocation, and teaching competency system covering all 437 BMA primary and secondary schools.',
    },
    scope: {
      th: [
        'จัดทำฐานข้อมูลประวัติการสอน วุฒิการศึกษา และใบประกอบวิชาชีพครู 14,000 คน',
        'พัฒนาระบบวิเคราะห์ความต้องการครูตามกลุ่มสาระการเรียนรู้ในแต่ละโรงเรียน',
        'สร้างโมดูลยื่นขอและประเมินวิทยฐานะออนไลน์แบบ Paperless',
        'เชื่อมต่อระบบการโอนย้ายและเกลี่ยอัตรากำลังระหว่างสำนักงานเขต',
      ],
      en: [
        'Index teaching credentials, pedagogical certifications, and service logs for 14,000 educators',
        'Implement staffing gap analytics engine matching curriculum subject demands',
        'Build paperless online evaluation portal for professional rank advancement',
        'Coordinate inter-district school teacher reassignment and staff distribution',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาระบบการศึกษาดิจิทัลและห้องเรียนเสมือนจริงสำหรับนักเรียน กทม.',
      en: 'BMA Digital Classroom and Virtual Learning Platform',
    },
    department: INITIAL_DEPARTMENTS[1],
    year: 2024,
    category: 'Website',
    budget: 11800000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท สมาร์ท คลาสรูม อินโนเวชั่น จำกัด', en: 'Smart Classroom Innovation Co., Ltd.' },
    description: {
      th: 'พัฒนาระบบการเรียนรู้ดิจิทัล คลังข้อสอบกลาง และระบบถ่ายทอดสดห้องเรียนเสมือนจริงสำหรับนักเรียนสังกัด กทม. 250,000 คน',
      en: 'Digital learning management system, centralized question bank, and virtual classroom broadcasting for 250,000 BMA students.',
    },
    scope: {
      th: [
        'พัฒนาระบบ Learning Management System (LMS) รองรับการเข้าใช้งานพร้อมกัน 50,000 ผู้ใช้',
        'สร้างคลังข้อสอบและแบบฝึกหัดมาตรฐานตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน',
        'พัฒนาระบบ Virtual Classroom ถ่ายทอดสดและบันทึกวิดีโอการสอนย้อนหลัง',
        'สร้างระบบติดตามผลการเรียนรู้รายบุคคล (Student Learning Analytics)',
      ],
      en: [
        'Deploy scalable LMS platform supporting 50,000 concurrent student connections',
        'Construct central standardized examination bank aligned with national curriculum',
        'Implement live virtual classroom video broadcasting and on-demand replay modules',
        'Deliver granular student learning analytics dashboards identifying learning gaps',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาแอปพลิเคชันบริการสวัสดิการสังคมและคนพิการ กทม. (BMA Welfare App)',
      en: 'BMA Social Welfare and Disability Support Mobile App',
    },
    department: INITIAL_DEPARTMENTS[6],
    year: 2025,
    category: 'Mobile App',
    budget: 7200000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท แอคเซสซิเบิล เทคโนโลยี จำกัด', en: 'Accessible Technology Co., Ltd.' },
    description: {
      th: 'แอปพลิเคชันอำนวยความสะดวกในการยื่นขอเบี้ยยังชีพ สิทธิ์กายอุปกรณ์ และบริการรถรับส่งผู้สูงอายุและคนพิการของ กทม.',
      en: 'Mobile portal facilitating welfare subsidy disbursement, assistive device requests, and accessible van bookings for disabled citizens.',
    },
    scope: {
      th: [
        'พัฒนา Mobile App ตามมาตรฐานการเข้าถึง WCAG 2.1 Level AAA สำหรับผู้พิการทางสายตา',
        'พัฒนาระบบตรวจสอบยอดเงินเบี้ยยังชีพและการโอนสวัสดิการประจำเดือน',
        'ออกแบบระบบจองคิวรถตู้รับ-ส่งผู้พิการและผู้สูงอายุไปโรงพยาบาล',
        'เชื่อมต่อระบบบริการช่วยเหลือฉุกเฉิน (Emergency Help Button) กับศูนย์สั่งการ กทม.',
      ],
      en: [
        'Build mobile app meeting WCAG 2.1 AAA accessibility for visually impaired citizens',
        'Provide instant monthly welfare payout verification and remittance histories',
        'Create accessible shuttle van booking dispatch system for medical appointments',
        'Establish one-tap emergency SOS broadcast channel to municipal dispatchers',
      ],
    },
  },
  {
    title: {
      th: 'โครงการจัดทำคลังข้อมูลและแพลตฟอร์มวิเคราะห์งบประมาณแบบเปิด กรุงเทพมหานคร (BMA Open Budget)',
      en: 'BMA Open Budget Data Warehouse and Public Transparency Platform',
    },
    department: INITIAL_DEPARTMENTS[7],
    year: 2023,
    category: 'Database',
    budget: 16800000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท โอเพ่นดาต้า โซลูชั่นส์ จำกัด', en: 'Open Data Solutions Co., Ltd.' },
    description: {
      th: 'พัฒนาระบบคลังข้อมูลการจัดทำงบประมาณรายจ่ายประจำปีของกรุงเทพมหานคร เชื่อมโยง 16 สำนัก 50 เขต พร้อมระบบเปิดเผยข้อมูลสาธารณะ',
      en: 'Enterprise data warehouse consolidating annual municipal budget appropriations across all 16 bureaus and 50 district councils with public portal.',
    },
    scope: {
      th: [
        'พัฒนาระบบ Data Warehouse รวบรวมข้อมูลรายการงบประมาณกว่า 20 ปี',
        'จัดทำหน้าเว็บพอร์ทัล BMA Open Budget แสดงสถิติการใช้จ่ายงบประมาณแบบ Interactive',
        'พัฒนา REST API ให้บริการข้อมูล Open Data แก่ประชาชน นักวิจัย และสื่อมวลชน',
        'จัดทำระบบเชื่อมโยงข้อมูลกับระบบ e-LAAS ของกรมส่งเสริมการปกครองท้องถิ่น',
      ],
      en: [
        'Architect enterprise data warehouse indexing 20+ years of municipal budgets',
        'Deliver public-facing interactive BMA Open Budget data visualization explorer',
        'Provide high-throughput REST APIs publishing machine-readable budget datasets',
        'Establish ETL pipelines integrating with national local government financial systems',
      ],
    },
  },
  {
    title: {
      th: 'โครงการพัฒนาระบบปัญญาประดิษฐ์จัดการขยะและคัดแยกวัสดุรีไซเคิลอัตโนมัติ',
      en: 'AI Automated Waste Sorting and Recycling Analytics System',
    },
    department: INITIAL_DEPARTMENTS[2],
    year: 2025,
    category: 'AI',
    budget: 13500000,
    procurementType: 'e-Bidding',
    awardedVendor: { th: 'บริษัท กรีนเทค ปัญญาประดิษฐ์ จำกัด', en: 'GreenTech Artificial Intelligence Co., Ltd.' },
    description: {
      th: 'ติดตั้งระบบ AI Computer Vision วิเคราะห์ชนิดและปริมาณขยะบนสายพานโรงกำจัดขยะ กทม. เพื่อประเมินสัดส่วนขยะรีไซเคิลและลดปริมาณฝังกลบ',
      en: 'Computer vision sorting system classifying waste streams on municipal recycling conveyor belts to boost diversion from landfills.',
    },
    scope: {
      th: [
        'พัฒนาโมเดลจำแนกชนิดขยะพลาสติก โลหะ แก้ว และขยะอินทรีย์ความเร็วสูง',
        'ติดตั้งระบบเซ็นเซอร์และกล้องอุตสาหกรรม ณ โรงกำจัดขยะอ่อนนุชและหนองแขม',
        'พัฒนาระบบคำนวณ Carbon Footprint ที่ลดได้จากการรีไซเคิลแบบเรียลไทม์',
        'จัดทำรายงานสถิติขยะมูลฝอยประจำวันสำหรับสำนักสิ่งแวดล้อม',
      ],
      en: [
        'Train ultra-fast computer vision models identifying plastics, metals, and organics',
        'Deploy industrial imaging hardware at On Nut and Nong Khaem treatment centers',
        'Calculate real-time greenhouse gas carbon offsets achieved through recycling',
        'Automate daily waste categorization analytics for Environment Bureau officers',
      ],
    },
  },
];

