// =============================================================================
// scripts/send-test-email.ts
// Dispatch TORBIDD email alerts with REAL procurement data from MongoDB
//
// Usage:
//   npx tsx scripts/send-test-email.ts <recipient@email.com> [projectId]
//
// Examples:
//   npx tsx scripts/send-test-email.ts user@example.com
//   npx tsx scripts/send-test-email.ts user@example.com 10
//   npx tsx scripts/send-test-email.ts --list
// =============================================================================

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import mongoose from 'mongoose';
import connectToDatabase from '../src/lib/mongodb';
import Project from '../src/models/Project';
import User from '../src/models/User';
import { emailDeliveryService } from '../src/services/notifications/email-delivery.service';

async function main() {
  await connectToDatabase();

  const args = process.argv.slice(2);

  // If user passed --list, show all available real projects and users in DB
  if (args.includes('--list')) {
    console.log('\n📋 Real Projects currently in MongoDB:');
    const allProjects = await Project.find({}).sort({ externalId: -1 });
    allProjects.forEach((p) => {
      console.log(`  [ID: ${p.externalId}] ${p.title?.th || p.title} (${p.category}) - Budget: ${Number(p.budget).toLocaleString()} THB`);
    });

    console.log('\n👥 Registered Users in MongoDB:');
    const allUsers = await User.find({}).limit(10);
    allUsers.forEach((u) => {
      console.log(`  - ${u.name} <${u.email}> [${u.role}]`);
    });
    process.exit(0);
  }

  // Determine recipient
  let recipientEmail = args[0];
  if (!recipientEmail || recipientEmail.startsWith('--')) {
    recipientEmail = process.env.SMTP_USER || 'rosesmonett@gmail.com';
  }

  // Determine which real project to send
  const requestedId = args[1] ? Number(args[1]) : undefined;
  let targetProject;

  if (requestedId && !isNaN(requestedId)) {
    targetProject = await Project.findOne({ externalId: requestedId });
    if (!targetProject) {
      console.warn(`⚠️ Project with externalId ${requestedId} not found, fetching the latest real project...`);
    }
  }

  if (!targetProject) {
    targetProject = await Project.findOne({}).sort({ externalId: -1 });
  }

  if (!targetProject) {
    console.error('❌ No projects found in database. Please run `npm run seed` first.');
    process.exit(1);
  }

  // Find user name if registered
  const existingUser = await User.findOne({ email: recipientEmail });
  const recipientName = existingUser ? existingUser.name : 'ผู้ใช้งานระบบ TORBIDD';

  console.log('============================================================');
  console.log(`🚀 Dispatching TORBIDD Alerts with REAL DATABASE DATA`);
  console.log('============================================================');
  console.log(`📬 Recipient:       ${recipientEmail} (${recipientName})`);
  console.log(`📄 Selected Project: [ID ${targetProject.externalId}] ${targetProject.title?.th}`);
  console.log(`💰 Budget:           ${Number(targetProject.budget).toLocaleString()} THB`);
  console.log(`🏢 Department:       ${targetProject.department?.th}`);
  console.log(`🏷️ Category:         ${targetProject.category}`);
  console.log(`📡 SMTP Server:      ${process.env.SMTP_HOST || 'Simulated'}:${process.env.SMTP_PORT || 587}`);
  console.log(`👤 SMTP Sender:      ${process.env.EMAIL_FROM || process.env.SMTP_USER}`);
  console.log('============================================================\n');

  // Reset deduplication cache so multiple test runs to the same recipient succeed
  emailDeliveryService.resetHistory();

  // Construct realistic match criteria based on real project fields
  const matchReasons = [
    `ตรงตามหมวดหมู่เทคโนโลยีที่สนใจ: ${targetProject.category}`,
    `ตรงตามหน่วยงานที่ติดตาม: ${targetProject.department?.th}`,
    `งบประมาณโครงการ (${Number(targetProject.budget).toLocaleString()} THB) อยู่ในเกณฑ์ที่กำหนด`,
  ];
  if (targetProject.requiredTechnologies && targetProject.requiredTechnologies.length > 0) {
    matchReasons.push(`มีทักษะเทคโนโลยีที่ต้องการ: ${targetProject.requiredTechnologies.join(', ')}`);
  }

  // 1. Send Opportunity Alert
  console.log('[1/2] 📨 Dispatching Real Opportunity Alert Email...');
  const oppResult = await emailDeliveryService.sendOpportunityAlert({
    recipientEmail,
    recipientName,
    project: {
      id: String(targetProject.externalId || targetProject._id),
      title: targetProject.title,
      department: targetProject.department,
      budget: targetProject.budget,
      deadline: targetProject.deadline,
      category: targetProject.category,
    },
    matchReasons,
  });

  console.log('Opportunity Alert Result:', oppResult);

  // 2. Send Deadline Reminder Alert
  console.log('\n[2/2] ⏰ Dispatching Real Deadline Reminder Alert...');
  // Calculate remaining days or default to 3 days for urgent reminder preview
  const daysDiff = Math.max(1, Math.min(3, Math.ceil((new Date(targetProject.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))));
  const daysRemaining = isNaN(daysDiff) || daysDiff <= 0 ? 3 : daysDiff;

  const deadlineResult = await emailDeliveryService.sendDeadlineReminder({
    recipientEmail,
    recipientName,
    project: {
      id: String(targetProject.externalId || targetProject._id),
      title: targetProject.title,
      department: targetProject.department,
      budget: targetProject.budget,
      deadline: targetProject.deadline,
      category: targetProject.category,
    },
    daysRemaining,
  });

  console.log('Deadline Reminder Result:', deadlineResult);

  // Summary
  console.log('\n============================================================');
  if (oppResult.simulated) {
    console.log('ℹ️  Note: Emails were sent in SIMULATED MODE because SMTP credentials were not found.');
  } else if (oppResult.success && deadlineResult.success) {
    console.log(`✅ Success! Real procurement alert emails were dispatched to: ${recipientEmail}`);
    console.log(`📬 Message IDs:`);
    console.log(`   - Opportunity Alert: ${oppResult.messageId}`);
    console.log(`   - Deadline Reminder: ${deadlineResult.messageId}`);
    console.log(`👉 Please check ${recipientEmail} (Inbox or Spam/Promotions folder).`);
  } else {
    console.log('⚠️ Delivery status:');
    if (oppResult.error) console.log('  - Opportunity Alert Error:', oppResult.error);
    if (deadlineResult.error) console.log('  - Deadline Reminder Error:', deadlineResult.error);
  }
  console.log('============================================================');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error in send-test-email:', err);
  process.exit(1);
});
