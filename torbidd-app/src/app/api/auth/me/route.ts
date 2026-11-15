// =============================================================================
// app/api/auth/me/route.ts - Get & Update Current Authenticated User Session
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthSessionFromRequest,
  signSession,
  AUTH_COOKIE_NAME,
  AuthSessionUser,
  isAdminUser,
  validateEmailMutation,
} from '@/lib/auth';
import { validateRoleAssignment } from '@/lib/authorization';
import { rejectUnauthorizedFields, ADMIN_ONLY_USER_FIELDS } from '@/lib/authorization/fields';
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

  // ── SEC-08: Immediate permission freshness (ASVS V8.3.2) ──────────────────
  // Re-read user role from database if available, ensuring role revocations
  // or promotions apply immediately without waiting for session expiry.
  let freshUser = user;
  let roleChanged = false;
  if (process.env.MONGODB_URI) {
    try {
      await connectToDatabase();
      const dbUser = await User.findOne({
        $or: [{ googleId: user.id }, { email: user.email }],
      }).select('role name org picture').lean();

      if (dbUser && dbUser.role && dbUser.role !== user.role) {
        freshUser = {
          ...user,
          role: dbUser.role,
        };
        roleChanged = true;
      }
    } catch {
      // Fallback to session token user if DB connection fails
    }
  }

  const isAdmin = isAdminUser(freshUser);

  const res = NextResponse.json({
    authenticated: true,
    user: {
      ...freshUser,
      isAdmin,
    },
    isAdmin,
  });

  // Re-issue signed cookie when role changes dynamically
  if (roleChanged) {
    const sessionToken = signSession(freshUser);
    res.cookies.set(AUTH_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  }

  return res;
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
    const { name, org, role, avatar, email } = body;

    // ── SEC-07: Field-level authorization — reject admin-only fields for non-admins ──
    // Ordinary users (BMA Officer) cannot submit the 'role' field via this endpoint.
    // This prevents Broken Object Property Level Authorization (BOPLA).
    // Admins may submit the role field (they can update their own display-role).
    if (!isAdminUser(user)) {
      const fieldCheck = rejectUnauthorizedFields(body, user.role, ADMIN_ONLY_USER_FIELDS);
      if (fieldCheck.rejected) {
        console.warn(
          `[SEC-07] Field-level violation: user=${user.email} attempted to set fields: ${fieldCheck.fields.join(', ')}`,
        );
        return NextResponse.json(
          {
            error: `Field not allowed: ${fieldCheck.fields.join(', ')}. Only administrators may modify these fields.`,
          },
          { status: 400 },
        );
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── SEC-03: Email mutation restriction (ASVS V6.3.6) ──────────────────────
    // Email is an identifier bound to Google OAuth; direct mutation is blocked
    // to prevent account takeover without identity provider re-authentication.
    const emailCheck = validateEmailMutation(user.email, email);
    if (!emailCheck.allowed) {
      return NextResponse.json({ error: emailCheck.reason }, { status: 400 });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── SEC-02: Centralised role assignment validation ────────────────────────
    // validateRoleAssignment enforces that only admins can grant admin roles,
    // and that reserved identifiers cannot hold privileged roles.
    let resolvedRole = user.role;
    if (typeof role === 'string' && role.trim()) {
      const requestedTrimmed = role.trim();
      const currentIsAdmin = isAdminUser(user);
      const isRequestingPrivilege =
        requestedTrimmed.toLowerCase() === 'admin' || requestedTrimmed.toLowerCase() === 'administrator';

      if (isRequestingPrivilege) {
        if (currentIsAdmin) {
          resolvedRole = 'admin';
        } else {
          // Non-admin attempting privilege escalation: silently deny and keep existing role
          console.warn(
            `[SEC-02] Self-escalation blocked for ${user.email}: requested=${role}`,
          );
          resolvedRole = user.role;
        }
      } else {
        const assignmentResult = validateRoleAssignment(user, requestedTrimmed, user.email);
        resolvedRole = assignmentResult.resolvedRole;
      }
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
