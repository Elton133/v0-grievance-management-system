# Resend Email Service Setup Guide

## Why Resend?

- ✅ **100 emails/day free** (perfect for development)
- ✅ **Easy API integration** - Simple setup
- ✅ **Great deliverability** - Emails reach inboxes
- ✅ **Modern developer experience** - Clean API
- ✅ **No SMTP configuration needed** - Just an API key

## Step 1: Create Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Click **"Sign Up"** (you can use GitHub, Google, or email)
3. Verify your email address

## Step 2: Get API Key

1. Once logged in, go to **API Keys** in the sidebar
2. Click **"Create API Key"**
3. Give it a name (e.g., "Grievance System Production")
4. Copy the API key (you'll only see it once!)

## Step 3: Verify Domain (Optional but Recommended)

For production, you should verify your domain:

1. Go to **Domains** in the sidebar
2. Click **"Add Domain"**
3. Enter your domain (e.g., `rmu.edu.gh`)
4. Add the DNS records Resend provides to your domain
5. Wait for verification (usually a few minutes)

**For development/testing:** You can use Resend's default domain `onboarding@resend.dev` without verification.

## Step 4: Configure Environment Variables

Add these to your `server/.env` file:

```env
# Resend Configuration (Recommended)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com  # Or use onboarding@resend.dev for testing
RESEND_FROM_NAME="Grievance Management System"

# Frontend URL (for email links)
FRONTEND_URL=https://your-frontend-url.com
# Or for local development:
# FRONTEND_URL=http://localhost:3000
```

## Step 5: Test Email Sending

1. Start your server
2. Register a new user
3. Check your email inbox (and spam folder)
4. You should receive a verification email

## Fallback to SMTP

If you prefer to use SMTP (Gmail, etc.) instead of Resend, the system will automatically fall back to SMTP if Resend is not configured. Just set:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="Grievance Management System <your-email@gmail.com>"
```

## Email Templates Included

The system now includes these email templates:

1. **Email Verification** - Sent on registration
2. **Password Reset** - Sent when user requests password reset
3. **Ticket Notifications** - Already implemented

## Troubleshooting

### Emails not sending?
1. Check `RESEND_API_KEY` is set correctly
2. Verify `RESEND_FROM_EMAIL` is valid
3. Check server logs for error messages
4. Make sure you haven't exceeded free tier (100 emails/day)

### Emails going to spam?
1. Verify your domain (if using custom domain)
2. Set up SPF/DKIM records (Resend provides these)
3. Use a professional `FROM_EMAIL` address

### Need more emails?
- Resend Pro: $20/month for 50,000 emails
- Resend Business: Custom pricing

## Next Steps

After setting up Resend:
1. Test email verification flow
2. Test password reset flow
3. Monitor email delivery in Resend dashboard
4. Set up domain verification for production

