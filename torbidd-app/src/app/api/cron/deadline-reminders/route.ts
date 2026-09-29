// =============================================================================
// app/api/cron/deadline-reminders/route.ts - Scheduled Deadline Reminder Cron Job
// Triggered by scheduled cron or admin worker to evaluate approaching deadlines
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { scanAndSendDeadlineReminders } from '@/services/notifications/deadline-scanner';

export async function GET(req: NextRequest) {
  // Verify optional cron secret if defined in environment
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  try {
    const summary = await scanAndSendDeadlineReminders();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to execute deadline reminder scanner' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
