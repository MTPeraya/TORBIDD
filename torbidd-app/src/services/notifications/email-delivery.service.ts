// =============================================================================
// services/notifications/email-delivery.service.ts
// Outbound Email Delivery Service for TORBIDD Procurement Alerts (UC-6)
// Supports SMTP (Nodemailer), safe mock fallback, HTML templates, and deduplication
// =============================================================================

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { OpportunityEmailPayload, DeadlineReminderEmailPayload } from '@/types/notification';

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

export interface SentEmailRecord {
  to: string;
  subject: string;
  html: string;
  text: string;
  sentAt: Date;
  messageId: string;
}

export class EmailDeliveryService {
  private static instance: EmailDeliveryService;
  private transporter: Transporter | null = null;
  private isConfigured = false;
  private sentEmails: SentEmailRecord[] = [];
  private sentKeys: Map<string, number> = new Map(); // deduplication key -> timestamp
  private readonly deduplicationWindowMs = 60 * 60 * 1000; // 1 hour

  private constructor() {
    this.initTransporter();
  }

  public static getInstance(): EmailDeliveryService {
    if (!EmailDeliveryService.instance) {
      EmailDeliveryService.instance = new EmailDeliveryService();
    }
    return EmailDeliveryService.instance;
  }

  private initTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
        });
        this.isConfigured = true;
      } catch (err) {
        console.warn('[EmailDeliveryService] Failed to initialize SMTP transporter; using simulated delivery mode:', (err as Error).message);
        this.transporter = null;
        this.isConfigured = false;
      }
    } else {
      // Development or test environment without SMTP
      this.isConfigured = false;
      this.transporter = null;
    }
  }

  /**
   * Resets sent emails log and deduplication cache (useful for testing).
   */
  public resetHistory(): void {
    this.sentEmails = [];
    this.sentKeys.clear();
  }

  /**
   * Returns list of sent emails (in simulated/test mode).
   */
  public getSentEmails(): SentEmailRecord[] {
    return [...this.sentEmails];
  }

  /**
   * Validates if email address format is broadly valid.
   */
  public isValidEmail(email?: string | null): boolean {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  /**
   * Checks whether an identical alert was dispatched within the deduplication window.
   */
  private isDuplicate(dedupKey: string): boolean {
    const now = Date.now();
    const lastSent = this.sentKeys.get(dedupKey);
    if (lastSent && now - lastSent < this.deduplicationWindowMs) {
      return true;
    }
    this.sentKeys.set(dedupKey, now);
    return false;
  }

  /**
   * Dispatches an opportunity alert email to a user when a procurement matches their criteria.
   */
  public async sendOpportunityAlert(payload: OpportunityEmailPayload): Promise<EmailSendResult> {
    const { recipientEmail, recipientName, project, matchReasons } = payload;

    if (!this.isValidEmail(recipientEmail)) {
      return { success: false, error: `Invalid recipient email address: "${recipientEmail}"` };
    }

    const projectId = String(project.id);
    const dedupKey = `opp_${recipientEmail}_${projectId}`;
    if (this.isDuplicate(dedupKey)) {
      return { success: true, simulated: true, messageId: `dedup-suppressed-${projectId}` };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    const detailUrl = `${baseUrl}/opportunities/${projectId}`;

    const titleTh = typeof project.title === 'object' ? project.title.th : String(project.title || '');
    const titleEn = typeof project.title === 'object' ? project.title.en : '';
    const displayTitle = titleEn ? `${titleTh} (${titleEn})` : titleTh;
    const deptTh = typeof project.department === 'object' ? project.department.th : String(project.department || 'กรุงเทพมหานคร');

    const formattedBudget = project.budget !== undefined && project.budget !== null
      ? `${Number(project.budget).toLocaleString('th-TH')} THB`
      : 'ตามที่กำหนดใน TOR / Unspecified';

    const deadlineStr = project.deadline
      ? new Date(project.deadline).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
      : 'ยังไม่ระบุ / Not specified';

    const reasonsList = (matchReasons && matchReasons.length > 0)
      ? matchReasons.map((r) => `<li>${r}</li>`).join('')
      : '<li>หมวดหมู่และงบประมาณตรงกับความสนใจ / Category & Budget matched</li>';

    const subject = `[TORBIDD แจ้งเตือน] พบโอกาสจัดซื้อใหม่ตรงตามความสนใจ: ${titleTh}`;

    const textContent = `
เรียน ${recipientName || 'ผู้ใช้งาน TORBIDD'},

ระบบ TORBIDD ตรวจพบโครงการจัดซื้อจัดจ้างใหม่ที่ตรงกับเงื่อนไขการแจ้งเตือนของคุณ:

หัวข้อโครงการ: ${titleTh}
หน่วยงานเจ้าของโครงการ: ${deptTh}
งบประมาณ: ${formattedBudget}
กำหนดการยื่นข้อเสนอ: ${deadlineStr}

เหตุผลที่ตรงเงื่อนไข:
${(matchReasons || []).join('\n')}

ดูรายละเอียดโครงการและข้อกำหนด TOR ได้ที่:
${detailUrl}

---
ข้อความนี้เป็นการแจ้งเตือนอัตโนมัติเนื่องจากท่านตั้งค่ารับอีเมลแจ้งเตือนในระบบ TORBIDD
ท่านสามารถปรับเปลี่ยนความสนใจหรือปิดการแจ้งเตือนได้ที่หน้าตั้งค่าของระบบ
    `.trim();

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #0ea5e9, #0284c7); padding: 24px 32px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 32px; }
    .project-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .project-title { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 12px; line-height: 1.4; }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .meta-label { color: #64748b; font-weight: 500; }
    .meta-value { color: #0f172a; font-weight: 600; text-align: right; }
    .reasons-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; margin: 18px 0; }
    .reasons-box h4 { margin: 0 0 8px; font-size: 13px; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px; }
    .reasons-box ul { margin: 0; padding-left: 20px; font-size: 13px; color: #047857; }
    .btn-container { text-align: center; margin: 30px 0 10px; }
    .btn { display: inline-block; background-color: #0284c7; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
    .footer { background: #f1f5f9; padding: 20px 32px; font-size: 12px; color: #64748b; line-height: 1.6; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>TORBIDD Opportunity Alert</h1>
      <p>แจ้งเตือนโครงการจัดซื้อจัดจ้างใหม่ตรงตามความสนใจของคุณ</p>
    </div>
    <div class="content">
      <p>เรียน <strong>${recipientName || 'ผู้ใช้งาน TORBIDD'}</strong>,</p>
      <p>ระบบตรวจพบประกาศจัดซื้อจัดจ้างฉบับใหม่ที่ตรงกับเงื่อนไขการแจ้งเตือนที่คุณกำหนดไว้:</p>

      <div class="project-card">
        <h2 class="project-title">${displayTitle}</h2>
        <div class="meta-row">
          <span class="meta-label">หน่วยงานเจ้าของโครงการ:</span>
          <span class="meta-value">${deptTh}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">งบประมาณโครงการ:</span>
          <span class="meta-value">${formattedBudget}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">กำหนดการยื่นข้อเสนอ:</span>
          <span class="meta-value">${deadlineStr}</span>
        </div>
      </div>

      <div class="reasons-box">
        <h4>เกณฑ์การจับคู่ที่ตรงกัน (Match Criteria)</h4>
        <ul>
          ${reasonsList}
        </ul>
      </div>

      <div class="btn-container">
        <a href="${detailUrl}" class="btn" target="_blank" rel="noopener">ดูรายละเอียดโครงการและข้อกำหนด TOR</a>
      </div>
    </div>
    <div class="footer">
      <p>อีเมลฉบับนี้ส่งถึง ${recipientEmail} ตามที่คุณได้เปิดรับการแจ้งเตือนทางอีเมลในระบบ TORBIDD</p>
      <p>หากต้องการแก้ไขเงื่อนไขหรือปิดการแจ้งเตือนทางอีเมล สามารถดำเนินการได้ที่ <a href="${baseUrl}/notifications" style="color: #0284c7;">การตั้งค่าการแจ้งเตือน</a></p>
    </div>
  </div>
</body>
</html>
    `.trim();

    return await this.dispatchMail({
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });
  }

  /**
   * Dispatches a deadline reminder alert.
   */
  public async sendDeadlineReminder(payload: DeadlineReminderEmailPayload): Promise<EmailSendResult> {
    const { recipientEmail, recipientName, project, daysRemaining } = payload;

    if (!this.isValidEmail(recipientEmail)) {
      return { success: false, error: `Invalid recipient email address: "${recipientEmail}"` };
    }

    const projectId = String(project.id);
    const dedupKey = `deadline_${recipientEmail}_${projectId}_${daysRemaining}d`;
    if (this.isDuplicate(dedupKey)) {
      return { success: true, simulated: true, messageId: `dedup-suppressed-${projectId}` };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'http://localhost:3000';
    const detailUrl = `${baseUrl}/opportunities/${projectId}`;
    const titleTh = typeof project.title === 'object' ? project.title.th : String(project.title);

    const subject = `[เตือนใกล้หมดเขต] เหลืออีก ${daysRemaining} วัน: ${titleTh}`;
    const textContent = `เรียน ${recipientName || 'ผู้ใช้งาน TORBIDD'},\n\nเตือนความจำ: โครงการ "${titleTh}" กำลังจะปิดรับข้อเสนอภายในอีก ${daysRemaining} วัน ดูรายละเอียดได้ที่: ${detailUrl}`;
    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #e11d48;">แจ้งเตือนใกล้ถึงกำหนดการยื่นข้อเสนอ</h2>
        <p>เรียน ${recipientName || 'ผู้ใช้งาน TORBIDD'},</p>
        <p>โครงการ <strong>${titleTh}</strong> กำลังจะปิดรับข้อเสนอในอีก <strong>${daysRemaining} วัน</strong></p>
        <p><a href="${detailUrl}" style="background: #e11d48; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">ดูรายละเอียดโครงการ</a></p>
      </div>
    `;

    return await this.dispatchMail({
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });
  }

  /**
   * Internal sender method. Isolates errors and prevents throwing uncaught exceptions.
   */
  private async dispatchMail(options: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<EmailSendResult> {
    const from = process.env.EMAIL_FROM || 'TORBIDD Procurement Alerts <notifications@torbidd.gov.th>';

    try {
      if (this.isConfigured && this.transporter) {
        const info = await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          text: options.text,
          html: options.html,
        });

        return {
          success: true,
          messageId: info.messageId,
          simulated: false,
        };
      } else {
        // Simulated delivery in dev/test environment
        const mockMessageId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        this.sentEmails.push({
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          sentAt: new Date(),
          messageId: mockMessageId,
        });

        console.info(`[EmailDeliveryService] [Simulated Delivery] Sent to ${options.to}: "${options.subject}"`);
        return {
          success: true,
          messageId: mockMessageId,
          simulated: true,
        };
      }
    } catch (err) {
      const errMsg = (err as Error).message || 'Unknown SMTP error';
      console.error(`[EmailDeliveryService] Failed to deliver email to ${options.to}:`, errMsg);
      return {
        success: false,
        error: errMsg,
      };
    }
  }
}

export const emailDeliveryService = EmailDeliveryService.getInstance();
