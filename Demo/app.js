// ==========================================================================
// BMA SOFTWARE PROCUREMENT INTELLIGENCE PLATFORM - JAVASCRIPT (WITH DARK MODE)
// ==========================================================================

// ========== ICONS (SVG) ==========
const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  bookmarkFilled: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>',
  arrowLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  trendUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  trendDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
  dollarSign: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  externalLink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  // Theme Toggle Icons
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
};

// ========== TRANSLATIONS (TH/EN) ==========
const LABELS = {
  th: {
    appName: 'BMA Procurement',
    appSub: 'Intelligence Platform',
    navHome: 'หน้าหลัก',
    navDashboard: 'ภาพรวมโอกาส',
    navHistorical: 'วิเคราะห์ราคาย้อนหลัง',
    navSaved: 'รายการที่บันทึก',
    navSettings: 'ตั้งค่าการแจ้งเตือน',
    sectionMain: 'เมนูหลัก',
    sectionTools: 'เครื่องมือ',
    dashboardTitle: 'โอกาสการจัดซื้อจัดจ้างซอฟต์แวร์ กทม.',
    dashboardSub: 'ระบบข้อมูลเชิงลึกการจัดหาและจัดซื้อจัดจ้างซอฟต์แวร์ กรุงเทพมหานคร',
    searchPlaceholder: 'ค้นหาโครงการ, หน่วยงาน...',
    filterDept: 'หน่วยงาน',
    filterCategory: 'ประเภทโครงการ',
    filterBudget: 'งบประมาณ',
    filterDeadline: 'กำหนดส่ง',
    allDepts: 'ทุกหน่วยงาน',
    allCategories: 'ทุกประเภท',
    allBudgets: 'ทุกงบประมาณ',
    allDeadlines: 'ทุกกำหนดส่ง',
    totalOpps: 'โอกาสทั้งหมด',
    closingSoon: 'ใกล้ปิดรับ',
    newPublished: 'เพิ่งประกาศ',
    totalBudget: 'งบประมาณรวม',
    budget: 'งบประมาณ',
    publishDate: 'วันประกาศ',
    deadline: 'กำหนดส่ง',
    department: 'หน่วยงาน',
    softwareProject: 'โครงการซอฟต์แวร์ กทม.',
    closingSoonTag: 'ใกล้ปิดรับ',
    newTag: 'ใหม่',
    viewDetail: 'ดูรายละเอียด',
    backToList: 'กลับไปรายการ',
    projectDetail: 'รายละเอียดโครงการ',
    procurementType: 'ประเภทการจัดซื้อ',
    projectDesc: 'รายละเอียดโครงการ',
    scopeOfWork: 'ขอบเขตงาน (Scope of Work)',
    bidderQualifications: 'คุณสมบัติของผู้เสนอราคา',
    qualImportant: 'กรุณาตรวจสอบก่อนยื่นข้อเสนอ',
    downloadTOR: 'เปิดเอกสาร TOR ต้นฉบับ ↗',
    saveBookmark: 'บันทึกโอกาส',
    saved: 'บันทึกแล้ว',
    budgetComparison: 'การวิเคราะห์งบประมาณเปรียบเทียบ',
    currentProject: 'โครงการนี้',
    historicalAvg: 'ค่าเฉลี่ยย้อนหลัง',
    aboveAvg: 'สูงกว่าช่วงเฉลี่ยปกติ',
    withinRange: 'อยู่ในช่วงเฉลี่ยปกติ',
    belowAvg: 'ต่ำกว่าช่วงเฉลี่ยปกติ',
    historicalTitle: 'วิเคราะห์ราคาย้อนหลัง',
    historicalSub: 'เปรียบเทียบงบประมาณกับโครงการคอมพิวเตอร์และซอฟต์แวร์ที่ผ่านมาของ กทม.',
    budgetChart: 'แผนภูมิเปรียบเทียบงบประมาณจัดซื้อจัดจ้าง',
    projectName: 'ชื่อโครงการ',
    year: 'ปีงบประมาณ',
    category: 'ประเภท',
    budgetAnalysis: 'การวิเคราะห์ราคาย้อนหลัง',
    savedTitle: 'โอกาสที่บันทึกไว้',
    savedSub: 'รายการประกาศจัดซื้อจัดจ้างที่คุณกำลังติดตาม',
    noSaved: 'ยังไม่มีรายการที่บันทึก',
    noSavedDesc: 'กดปุ่มบันทึกในหน้ารายละเอียดโครงการเพื่อเก็บโอกาสที่สนใจ',
    noResults: 'ไม่พบประกาศจัดซื้อจัดจ้าง',
    noResultsDesc: 'ลองปรับตัวกรองหรือใช้คำค้นหาใหม่อีกครั้ง',
    settingsTitle: 'ตั้งค่าการแจ้งเตือน',
    settingsSub: 'กำหนดเงื่อนไขการส่งข้อมูลแจ้งเตือนโอกาสการจัดซื้อจัดจ้าง',
    emailNotif: 'การแจ้งเตือนทางอีเมล',
    emailNotifDesc: 'รับอีเมลแจ้งเตือนเมื่อมีประกาศโครงการใหม่ตรงตามความสนใจ',
    dailyDigest: 'สรุปรายวัน',
    dailyDigestDesc: 'รับสรุปหัวข้อประกาศจัดซื้อจัดจ้างใหม่ทุกวัน เวลา 08:00 น.',
    closingAlert: 'แจ้งเตือนวันสิ้นสุดยื่นซอง',
    closingAlertDesc: 'แจ้งเตือนล่วงหน้า 3 วันก่อนกำหนดการยื่นข้อเสนอ',
    newProjectAlert: 'โครงการใหม่ทันที',
    newProjectAlertDesc: 'แจ้งเตือนในระบบทันทีที่มีการเปิดประกาศจัดซื้อจัดจ้างใหม่',
    interestTags: 'หมวดหมู่ความสนใจ',
    interestTagsDesc: 'เลือกประเภทโครงการซอฟต์แวร์ที่สอดคล้องกับธุรกิจของคุณ',
    budgetPref: 'งบประมาณโครงการที่สนใจ',
    budgetPrefDesc: 'รับการแจ้งเตือนเฉพาะโครงการที่มีช่วงราคากลางที่กำหนด',
    budgetMin: 'งบประมาณขั้นต่ำ (บาท)',
    budgetMax: 'งบประมาณสูงสุด (บาท)',
    saveSettings: 'บันทึกการตั้งค่าการแจ้งเตือน',
    settingsSaved: 'บันทึกการตั้งค่าเรียบร้อยแล้ว',
    bookmarkAdded: 'บันทึกโครงการเรียบร้อยแล้ว',
    bookmarkRemoved: 'ลบโครงการออกจากรายการบันทึกแล้ว',
    thb: 'บาท',
    million: 'ล้าน',
    filterDeptAll: 'ทุกหน่วยงาน',
    under5m: 'ต่ำกว่า 5 ล้าน',
    range5to10: '5-10 ล้าน',
    range10to20: '10-20 ล้าน',
    above20m: 'มากกว่า 20 ล้าน',
    within7days: 'ภายใน 7 วัน',
    within30days: 'ภายใน 30 วัน',
    moreThan30: 'มากกว่า 30 วัน',
    allYears: 'ทุกปี',
    breadcrumbHome: 'หน้าแรก',
    // Landing specific translation strings
    heroBadge: 'ระบบอัตโนมัติ (AI-ASSISTED PORTAL)',
    heroTitle: 'วิเคราะห์และกลั่นกรองประกาศจัดซื้อจัดจ้างซอฟต์แวร์ กทม.',
    heroSubtitle: 'แพลตฟอร์มข่าวกรองสำหรับการสกัดขอบเขตงาน (TOR) วิเคราะห์เปรียบเทียบราคา และประเมินคุณสมบัติสำหรับผู้ประกอบการเทคโนโลยี',
    searchBtn: 'สืบค้นข้อมูล',
    exploreTitle: 'ขีดความสามารถหลักของระบบ',
    cap1Title: 'สกัดข้อมูลขอบเขตงาน (TOR)',
    cap1Desc: 'ใช้ AI สกัดขอบเขตงาน งบประมาณ และกำหนดการยื่นข้อเสนออัตโนมัติจากเอกสาร PDF',
    cap1Link: 'ค้นหาประกาศจัดซื้อล่าสุด →',
    cap2Title: 'ตรวจสอบคุณสมบัติผู้เสนอราคา',
    cap2Desc: 'เครื่องมือตรวจสอบเกณฑ์คุณสมบัติ (Go / No-Go Checklist) ประเมินความเป็นไปได้เชิงธุรกิจ',
    cap2Link: 'เปิดเครื่องมือเช็คลิสต์ →',
    cap3Title: 'แบบจำลองเปรียบเทียบราคา',
    cap3Desc: 'ตรวจจับราคาผิดปกติ (Outliers) และวิเคราะห์แนวโน้มราคากลางร่วมกับโครงการในอดีต',
    cap3Link: 'วิเคราะห์สถิติราคา →',
    recentOpps: 'ประกาศจัดซื้อจัดจ้างล่าสุด',
    viewAll: 'ดูทั้งหมด',
  },
  en: {
    appName: 'BMA Procurement',
    appSub: 'Intelligence Platform',
    navHome: 'Home',
    navDashboard: 'Opportunities',
    navHistorical: 'Price Analysis',
    navSaved: 'Saved Items',
    navSettings: 'Notifications',
    sectionMain: 'Main Menu',
    sectionTools: 'Tools',
    dashboardTitle: 'BMA Software Procurement Opportunities',
    dashboardSub: 'Aggregated software procurement listings from Bangkok Metropolitan Administration',
    searchPlaceholder: 'Search projects, departments...',
    filterDept: 'Department',
    filterCategory: 'Category',
    filterBudget: 'Budget',
    filterDeadline: 'Deadline',
    allDepts: 'All Departments',
    allCategories: 'All Categories',
    allBudgets: 'All Budgets',
    allDeadlines: 'All Deadlines',
    totalOpps: 'Total Opportunities',
    closingSoon: 'Closing Soon',
    newPublished: 'Newly Published',
    totalBudget: 'Total Budget',
    budget: 'Budget',
    publishDate: 'Published',
    deadline: 'Deadline',
    department: 'Department',
    softwareProject: 'BMA Software Project',
    closingSoonTag: 'Closing Soon',
    newTag: 'New',
    viewDetail: 'View Details',
    backToList: 'Back to List',
    projectDetail: 'Project Details',
    procurementType: 'Procurement Type',
    projectDesc: 'Project Description',
    scopeOfWork: 'Scope of Work',
    bidderQualifications: 'Bidder Qualifications',
    qualImportant: 'Please verify qualifications before bidding',
    downloadTOR: 'Open Original TOR ↗',
    saveBookmark: 'Save Opportunity',
    saved: 'Saved',
    budgetComparison: 'Historical Budget Comparison',
    currentProject: 'Current Project',
    historicalAvg: 'Typical Range Avg',
    aboveAvg: 'Above Historical Range',
    withinRange: 'Within Normal Range',
    belowAvg: 'Below Average',
    historicalTitle: 'Historical Price Analysis',
    historicalSub: 'Compare budgets against BMA past similar projects',
    budgetChart: 'Budget Comparison Chart',
    projectName: 'Project Name',
    year: 'Fiscal Year',
    category: 'Category',
    budgetAnalysis: 'Historical Analysis',
    savedTitle: 'Saved Opportunities',
    savedSub: 'Bookmarked procurement opportunities',
    noSaved: 'No Saved Items',
    noSavedDesc: 'Click the save button on a project detail page to bookmark it',
    noResults: 'No Opportunities Found',
    noResultsDesc: 'Try adjusting your search or filters',
    settingsTitle: 'Notification Preferences',
    settingsSub: 'Configure alerts for relevant procurement opportunities',
    emailNotif: 'Email Notifications',
    emailNotifDesc: 'Receive emails when matching opportunities are published',
    dailyDigest: 'Daily Digest',
    dailyDigestDesc: 'Receive a daily summary at 08:00',
    closingAlert: 'Closing Soon Alert',
    closingAlertDesc: '3 days before submission deadline',
    newProjectAlert: 'New Project Alert',
    newProjectAlertDesc: 'Instant notification for matching new projects',
    interestTags: 'Interest Tags',
    interestTagsDesc: 'Select project categories you are interested in',
    budgetPref: 'Budget Range Preference',
    budgetPrefDesc: 'Filter projects within your preferred budget range',
    budgetMin: 'Minimum (THB)',
    budgetMax: 'Maximum (THB)',
    saveSettings: 'Save Alert Settings',
    settingsSaved: 'Settings saved successfully',
    bookmarkAdded: 'Added to saved items',
    bookmarkRemoved: 'Removed from saved items',
    thb: 'THB',
    million: 'M',
    filterDeptAll: 'All Departments',
    under5m: 'Under 5M',
    range5to10: '5-10M',
    range10to20: '10-20M',
    above20m: 'Above 20M',
    within7days: 'Within 7 days',
    within30days: 'Within 30 days',
    moreThan30: 'More than 30 days',
    allYears: 'All Years',
    breadcrumbHome: 'Home',
    // Landing specific translation strings
    heroBadge: 'AI-ASSISTED PORTAL',
    heroTitle: 'Analyze & Filter BMA Software Procurement Opportunities',
    heroSubtitle: 'BMA intelligence portal offering automated Terms of Reference (TOR) parameter extraction, bidder qualifications checking, and historical price benchmarking models.',
    searchBtn: 'Search',
    exploreTitle: 'Core Capabilities',
    cap1Title: 'TOR Parameters Extraction',
    cap1Desc: 'Automatically extract project goals, budgets, deadlines, and requirements from scanned PDF files using AI models.',
    cap1Link: 'Browse Active Projects →',
    cap2Title: 'Bidder Eligibility Evaluator',
    cap2Desc: 'Check credential metrics dynamically using checklist models to evaluate qualifications prior to bidding.',
    cap2Link: 'Open Checklist Evaluator →',
    cap3Title: 'Price Comparison Models',
    cap3Desc: 'Examine historical procurement pricing outliers and run competitive budget comparisons.',
    cap3Link: 'Analyze Historical Bids →',
    recentOpps: 'Latest Opportunities',
    viewAll: 'View All',
  }
};

// ========== DATASETS (REAL BMA PROCUREMENT DATA) ==========
const CATEGORIES = ['Website', 'Mobile App', 'AI', 'Database'];
const CATEGORY_LABELS = {
  th: { 'Website': 'เว็บไซต์ / พอร์ทัล', 'Mobile App': 'แอปพลิเคชันมือถือ', 'AI': 'AI / แผนที่จีไอเอส', 'Database': 'ฐานข้อมูล / สารสนเทศ' },
  en: { 'Website': 'Website / Portal', 'Mobile App': 'Mobile App', 'AI': 'AI / GIS Mapping', 'Database': 'Database System' }
};

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

const PROJECTS = [
  {
    id: 1,
    title: { 
      th: 'โครงการพัฒนาระบบรวมศูนย์การให้บริการประชาชน (BMA e-Service Smart Portal)', 
      en: 'BMA e-Service Smart Portal Centralized System Development Project' 
    },
    department: DEPARTMENTS[0],
    budget: 53131650,
    publishDate: '2026-08-01',
    deadline: '2026-08-25',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการพัฒนาระบบรวมศูนย์พอร์ทัลการให้บริการประชาชนแบบครบวงจร เพื่อรองรับและบูรณาการงานบริการออนไลน์ของ 50 สำนักงานเขต โดยครอบคลุมระบบลงทะเบียนสมาชิกเดี่ยว (Single Sign-On) และระบบชำระเงินค่าธรรมเนียมออนไลน์ของกรุงเทพมหานคร',
      en: 'Development of BMA e-Service Smart Portal as a centralized portal integrating online citizen services across 50 districts. Includes BMA Single Sign-On and e-payment systems.'
    },
    scope: {
      th: [
        'ออกแบบและพัฒนาระบบ BMA e-Service Portal สำหรับประชาชน',
        'พัฒนาระบบยืนยันตัวตนรวมศูนย์ BMA Single Sign-On รองรับการจดจำผู้ใช้ผ่าน ThaID',
        'พัฒนาระบบชำระค่าธรรมเนียมและค่าภาษีท้องถิ่นผ่าน QR Code/บัตรเครดิต',
        'เชื่อมโยง API และฐานข้อมูลกับระบบบริการเดิมของ กทม. 25 ระบบ',
        'จัดทำระบบ Dashboard สรุปสถิติผู้เข้าใช้บริการสำหรับผู้บริหารแบบ Real-time'
      ],
      en: [
        'Design and develop the citizen-facing BMA e-Service Portal',
        'Develop centralized BMA Single Sign-On integrated with national ThaID system',
        'Develop local tax and fee payment systems supporting QR code and credit cards',
        'Integrate APIs and databases with 25 existing BMA service systems',
        'Develop real-time executive dashboard summarizing service usage statistics'
      ]
    },
    qualifications: {
      th: [
        'เป็นนิติบุคคลจดทะเบียนในประเทศไทย มีทุนจดทะเบียนชำระแล้วไม่น้อยกว่า 10,000,000 บาท',
        'มีผลงานประเภทพัฒนาระบบสารสนเทศระดับองค์กร (Enterprise Portal) หรือ e-Government มูลค่าสัญญาเดียวไม่น้อยกว่า 15,000,000 บาท ภายใน 5 ปีย้อนหลัง',
        'ต้องได้รับใบรับรองมาตรฐาน ISO 27001 หรือ CMMI Level 3 ขึ้นไปด้านการพัฒนาซอฟต์แวร์',
        'มีบุคลากรประจำทีมที่ผ่านการอบรมหรือมีใบรับรองมาตรฐานการเขียนโปรแกรมความมั่นคงปลอดภัย'
      ],
      en: [
        'Legal entity registered in Thailand with paid-up capital of at least 10,000,000 THB',
        'Must have completed enterprise portal or e-Government systems development worth at least 15,000,000 THB in a single contract within the past 5 years',
        'Must possess ISO 27001 or CMMI Level 3 or higher certification in software development',
        'Development team must include certified secure programming professionals'
      ]
    },
    historicalAvg: 48000000,
    sourceDocument: 'BMA_eService_SmartPortal_TOR.pdf',
    processedDate: '2026-08-11',
  },
  {
    id: 2,
    title: { 
      th: 'โครงการจ้างเหมาพัฒนาระบบศูนย์สื่อการเรียนรู้ออนไลน์ (BMA Learning Hub)', 
      en: 'BMA Learning Hub Online Classroom System Project' 
    },
    department: DEPARTMENTS[1],
    budget: 14993300,
    publishDate: '2026-08-05',
    deadline: '2026-08-28',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: {
      th: 'พัฒนาซอฟต์แวร์และคอร์สแวร์บริหารจัดการการเรียนรู้ออนไลน์ (LMS) สำหรับคุณครู นักเรียน และบุคลากรทางการศึกษาของโรงเรียนในสังกัดกรุงเทพมหานคร เพื่อการเรียนการสอนทางไกลอย่างเต็มรูปแบบ',
      en: 'Develop an online Learning Management System (LMS) and courseware portal for teachers, students, and educational staff under BMA public schools.'
    },
    scope: {
      th: [
        'พัฒนาระบบจัดการบทเรียน แผนการเรียนรู้ และห้องเรียนเสมือนจริง (Virtual Classroom)',
        'พัฒนาคลังเก็บสื่อวิดีโอ เอกสารประกอบการสอน และระบบสอบวัดผลคะแนนออนไลน์',
        'ออกแบบระบบประเมินวิทยฐานะของครูผู้สอนผ่านผลสัมฤทธิ์ทางการศึกษา',
        'จัดให้มีระบบส่งข้อความแจ้งเตือนความคืบหน้าการเรียนไปยังกลุ่มผู้ปกครอง'
      ],
      en: [
        'Develop curriculum manager, learning tracks, and virtual classroom facilities',
        'Create media storage for educational videos, handouts, and online quiz managers',
        'Design teacher evaluation modules based on student education performance targets',
        'Establish automated push notifications tracking student progress for parents'
      ]
    },
    qualifications: {
      th: [
        'จดทะเบียนจัดตั้งประเภทนิติบุคคล มีทุนจดทะเบียนไม่น้อยกว่า 3,000,000 บาท',
        'มีผลงานจ้างพัฒนาระบบบริหารจัดการเรียนรู้ (LMS) หรือแพลตฟอร์มการศึกษาอิเล็กทรอนิกส์ให้กับสถาบันการศึกษาหรือรัฐ มูลค่าไม่น้อยกว่า 4,000,000 บาท'
      ],
      en: [
        'Registered corporate entity with capital of at least 3,000,000 THB',
        'Must have successfully deployed LMS or e-learning platforms for schools or government agencies worth at least 4,000,000 THB'
      ]
    },
    historicalAvg: 16500000,
    sourceDocument: 'BMA_LearningHub_Education_TOR.pdf',
    processedDate: '2026-08-11',
  },
  {
    id: 3,
    title: { 
      th: 'โครงการพัฒนาระบบแอปพลิเคชันบริการประชาชน กทม. บนมือถือ (BMA Smart Service Mobile App)', 
      en: 'BMA Smart Service Citizen Mobile Application Project' 
    },
    department: DEPARTMENTS[0],
    budget: 28500000,
    publishDate: '2026-08-03',
    deadline: '2026-08-27',
    category: 'Mobile App',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการจ้างออกแบบและพัฒนาแอปพลิเคชันบนอุปกรณ์สื่อสารเคลื่อนที่ (iOS และ Android) รวบรวมบริการสาธารณะ ภาษีที่ดิน ระบบจองคิวนัดหมายสำนักงานเขต และผสานงานระบบร้องเรียน Traffy Fondue เข้าไว้เป็นหนึ่งเดียว',
      en: 'Design and develop the BMA Smart Service mobile application on iOS and Android to aggregate public tax payments, local district booking queues, and Traffy Fondue complaints.'
    },
    scope: {
      th: [
        'ออกแบบ UI/UX แอปพลิเคชันตามแนวทางแบรนด์ กทม. รองรับทั้ง iOS และ Android',
        'พัฒนาโมดูลชำระภาษีที่ดินและสิ่งปลูกสร้าง พร้อมระบบเรียกดูประวัติใบเสร็จย้อนหลัง',
        'ผสานการทำงานเชื่อมต่อ API กับ Traffy Fondue เพื่อแสดงสถานะร้องเรียนแบบเรียลไทม์',
        'พัฒนาระบบจองคิวออนไลน์เพื่อขอรับบริการงานทะเบียนราษฎร ณ ที่ทำการเขต 50 เขต'
      ],
      en: [
        'Design mobile UI/UX in compliance with BMA branding guidelines for iOS and Android',
        'Develop real estate and local tax invoice payment features with payment history',
        'Integrate Traffy Fondue API to present real-time report feedback and tracking',
        'Develop online queue booking for civil registration services at all 50 district offices'
      ]
    },
    qualifications: {
      th: [
        'เป็นผู้มีอาชีพรับจ้างงานคอมพิวเตอร์และซอฟต์แวร์โดยตรง',
        'มีสัญญาผลงานพัฒนาแอปพลิเคชันบนมือถือที่เผยแพร่บน App Store และ Google Play Store ที่มีผู้ลงทะเบียนใช้งานมากกว่า 50,000 บัญชี',
        'มูลค่าสัญญาพัฒนาแอปพลิเคชันระบบสารสนเทศไม่ต่ำกว่า 10,000,000 บาท ภายในระยะเวลาไม่เกิน 5 ปี'
      ],
      en: [
        'Must be actively trading in software and computer development fields',
        'Must showcase mobile applications published on App Store/Google Play with at least 50,000 registered users',
        'Must have mobile or IT system project contracts worth at least 10,000,000 THB within the past 5 years'
      ]
    },
    historicalAvg: 25000000,
    sourceDocument: 'BMA_SmartService_MobileApp_TOR.pdf',
    processedDate: '2026-08-11',
  },
  {
    id: 4,
    title: { 
      th: 'โครงการจ้างเหมาพัฒนาระบบเทคโนโลยีสารสนเทศห้องสมุดเพื่อการเรียนรู้กรุงเทพมหานคร', 
      en: 'BMA Learning Library Information Technology System Upgrade' 
    },
    department: DEPARTMENTS[3],
    budget: 14502000,
    publishDate: '2026-07-28',
    deadline: '2026-08-18',
    category: 'Database',
    procurementType: 'e-Bidding',
    description: {
      th: 'จ้างเหมาปรับปรุงระบบฐานข้อมูลและซอฟต์แวร์จัดการห้องสมุดดิจิทัล เชื่อมต่อระบบยืม-คืนอัตโนมัติ ฐานข้อมูลสื่ออิเล็กทรอนิกส์ข้ามเครือข่ายห้องสมุดเพื่อการเรียนรู้ กทม. จำนวน 36 แห่ง',
      en: 'Upgrade database system and library management software to link automated check-in/out and digital books across 36 BMA Learning Library locations.'
    },
    scope: {
      th: [
        'ปรับปรุงระบบบริการยืม-คืนหนังสือและจองคิวใช้งานคอมพิวเตอร์ออนไลน์',
        'พัฒนาระบบค้นหารายการหนังสือรวมศูนย์ (OPAC) เชื่อมโยงทุกสาขาห้องสมุด',
        'บูรณาการระบบจัดการคลังเก็บสื่อสิ่งพิมพ์และ e-Book ลิขสิทธิ์เฉพาะ กทม.',
        'ติดตั้ง API เชื่อมต่อกับระบบยืนยันตัวตน BMA Single Sign-On'
      ],
      en: [
        'Upgrade check-in/check-out services and online research desk reservations',
        'Develop unified book search (OPAC) indexing library collections across branches',
        'Integrate media assets manager hosting publications and BMA-owned e-Books',
        'Deploy authentication API interfacing with BMA Single Sign-On database'
      ]
    },
    qualifications: {
      th: [
        'มีผลงานการพัฒนาระบบสารสนเทศห้องสมุดหรือระบบ OPAC ให้ส่วนราชการหรือสถาบันการศึกษา มูลค่าสัญญาเดียวไม่ต่ำกว่า 4,000,000 บาท',
        'ผ่านการรับรองระบบคุณภาพในการพัฒนาซอฟต์แวร์ตามมาตรฐานของรัฐ'
      ],
      en: [
        'Must possess completed library management system or OPAC portal contract worth at least 4,000,000 THB',
        'Must comply with software quality frameworks recognized by public bodies'
      ]
    },
    historicalAvg: 12000000,
    sourceDocument: 'BMA_LearningLibrary_IT_TOR.pdf',
    processedDate: '2026-08-11',
  },
  {
    id: 5,
    title: { 
      th: 'โครงการพัฒนาระบบสารสนเทศภูมิศาสตร์เพื่อการบริหารจัดการสารเคมี (BMA Chemical GIS System)', 
      en: 'BMA Hazardous Chemical GIS System Development Project' 
    },
    department: DEPARTMENTS[4],
    budget: 8200000,
    publishDate: '2026-08-09',
    deadline: '2026-09-02',
    category: 'AI',
    procurementType: 'e-Bidding',
    description: {
      th: 'พัฒนาระบบสารสนเทศภูมิศาสตร์ (GIS) สำหรับพล็อตและวิเคราะห์จุดพิกัดการจัดเก็บสารเคมีและวัตถุอันตรายภายในโรงงานและสถานประกอบการ เพื่อการระงับเหตุและประเมินภัยพิบัติเชิงรุก',
      en: 'Develop a Geographic Information System (GIS) mapping chemical storage sites in commercial zones to facilitate active hazard containment and disaster response.'
    },
    scope: {
      th: [
        'ออกแบบระบบแผนที่สารสนเทศภูมิศาสตร์ (GIS) บนเว็บบราวเซอร์หลัก',
        'พัฒนาระบบวิเคราะห์ประเมินทิศทางแก๊สรั่วและเขตรัศมีอพยพกรณีฉุกเฉิน (Plume Modeling AI)',
        'สร้างฐานข้อมูลรายการสารเคมีและวัตถุอันตรายครอบคลุมสถานประกอบการ 3,000 แห่ง',
        'พัฒนาระบบ Dashboard รายงานสถิติปริมาณสารเคมีควบคุมสำหรับกองอนามัยสิ่งแวดล้อม'
      ],
      en: [
        'Design web-based Geographic Information System (GIS) application',
        'Develop emergency chemical plume simulation modeling AI determining evacuation radii',
        'Create chemical substance inventory database covering 3,000 local manufacturing sites',
        'Build executive dashboard reporting toxic substances stats for Environment Health Division'
      ]
    },
    qualifications: {
      th: [
        'มีผลงานพัฒนาระบบเทคโนโลยีสารสนเทศภูมิศาสตร์ (GIS) หรือโปรแกรมประยุกต์ด้านการวางแผนป้องกันภัย มูลค่าสัญญาเดียวไม่ต่ำกว่า 2,500,000 บาท',
        'ผู้เสนอราคาต้องมีบุคลากรตำแหน่งนักวิเคราะห์ระบบจีไอเอสประจำโครงการ'
      ],
      en: [
        'Must have completed GIS software development or disaster prevention application worth at least 2,500,000 THB in a single contract',
        'Must allocate dedicated GIS Analyst personnel on team rosters'
      ]
    },
    historicalAvg: 7500000,
    sourceDocument: 'BMA_Health_Chemical_GIS_TOR.pdf',
    processedDate: '2026-08-11',
  },
  {
    id: 6,
    title: { 
      th: 'โครงการพัฒนาระบบโปรแกรมติดตามและตรวจสอบเวชระเบียนโรงพยาบาลในสังกัด กทม.', 
      en: 'BMA Hospitals Medical Records Tracking and Verification System' 
    },
    department: DEPARTMENTS[5],
    budget: 18500000,
    publishDate: '2026-08-10',
    deadline: '2026-09-12',
    category: 'Database',
    procurementType: 'e-Bidding',
    description: {
      th: 'จัดหาและพัฒนาซอฟต์แวร์สำหรับตรวจสอบความสมบูรณ์ของเวชระเบียนผู้ป่วยนอกและผู้ป่วยใน เพื่อรองรับการเบิกจ่ายค่ารักษาพยาบาลจากกองทุนหลักประกันสุขภาพได้อย่างถูกต้องรวดเร็ว',
      en: 'Procure and develop clinical software validating inpatient/outpatient electronic medical records (EMR) for healthcare reimbursement.'
    },
    scope: {
      th: [
        'พัฒนาระบบวิเคราะห์ความถูกต้องของการลงรหัสโรค (ICD-10/ICD-9-CM) บนเวชระเบียนอิเล็กทรอนิกส์',
        'พัฒนาโปรแกรมดึงข้อมูลเวชระเบียนและแปลงเป็นโครงสร้างแฟ้มข้อมูลมาตรฐานกระทรวงสาธารณสุข',
        'จัดทำระบบแจ้งเตือนกรณีตรวจพบรหัสโรคขัดแย้งกับบันทึกการรักษาพยาบาล',
        'เชื่อมต่อฐานข้อมูลร่วมกับระบบ HIS ของโรงพยาบาล กทม. 11 แห่ง'
      ],
      en: [
        'Develop clinical validation rules checking diagnosis codes (ICD-10/ICD-9-CM) in EMRs',
        'Build extractors transforming records to ministry-compliant health reporting standard files',
        'Deploy alerting modules flagging inconsistencies between code assignments and progress notes',
        'Establish direct integrations with HIS platforms across 11 BMA public hospitals'
      ]
    },
    qualifications: {
      th: [
        'มีผลงานจ้างเหมาพัฒนาระบบเทคโนโลยีสารสนเทศให้กับโรงพยาบาลรัฐหรือเอกชน มูลค่าไม่น้อยกว่า 5,000,000 บาท',
        'มีบุคลากรที่มีความเชี่ยวชาญด้านเวชสถิติหรือมีใบรับรองการลงรหัสโรคสากลประจำทีมพัฒนา'
      ],
      en: [
        'Must possess completed health IT systems contracts with state or private hospitals worth at least 5,000,000 THB',
        'Must assign medical coders or health information specialists to the software team'
      ]
    },
    historicalAvg: 20000000,
    sourceDocument: 'BMA_MedicalRecord_Verify_TOR.pdf',
    processedDate: '2026-08-11',
  },
  {
    id: 7,
    title: { 
      th: 'โครงการพัฒนาระบบข้อมูลการจัดการคุณภาพอากาศกรุงเทพมหานคร', 
      en: 'BMA Air Quality Management Information System Project' 
    },
    department: DEPARTMENTS[2],
    budget: 6800000,
    publishDate: '2026-08-04',
    deadline: '2026-08-25',
    category: 'Database',
    procurementType: 'e-Bidding',
    description: {
      th: 'ปรับปรุงฐานข้อมูลดัชนีคุณภาพอากาศ (Air Quality Index) พัฒนาระบบรวบรวมข้อมูลฝุ่นละออง PM2.5 ข้อมูลสภาพอากาศจากเซ็นเซอร์ 70 จุดของสำนักสิ่งแวดล้อม',
      en: 'Upgrade BMA Air Quality Index database and system collecting real-time PM2.5 and meteorological sensor data from 70 environmental stations.'
    },
    scope: {
      th: [
        'ปรับปรุง API ดึงข้อมูลมลพิษทางอากาศ PM2.5, PM10, O3, CO จากสถานีตรวจวัดแบบ Real-time',
        'พัฒนาโมดูลคำนวณดัชนีคุณภาพอากาศ (AQI) และพยากรณ์ปริมาณฝุ่นละอองล่วงหน้า 3 วัน',
        'ปรับปรุงความเสถียรของระบบส่งแจ้งเตือนคุณภาพอากาศผ่าน LINE Official Account',
        'จัดทำระบบสำรองข้อมูลและจัดการ API เพื่อให้หน่วยงานภายนอกนำข้อมูลไปพัฒนาต่อได้'
      ],
      en: [
        'Update API fetching real-time PM2.5, PM10, O3, and CO sensor readings',
        'Develop module calculating AQI and generating 3-day particulate forecast alerts',
        'Improve performance of air quality broadcast notifications via LINE Official Account',
        'Design data backup and developer API catalog supporting external data consumption'
      ]
    },
    qualifications: {
      th: [
        'มีทุนจดทะเบียนไม่น้อยกว่า 1,500,000 บาท',
        'มีผลงานพัฒนาระบบฐานข้อมูลเชิงสัมพัทธ์ หรือระบบเชื่อมโยง API มูลค่าสัญญาเดี่ยวไม่ต่ำกว่า 1,500,000 บาท'
      ],
      en: [
        'Paid-up capital must be at least 1,500,000 THB',
        'Must have completed relational database or API integration contract worth at least 1,500,000 THB'
      ]
    },
    historicalAvg: 5500000,
    sourceDocument: 'BMA_AirQuality_Management_TOR.pdf',
    processedDate: '2026-08-11',
  },
  {
    id: 8,
    title: { 
      th: 'โครงการพัฒนาแอปพลิเคชันศูนย์บริการคนพิการและผู้สูงอายุ กทม. (BMA Welfare Companion Mobile App)', 
      en: 'BMA Welfare Companion Mobile Application Project' 
    },
    department: DEPARTMENTS[6],
    budget: 11200000,
    publishDate: '2026-08-02',
    deadline: '2026-08-22',
    category: 'Mobile App',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการพัฒนาโปรแกรมประยุกต์บนสมาร์ทโฟนสำหรับอำนวยความสะดวกในการเข้าถึงข้อมูลเบี้ยยังชีพคนพิการและผู้สูงอายุ พร้อมฟีเจอร์แจ้งเตือนฉุกเฉิน (SOS) ส่งพิกัดตำแหน่งช่วยเหลือ',
      en: 'Develop a mobile smartphone application facilitating access to BMA welfare payouts and emergency SOS geo-location tracking for senior citizens and disabled persons.'
    },
    scope: {
      th: [
        'พัฒนา Mobile Application (iOS/Android) ที่เน้นการออกแบบสำหรับผู้สูงอายุ (Accessibility UX)',
        'พัฒนาระบบตรวจสอบยอดเงินเบี้ยยังชีพและประวัติการรับเงินโอนสวัสดิการสังคม',
        'ออกแบบระบบช่วยเหลือฉุกเฉิน (SOS Button) ส่งพิกัดจีพีเอสเข้าศูนย์ควบคุมสวัสดิการสังคม กทม.',
        'ติดตั้งระบบลงทะเบียนขอสิทธิ์กายอุปกรณ์ช่วยเหลือคนพิการออนไลน์'
      ],
      en: [
        'Develop smartphone app focusing on accessible UX principles for seniors and disabled users',
        'Develop payout ledger view showing monthly allowance distribution history',
        'Design SOS emergency button broadcasting GPS location to BMA command centers',
        'Establish online request forms for government-funded mobility aids and devices'
      ]
    },
    qualifications: {
      th: [
        'มีผลงานพัฒนาแอปพลิเคชันมือถือระบบบริการภาครัฐหรือสังคม มูลค่าสัญญารวมกันไม่น้อยกว่า 3,000,000 บาท',
        'ซอฟต์แวร์ต้องผ่านเกณฑ์ประเมินการออกแบบที่เป็นมิตรตามมาตรฐาน Web Content Accessibility Guidelines (WCAG) ระดับ AA'
      ],
      en: [
        'Must have completed mobile apps delivering government or public services totaling at least 3,000,000 THB',
        'Software design must comply with WCAG 2.1 Level AA accessibility regulations'
      ]
    },
    historicalAvg: 10000000,
    sourceDocument: 'BMA_Welfare_Companion_Mobile_TOR.pdf',
    processedDate: '2026-08-11',
  },
  {
    id: 9,
    title: { 
      th: 'โครงการจ้างพัฒนาระบบสารสนเทศสำหรับกองบำเหน็จบำนาญข้าราชการกรุงเทพมหานคร', 
      en: 'BMA Pension and Retirement Benefits Management System Project' 
    },
    department: DEPARTMENTS[7],
    budget: 9800000,
    publishDate: '2026-07-22',
    deadline: '2026-08-14',
    category: 'Website',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการจัดหาและพัฒนาระบบสารสนเทศจัดการข้อมูลผู้เกษียณอายุ คำนวณเบี้ยหวัดบำเหน็จบำนาญ และค่าตอบแทนพิเศษข้าราชการ กทม. เพื่อแก้ปัญหาการอนุมัติและจ่ายเงินบำนาญล่าช้า',
      en: 'Development of retiree pension benefits calculations system for BMA to automate monthly retirement allocations and prevent approval bottlenecks.'
    },
    scope: {
      th: [
        'พัฒนาระบบยื่นคำขอรับบำเหน็จบำนาญออนไลน์ผ่านหน้าเว็บไซต์ข้าราชการ กทม.',
        'เขียนซอฟต์แวร์คำนวณเบี้ยหวัด บำเหน็จบำนาญ และเงินเบิกจ่ายช่วยพิเศษอัตโนมัติ',
        'เชื่อมต่อข้อมูลประวัติบุคลากรข้ามระบบ HR Database ของ กทม.',
        'จัดทำระบบรายงานทางการเงินเพื่อส่งให้ผู้ตรวจสอบบัญชีตรวจสอบรายปี'
      ],
      en: [
        'Develop online portal allowing retired staff to file pension paperwork electronically',
        'Implement automated calculators processing pension variables and tax withholdings',
        'Interface with BMA centralized HR Database to fetch salary histories',
        'Generate audit-compliant financial reports for external auditors review'
      ]
    },
    qualifications: {
      th: [
        'จดทะเบียนนิติบุคคลไม่ต่ำกว่า 3 ปี มีทุนจดทะเบียนไม่น้อยกว่า 2,000,000 บาท',
        'มีผลงานพัฒนาระบบบัญชีการคลัง หรือระบบการจ่ายผลประโยชน์ทางการเงินให้กับส่วนราชการ มูลค่าสัญญาเดียวไม่น้อยกว่า 3,000,000 บาท'
      ],
      en: [
        'Incorporated for at least 3 years with capital of at least 2,000,000 THB',
        'Must possess completed financial accounting or benefits payroll system contract worth at least 3,000,000 THB'
      ]
    },
    historicalAvg: 11500000,
    sourceDocument: 'BMA_Pension_Finance_TOR.pdf',
    processedDate: '2026-08-11',
  },
  {
    id: 10,
    title: { 
      th: 'โครงการจ้างเหมาพัฒนาระบบศูนย์ควบคุมสัญญาณไฟจราจรอัจฉริยะ (Smart Traffic Control System)', 
      en: 'BMA Smart Traffic Light Control System Software Project' 
    },
    department: DEPARTMENTS[8],
    budget: 42000000,
    publishDate: '2026-08-06',
    deadline: '2026-08-30',
    category: 'AI',
    procurementType: 'e-Bidding',
    description: {
      th: 'โครงการจ้างเหมาติดตั้งระบบควบคุมวิเคราะห์สัญญาณไฟจราจรอัจฉริยะ (Adaptive Traffic Control) โดยใช้เทคโนโลยี AI วิเคราะห์ความหนาแน่นของรถยนต์ผ่านกล้อง เพื่อควบคุมสัญญาณไฟจราจรลดปัญหารถติดสะสม',
      en: 'Implement adaptive traffic light control software utilizing computer vision AI to measure vehicle queues and adjust green light cycles in real time.'
    },
    scope: {
      th: [
        'พัฒนา AI ซอฟต์แวร์ประมวลผลวิดีโอจากกล้องจราจร ณ ทางแยก 20 ทางแยกหลัก',
        'พัฒนาโมดูลคำนวณและปรับเปลี่ยนรอบสัญญาณไฟจราจรอัตโนมัติ (Green Time Optimization)',
        'พัฒนาระบบแจ้งเตือนภัยกรณีตรวจพบคอขวดหรืออุบัติเหตุกีดขวางทางจราจร',
        'ออกแบบแดชบอร์ดติดตามสถานะการจราจรแบบสด แผนที่ GIS สำหรับเจ้าหน้าที่ สจส.'
      ],
      en: [
        'Develop computer vision algorithms processing traffic camera streams across 20 junctions',
        'Program real-time adaptive green time optimization cycles based on queue lengths',
        'Establish automated notification alert for accidents and blockages',
        'Design real-time traffic GIS monitoring map dashboard for transport control centers'
      ]
    },
    qualifications: {
      th: [
        'เป็นนิติบุคคลจดทะเบียนในประเทศไทย มีทุนจดทะเบียนไม่น้อยกว่า 10,000,000 บาท',
        'มีผลงานพัฒนาหรือติดตั้งระบบประมวลผลคอมพิวเตอร์สำหรับการควบคุมจราจรทางบกให้กับรัฐ มูลค่าไม่น้อยกว่า 15,000,000 บาท ภายใน 5 ปี',
        'ทีมงานวิจัยต้องมี Data Scientist หรือ AI Specialist ที่มีประสบการณ์การทำงานระบบ Computer Vision'
      ],
      en: [
        'Must be legal entity registered in Thailand with capital of at least 10,000,000 THB',
        'Must possess completed computer systems for road traffic control contract worth at least 15,000,000 THB within 5 years',
        'Core development team must include AI/Computer Vision specialists'
      ]
    },
    historicalAvg: 38000000,
    sourceDocument: 'BMA_SmartTraffic_Control_TOR.pdf',
    processedDate: '2026-08-11',
  },
];

const HISTORICAL_DATA = [
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

// ========== APPLICATION STATE ==========
const state = {
  currentPage: 'home', 
  selectedProjectId: null,
  searchQuery: '',
  theme: 'light', // Light mode by default
  filters: {
    department: '',
    category: '',
    budget: '',
    deadline: '',
  },
  historicalFilters: {
    category: '',
    department: '',
    year: '',
  },
  bookmarks: new Set(),
  language: 'th',
  settings: {
    emailNotif: true,
    dailyDigest: true,
    closingAlert: true,
    newProjectAlert: false,
    interestTags: ['Website', 'AI'],
    budgetMin: '',
    budgetMax: '',
  },
  eligibilityChecks: {},
  charts: {
    budget: null,
    comparison: null,
  }
};

// ========== UTILITY FUNCTIONS ==========
function L(key) {
  return LABELS[state.language][key] || key;
}

function formatBudget(amount) {
  if (amount >= 1000000) {
    const m = (amount / 1000000).toFixed(1);
    return `฿${m} ${L('million')}`;
  }
  return `฿${amount.toLocaleString()}`;
}

function formatBudgetFull(amount) {
  return `${amount.toLocaleString()} ${L('thb')}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const months = state.language === 'th' 
    ? ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const year = state.language === 'th' ? d.getFullYear() + 543 : d.getFullYear();
  return `${d.getDate()} ${months[d.getMonth()]} ${year}`;
}

function daysUntil(dateStr) {
  const now = new Date('2026-08-10');
  const deadline = new Date(dateStr);
  return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
}

function isClosingSoon(dateStr) {
  const d = daysUntil(dateStr);
  return d >= 0 && d <= 7;
}

function isNew(publishDate) {
  const d = daysUntil(publishDate);
  return d >= -3 && d <= 0;
}

function getLocalizedText(obj) {
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj;
  return obj[state.language] || obj.th;
}

function getCategoryClass(cat) {
  return cat === 'AI' ? 'ai' : cat === 'Website' ? 'website' : cat === 'Mobile App' ? 'mobile' : 'database';
}

function getBudgetStatus(budget, historicalAvg) {
  const ratio = budget / historicalAvg;
  if (ratio > 1.2) return 'above';
  if (ratio < 0.8) return 'below';
  return 'normal';
}

// ========== THEME TOGGLE ==========
function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  if (state.theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
  render();
}

// ========== FILTER LOGIC ==========
function getFilteredProjects() {
  let projects = [...PROJECTS];

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    projects = projects.filter(p => 
      getLocalizedText(p.title).toLowerCase().includes(q) ||
      getLocalizedText(p.department).toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }

  if (state.filters.department) {
    projects = projects.filter(p => p.department.th === state.filters.department);
  }

  if (state.filters.category) {
    projects = projects.filter(p => p.category === state.filters.category);
  }

  if (state.filters.budget) {
    projects = projects.filter(p => {
      switch (state.filters.budget) {
        case 'under5m': return p.budget < 5000000;
        case '5to10': return p.budget >= 5000000 && p.budget <= 10000000;
        case '10to20': return p.budget >= 10000000 && p.budget <= 20000000;
        case 'above20m': return p.budget > 20000000;
        default: return true;
      }
    });
  }

  if (state.filters.deadline) {
    projects = projects.filter(p => {
      const d = daysUntil(p.deadline);
      switch (state.filters.deadline) {
        case 'within7': return d >= 0 && d <= 7;
        case 'within30': return d >= 0 && d <= 30;
        case 'moreThan30': return d > 30;
        default: return true;
      }
    });
  }

  return projects;
}

function getFilteredHistorical() {
  let data = [...HISTORICAL_DATA];
  if (state.historicalFilters.category) {
    data = data.filter(d => d.category === state.historicalFilters.category);
  }
  if (state.historicalFilters.department) {
    data = data.filter(d => d.department.th === state.historicalFilters.department);
  }
  if (state.historicalFilters.year) {
    data = data.filter(d => d.year === parseInt(state.historicalFilters.year));
  }
  return data;
}

// ========== NAVIGATION ==========
function navigate(page, projectId) {
  state.currentPage = page;
  state.selectedProjectId = projectId || null;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleBookmark(id, e) {
  if (e) e.stopPropagation();
  if (state.bookmarks.has(id)) {
    state.bookmarks.delete(id);
    showToast(L('bookmarkRemoved'), ICONS.bookmark);
  } else {
    state.bookmarks.add(id);
    showToast(L('bookmarkAdded'), ICONS.bookmarkFilled);
  }
  render();
}

function toggleLanguage(lang) {
  state.language = lang;
  document.documentElement.lang = lang;
  render();
}

function showToast(message, icon) {
  const toast = document.getElementById('toast');
  toast.innerHTML = `${icon || ''}<span>${message}</span>`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ========== INTERACTIVE ELIGIBILITY CHECKLIST LOGIC ==========
function toggleEligibilityCheck(projectId, index) {
  if (!state.eligibilityChecks[projectId]) {
    state.eligibilityChecks[projectId] = [];
  }
  const checks = state.eligibilityChecks[projectId];
  const idx = checks.indexOf(index);
  if (idx > -1) {
    checks.splice(idx, 1);
  } else {
    checks.push(index);
  }
  render();
}

// ========== RENDER APP ==========
function render() {
  const app = document.getElementById('app');
  app.innerHTML = renderSidebar() + `<div class="main-content">${renderTopbar()}${renderPage()}</div>`;
  attachEventListeners();
  if (state.currentPage === 'historical') {
    setTimeout(renderCharts, 100);
  }
}

function renderSidebar() {
  const bookmarkCount = state.bookmarks.size;
  return `
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-logo" onclick="navigate('home')">
          <div class="sidebar-brand-icon">B</div>
          <div class="sidebar-brand-text">
            <div class="sidebar-brand-name">${L('appName')}</div>
            <div class="sidebar-brand-sub">${L('appSub')}</div>
          </div>
        </div>
      </div>
      <nav class="sidebar-nav">
        <div class="sidebar-section-label">${L('sectionMain')}</div>
        <a class="sidebar-link ${state.currentPage === 'home' ? 'active' : ''}" onclick="navigate('home')">
          ${ICONS.home}
          <span>${L('navHome')}</span>
        </a>
        <a class="sidebar-link ${state.currentPage === 'dashboard' ? 'active' : ''}" onclick="navigate('dashboard')">
          ${ICONS.dashboard}
          <span>${L('navDashboard')}</span>
        </a>
        <a class="sidebar-link ${state.currentPage === 'historical' ? 'active' : ''}" onclick="navigate('historical')">
          ${ICONS.chart}
          <span>${L('navHistorical')}</span>
        </a>
        <a class="sidebar-link ${state.currentPage === 'saved' ? 'active' : ''}" onclick="navigate('saved')">
          ${ICONS.bookmark}
          <span>${L('navSaved')}</span>
          ${bookmarkCount > 0 ? `<span class="sidebar-badge">${bookmarkCount}</span>` : ''}
        </a>
        <div class="sidebar-section-label">${L('sectionTools')}</div>
        <a class="sidebar-link ${state.currentPage === 'notifications' ? 'active' : ''}" onclick="navigate('notifications')">
          ${ICONS.bell}
          <span>${L('navSettings')}</span>
        </a>
      </nav>
      <div class="sidebar-footer">
        <div class="lang-toggle">
          <button class="lang-btn ${state.language === 'th' ? 'active' : ''}" onclick="toggleLanguage('th')">🇹🇭 ไทย</button>
          <button class="lang-btn ${state.language === 'en' ? 'active' : ''}" onclick="toggleLanguage('en')">🇺🇸 EN</button>
        </div>
      </div>
    </aside>
  `;
}

function renderTopbar() {
  const pages = {
    home: L('navHome'),
    dashboard: L('navDashboard'),
    detail: L('projectDetail'),
    historical: L('navHistorical'),
    saved: L('navSaved'),
    notifications: L('navSettings'),
  };
  return `
    <header class="topbar">
      <div class="topbar-breadcrumb">
        <span onclick="navigate('home')">${L('breadcrumbHome')}</span>
        ${state.currentPage !== 'home' ? `${ICONS.chevronRight}<span class="active-crumb">${pages[state.currentPage]}</span>` : ''}
      </div>
      <div class="topbar-spacer"></div>
      <div class="topbar-actions">
        <button class="topbar-icon-btn" id="themeToggleBtn" onclick="toggleTheme()" title="${state.theme === 'dark' ? 'Light Mode' : 'Dark Mode'}">
          ${state.theme === 'dark' ? ICONS.sun : ICONS.moon}
        </button>
        <button class="topbar-icon-btn" onclick="navigate('notifications')" title="${L('navSettings')}">
          ${ICONS.bell}
          <span class="notif-dot"></span>
        </button>
        <div class="topbar-avatar">BM</div>
      </div>
    </header>
  `;
}

function renderPage() {
  switch (state.currentPage) {
    case 'home': return renderHome();
    case 'dashboard': return renderDashboard();
    case 'detail': return renderDetail();
    case 'historical': return renderHistorical();
    case 'saved': return renderSaved();
    case 'notifications': return renderNotifications();
    default: return renderHome();
  }
}

// ========== PREMIUM LANDING PAGE (HOME) ==========
function renderHome() {
  const recentProjects = PROJECTS.slice(0, 2);

  return `
    <div class="page-content" id="home-page">
      <!-- Hero Portal Banner -->
      <div class="hero-section">
        <div class="hero-content">
          <span class="hero-badge">
            ${ICONS.shield}
            <span>${L('heroBadge')}</span>
          </span>
          <h1 class="hero-title">${L('heroTitle')}</h1>
          <p class="hero-subtitle">${L('heroSubtitle')}</p>
          <form class="hero-search-bar" id="heroSearchForm">
            <input type="text" id="heroSearchInput" placeholder="${L('searchPlaceholder')}">
            <button type="submit">${L('searchBtn')}</button>
          </form>
        </div>
      </div>

      <!-- Core Capabilities Segment -->
      <div class="page-header" style="margin-top: 10px; margin-bottom: 16px;">
        <h2 class="home-section-title">${L('exploreTitle')}</h2>
      </div>
      
      <div class="landing-grid">
        <div class="landing-card">
          <div class="landing-card-icon">
            ${ICONS.file}
          </div>
          <h3 class="landing-card-title">${L('cap1Title')}</h3>
          <p class="landing-card-desc">${L('cap1Desc')}</p>
          <a class="landing-card-link" onclick="navigate('dashboard')">${L('cap1Link')}</a>
        </div>
        <div class="landing-card">
          <div class="landing-card-icon">
            ${ICONS.shield}
          </div>
          <h3 class="landing-card-title">${L('cap2Title')}</h3>
          <p class="landing-card-desc">${L('cap2Desc')}</p>
          <a class="landing-card-link" onclick="navigate('detail', 1)">${L('cap2Link')}</a>
        </div>
        <div class="landing-card">
          <div class="landing-card-icon">
            ${ICONS.chart}
          </div>
          <h3 class="landing-card-title">${L('cap3Title')}</h3>
          <p class="landing-card-desc">${L('cap3Desc')}</p>
          <a class="landing-card-link" onclick="navigate('historical')">${L('cap3Link')}</a>
        </div>
      </div>

      <!-- Recent Tenders Segment -->
      <div class="home-section-header">
        <h2 class="home-section-title">${L('recentOpps')}</h2>
        <a class="home-section-link" onclick="navigate('dashboard')">${L('viewAll')} (${PROJECTS.length})</a>
      </div>

      <div class="recent-projects-list">
        ${recentProjects.map(p => renderProjectCard(p)).join('')}
      </div>

      <!-- Footer Disclaimer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--gray-200); text-align: center;">
        <span class="analysis-disclaimer" style="display:inline-block; max-width:800px;">
          ${state.language === 'th'
            ? 'ข้อมูลระบบนี้ได้มาจากการสกัดขอบเขตงานเอกสารราชการโดยใช้โมเดล AI กรุณาตรวจสอบเอกสาร TOR ต้นฉบับเพื่อความถูกต้องอย่างเป็นทางการ'
            : 'Disclaimer: System parameters are extracted from official documents using AI. Always cross-reference against the original TOR files for validation.'}
        </span>
      </div>
    </div>
  `;
}

// ========== DASHBOARD PAGE ==========
function renderDashboard() {
  const projects = getFilteredProjects();
  const closingCount = PROJECTS.filter(p => isClosingSoon(p.deadline)).length;
  const newCount = PROJECTS.filter(p => isNew(p.publishDate)).length;
  const totalBudget = PROJECTS.reduce((s, p) => s + p.budget, 0);

  const depts = [...new Set(PROJECTS.map(p => p.department.th))];

  return `
    <div class="page-content" id="dashboard-page">
      <div class="page-header">
        <h1 class="page-title">${L('dashboardTitle')}</h1>
        <p class="page-subtitle">${L('dashboardSub')}</p>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">${L('totalOpps')}</span>
            <div class="stat-card-icon blue">${ICONS.target}</div>
          </div>
          <div class="stat-card-value">${PROJECTS.length}</div>
          <div class="stat-card-change positive">+${newCount} ${state.language === 'th' ? 'รายการใหม่สัปดาห์นี้' : 'new this week'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">${L('closingSoon')}</span>
            <div class="stat-card-icon amber">${ICONS.clock}</div>
          </div>
          <div class="stat-card-value">${closingCount}</div>
          <div class="stat-card-change neutral">${state.language === 'th' ? 'ภายใน 7 วัน' : 'within 7 days'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">${L('newPublished')}</span>
            <div class="stat-card-icon green">${ICONS.star}</div>
          </div>
          <div class="stat-card-value">${newCount}</div>
          <div class="stat-card-change positive">${state.language === 'th' ? 'ใน 3 วันที่ผ่านมา' : 'in the past 3 days'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-label">${L('totalBudget')}</span>
            <div class="stat-card-icon teal">${ICONS.dollarSign}</div>
          </div>
          <div class="stat-card-value">${formatBudget(totalBudget)}</div>
          <div class="stat-card-change neutral">${PROJECTS.length} ${state.language === 'th' ? 'โครงการ' : 'projects'}</div>
        </div>
      </div>

      <div class="search-filter-bar">
        <div class="search-input-wrapper">
          ${ICONS.search}
          <input type="text" class="search-input" id="searchInput" placeholder="${L('searchPlaceholder')}" value="${state.searchQuery}">
        </div>
        <select class="filter-select" id="filterDept">
          <option value="">${L('allDepts')}</option>
          ${depts.map(d => `<option value="${d}" ${state.filters.department === d ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
        <select class="filter-select" id="filterCategory">
          <option value="">${L('allCategories')}</option>
          ${CATEGORIES.map(c => `<option value="${c}" ${state.filters.category === c ? 'selected' : ''}>${CATEGORY_LABELS[state.language][c]}</option>`).join('')}
        </select>
        <select class="filter-select" id="filterBudget">
          <option value="">${L('allBudgets')}</option>
          <option value="under5m" ${state.filters.budget === 'under5m' ? 'selected' : ''}>${L('under5m')}</option>
          <option value="5to10" ${state.filters.budget === '5to10' ? 'selected' : ''}>${L('range5to10')}</option>
          <option value="10to20" ${state.filters.budget === '10to20' ? 'selected' : ''}>${L('range10to20')}</option>
          <option value="above20m" ${state.filters.budget === 'above20m' ? 'selected' : ''}>${L('above20m')}</option>
        </select>
        <select class="filter-select" id="filterDeadline">
          <option value="">${L('allDeadlines')}</option>
          <option value="within7" ${state.filters.deadline === 'within7' ? 'selected' : ''}>${L('within7days')}</option>
          <option value="within30" ${state.filters.deadline === 'within30' ? 'selected' : ''}>${L('within30days')}</option>
          <option value="moreThan30" ${state.filters.deadline === 'moreThan30' ? 'selected' : ''}>${L('moreThan30')}</option>
        </select>
      </div>

      ${projects.length === 0 ? `
        <div class="no-results">
          ${ICONS.search}
          <h3>${L('noResults')}</h3>
          <p>${L('noResultsDesc')}</p>
        </div>
      ` : `
        <div class="projects-grid">
          ${projects.map(p => renderProjectCard(p)).join('')}
        </div>
      `}
    </div>
  `;
}

function renderProjectCard(project) {
  const isBookmarked = state.bookmarks.has(project.id);
  const closing = isClosingSoon(project.deadline);
  const isNewItem = isNew(project.publishDate);
  const days = daysUntil(project.deadline);
  const catClass = getCategoryClass(project.category);
  const catLabel = CATEGORY_LABELS[state.language][project.category];

  // Dot Status tags
  let statusTagClass = 'tag open-dot';
  let statusText = state.language === 'th' ? '● เปิดรับข้อเสนอ' : '● Open';
  if (closing) {
    statusTagClass = 'tag closing-soon-dot';
    statusText = state.language === 'th' ? '● ใกล้ปิดรับ' : '● Closing Soon';
  } else if (days < 0) {
    statusTagClass = 'tag closed-dot';
    statusText = state.language === 'th' ? '● ปิดรับข้อเสนอ' : '● Closed';
  }

  return `
    <div class="project-card" onclick="navigate('detail', ${project.id})">
      <div>
        <div class="project-card-header">
          <div class="project-card-tags">
            <span class="tag software">${L('softwareProject')}</span>
            <span class="tag category ${catClass}">${catLabel}</span>
            <span class="${statusTagClass}">${statusText}</span>
          </div>
          <button class="bookmark-btn ${isBookmarked ? 'active' : ''}" onclick="toggleBookmark(${project.id}, event)">
            ${isBookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}
          </button>
        </div>
        <div class="ai-tag-label">AI classification · Confidence: High</div>
        <h3 class="project-card-title" style="margin-top: 6px">${getLocalizedText(project.title)}</h3>
        <div class="project-card-dept">
          ${ICONS.building}
          ${getLocalizedText(project.department)}
        </div>
      </div>
      <div>
        <div class="project-card-meta">
          <div class="meta-item">
            <span class="meta-label">${L('budget')}</span>
            <span class="meta-value budget">${formatBudget(project.budget)}</span>
            <span style="font-size:10px; color:var(--gray-500)">AI extracted</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${L('deadline')}</span>
            <span class="meta-value ${closing ? 'deadline-soon' : ''}">${formatDate(project.deadline)}${closing ? ` (${days}${state.language === 'th' ? ' วัน' : 'd'})` : ''}</span>
            <span style="font-size:10px; color:var(--gray-500)">AI extracted</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${L('publishDate')}</span>
            <span class="meta-value">${formatDate(project.publishDate)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${L('procurementType')}</span>
            <span class="meta-value">${project.procurementType}</span>
          </div>
        </div>
        <div class="source-label">
          Source: ${project.sourceDocument || 'BMA TOR'} • Updated: 11 Aug 2026
        </div>
      </div>
    </div>
  `;
}

// ========== PROJECT DETAIL PAGE ==========
function renderDetail() {
  const project = PROJECTS.find(p => p.id === state.selectedProjectId);
  if (!project) return '<div class="page-content"><p>Project not found</p></div>';

  const isBookmarked = state.bookmarks.has(project.id);
  const catClass = getCategoryClass(project.category);
  const catLabel = CATEGORY_LABELS[state.language][project.category];
  const closing = isClosingSoon(project.deadline);
  const isNewItem = isNew(project.publishDate);
  const days = daysUntil(project.deadline);
  const budgetStatus = getBudgetStatus(project.budget, project.historicalAvg);
  
  // Budget bar scaling calculation
  const maxVal = Math.max(project.budget, project.historicalAvg);
  const budgetPct = Math.round((project.budget / maxVal) * 100);
  const avgPct = Math.round((project.historicalAvg / maxVal) * 100);

  const statusLabel = budgetStatus === 'above' ? L('aboveAvg') : budgetStatus === 'below' ? L('belowAvg') : L('withinRange');
  const statusIcon = budgetStatus === 'above' ? ICONS.trendUp : budgetStatus === 'below' ? ICONS.trendDown : ICONS.check;

  // Qualifications list and checklist logic
  const quals = getLocalizedText(project.qualifications);
  const checkedIndices = state.eligibilityChecks[project.id] || [];
  const checkedCount = checkedIndices.length;
  const totalCount = quals.length;
  const matchPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  
  let matchStatusText = '';
  let matchStatusClass = '';
  if (matchPct === 100) {
    matchStatusText = state.language === 'th' ? 'ผ่านเกณฑ์ (Go)' : 'Eligible (Go)';
    matchStatusClass = 'green';
  } else if (matchPct >= 60) {
    matchStatusText = state.language === 'th' ? 'ต้องพิจารณาเพิ่มเติม (Review)' : 'Needs Review';
    matchStatusClass = 'amber';
  } else {
    matchStatusText = state.language === 'th' ? 'คุณสมบัติไม่ครบ (No-Go)' : 'Ineligible (No-Go)';
    matchStatusClass = 'red';
  }

  // Dot Status tags
  let statusTagClass = 'tag open-dot';
  let statusText = state.language === 'th' ? '● เปิดรับข้อเสนอ' : '● Open';
  if (closing) {
    statusTagClass = 'tag closing-soon-dot';
    statusText = state.language === 'th' ? '● ใกล้ปิดรับ' : '● Closing Soon';
  } else if (days < 0) {
    statusTagClass = 'tag closed-dot';
    statusText = state.language === 'th' ? '● ปิดรับข้อเสนอ' : '● Closed';
  }

  return `
    <div class="page-content">
      <button class="detail-back-btn" onclick="navigate('dashboard')">
        ${ICONS.arrowLeft}
        ${L('backToList')}
      </button>

      <div class="detail-grid">
        <div class="detail-main">
          <!-- Hero Card -->
          <div class="detail-card detail-hero">
            <div class="detail-hero-tags">
              <span class="tag software">${L('softwareProject')}</span>
              <span class="tag category ${catClass}">${catLabel}</span>
              <span class="${statusTagClass}">${statusText}</span>
            </div>
            <h1 class="detail-hero-title">${getLocalizedText(project.title)}</h1>
            <div class="detail-hero-dept">
              ${ICONS.building}
              ${getLocalizedText(project.department)}
            </div>
            <div class="detail-meta-grid">
              <div class="detail-meta-item">
                <div class="meta-label">${L('budget')}</div>
                <div class="meta-value budget" style="font-weight: 700">${formatBudgetFull(project.budget)}</div>
                <span class="ai-extract-label">Extracted from TOR document</span>
              </div>
              <div class="detail-meta-item">
                <div class="meta-label">${L('procurementType')}</div>
                <div class="meta-value" style="font-weight: 700">${project.procurementType}</div>
                <span class="ai-extract-label">AI extracted</span>
              </div>
              <div class="detail-meta-item">
                <div class="meta-label">${L('publishDate')}</div>
                <div class="meta-value" style="font-weight: 700">${formatDate(project.publishDate)}</div>
                <span class="ai-extract-label">AI extracted</span>
              </div>
              <div class="detail-meta-item">
                <div class="meta-label">${L('deadline')}</div>
                <div class="meta-value ${closing ? 'deadline-soon' : ''}" style="font-weight: 700">${formatDate(project.deadline)}</div>
                <span class="ai-extract-label">AI extracted</span>
              </div>
            </div>
            <div class="detail-hero-actions">
              <button class="btn btn-primary" onclick="alert('${state.language === 'th' ? 'ลิงก์ไปยังเอกสาร TOR กทม. (ต้นฉบับ)' : 'Redirecting to original BMA TOR document (mockup link)'}')">
                ${ICONS.externalLink}
                ${L('downloadTOR')}
              </button>
              <button class="btn btn-bookmark ${isBookmarked ? 'active' : ''}" onclick="toggleBookmark(${project.id})">
                ${isBookmarked ? ICONS.bookmarkFilled : ICONS.bookmark}
                <span>${isBookmarked ? L('saved') : L('saveBookmark')}</span>
              </button>
            </div>
          </div>

          <!-- Description -->
          <div class="detail-card">
            <h2 class="detail-card-title">
              ${ICONS.file}
              <span>${L('projectDesc')}</span>
            </h2>
            <p class="description-text">${getLocalizedText(project.description)}</p>
          </div>

          <!-- Scope of Work -->
          <div class="detail-card">
            <h2 class="detail-card-title">
              ${ICONS.target}
              <span>${L('scopeOfWork')}</span>
            </h2>
            <ul class="scope-list">
              ${getLocalizedText(project.scope).map(item => `
                <li class="scope-item">
                  <span class="scope-bullet">●</span>
                  <span>${item}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Qualifications (Interactive Bidder Eligibility Checklist) -->
          <div class="detail-card qualifications-card">
            <div class="qualifications-badge">
              ${ICONS.shield}
              <span>${L('bidderQualifications')}</span>
            </div>
            <p style="font-size: 13px; color: var(--gray-700); margin-bottom: 16px; font-weight: 500;">
              ${state.language === 'th' 
                ? '💡 เครื่องมือตรวจสอบคุณสมบัติของผู้เสนอราคา: ทำเครื่องหมายคุณสมบัติที่บริษัทของคุณมี เพื่อประเมินความพร้อมเสนอราคา' 
                : '💡 Bidder Eligibility Checklist: Check the qualifications your organization matches to evaluate proposal compatibility.'}
            </p>

            <div class="eligibility-checklist">
              ${quals.map((q, idx) => {
                const isChecked = checkedIndices.includes(idx);
                return `
                  <div class="checklist-item ${isChecked ? 'checked' : ''}" onclick="toggleEligibilityCheck(${project.id}, ${idx})">
                    <div class="checklist-checkbox">
                      ${ICONS.check}
                    </div>
                    <div class="checklist-text">${q}</div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Gauge Panel -->
            <div class="gauge-wrapper">
              <div class="gauge-header-text">
                ${state.language === 'th' ? 'สรุปอัตราความสอดคล้องทางธุรกิจ (Go / No-Go)' : 'Go / No-Go Eligibility Analysis'}
              </div>
              <div class="gauge-container">
                <div class="gauge-fill ${matchPct === 100 ? 'high' : matchPct >= 60 ? 'mid' : ''}" style="width: ${matchPct}%"></div>
              </div>
              <div class="gauge-status-row">
                <div class="gauge-score">${matchPct}%</div>
                <div class="gauge-badge ${matchStatusClass}">${matchStatusText}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="detail-sidebar-col">
          <!-- Budget Comparison -->
          <div class="detail-card budget-comparison">
            <h2 class="detail-card-title">
              ${ICONS.chart}
              <span>${L('budgetComparison')}</span>
            </h2>
            <div class="budget-comparison-indicator ${budgetStatus}">
              ${statusIcon}
              <span>${statusLabel}</span>
            </div>
            <div class="budget-bar-chart">
              <div class="budget-bar-row">
                <div class="budget-bar-label">${L('currentProject')}</div>
                <div class="budget-bar-track">
                  <div class="budget-bar-fill current" style="width:${budgetPct}%">${formatBudget(project.budget)}</div>
                </div>
              </div>
              <div class="budget-bar-row">
                <div class="budget-bar-label">${L('historicalAvg')}</div>
                <div class="budget-bar-track">
                  <div class="budget-bar-fill avg" style="width:${avgPct}%">${formatBudget(project.historicalAvg)}</div>
                </div>
              </div>
            </div>
            
            <!-- Analysis Disclaimer -->
            <span class="analysis-disclaimer">
              ${state.language === 'th'
                ? 'การวิเคราะห์เปรียบเทียบงบประมาณย้อนหลังจัดทำขึ้นเพื่อให้ข้อมูลเบื้องต้นเท่านั้น ไม่ใช่การประเมินราคาอย่างเป็นทางการจากหน่วยงาน กทม.'
                : 'Historical comparisons are indicative and should not be interpreted as an official assessment of procurement fairness, pricing, or value.'}
            </span>
            
            <div style="margin-top:16px; text-align:center">
              <button class="btn btn-secondary" onclick="navigate('historical')" style="width:100%; justify-content: center;">
                ${ICONS.chart}
                <span>${state.language === 'th' ? 'ดูข้อมูลเปรียบเทียบราคา' : 'View Price Comparisons'}</span>
              </button>
            </div>
          </div>

          <!-- Quick Info -->
          <div class="detail-card">
            <h2 class="detail-card-title">
              ${ICONS.info}
              <span>${state.language === 'th' ? 'แหล่งที่มา & ความโปร่งใส' : 'Source & Transparency'}</span>
            </h2>
            <div style="display:flex;flex-direction:column;gap:12px;">
              <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gray-200);">
                <span style="font-size:12px;color:var(--gray-500)">Source Document</span>
                <span style="font-size:12.5px;font-weight:600;color:var(--gray-900)">${project.sourceDocument || 'BMA TOR PDF'}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gray-200);">
                <span style="font-size:12px;color:var(--gray-500)">Last Extracted</span>
                <span style="font-size:12.5px;font-weight:600;color:var(--gray-900)">${project.processedDate || '2026-08-11'}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--gray-200);">
                <span style="font-size:12px;color:var(--gray-500)">Extraction Status</span>
                <span style="font-size:12.5px;font-weight:600;color:var(--success)">✓ Verified</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;">
                <span style="font-size:12px;color:var(--gray-500)">AI Confidence</span>
                <span style="font-size:12.5px;font-weight:600;color:var(--primary-700)">High</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ========== HISTORICAL DATA / CHART PAGE ==========
function renderHistorical() {
  const historicalData = getFilteredHistorical();
  const depts = [...new Set(HISTORICAL_DATA.map(d => d.department.th))];
  const years = [...new Set(HISTORICAL_DATA.map(d => d.year))].sort((a, b) => b - a);

  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">${L('historicalTitle')}</h1>
        <p class="page-subtitle">${L('historicalSub')}</p>
      </div>

      <!-- Budget Comparison Chart -->
      <div class="chart-container">
        <div class="chart-header">
          <h2 class="chart-title">${L('budgetChart')}</h2>
          <div class="chart-filters">
            <select class="filter-select" id="histFilterCategory">
              <option value="">${L('allCategories')}</option>
              ${CATEGORIES.map(c => `<option value="${c}" ${state.historicalFilters.category === c ? 'selected' : ''}>${CATEGORY_LABELS[state.language][c]}</option>`).join('')}
            </select>
            <select class="filter-select" id="histFilterDept">
              <option value="">${L('allDepts')}</option>
              ${depts.map(d => `<option value="${d}" ${state.historicalFilters.department === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            <select class="filter-select" id="histFilterYear">
              <option value="">${L('allYears')}</option>
              ${years.map(y => `<option value="${y}" ${state.historicalFilters.year == y ? 'selected' : ''}>${y + (state.language === 'th' ? 543 : 0)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="position:relative; height:300px; width:100%;">
          <canvas id="budgetChart"></canvas>
        </div>
      </div>

      <!-- Current Projects vs Historical Average -->
      <div class="chart-container">
        <h2 class="chart-title" style="margin-bottom:16px; border-bottom:1px solid var(--gray-200); padding-bottom:8px">
          ${state.language === 'th' ? 'โครงการปัจจุบันเปรียบเทียบราคากลางเฉลี่ย' : 'Current Projects vs Historical Average'}
        </h2>
        <div style="position:relative; height:280px; width:100%;">
          <canvas id="comparisonChart"></canvas>
        </div>
      </div>

      <!-- Historical Data Table -->
      <div class="chart-container">
        <h2 class="chart-title" style="margin-bottom:16px; border-bottom:1px solid var(--gray-200); padding-bottom:8px">
          ${state.language === 'th' ? 'ตารางข้อมูลย้อนหลัง' : 'Historical Data'}
        </h2>
        <div class="historical-table-wrapper">
          <table class="historical-table">
            <thead>
              <tr>
                <th>${L('projectName')}</th>
                <th>${L('department')}</th>
                <th>${L('category')}</th>
                <th>${L('year')}</th>
                <th>${L('budget')}</th>
                <th>${L('budgetAnalysis')}</th>
              </tr>
            </thead>
            <tbody>
              ${historicalData.map(d => {
                const catAvg = getCategoryAvg(d.category);
                const ratio = d.budget / catAvg;
                let outlierClass = 'normal';
                let outlierText = state.language === 'th' ? 'ปกติ' : 'Normal';
                if (ratio > 1.3) { outlierClass = 'high'; outlierText = state.language === 'th' ? 'สูงกว่าค่าเฉลี่ย' : 'Above Avg'; }
                if (ratio < 0.7) { outlierClass = 'low'; outlierText = state.language === 'th' ? 'ต่ำกว่าค่าเฉลี่ย' : 'Below Avg'; }
                return `
                  <tr>
                    <td style="font-weight:600; color:var(--gray-950)">${getLocalizedText(d.title)}</td>
                    <td>${getLocalizedText(d.department)}</td>
                    <td><span class="tag category">${CATEGORY_LABELS[state.language][d.category]}</span></td>
                    <td>${d.year + (state.language === 'th' ? 543 : 0)}</td>
                    <td style="font-weight:700; color:var(--gray-950)">${formatBudget(d.budget)}</td>
                    <td><span class="outlier-badge ${outlierClass}">${outlierText}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <!-- Global Disclaimer -->
        <span class="analysis-disclaimer" style="margin-top: 14px">
          ${state.language === 'th'
            ? 'การวิเคราะห์เปรียบเทียบงบประมาณย้อนหลังจัดทำขึ้นเพื่อให้ข้อมูลเบื้องต้นเท่านั้น ไม่ใช่การประเมินราคาอย่างเป็นทางการจากหน่วยงาน กทม.'
            : 'Historical comparisons are indicative and should not be interpreted as an official assessment of procurement fairness, pricing, or value.'}
        </span>
      </div>
    </div>
  `;
}

function getCategoryAvg(category) {
  const items = HISTORICAL_DATA.filter(d => d.category === category);
  if (items.length === 0) return 0;
  return items.reduce((s, d) => s + d.budget, 0) / items.length;
}

function renderCharts() {
  if (state.charts.budget) {
    state.charts.budget.destroy();
    state.charts.budget = null;
  }
  if (state.charts.comparison) {
    state.charts.comparison.destroy();
    state.charts.comparison = null;
  }

  const historicalData = getFilteredHistorical();
  const isDark = state.theme === 'dark';

  // Chart 1: Historical budgets bar chart (TORBIDD color theme)
  const ctx1 = document.getElementById('budgetChart');
  if (ctx1) {
    state.charts.budget = new Chart(ctx1.getContext('2d'), {
      type: 'bar',
      data: {
        labels: historicalData.map(d => {
          const text = getLocalizedText(d.title);
          return text.length > 20 ? text.substring(0, 20) + '...' : text;
        }),
        datasets: [{
          label: state.language === 'th' ? 'งบประมาณ (ล้านบาท)' : 'Budget (M THB)',
          data: historicalData.map(d => d.budget / 1000000),
          backgroundColor: historicalData.map(d => {
            const avg = getCategoryAvg(d.category);
            const ratio = d.budget / avg;
            if (ratio > 1.3) return isDark ? 'rgba(248, 113, 113, 0.8)' : 'rgba(196, 69, 69, 0.8)'; // Red
            if (ratio < 0.7) return isDark ? 'rgba(75, 156, 203, 0.5)' : 'rgba(39, 115, 165, 0.5)'; // Accent Tint
            return isDark ? 'rgba(75, 156, 203, 0.8)' : 'rgba(39, 115, 165, 0.8)'; // Brand primary Blue
          }),
          borderColor: historicalData.map(d => {
            const avg = getCategoryAvg(d.category);
            const ratio = d.budget / avg;
            if (ratio > 1.3) return isDark ? 'rgb(248, 113, 113)' : 'rgb(196, 69, 69)';
            if (ratio < 0.7) return isDark ? 'rgb(75, 156, 203)' : 'rgb(39, 115, 165)';
            return isDark ? 'rgb(75, 156, 203)' : 'rgb(39, 115, 165)';
          }),
          borderWidth: 1.5,
          borderRadius: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.parsed.y.toFixed(2)} M THB`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: state.language === 'th' ? 'ล้านบาท (M THB)' : 'Budget (M THB)',
              font: { family: 'Noto Sans Thai, sans-serif', weight: 'bold' },
              color: isDark ? '#f1f5f9' : '#24313d'
            },
            grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            ticks: { color: isDark ? '#94a3b8' : '#71808c' }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 9.5, family: 'Noto Sans Thai, sans-serif' },
              maxRotation: 20,
              color: isDark ? '#94a3b8' : '#71808c'
            }
          }
        }
      }
    });
  }

  // Chart 2: Current vs historical average comparison chart
  const ctx2 = document.getElementById('comparisonChart');
  if (ctx2) {
    state.charts.comparison = new Chart(ctx2.getContext('2d'), {
      type: 'bar',
      data: {
        labels: PROJECTS.map(p => {
          const text = getLocalizedText(p.title);
          return text.length > 20 ? text.substring(0, 20) + '...' : text;
        }),
        datasets: [
          {
            label: state.language === 'th' ? 'งบประมาณโครงการ' : 'Project Budget',
            data: PROJECTS.map(p => p.budget / 1000000),
            backgroundColor: isDark ? 'rgba(75, 156, 203, 0.85)' : 'rgba(39, 115, 165, 0.85)',
            borderColor: isDark ? 'rgb(75, 156, 203)' : 'rgb(39, 115, 165)',
            borderWidth: 1.5,
            borderRadius: 3,
          },
          {
            label: state.language === 'th' ? 'ค่าเฉลี่ยประเภทโครงการย้อนหลัง' : 'Historical Average',
            data: PROJECTS.map(p => p.historicalAvg / 1000000),
            backgroundColor: isDark ? 'rgba(148, 163, 184, 0.6)' : 'rgba(113, 128, 140, 0.6)',
            borderColor: isDark ? 'rgb(148, 163, 184)' : 'rgb(113, 128, 140)',
            borderWidth: 1.5,
            borderRadius: 3,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { family: 'Noto Sans Thai, sans-serif', size: 12, weight: 'bold' },
              usePointStyle: true,
              pointStyle: 'rectRounded',
              color: isDark ? '#cbd5e1' : '#4b5965'
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} M THB`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: state.language === 'th' ? 'ล้านบาท (M THB)' : 'M THB',
              font: { family: 'Noto Sans Thai, sans-serif', weight: 'bold' },
              color: isDark ? '#f1f5f9' : '#24313d'
            },
            grid: { color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
            ticks: { color: isDark ? '#94a3b8' : '#71808c' }
          },
          x: {
            grid: { display: false },
            ticks: {
              font: { size: 9.5, family: 'Noto Sans Thai, sans-serif' },
              maxRotation: 20,
              color: isDark ? '#94a3b8' : '#71808c'
            }
          }
        }
      }
    });
  }
}

// ========== SAVED OPPORTUNITIES PAGE ==========
function renderSaved() {
  const savedProjects = PROJECTS.filter(p => state.bookmarks.has(p.id));

  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">${L('savedTitle')}</h1>
        <p class="page-subtitle">${L('savedSub')}</p>
      </div>

      ${savedProjects.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">
            ${ICONS.bookmark}
          </div>
          <h3>${L('noSaved')}</h3>
          <p>${L('noSavedDesc')}</p>
          <button class="btn btn-primary" onclick="navigate('dashboard')" style="margin-top:20px">
            ${ICONS.dashboard}
            <span>${state.language === 'th' ? 'ดูโอกาสทั้งหมด' : 'Browse Opportunities'}</span>
          </button>
        </div>
      ` : `
        <div class="projects-grid">
          ${savedProjects.map(p => renderProjectCard(p)).join('')}
        </div>
      `}
    </div>
  `;
}

// ========== NOTIFICATIONS & PREFERENCES PAGE ==========
function renderNotifications() {
  return `
    <div class="page-content">
      <div class="page-header">
        <h1 class="page-title">${L('settingsTitle')}</h1>
        <p class="page-subtitle">${L('settingsSub')}</p>
      </div>

      <div class="settings-grid">
        <!-- Email Notification Panel -->
        <div class="settings-card">
          <h3 class="settings-card-title">${L('emailNotif')}</h3>
          <p class="settings-card-desc">${L('emailNotifDesc')}</p>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">${L('dailyDigest')}</div>
              <div class="toggle-sublabel">${L('dailyDigestDesc')}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggleDailyDigest" ${state.settings.dailyDigest ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">${L('closingAlert')}</div>
              <div class="toggle-sublabel">${L('closingAlertDesc')}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggleClosingAlert" ${state.settings.closingAlert ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>

          <div class="toggle-row">
            <div>
              <div class="toggle-label">${L('newProjectAlert')}</div>
              <div class="toggle-sublabel">${L('newProjectAlertDesc')}</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="toggleNewProject" ${state.settings.newProjectAlert ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Budget Range Selection -->
        <div class="settings-card">
          <h3 class="settings-card-title">${L('budgetPref')}</h3>
          <p class="settings-card-desc">${L('budgetPrefDesc')}</p>
          <div class="budget-range-inputs">
            <input type="number" id="budgetMin" placeholder="${L('budgetMin')}" value="${state.settings.budgetMin}">
            <span>—</span>
            <input type="number" id="budgetMax" placeholder="${L('budgetMax')}" value="${state.settings.budgetMax}">
          </div>
        </div>

        <!-- Industry/Interest Tags -->
        <div class="settings-card" style="grid-column: 1 / -1;">
          <h3 class="settings-card-title">${L('interestTags')}</h3>
          <p class="settings-card-desc">${L('interestTagsDesc')}</p>
          <div class="interest-tags-grid">
            ${CATEGORIES.map(c => `
              <button class="interest-tag ${state.settings.interestTags.includes(c) ? 'active' : ''}" data-tag="${c}">
                ${state.settings.interestTags.includes(c) ? '✓ ' : ''}${CATEGORY_LABELS[state.language][c]}
              </button>
            `).join('')}
            <button class="interest-tag ${state.settings.interestTags.includes('Cloud') ? 'active' : ''}" data-tag="Cloud">
              ${state.settings.interestTags.includes('Cloud') ? '✓ ' : ''}${state.language === 'th' ? 'ระบบ Cloud' : 'Cloud'}
            </button>
            <button class="interest-tag ${state.settings.interestTags.includes('Security') ? 'active' : ''}" data-tag="Security">
              ${state.settings.interestTags.includes('Security') ? '✓ ' : ''}${state.language === 'th' ? 'ความปลอดภัย' : 'Security'}
            </button>
            <button class="interest-tag ${state.settings.interestTags.includes('IoT') ? 'active' : ''}" data-tag="IoT">
              ${state.settings.interestTags.includes('IoT') ? '✓ ' : ''}IoT
            </button>
            <button class="interest-tag ${state.settings.interestTags.includes('Blockchain') ? 'active' : ''}" data-tag="Blockchain">
              ${state.settings.interestTags.includes('Blockchain') ? '✓ ' : ''}Blockchain
            </button>
          </div>
          <div class="settings-save-btn">
            <button class="btn btn-primary" onclick="saveSettings()">
              ${ICONS.check}
              <span>${L('saveSettings')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function saveSettings() {
  showToast(L('settingsSaved'), ICONS.check);
}

// ========== EVENT ATTACHERS & LISTENERS ==========
function attachEventListeners() {
  // Search Input listener (Opportunities page)
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      debounceRenderCards();
    });
  }

  // Hero Search box on home page
  const heroForm = document.getElementById('heroSearchForm');
  if (heroForm) {
    heroForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const heroVal = document.getElementById('heroSearchInput').value;
      state.searchQuery = heroVal;
      navigate('dashboard');
    });
  }

  // Dashboard Filters Select elements
  ['filterDept', 'filterCategory', 'filterBudget', 'filterDeadline'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', (e) => {
        const key = id.replace('filter', '').toLowerCase();
        const keyMap = { dept: 'department', category: 'category', budget: 'budget', deadline: 'deadline' };
        state.filters[keyMap[key]] = e.target.value;
        render();
      });
    }
  });

  // Historical Analysis Filters
  ['histFilterCategory', 'histFilterDept', 'histFilterYear'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', (e) => {
        const key = id.replace('histFilter', '').toLowerCase();
        state.historicalFilters[key] = e.target.value;
        render();
      });
    }
  });

  // Settings Screen Switches
  const toggleMap = {
    toggleDailyDigest: 'dailyDigest',
    toggleClosingAlert: 'closingAlert',
    toggleNewProject: 'newProjectAlert',
  };
  Object.entries(toggleMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', (e) => {
        state.settings[key] = e.target.checked;
      });
    }
  });

  // Settings Budget Filters
  const budgetMin = document.getElementById('budgetMin');
  const budgetMax = document.getElementById('budgetMax');
  if (budgetMin) budgetMin.addEventListener('input', (e) => { state.settings.budgetMin = e.target.value; });
  if (budgetMax) budgetMax.addEventListener('input', (e) => { state.settings.budgetMax = e.target.value; });

  // Settings Interest Tag Buttons
  document.querySelectorAll('.interest-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      const idx = state.settings.interestTags.indexOf(tag);
      if (idx > -1) {
        state.settings.interestTags.splice(idx, 1);
      } else {
        state.settings.interestTags.push(tag);
      }
      render();
    });
  });
}

// Debounce rendering logic for search
let renderTimer;
function debounceRenderCards() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    const projects = getFilteredProjects();
    const grid = document.querySelector('.projects-grid');
    const noResults = document.querySelector('.no-results');
    if (grid) {
      if (projects.length === 0) {
        grid.style.display = 'none';
        if (!noResults) {
          grid.insertAdjacentHTML('afterend', `
            <div class="no-results">
              ${ICONS.search}
              <h3>${L('noResults')}</h3>
              <p>${L('noResultsDesc')}</p>
            </div>
          `);
        }
      } else {
        grid.style.display = '';
        grid.innerHTML = projects.map(p => renderProjectCard(p)).join('');
        if (noResults) noResults.remove();
      }
    }
  }, 180);
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
  render();
});
