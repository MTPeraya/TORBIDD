#!/usr/bin/env ts-node
// =============================================================================
// scripts/seed.ts - MongoDB Atlas Seed Script
// Run with: npx ts-node --project tsconfig.json scripts/seed.ts
// Or: npm run seed
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import Project from '../src/models/Project';
import HistoricalProject from '../src/models/HistoricalProject';
import Bookmark from '../src/models/Bookmark';
import UserSettings from '../src/models/UserSettings';
import User from '../src/models/User';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'torbidd';

// ─── Departments ─────────────────────────────────────────────────────────────

const DEPARTMENTS = [
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

// ─── Projects (from Demo/app.js PROJECTS array) ──────────────────────────────

const PROJECTS_SEED = [
  {
    externalId: 1,
    title: { th: 'โครงการพัฒนาระบบรวมศูนย์การให้บริการประชาชน (BMA e-Service Smart Portal)', en: 'BMA e-Service Smart Portal Centralized System Development Project' },
    department: DEPARTMENTS[0],
    budget: 53131650,
    publishDate: new Date('2026-08-01'),
    deadline: new Date('2026-08-25'),
    category: 'Website',
    procurementType: 'e-Bidding',
    description: { th: 'โครงการพัฒนาระบบรวมศูนย์พอร์ทัลการให้บริการประชาชนแบบครบวงจร เพื่อรองรับและบูรณาการงานบริการออนไลน์ของ 50 สำนักงานเขต โดยครอบคลุมระบบลงทะเบียนสมาชิกเดี่ยว (Single Sign-On) และระบบชำระเงินค่าธรรมเนียมออนไลน์ของกรุงเทพมหานคร', en: 'Development of BMA e-Service Smart Portal as a centralized portal integrating online citizen services across 50 districts. Includes BMA Single Sign-On and e-payment systems.' },
    scope: { th: ['ออกแบบและพัฒนาระบบ BMA e-Service Portal สำหรับประชาชน', 'พัฒนาระบบยืนยันตัวตนรวมศูนย์ BMA Single Sign-On รองรับการจดจำผู้ใช้ผ่าน ThaID', 'พัฒนาระบบชำระค่าธรรมเนียมและค่าภาษีท้องถิ่นผ่าน QR Code/บัตรเครดิต', 'เชื่อมโยง API และฐานข้อมูลกับระบบบริการเดิมของ กทม. 25 ระบบ', 'จัดทำระบบ Dashboard สรุปสถิติผู้เข้าใช้บริการสำหรับผู้บริหารแบบ Real-time'], en: ['Design and develop the citizen-facing BMA e-Service Portal', 'Develop centralized BMA Single Sign-On integrated with national ThaID system', 'Develop local tax and fee payment systems supporting QR code and credit cards', 'Integrate APIs and databases with 25 existing BMA service systems', 'Develop real-time executive dashboard summarizing service usage statistics'] },
    qualifications: { th: ['เป็นนิติบุคคลจดทะเบียนในประเทศไทย มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 10,000,000 บาท', 'มีผลงานประเภทพัฒนาระบบสารสนเทศระดับองค์กร (Enterprise Portal) หรือ e-Government มูลค่าสัญญาเดียวไม่น้อยกว่า 15,000,000 บาท ภายใน 5 ปีย้อนหลัง', 'ต้องได้รับใบรับรองมาตรฐาน ISO 27001 หรือ CMMI Level 3 ขึ้นไปด้านการพัฒนาซอฟต์แวร์', 'มีบุคลากรประจำทีมที่ผ่านการอบรมหรือมีใบรับรองมาตรฐานการเขียนโปรแกรมความมั่นคงปลอดภัย'], en: ['Legal entity registered in Thailand with paid-up capital of at least 10,000,000 THB', 'Must have completed enterprise portal or e-Government systems development worth at least 15,000,000 THB in a single contract within the past 5 years', 'Must possess ISO 27001 or CMMI Level 3 or higher certification in software development', 'Development team must include certified secure programming professionals'] },
    historicalAvg: 48000000, sourceDocument: 'BMA_eService_SmartPortal_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
  {
    externalId: 2,
    title: { th: 'โครงการจ้างเหมาพัฒนาระบบศูนย์สื่อการเรียนรู้ออนไลน์ (BMA Learning Hub)', en: 'BMA Learning Hub Online Classroom System Project' },
    department: DEPARTMENTS[1],
    budget: 14993300, publishDate: new Date('2026-08-05'), deadline: new Date('2026-08-28'), category: 'Website', procurementType: 'e-Bidding',
    description: { th: 'พัฒนาซอฟต์แวร์และคอร์สแวร์บริหารจัดการการเรียนรู้ออนไลน์ (LMS) สำหรับคุณครู นักเรียน และบุคลากรทางการศึกษาของโรงเรียนในสังกัดกรุงเทพมหานคร', en: 'Develop an online Learning Management System (LMS) and courseware portal for teachers, students, and educational staff under BMA public schools.' },
    scope: { th: ['พัฒนาระบบจัดการบทเรียน แผนการเรียนรู้ และห้องเรียนเสมือนจริง (Virtual Classroom)', 'พัฒนาคลังเก็บสื่อวิดีโอ เอกสารประกอบการสอน และระบบสอบวัดผลคะแนนออนไลน์', 'ออกแบบระบบประเมินวิทยฐานะของครูผู้สอนผ่านผลสัมฤทธิ์ทางการศึกษา', 'จัดให้มีระบบส่งข้อความแจ้งเตือนความคืบหน้าการเรียนไปยังกลุ่มผู้ปกครอง'], en: ['Develop curriculum manager, learning tracks, and virtual classroom facilities', 'Create media storage for educational videos, handouts, and online quiz managers', 'Design teacher evaluation modules based on student education performance targets', 'Establish automated push notifications tracking student progress for parents'] },
    qualifications: { th: ['จดทะเบียนจัดตั้งประเภทนิติบุคคล มีทุนจดทะเบียนไม่น้อยกว่า 3,000,000 บาท', 'มีผลงานจ้างพัฒนาระบบบริหารจัดการเรียนรู้ (LMS) หรือแพลตฟอร์มการศึกษาอิเล็กทรอนิกส์ให้กับสถาบันการศึกษาหรือรัฐ มูลค่าไม่น้อยกว่า 4,000,000 บาท'], en: ['Registered corporate entity with capital of at least 3,000,000 THB', 'Must have successfully deployed LMS or e-learning platforms for schools or government agencies worth at least 4,000,000 THB'] },
    historicalAvg: 16500000, sourceDocument: 'BMA_LearningHub_Education_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
  {
    externalId: 3,
    title: { th: 'โครงการพัฒนาระบบแอปพลิเคชันบริการประชาชน กทม. บนมือถือ (BMA Smart Service Mobile App)', en: 'BMA Smart Service Citizen Mobile Application Project' },
    department: DEPARTMENTS[0],
    budget: 28500000, publishDate: new Date('2026-08-03'), deadline: new Date('2026-08-27'), category: 'Mobile App', procurementType: 'e-Bidding',
    description: { th: 'โครงการจ้างออกแบบและพัฒนาแอปพลิเคชันบนอุปกรณ์สื่อสารเคลื่อนที่ (iOS และ Android) รวบรวมบริการสาธารณะ ภาษีที่ดิน ระบบจองคิวนัดหมายสำนักงานเขต และผสานงานระบบร้องเรียน Traffy Fondue เข้าไว้เป็นหนึ่งเดียว', en: 'Design and develop the BMA Smart Service mobile application on iOS and Android to aggregate public tax payments, local district booking queues, and Traffy Fondue complaints.' },
    scope: { th: ['ออกแบบ UI/UX แอปพลิเคชันตามแนวทางแบรนด์ กทม. รองรับทั้ง iOS และ Android', 'พัฒนาโมดูลชำระภาษีที่ดินและสิ่งปลูกสร้าง พร้อมระบบเรียกดูประวัติใบเสร็จย้อนหลัง', 'ผสานการทำงานเชื่อมต่อ API กับ Traffy Fondue เพื่อแสดงสถานะร้องเรียนแบบเรียลไทม์', 'พัฒนาระบบจองคิวออนไลน์เพื่อขอรับบริการงานทะเบียนราษฎร ณ ที่ทำการเขต 50 เขต'], en: ['Design mobile UI/UX in compliance with BMA branding guidelines for iOS and Android', 'Develop real estate and local tax invoice payment features with payment history', 'Integrate Traffy Fondue API to present real-time report feedback and tracking', 'Develop online queue booking for civil registration services at all 50 district offices'] },
    qualifications: { th: ['เป็นผู้มีอาชีพรับจ้างงานคอมพิวเตอร์และซอฟต์แวร์โดยตรง', 'มีสัญญาผลงานพัฒนาแอปพลิเคชันบนมือถือที่เผยแพร่บน App Store และ Google Play Store ที่มีผู้ลงทะเบียนใช้งานมากกว่า 50,000 บัญชี', 'มูลค่าสัญญาพัฒนาแอปพลิเคชันระบบสารสนเทศไม่ต่ำกว่า 10,000,000 บาท ภายในระยะเวลาไม่เกิน 5 ปี'], en: ['Must be actively trading in software and computer development fields', 'Must showcase mobile applications published on App Store/Google Play with at least 50,000 registered users', 'Must have mobile or IT system project contracts worth at least 10,000,000 THB within the past 5 years'] },
    historicalAvg: 25000000, sourceDocument: 'BMA_SmartService_MobileApp_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
  {
    externalId: 4,
    title: { th: 'โครงการจ้างเหมาพัฒนาระบบเทคโนโลยีสารสนเทศห้องสมุดเพื่อการเรียนรู้กรุงเทพมหานคร', en: 'BMA Learning Library Information Technology System Upgrade' },
    department: DEPARTMENTS[3],
    budget: 14502000, publishDate: new Date('2026-07-28'), deadline: new Date('2026-08-18'), category: 'Database', procurementType: 'e-Bidding',
    description: { th: 'จ้างเหมาปรับปรุงระบบฐานข้อมูลและซอฟต์แวร์จัดการห้องสมุดดิจิทัล เชื่อมต่อระบบยืม-คืนอัตโนมัติ ฐานข้อมูลสื่ออิเล็กทรอนิกส์ข้ามเครือข่ายห้องสมุดเพื่อการเรียนรู้ กทม. จำนวน 36 แห่ง', en: 'Upgrade database system and library management software to link automated check-in/out and digital books across 36 BMA Learning Library locations.' },
    scope: { th: ['ปรับปรุงระบบบริการยืม-คืนหนังสือและจองคิวใช้งานคอมพิวเตอร์ออนไลน์', 'พัฒนาระบบค้นหารายการหนังสือรวมศูนย์ (OPAC) เชื่อมโยงทุกสาขาห้องสมุด', 'บูรณาการระบบจัดการคลังเก็บสื่อสิ่งพิมพ์และ e-Book ลิขสิทธิ์เฉพาะ กทม.', 'ติดตั้ง API เชื่อมต่อกับระบบยืนยันตัวตน BMA Single Sign-On'], en: ['Upgrade check-in/check-out services and online research desk reservations', 'Develop unified book search (OPAC) indexing library collections across branches', 'Integrate media assets manager hosting publications and BMA-owned e-Books', 'Deploy authentication API interfacing with BMA Single Sign-On database'] },
    qualifications: { th: ['มีผลงานการพัฒนาระบบสารสนเทศห้องสมุดหรือระบบ OPAC ให้ส่วนราชการหรือสถาบันการศึกษา มูลค่าสัญญาเดียวไม่ต่ำกว่า 4,000,000 บาท', 'ผ่านการรับรองระบบคุณภาพในการพัฒนาซอฟต์แวร์ตามมาตรฐานของรัฐ'], en: ['Must possess completed library management system or OPAC portal contract worth at least 4,000,000 THB', 'Must comply with software quality frameworks recognized by public bodies'] },
    historicalAvg: 12000000, sourceDocument: 'BMA_LearningLibrary_IT_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
  {
    externalId: 5,
    title: { th: 'โครงการพัฒนาระบบสารสนเทศภูมิศาสตร์เพื่อการบริหารจัดการสารเคมี (BMA Chemical GIS System)', en: 'BMA Hazardous Chemical GIS System Development Project' },
    department: DEPARTMENTS[4],
    budget: 8200000, publishDate: new Date('2026-08-09'), deadline: new Date('2026-09-02'), category: 'AI', procurementType: 'e-Bidding',
    description: { th: 'พัฒนาระบบสารสนเทศภูมิศาสตร์ (GIS) สำหรับพล็อตและวิเคราะห์จุดพิกัดการจัดเก็บสารเคมีและวัตถุอันตรายภายในโรงงานและสถานประกอบการ เพื่อการระงับเหตุและประเมินภัยพิบัติเชิงรุก', en: 'Develop a Geographic Information System (GIS) mapping chemical storage sites in commercial zones to facilitate active hazard containment and disaster response.' },
    scope: { th: ['ออกแบบระบบแผนที่สารสนเทศภูมิศาสตร์ (GIS) บนเว็บบราวเซอร์หลัก', 'พัฒนาระบบวิเคราะห์ประเมินทิศทางแก๊สรั่วและเขตรัศมีอพยพกรณีฉุกเฉิน (Plume Modeling AI)', 'สร้างฐานข้อมูลรายการสารเคมีและวัตถุอันตรายครอบคลุมสถานประกอบการ 3,000 แห่ง', 'พัฒนาระบบ Dashboard รายงานสถิติปริมาณสารเคมีควบคุมสำหรับกองอนามัยสิ่งแวดล้อม'], en: ['Design web-based Geographic Information System (GIS) application', 'Develop emergency chemical plume simulation modeling AI determining evacuation radii', 'Create chemical substance inventory database covering 3,000 local manufacturing sites', 'Build executive dashboard reporting toxic substances stats for Environment Health Division'] },
    qualifications: { th: ['มีผลงานพัฒนาระบบเทคโนโลยีสารสนเทศภูมิศาสตร์ (GIS) หรือโปรแกรมประยุกต์ด้านการวางแผนป้องกันภัย มูลค่าสัญญาเดียวไม่ต่ำกว่า 2,500,000 บาท', 'ผู้เสนอราคาต้องมีบุคลากรตำแหน่งนักวิเคราะห์ระบบจีไอเอสประจำโครงการ'], en: ['Must have completed GIS software development or disaster prevention application worth at least 2,500,000 THB in a single contract', 'Must allocate dedicated GIS Analyst personnel on team rosters'] },
    historicalAvg: 7500000, sourceDocument: 'BMA_Health_Chemical_GIS_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
  {
    externalId: 6,
    title: { th: 'โครงการพัฒนาระบบโปรแกรมติดตามและตรวจสอบเวชระเบียนโรงพยาบาลในสังกัด กทม.', en: 'BMA Hospitals Medical Records Tracking and Verification System' },
    department: DEPARTMENTS[5],
    budget: 18500000, publishDate: new Date('2026-08-10'), deadline: new Date('2026-09-12'), category: 'Database', procurementType: 'e-Bidding',
    description: { th: 'จัดหาและพัฒนาซอฟต์แวร์สำหรับตรวจสอบความสมบูรณ์ของเวชระเบียนผู้ป่วยนอกและผู้ป่วยใน เพื่อรองรับการเบิกจ่ายค่ารักษาพยาบาลจากกองทุนหลักประกันสุขภาพได้อย่างถูกต้องรวดเร็ว', en: 'Procure and develop clinical software validating inpatient/outpatient electronic medical records (EMR) for healthcare reimbursement.' },
    scope: { th: ['พัฒนาระบบวิเคราะห์ความถูกต้องของการลงรหัสโรค (ICD-10/ICD-9-CM) บนเวชระเบียนอิเล็กทรอนิกส์', 'พัฒนาโปรแกรมดึงข้อมูลเวชระเบียนและแปลงเป็นโครงสร้างแฟ้มข้อมูลมาตรฐานกระทรวงสาธารณสุข', 'จัดทำระบบแจ้งเตือนกรณีตรวจพบรหัสโรคขัดแย้งกับบันทึกการรักษาพยาบาล', 'เชื่อมต่อฐานข้อมูลร่วมกับระบบ HIS ของโรงพยาบาล กทม. 11 แห่ง'], en: ['Develop clinical validation rules checking diagnosis codes (ICD-10/ICD-9-CM) in EMRs', 'Build extractors transforming records to ministry-compliant health reporting standard files', 'Deploy alerting modules flagging inconsistencies between code assignments and progress notes', 'Establish direct integrations with HIS platforms across 11 BMA public hospitals'] },
    qualifications: { th: ['มีผลงานจ้างเหมาพัฒนาระบบเทคโนโลยีสารสนเทศให้กับโรงพยาบาลรัฐหรือเอกชน มูลค่าไม่น้อยกว่า 5,000,000 บาท', 'มีบุคลากรที่มีความเชี่ยวชาญด้านเวชสถิติหรือมีใบรับรองการลงรหัสโรคสากลประจำทีมพัฒนา'], en: ['Must possess completed health IT systems contracts with state or private hospitals worth at least 5,000,000 THB', 'Must assign medical coders or health information specialists to the software team'] },
    historicalAvg: 20000000, sourceDocument: 'BMA_MedicalRecord_Verify_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
  {
    externalId: 7,
    title: { th: 'โครงการพัฒนาระบบข้อมูลการจัดการคุณภาพอากาศกรุงเทพมหานคร', en: 'BMA Air Quality Management Information System Project' },
    department: DEPARTMENTS[2],
    budget: 6800000, publishDate: new Date('2026-08-04'), deadline: new Date('2026-08-25'), category: 'Database', procurementType: 'e-Bidding',
    description: { th: 'ปรับปรุงฐานข้อมูลดัชนีคุณภาพอากาศ (Air Quality Index) พัฒนาระบบรวบรวมข้อมูลฝุ่นละออง PM2.5 ข้อมูลสภาพอากาศจากเซ็นเซอร์ 70 จุดของสำนักสิ่งแวดล้อม', en: 'Upgrade BMA Air Quality Index database and system collecting real-time PM2.5 and meteorological sensor data from 70 environmental stations.' },
    scope: { th: ['ปรับปรุง API ดึงข้อมูลมลพิษทางอากาศ PM2.5, PM10, O3, CO จากสถานีตรวจวัดแบบ Real-time', 'พัฒนาโมดูลคำนวณดัชนีคุณภาพอากาศ (AQI) และพยากรณ์ปริมาณฝุ่นละอองล่วงหน้า 3 วัน', 'ปรับปรุงความเสถียรของระบบส่งแจ้งเตือนคุณภาพอากาศผ่าน LINE Official Account', 'จัดทำระบบสำรองข้อมูลและจัดการ API เพื่อให้หน่วยงานภายนอกนำข้อมูลไปพัฒนาต่อได้'], en: ['Update API fetching real-time PM2.5, PM10, O3, and CO sensor readings', 'Develop module calculating AQI and generating 3-day particulate forecast alerts', 'Improve performance of air quality broadcast notifications via LINE Official Account', 'Design data backup and developer API catalog supporting external data consumption'] },
    qualifications: { th: ['มีทุนจดทะเบียนไม่น้อยกว่า 1,500,000 บาท', 'มีผลงานพัฒนาระบบฐานข้อมูลเชิงสัมพัทธ์ หรือระบบเชื่อมโยง API มูลค่าสัญญาเดี่ยวไม่ต่ำกว่า 1,500,000 บาท'], en: ['Paid-up capital must be at least 1,500,000 THB', 'Must have completed relational database or API integration contract worth at least 1,500,000 THB'] },
    historicalAvg: 5500000, sourceDocument: 'BMA_AirQuality_Management_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
  {
    externalId: 8,
    title: { th: 'โครงการพัฒนาแอปพลิเคชันศูนย์บริการคนพิการและผู้สูงอายุ กทม. (BMA Welfare Companion Mobile App)', en: 'BMA Welfare Companion Mobile Application Project' },
    department: DEPARTMENTS[6],
    budget: 11200000, publishDate: new Date('2026-08-02'), deadline: new Date('2026-08-22'), category: 'Mobile App', procurementType: 'e-Bidding',
    description: { th: 'โครงการพัฒนาโปรแกรมประยุกต์บนสมาร์ทโฟนสำหรับอำนวยความสะดวกในการเข้าถึงข้อมูลเบี้ยยังชีพคนพิการและผู้สูงอายุ พร้อมฟีเจอร์แจ้งเตือนฉุกเฉิน (SOS) ส่งพิกัดตำแหน่งช่วยเหลือ', en: 'Develop a mobile smartphone application facilitating access to BMA welfare payouts and emergency SOS geo-location tracking for senior citizens and disabled persons.' },
    scope: { th: ['พัฒนา Mobile Application (iOS/Android) ที่เน้นการออกแบบสำหรับผู้สูงอายุ (Accessibility UX)', 'พัฒนาระบบตรวจสอบยอดเงินเบี้ยยังชีพและประวัติการรับเงินโอนสวัสดิการสังคม', 'ออกแบบระบบช่วยเหลือฉุกเฉิน (SOS Button) ส่งพิกัดจีพีเอสเข้าศูนย์ควบคุมสวัสดิการสังคม กทม.', 'ติดตั้งระบบลงทะเบียนขอสิทธิ์กายอุปกรณ์ช่วยเหลือคนพิการออนไลน์'], en: ['Develop smartphone app focusing on accessible UX principles for seniors and disabled users', 'Develop payout ledger view showing monthly allowance distribution history', 'Design SOS emergency button broadcasting GPS location to BMA command centers', 'Establish online request forms for government-funded mobility aids and devices'] },
    qualifications: { th: ['มีผลงานพัฒนาแอปพลิเคชันมือถือระบบบริการภาครัฐหรือสังคม มูลค่าสัญญารวมกันไม่น้อยกว่า 3,000,000 บาท', 'ซอฟต์แวร์ต้องผ่านเกณฑ์ประเมินการออกแบบที่เป็นมิตรตามมาตรฐาน Web Content Accessibility Guidelines (WCAG) ระดับ AA'], en: ['Must have completed mobile apps delivering government or public services totaling at least 3,000,000 THB', 'Software design must comply with WCAG 2.1 Level AA accessibility regulations'] },
    historicalAvg: 10000000, sourceDocument: 'BMA_Welfare_Companion_Mobile_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
  {
    externalId: 9,
    title: { th: 'โครงการจ้างพัฒนาระบบสารสนเทศสำหรับกองบำเหน็จบำนาญข้าราชการกรุงเทพมหานคร', en: 'BMA Pension and Retirement Benefits Management System Project' },
    department: DEPARTMENTS[7],
    budget: 9800000, publishDate: new Date('2026-07-22'), deadline: new Date('2026-08-14'), category: 'Website', procurementType: 'e-Bidding',
    description: { th: 'โครงการจัดหาและพัฒนาระบบสารสนเทศจัดการข้อมูลผู้เกษียณอายุ คำนวณเบี้ยหวัดบำเหน็จบำนาญ และค่าตอบแทนพิเศษข้าราชการ กทม. เพื่อแก้ปัญหาการอนุมัติและจ่ายเงินบำนาญล่าช้า', en: 'Development of retiree pension benefits calculations system for BMA to automate monthly retirement allocations and prevent approval bottlenecks.' },
    scope: { th: ['พัฒนาระบบยื่นคำขอรับบำเหน็จบำนาญออนไลน์ผ่านหน้าเว็บไซต์ข้าราชการ กทม.', 'เขียนซอฟต์แวร์คำนวณเบี้ยหวัด บำเหน็จบำนาญ และเงินเบิกจ่ายช่วยพิเศษอัตโนมัติ', 'เชื่อมต่อข้อมูลประวัติบุคลากรข้ามระบบ HR Database ของ กทม.', 'จัดทำระบบรายงานทางการเงินเพื่อส่งให้ผู้ตรวจสอบบัญชีตรวจสอบรายปี'], en: ['Develop online portal allowing retired staff to file pension paperwork electronically', 'Implement automated calculators processing pension variables and tax withholdings', 'Interface with BMA centralized HR Database to fetch salary histories', 'Generate audit-compliant financial reports for external auditors review'] },
    qualifications: { th: ['จดทะเบียนนิติบุคคลไม่ต่ำกว่า 3 ปี มีทุนจดทะเบียนไม่น้อยกว่า 2,000,000 บาท', 'มีผลงานพัฒนาระบบบัญชีการคลัง หรือระบบการจ่ายผลประโยชน์ทางการเงินให้กับส่วนราชการ มูลค่าสัญญาเดียวไม่น้อยกว่า 3,000,000 บาท'], en: ['Incorporated for at least 3 years with capital of at least 2,000,000 THB', 'Must possess completed financial accounting or benefits payroll system contract worth at least 3,000,000 THB'] },
    historicalAvg: 11500000, sourceDocument: 'BMA_Pension_Finance_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
  {
    externalId: 10,
    title: { th: 'โครงการจ้างเหมาพัฒนาระบบศูนย์ควบคุมสัญญาณไฟจราจรอัจฉริยะ (Smart Traffic Control System)', en: 'BMA Smart Traffic Light Control System Software Project' },
    department: DEPARTMENTS[8],
    budget: 42000000, publishDate: new Date('2026-08-06'), deadline: new Date('2026-08-30'), category: 'AI', procurementType: 'e-Bidding',
    description: { th: 'โครงการจ้างเหมาติดตั้งระบบควบคุมวิเคราะห์สัญญาณไฟจราจรอัจฉริยะ (Adaptive Traffic Control) โดยใช้เทคโนโลยี AI วิเคราะห์ความหนาแน่นของรถยนต์ผ่านกล้อง เพื่อควบคุมสัญญาณไฟจราจรลดปัญหารถติดสะสม', en: 'Implement adaptive traffic light control software utilizing computer vision AI to measure vehicle queues and adjust green light cycles in real time.' },
    scope: { th: ['พัฒนา AI ซอฟต์แวร์ประมวลผลวิดีโอจากกล้องจราจร ณ ทางแยก 20 ทางแยกหลัก', 'พัฒนาโมดูลคำนวณและปรับเปลี่ยนรอบสัญญาณไฟจราจรอัตโนมัติ (Green Time Optimization)', 'พัฒนาระบบแจ้งเตือนภัยกรณีตรวจพบคอขวดหรืออุบัติเหตุกีดขวางทางจราจร', 'ออกแบบแดชบอร์ดติดตามสถานะการจราจรแบบสด แผนที่ GIS สำหรับเจ้าหน้าที่ สจส.'], en: ['Develop computer vision algorithms processing traffic camera streams across 20 junctions', 'Program real-time adaptive green time optimization cycles based on queue lengths', 'Establish automated notification alert for accidents and blockages', 'Design real-time traffic GIS monitoring map dashboard for transport control centers'] },
    qualifications: { th: ['เป็นนิติบุคคลจดทะเบียนในประเทศไทย มีทุนจดทะเบียนไม่น้อยกว่า 10,000,000 บาท', 'มีผลงานพัฒนาหรือติดตั้งระบบประมวลผลคอมพิวเตอร์สำหรับการควบคุมจราจรทางบกให้กับรัฐ มูลค่าไม่น้อยกว่า 15,000,000 บาท ภายใน 5 ปี', 'ทีมงานวิจัยต้องมี Data Scientist หรือ AI Specialist ที่มีประสบการณ์การทำงานระบบ Computer Vision'], en: ['Must be legal entity registered in Thailand with capital of at least 10,000,000 THB', 'Must possess completed computer systems for road traffic control contract worth at least 15,000,000 THB within 5 years', 'Core development team must include AI/Computer Vision specialists'] },
    historicalAvg: 38000000, sourceDocument: 'BMA_SmartTraffic_Control_TOR.pdf', processedDate: new Date('2026-08-11'), aiConfidence: 'High',
  },
];

// ─── Historical Data (from Demo/app.js HISTORICAL_DATA) ─────────────────────

const HISTORICAL_SEED = [
  { title: { th: 'โครงการพัฒนาระบบบริหารจัดการกล้อง CCTV สำนักการจราจร กทม.', en: 'BMA CCTV Management Database System Project' }, department: DEPARTMENTS[8], year: 2025, category: 'Database', budget: 34000000 },
  { title: { th: 'โครงการพัฒนาเว็บไซต์และสื่อข้อมูลประวัติศาสตร์แหล่งท่องเที่ยวกรุงเทพฯ', en: 'BMA Historical Tourism Web Portal Project' }, department: DEPARTMENTS[3], year: 2025, category: 'Website', budget: 4500000 },
  { title: { th: 'โครงการพัฒนาระบบโปรแกรมสารสนเทศงานบำเหน็จบำนาญข้าราชการ กทม. ระยะที่ 1', en: 'BMA Retiree Benefits Information System Phase I' }, department: DEPARTMENTS[7], year: 2024, category: 'Website', budget: 7800000 },
  { title: { th: 'โครงการจ้างพัฒนาแอปพลิเคชันรายงานข้อมูลการจราจรติดขัด กทม. แบบเรียลไทม์', en: 'BMA Live Traffic Conditions Mobile App' }, department: DEPARTMENTS[8], year: 2024, category: 'Mobile App', budget: 8500000 },
  { title: { th: 'โครงการพัฒนาระบบปัญญาประดิษฐ์วิเคราะห์ภาพกล้องวงจรปิดเพื่อตรวจจับระดับน้ำท่วมขัง', en: 'AI CCTV Image Flood Level Detection Project' }, department: DEPARTMENTS[0], year: 2025, category: 'AI', budget: 18200000 },
  { title: { th: 'โครงการจ้างพัฒนาระบบสารสนเทศติดตามเรื่องร้องเรียนกทม. (Traffy Fondue Platform)', en: 'BMA Traffy Fondue Complaint Tracking Database System' }, department: DEPARTMENTS[0], year: 2023, category: 'Website', budget: 12500000 },
  { title: { th: 'โครงการพัฒนาระบบฐานข้อมูลกลางคนเมืองกทม. (BMA Citizen Profile)', en: 'BMA Centralized Citizen Profile Database System' }, department: DEPARTMENTS[0], year: 2024, category: 'Database', budget: 22000000 },
  { title: { th: 'โครงการระบบวิเคราะห์ข้อมูลสุขภาพผู้สูงอายุอัจฉริยะ (BMA Smart Health AI Model)', en: 'BMA Smart Health AI Analytics Model' }, department: DEPARTMENTS[4], year: 2025, category: 'AI', budget: 9500000 },
  { title: { th: 'โครงการพัฒนาระบบจัดซื้อจัดจ้างภาครัฐส่วนท้องถิ่น กทม. (e-GP BMA)', en: 'BMA Local e-Procurement Portal (e-GP BMA)' }, department: DEPARTMENTS[7], year: 2024, category: 'Website', budget: 15200000 },
  { title: { th: 'โครงการพัฒนาแอปพลิเคชันตรวจสอบสิทธิสุขภาพพนักงาน กทม.', en: 'BMA Employees Healthcare Benefits Mobile App' }, department: DEPARTMENTS[5], year: 2025, category: 'Mobile App', budget: 4800000 },
  { title: { th: 'โครงการจ้างพัฒนาระบบภูมิสารสนเทศด้านสิ่งแวดล้อม กทม. (BMA Environment GIS)', en: 'BMA Environmental GIS Map Project' }, department: DEPARTMENTS[2], year: 2024, category: 'AI', budget: 6100000 },
  { title: { th: 'โครงการพัฒนาระบบวิเคราะห์ฐานข้อมูลครูโรงเรียนสังกัดกรุงเทพมหานคร', en: 'BMA Teachers Personnel Registry Database System' }, department: DEPARTMENTS[1], year: 2025, category: 'Database', budget: 5200000 },
];

async function seed() {
  if (!MONGODB_URI) {
    console.error('❌  MONGODB_URI is not set. Add it to .env.local and retry.');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });
  console.log(`✅ Connected to database: ${MONGODB_DB}`);

  // Seed Projects
  console.log('\n📦 Seeding projects...');
  for (const p of PROJECTS_SEED) {
    await Project.findOneAndUpdate({ externalId: p.externalId }, p, { upsert: true, new: true });
    console.log(`   ✓ Project #${p.externalId}: ${p.title.en.substring(0, 60)}...`);
  }

  // Seed Historical Data
  console.log('\n📊 Seeding historical data...');
  await HistoricalProject.deleteMany({});
  await HistoricalProject.insertMany(HISTORICAL_SEED);
  console.log(`   ✓ Inserted ${HISTORICAL_SEED.length} historical records`);

  // Ensure collections & indexes exist for bookmarks, user settings, and users
  console.log('\n📑 Initializing collections and indexes...');
  await Bookmark.createCollection().catch(() => {});
  await Bookmark.syncIndexes().catch(() => {});
  console.log('   ✓ Bookmark collection & indexes initialized');

  await UserSettings.createCollection().catch(() => {});
  await UserSettings.syncIndexes().catch(() => {});
  console.log('   ✓ UserSettings collection & indexes initialized');

  await User.createCollection().catch(() => {});
  await User.syncIndexes().catch(() => {});
  console.log('   ✓ User collection & indexes initialized');

  console.log('\n🎉 Seed complete!');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
