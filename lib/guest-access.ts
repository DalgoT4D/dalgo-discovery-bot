/**
 * Shared config for the "try the live platform as a guest" feature.
 *
 * A read-only Guest account is pre-provisioned on the demo org (health_org) so
 * prospects can explore the real Dalgo platform without signing up. These are
 * intentionally public, low-privilege demo credentials (view-only role).
 */
export const GUEST_ACCESS = {
  platformUrl: process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3001',
  email: process.env.NEXT_PUBLIC_GUEST_EMAIL || 'guest_user@dalgo.org',
  password: process.env.NEXT_PUBLIC_GUEST_PASSWORD || 'password',
};
