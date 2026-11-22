// =============================================================================
// app/api/cron/deadline-reminders/route.ts - Scheduled Deadline Reminder Cron Job
// Triggered by scheduled cron or admin worker to evaluate approaching deadlines
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { scanAndSendDeadlineReminders } from '@/services/notifications/deadline-scanner';
import { checkRateLimit, getClientIp, rateLimitHeaders } from '@/lib/rate-limiter';

const CRON_LIMITER = {
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 30,
  label: 'cron-deadline-reminders',
};

export async function GET(req: NextRequest) {
  // Rate limiting per IP (T-03)
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit('cron-deadline-reminders', clientIp, CRON_LIMITER);
  const responseHeaders = rateLimitHeaders(rateLimit, CRON_LIMITER.max);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many cron requests' },
      { status: 429, headers: responseHeaders },
    );
  }

  // Verify cron secret fail-securely (T-03)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Service Unavailable: Cron secret not configured' },
      { status: 503, headers: responseHeaders },
    );
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid cron secret' },
      { status: 401, headers: responseHeaders },
    );
  }

  try {
    const summary = await scanAndSendDeadlineReminders();
    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        summary,
      },
      { headers: responseHeaders },
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to execute deadline reminder scanner' },
      { status: 500, headers: responseHeaders },
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
