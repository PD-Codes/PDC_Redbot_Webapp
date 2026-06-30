import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildAuthorizeUrl, newState } from '$lib/server/auth';

export const GET: RequestHandler = async ({ cookies }) => {
  const state = newState();
  cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600
  });
  throw redirect(302, buildAuthorizeUrl(state));
};
