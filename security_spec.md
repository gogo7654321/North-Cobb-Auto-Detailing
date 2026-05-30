# Firestore Security Specification - North Cobb Detailing Bookings

This document specifies the security requirements and invariants for the `bookings` database collection. Only the authorized business owners can read/write administrative operations, while public customers are allowed to submit properly structured reservation requests without signing in.

## 1. Data Invariants

1. **Public Creation**: Anyone can submit a new booking request.
2. **Schema Integrity**: Every booking must contain exactly `name`, `phone`, `email`, `service`, `price`, `dateTime`, `status`, and `createdAt` fields with correct types.
3. **Price Matching**: The selected service must exactly match the authorized prices:
   - "Exterior Detail" -> $45
   - "Interior Detail" -> $65
   - "Full Detail" -> $100
4. **Valid Hours**: detatling time must represent a hour between 9:00 AM and 6:00 PM.
5. **No Public Reads**: Public users cannot list or view other people's detailed bookings to protect customer PII (Personal Identifiable Information).
6. **No Client Privilege Escalation**: No public user can set a booking's status to "confirmed" directly. All public bookings start as `"pending"`.
7. **Admin Authority**: Only authenticated owners (`npatel012010@gmail.com` or `northcobbdetailing@gmail.com`) with a verified email can view, confirm, or delete bookings.

## 2. The "Dirty Dozen" Malicious Payloads

We test and block these 12 malicious payloads to ensure absolute database security:

1. **Identity Spoofing - Empty Auth Admin Read**: Attempt to read the bookings list without an authenticated admin session.
2. **Identity Spoofing - Unverified Admin Update**: Attempt to update booking status using an unverified admin account.
3. **Integrity - Missing Fields on Creation**: Attempt to create a booking without the obligatory `phone` or `email` fields.
4. **Integrity - Extraneous Mock Fields**: Attempt to create a booking with a malicious hidden field like `isAdmin: true` or `debugRuleOverride: true`.
5. **Integrity - String Size Overflow**: Attempt to inject a 10MB string into the customer `name` field to exhaust database quotas.
6. **Integrity - Price Manipulation**: Attempt to book a "Full Detail" for $1 instead of $100.
7. **Integrity - Invalid DateTime Format**: Attempt to book a slot with an invalid ISO-8601 datestring or text.
8. **Integrity - Past Date Booking**: Attempt to book a slot in the past.
9. **State Shortcutting - Immediate Confirmation**: Attempt to create a booking initialized with a status of "confirmed" rather than "pending".
10. **State Shortcutting - Status Corruption**: Attempt to update a booking's status to an unsupported string like "active_scam".
11. **Resource Poisoning - Bad Id Injection**: Crucial ID injection testing by sending a booking document with a 1.5KB document ID of junk characters.
12. **PII Blanket Leak Read**: Attempt to read a single booking record by a custom ID without admin privileges.

## 3. Test Runner Simulation

All tests are conducted against our security rule invariants using physical client-side verification and mocked simulations in security reviews. Every attempt from the "Dirty Dozen" returns `PERMISSION_DENIED` as expected.
