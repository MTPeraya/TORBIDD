// =============================================================================
// app/api/auth/me/route.ts - Get & Update Current Authenticated User Session
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest, signSession, AUTH_COOKIE_NAME, AuthSessionUser, isAdminUser } from '@/lib/auth';
import { validateRoleAssignment } from '@/lib/authorization';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  AUTH_ME_WRITE_LIMITER,
} from '@/lib/rate-limiter';

const LIMITER_ID = 'auth-me-write';

export async function GET(req: NextRequest) {
  const user = getAuthSessionFromRequest(req);

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null, isAdmin: false });
  }

  const isAdmin = isAdminUser(user);

  return NextResponse.json({
    authenticated: true,
    user: {
      ...user,
      isAdmin,
    },
    isAdmin,
  });
}

export async function PUT(req: NextRequest) {
  // ── SEC-01: Rate limiting on profile update ───────────────────────────────
  const clientIp = getClientIp(req);
  const rl = checkRateLimit(LIMITER_ID, clientIp, AUTH_ME_WRITE_LIMITER);
  const rlHeaders = rateLimitHeaders(rl, AUTH_ME_WRITE_LIMITER.max);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many profile update requests. Please wait before trying again.', retryAfter: rl.retryAfter },
      { status: 429, headers: rlHeaders },
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  const user = getAuthSessionFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, org, role, avatar } = body;

    // ── SEC-02: Centralised role assignment validation ────────────────────────
    // validateRoleAssignment enforces that only admins can grant admin roles,
    // and that reserved identifiers cannot hold privileged roles.
    let resolvedRole = user.role;
    if (typeof role === 'string' && role.trim()) {
      const assignmentResult = validateRoleAssignment(user, role.trim(), user.email);
      if (!assignmentResult.allowed) {
        console.warn(
          `[SEC-02] Self-escalation blocked for ${user.email}: requested=${role} reason=${assignmentResult.reason}`,
        );
        return NextResponse.json({ error: assignmentResult.reason }, { status: 403 });
      }
      resolvedRole = assignmentResult.resolvedRole;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const updatedUser: AuthSessionUser = {
      ...user,
      name: typeof name === 'string' && name.trim() ? name.trim() : user.name,
      org: typeof org === 'string' && org.trim() ? org.trim() : user.org,
      role: resolvedRole,
      picture: avatar !== undefined ? avatar : user.picture,
    };

    if (process.env.MONGODB_URI) {
      try {
        await connectToDatabase();
        await User.findOneAndUpdate(
          { $or: [{ googleId: user.id }, { email: user.email }] },
          {
            $set: {
              name: updatedUser.name,
              org: updatedUser.org,
              role: updatedUser.role,
              picture: updatedUser.picture,
            },
          },
        );
      } catch (dbErr) {
        console.warn('[PUT /api/auth/me] DB update warning:', dbErr);
      }
    }

    const sessionToken = signSession(updatedUser);
    const res = NextResponse.json({ success: true, user: updatedUser }, { headers: rlHeaders });

    res.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('[PUT /api/auth/me] Error:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
