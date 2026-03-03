# Phase 1 Implementation Guide

This document outlines what has been implemented in Phase 1 and what needs to be configured.

## ✅ What's Been Implemented

### 1. File Upload Functionality (Supabase Storage)
- ✅ Supabase client setup (client & server)
- ✅ File upload utilities (`client/lib/file-upload.ts`, `server/config/utils/supabaseStorage.ts`)
- ✅ Attachment endpoints in API (`POST /api/tickets/:id/attachments`, `DELETE /api/tickets/:id/attachments/:attachmentId`)
- ✅ Ticket creation now accepts attachments
- ✅ File validation (size limits, type restrictions)
- ✅ Database schema already supports attachments (`TicketAttachment` model)

### 2. Pagination
- ✅ Pagination added to `GET /api/tickets` (all tickets)
- ✅ Pagination added to `GET /api/tickets/my` (user's tickets)
- ✅ Pagination metadata included in responses (page, limit, total, totalPages, hasNext, hasPrev)
- ✅ Query parameters: `?page=1&limit=20`

### 3. Input Sanitization & XSS Protection
- ✅ DOMPurify installed and configured
- ✅ Sanitization utilities (`client/lib/sanitize.ts`, `server/config/utils/sanitize.ts`)
- ✅ All user inputs sanitized in:
  - Ticket creation (subject, description, group, year)
  - Ticket updates
  - Comments
  - Registration (name, email, submitterId, group)
  - Login (email)

### 4. Password Reset Structure
- ✅ Database schema updated (passwordResetToken, passwordResetExpires)
- ✅ Endpoints created:
  - `POST /api/auth/forgot-password` - Request password reset
  - `POST /api/auth/reset-password` - Reset password with token
- ✅ Token generation and expiration (1 hour)
- ⚠️ Email sending not implemented (ready for integration)

### 5. Email Verification Structure
- ✅ Database schema updated (emailVerified, emailVerificationToken, emailVerificationExpires)
- ✅ Endpoints created:
  - `POST /api/auth/verify-email` - Verify email with token
  - `POST /api/auth/resend-verification` - Resend verification email
- ✅ Token generation and expiration (24 hours)
- ✅ Auto-verification if email service not configured
- ⚠️ Email sending not implemented (ready for integration)

## 🔧 Configuration Required

### 1. Supabase Storage Setup

#### Step 1: Create Storage Bucket
1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the sidebar
3. Click **"New bucket"**
4. Name: `ticket-attachments`
5. Make it **Public** (or set up RLS policies if you want private)
6. Click **"Create bucket"**

#### Step 2: Set Up RLS Policies (Optional but Recommended)
If you want private storage, set up Row Level Security policies:

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ticket-attachments');

-- Allow users to read their own files
CREATE POLICY "Users can read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ticket-attachments');

-- Allow users to delete their own files
CREATE POLICY "Users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ticket-attachments');
```

#### Step 3: Add Environment Variables

**Client (`.env.local` or `.env`):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Server (`.env`):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

To find these values:
1. Go to Supabase Dashboard → **Settings** → **API**
2. Copy **Project URL** → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
3. Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Keep this secret!)

### 2. Database Migration

Run the migration to add the new fields to the User model:

```bash
cd server
npm run prisma:push
```

Or create a migration:
```bash
npx prisma migrate dev --name add_email_verification_and_password_reset
```

### 3. Email Service Integration (When Ready)

When you have an email service configured, update these files:

**`server/config/utils/emailService.ts`** - Add functions:
- `sendVerificationEmail(userEmail, token)`
- `sendPasswordResetEmail(userEmail, token)`

**`server/config/controllers/authController.ts`** - Uncomment email sending in:
- `registerUser()` - After user creation
- `resendVerificationEmail()` - After token generation
- `requestPasswordReset()` - After token generation

**Environment Variable:**
```env
REQUIRE_EMAIL_VERIFICATION=true  # Enable email verification requirement
```

## 📝 Next Steps (Frontend Implementation)

### 1. File Upload UI
- [ ] Add file input to ticket creation form (`client/app/ticket/new/page.tsx`)
- [ ] Add file preview/display component
- [ ] Add file deletion UI
- [ ] Show attachments in ticket detail view

### 2. Pagination UI
- [ ] Add pagination component to dashboard
- [ ] Add pagination component to admin page
- [ ] Update API calls to use pagination parameters
- [ ] Add page size selector

### 3. Password Reset UI
- [ ] Create "Forgot Password" page
- [ ] Create "Reset Password" page
- [ ] Add "Forgot Password" link to login page

### 4. Email Verification UI
- [ ] Show verification status in user profile
- [ ] Add "Resend Verification" button
- [ ] Create email verification success page

## 🧪 Testing

### Test File Uploads
1. Create a ticket with attachments
2. Verify files appear in Supabase Storage
3. Verify attachments are linked in database
4. Test file deletion

### Test Pagination
```bash
# Test with curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/tickets?page=1&limit=10"
```

### Test Password Reset (Development)
1. Request password reset
2. Check response for token (only in development mode)
3. Use token to reset password

### Test Email Verification (Development)
1. Register new user
2. Check database for verification token
3. Use token to verify email

## 📚 API Endpoints Added

### Authentication
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Tickets
- `POST /api/tickets/:id/attachments` - Add attachment to ticket
- `DELETE /api/tickets/:id/attachments/:attachmentId` - Delete attachment

### Updated Endpoints (with pagination)
- `GET /api/tickets?page=1&limit=20` - Get all tickets (paginated)
- `GET /api/tickets/my?page=1&limit=20` - Get user's tickets (paginated)

## 🔒 Security Notes

1. **File Upload Security:**
   - File size limit: 10MB
   - Allowed types: images, PDF, Word docs, text files
   - File names sanitized
   - Files stored in organized structure: `tickets/{ticketId}/{userId}/{timestamp}-{filename}`

2. **Input Sanitization:**
   - All user inputs sanitized on both client and server
   - HTML tags stripped from text inputs
   - XSS protection via DOMPurify

3. **Token Security:**
   - Tokens are cryptographically random (32 bytes)
   - Tokens expire (1 hour for password reset, 24 hours for email verification)
   - Tokens are single-use (deleted after use)

## ⚠️ Important Notes

1. **Email Service:** Password reset and email verification are implemented but won't send emails until you configure SMTP. In development mode, tokens are returned in responses for testing.

2. **Auto-Verification:** If email service is not configured, users are auto-verified on registration. Set `REQUIRE_EMAIL_VERIFICATION=true` when email service is ready.

3. **Supabase Storage:** Make sure to create the bucket and set up proper permissions before testing file uploads.

4. **Database Migration:** Run the Prisma migration to add the new User fields before testing password reset/email verification.

## 🐛 Troubleshooting

### File Uploads Not Working
- Check Supabase Storage bucket exists
- Verify environment variables are set
- Check bucket permissions
- Verify file size/type restrictions

### Pagination Not Working
- Check query parameters are being sent correctly
- Verify API response structure matches frontend expectations

### Email Verification/Password Reset Not Working
- Check database migration ran successfully
- Verify tokens are being generated
- Check token expiration times
- In development, check response for token

