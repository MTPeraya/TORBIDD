// =============================================================================
// app/api/admin/users/route.ts – Admin User Management (UC-9)
// GET  /api/admin/users          – List all users (admin only)
// PATCH /api/admin/users         – Update a user's role (admin only)
// =============================================================================
// Security controls (ASVS V6.3.2):
//   - Endpoint protected by middleware (admin cookie check) AND explicit
//     double-check inside the handler (defence-in-depth).
//   - Role assignment validated by lib/authorization.validateRoleAssignment,
//     ensuring ordinary users can never promote themselves or others to admin.
//   - Reserved account identifiers ('admin', 'root', 'sa', …) are blocked
//     from receiving privileged roles.
//   - Actor's email is never allowed to demote or change their own role
//     (self-demotion attack prevention).
//   - All role change events are logged for audit purposes.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';
import {
  validateRoleAssignment,
  isReservedIdentifier,
} from '@/lib/authorization';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// GET /api/admin/users  –  List all registered users
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  // ── SEC-02: Double-check admin privilege ──────────────────────────────────
  const actor = getAuthSessionFromRequest(req);
  if (!actor || !isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: 'Database not configured' },
      { status: 503 },
    );
  }

  try {
    await connectToDatabase();
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .select('googleId email name picture role org lastLoginAt createdAt')
      .lean();

    return NextResponse.json({
      success: true,
      data: users.map((u) => ({
        id: String(u._id),
        googleId: u.googleId,
        email: u.email,
        name: u.name,
        picture: u.picture,
        role: u.role,
        org: u.org,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        // SEC-02: Flag suspicious reserved identifiers for admin awareness
        hasReservedIdentifier: isReservedIdentifier(u.email.split('@')[0]),
      })),
      total: users.length,
    });
  } catch (err) {
    console.error('[GET /api/admin/users]', err);
    return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/users  –  Update a user's role
// Body: { targetUserId: string; role: string }
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  // ── SEC-02: Double-check admin privilege ──────────────────────────────────
  const actor = getAuthSessionFromRequest(req);
  if (!actor || !isAdminUser(actor)) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: { targetUserId?: string; role?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { targetUserId, role } = body;

  if (!targetUserId || typeof targetUserId !== 'string') {
    return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 });
  }
  if (!role || typeof role !== 'string') {
    return NextResponse.json({ error: 'role is required' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const targetUser = await User.findById(targetUserId).lean();
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ── SEC-02: Prevent self-role-demotion (admin removing own admin status) ─
    if (targetUser.email.toLowerCase() === actor.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Administrators cannot modify their own role.' },
        { status: 403 },
      );
    }

    // ── SEC-02: Validate the role assignment ─────────────────────────────────
    const result = validateRoleAssignment(actor, role, targetUser.email);
    if (!result.allowed) {
      console.warn(
        `[SEC-02] Role escalation blocked: actor=${actor.email} → target=${targetUser.email} role=${role} reason=${result.reason}`,
      );
      return NextResponse.json(
        { error: result.reason },
        { status: 403 },
      );
    }

    // Apply the validated (possibly downgraded) role
    const updatedUser = await User.findByIdAndUpdate(
      targetUserId,
      { $set: { role: result.resolvedRole } },
      { new: true, select: 'email name role org' },
    ).lean();

    console.info(
      `[SEC-02 AUDIT] Role changed: actor=${actor.email} → target=${targetUser.email} oldRole=${targetUser.role} newRole=${result.resolvedRole}`,
    );

    return NextResponse.json({
      success: true,
      message: `Role updated to '${result.resolvedRole}' for user ${targetUser.email}`,
      data: updatedUser,
    });
  } catch (err) {
    console.error('[PATCH /api/admin/users]', err);
    return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Block any attempt to CREATE a user with a pre-set password / credentials
// via this API (ASVS V6.3.2 – no default account creation).
// All user accounts are created exclusively via Google OAuth callback.
// ---------------------------------------------------------------------------
export async function POST() {
  return NextResponse.json(
    {
      error:
        'User accounts cannot be created directly. ' +
        'All accounts are provisioned through Google OAuth 2.0 on first sign-in.',
    },
    { status: 405 },
  );
}
