// =============================================================================
// app/api/auth/me/route.ts - Get & Update Current Authenticated User Session
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest, signSession, AUTH_COOKIE_NAME, AuthSessionUser } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import User from '@/models/User';

export async function GET(req: NextRequest) {
  const user = getAuthSessionFromRequest(req);

  if (!user) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  return NextResponse.json({
    authenticated: true,
    user,
  });
}

export async function PUT(req: NextRequest) {
  const user = getAuthSessionFromRequest(req);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, org, role, avatar } = body;

    const updatedUser: AuthSessionUser = {
      ...user,
      name: typeof name === 'string' && name.trim() ? name.trim() : user.name,
      org: typeof org === 'string' && org.trim() ? org.trim() : user.org,
      role: typeof role === 'string' && role.trim() ? role.trim() : user.role,
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
    const res = NextResponse.json({ success: true, user: updatedUser });

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
