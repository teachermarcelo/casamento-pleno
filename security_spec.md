# Security Specification — Casamento Pleno (Firestore Rules)

## 1. Data Invariants
1. **Default Deny**: All paths are denied unless explicitly matched and verified.
2. **PII Isolation**: `users/{userId}` contains private email, subscription, webhook, and biometric settings and is strictly readable/writable only by `isOwner(userId)` or `isAdmin()`.
3. **No Self-Assigned Admin Privileges**: Users creating or updating their own `/users/{userId}` profile MUST have `role == 'bride'` and can never escalate to `'admin'`. Admin status is strictly checked via verified email (`marcellospropaganda@gmail.com` with `email_verified == true`) or existence in `/admins/{uid}`.
4. **Master Gate Relational Sync**: Every subcollection under `/weddings/{weddingId}` verifies parent wedding existence and ownership (`get(/databases/$(database)/documents/weddings/$(weddingId)).data.ownerId == request.auth.uid`) on writes, and matches `ownerId` immutably.
5. **Public Guest Site Least Privilege**:
   - Guests can `get` a published `/weddings/{weddingId}` and `get` `/slugs/{slug}` and read public subcollections (`schedule`, `party`, `gifts`) only when the parent wedding has `status == 'published'`.
   - Guests can `create` a strictly validated RSVP in `/weddings/{weddingId}/guests/{guestId}` (`source == 'public_rsvp'`) or Pix gift contribution in `/weddings/{weddingId}/giftContributions/{contributionId}` (`status == 'pending_pix'`), but can NEVER `read`, `list`, `update`, or `delete` guests or contributions (protecting guest PII).
6. **Temporal & Structural Integrity**: All `createdAt` / `updatedAt` timestamps must match `request.time`; all string fields enforce `.size()` limits; all document IDs pass `isValidId()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Admin Privilege Escalation on User Create**: Non-admin creates `/users/{uid}` with `role: "admin"`.
2. **Shadow Field Injection on User Update**: Authenticated bride updates `/users/{uid}` injecting ghost field `isSuperAdmin: true`.
3. **Cross-User PII Read**: Authenticated bride B attempts `get` on `/users/{brideA_uid}`.
4. **Email Spoofing Attack**: Unauthenticated or unverified token (`email_verified: false`) with admin email attempts to read `/users`.
5. **Owner Spoofing on Wedding Create**: Bride A creates `/weddings/w1` with `ownerId: "brideB"`.
6. **Guest List PII Scraping**: Unauthenticated guest or Bride B runs `list` on `/weddings/{wA}/guests`.
7. **ID Poisoning / Resource Exhaustion**: Attacker creates `/weddings/{1500_char_id}` or injects a 50KB string into `brideName`.
8. **Invalid Public RSVP Status Injection**: Public visitor submits RSVP with `source: "bride"` or `tableId: "table-1"`.
9. **Financial Tampering by Non-Owner**: Bride B attempts to create/update an expense in `/weddings/{wA}/expenses/exp1`.
10. **Immutable Field Mutation**: Bride A attempts to change `ownerId` or `createdAt` during a wedding update.
11. **Public Gift Confirmation Forgery**: Unauthenticated guest submits `/weddings/{wA}/giftContributions/c1` with `status: "confirmed"` instead of `"pending_pix"`.
12. **Client Timestamp Forgery**: Authenticated bride creates an expense with a backdated client timestamp instead of `request.time`.
