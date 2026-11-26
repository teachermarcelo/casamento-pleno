/**
 * Phase 0 Security Rules Test Specification — Casamento Pleno
 * Verifies all "Dirty Dozen" adversarial payloads are rejected (PERMISSION_DENIED).
 * Run with Firebase Emulator Suite & @firebase/rules-unit-testing when emulators are available.
 */

export interface AdversarialPayloadTest {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  auth: { uid?: string; email?: string; email_verified?: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_TESTS: AdversarialPayloadTest[] = [
  {
    id: 1,
    name: 'Admin Privilege Escalation on User Create',
    collectionPath: '/users/bride_1',
    operation: 'create',
    auth: { uid: 'bride_1', email: 'bride@example.com', email_verified: true },
    payload: {
      uid: 'bride_1',
      email: 'bride@example.com',
      displayName: 'Ana',
      role: 'admin',
      subscriptionStatus: 'active',
      planPrice: 39.9,
    },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidUserCreate enforces incoming().role == "bride" for non-admins',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on User Update',
    collectionPath: '/users/bride_1',
    operation: 'update',
    auth: { uid: 'bride_1', email: 'bride@example.com', email_verified: true },
    payload: { isSuperAdmin: true },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'affectedKeys().hasOnly(...) and isValidUserProfile reject unknown keys',
  },
  {
    id: 3,
    name: 'Cross-User PII Read',
    collectionPath: '/users/bride_a',
    operation: 'get',
    auth: { uid: 'bride_b', email: 'b@example.com', email_verified: true },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'users get requires isOwner(userId) || isAdmin()',
  },
  {
    id: 4,
    name: 'Admin Email Spoofing without email_verified',
    collectionPath: '/users',
    operation: 'list',
    auth: { uid: 'spoof', email: 'marcellospropaganda@gmail.com', email_verified: false },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isAdmin() strictly checks request.auth.token.email_verified == true',
  },
  {
    id: 5,
    name: 'Owner Spoofing on Wedding Create',
    collectionPath: '/weddings/wed_1',
    operation: 'create',
    auth: { uid: 'bride_a', email: 'a@example.com', email_verified: true },
    payload: { id: 'wed_1', ownerId: 'bride_b', slug: 'ana-lucas', brideName: 'Ana', groomName: 'Lucas' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidWedding enforces data.ownerId == request.auth.uid',
  },
  {
    id: 6,
    name: 'Guest List PII Scraping',
    collectionPath: '/weddings/wed_a/guests',
    operation: 'list',
    auth: null,
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'guests list requires isSignedIn() && (isAdmin() || resource.data.ownerId == request.auth.uid)',
  },
  {
    id: 7,
    name: 'ID Poisoning & String Overflow',
    collectionPath: `/weddings/${'a'.repeat(300)}`,
    operation: 'create',
    auth: { uid: 'bride_a', email: 'a@example.com', email_verified: true },
    payload: { brideName: 'x'.repeat(5000) },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(weddingId) enforces <= 128 chars and regex; brideName <= 80 chars',
  },
  {
    id: 8,
    name: 'Public RSVP Source Forgery',
    collectionPath: '/weddings/wed_a/guests/g_1',
    operation: 'create',
    auth: null,
    payload: { source: 'bride', name: 'Carlos', tableId: 'table_vip', status: 'confirmed' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidPublicRsvp enforces source == "public_rsvp" and empty tableId',
  },
  {
    id: 9,
    name: 'Cross-Tenant Expense Tampering',
    collectionPath: '/weddings/wed_a/expenses/exp_1',
    operation: 'create',
    auth: { uid: 'bride_b', email: 'b@example.com', email_verified: true },
    payload: { weddingId: 'wed_a', ownerId: 'bride_b', title: 'Buffet', amount: 10000 },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'Master Gate checks parent wedding ownerId == request.auth.uid',
  },
  {
    id: 10,
    name: 'Immutable Field Mutation on Wedding Update',
    collectionPath: '/weddings/wed_a',
    operation: 'update',
    auth: { uid: 'bride_a', email: 'a@example.com', email_verified: true },
    payload: { ownerId: 'bride_b' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'affectedKeys().hasOnly excludes ownerId and createdAt, plus immutability equality check',
  },
  {
    id: 11,
    name: 'Public Gift Confirmation Forgery',
    collectionPath: '/weddings/wed_a/giftContributions/c_1',
    operation: 'create',
    auth: null,
    payload: { status: 'confirmed', amount: 500, guestName: 'Guest' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidGiftContributionCreate enforces status == "pending_pix"',
  },
  {
    id: 12,
    name: 'Client Timestamp Backdating',
    collectionPath: '/weddings/wed_a/expenses/exp_2',
    operation: 'create',
    auth: { uid: 'bride_a', email: 'a@example.com', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
    enforcedByRule: 'Temporal integrity enforces incoming().createdAt == request.time',
  },
];
