# Email Service Troubleshooting Guide

This guide helps you diagnose and fix email issues in production environments.

## 🔍 Quick Diagnosis

### Check Email Configuration Status

**Option 1: Check Server Logs on Startup**
When your server starts, it will log the email configuration status:
```
📧 Checking email configuration...
[Email Service] Configuration Status:
  SMTP_HOST: smtp.gmail.com
  SMTP_PORT: 587
  SMTP_USER: your-email@gmail.com
  SMTP_PASS: ✅ SET
  SMTP_FROM: Using default
  Status: ✅ CONFIGURED
```

**Option 2: Use Diagnostic Endpoint**
Visit: `https://your-backend-url/api/email/status`

This will return:
```json
{
  "configured": true,
  "host": "smtp.gmail.com",
  "port": "587",
  "user": "your-email@gmail.com",
  "from": "Grievance Management System <your-email@gmail.com>",
  "message": "Email service is configured"
}
```

## ❌ Common Issues and Solutions

### Issue 1: "SMTP not configured" Error

**Symptoms:**
- Logs show: `❌ SMTP not configured`
- `SMTP_USER` or `SMTP_PASS` is missing

**Solution:**
1. Go to your hosting platform (Render, Heroku, etc.)
2. Navigate to **Environment Variables** settings
3. Add the following variables:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-character-app-password
   SMTP_FROM="Grievance Management System <your-email@gmail.com>"
   ```
4. **Redeploy** your application

---

### Issue 2: "Authentication failed" (EAUTH Error)

**Symptoms:**
- Logs show: `❌ Authentication failed`
- Error code: `EAUTH`

**Causes & Solutions:**

**A. Using Regular Password Instead of App Password**
- ❌ **Wrong:** Using your Gmail account password
- ✅ **Correct:** Using a Gmail App Password

**Steps to Generate Gmail App Password:**
1. Go to https://myaccount.google.com/
2. Click **Security** in the left sidebar
3. Enable **2-Step Verification** (if not already enabled)
4. Scroll down to **App passwords**
5. Click **App passwords**
6. Select **Mail** as the app
7. Select **Other (Custom name)** as the device
8. Enter "Grievance System" as the name
9. Click **Generate**
10. Copy the 16-character password (no spaces)
11. Use this password in `SMTP_PASS` environment variable

**B. Wrong Email Address**
- Make sure `SMTP_USER` matches the email address used to generate the App Password
- Example: If you generated App Password for `admin@university.edu`, use that exact email

**C. App Password Expired or Revoked**
- Generate a new App Password
- Update `SMTP_PASS` environment variable
- Redeploy your application

---

### Issue 3: "Connection failed" (ECONNECTION/ETIMEDOUT Error)

**Symptoms:**
- Logs show: `❌ Connection failed`
- Error codes: `ECONNECTION` or `ETIMEDOUT`

**Causes & Solutions:**

**A. Wrong SMTP Host/Port**
- For Gmail: Use `smtp.gmail.com` and port `587`
- Check your `SMTP_HOST` and `SMTP_PORT` environment variables

**B. Firewall/Network Issues**
- Some hosting platforms block outbound SMTP connections
- Check if your hosting provider allows SMTP connections
- Consider using a dedicated email service (SendGrid, Resend, etc.)

**C. Hosting Platform Restrictions**
- **Render:** SMTP connections are allowed by default
- **Heroku:** SMTP connections are allowed
- **AWS Lambda:** May require VPC configuration
- **Railway:** SMTP connections are allowed

---

### Issue 4: Emails Sent But Not Received

**Symptoms:**
- Logs show: `✅ Email sent successfully`
- But recipient doesn't receive email

**Causes & Solutions:**

**A. Email in Spam Folder**
- Check spam/junk folder
- Ask recipient to mark as "Not Spam"
- Consider using a professional email service

**B. Wrong Email Address**
- Verify the recipient email address is correct
- Check logs for the exact email address used

**C. Gmail Rate Limits**
- Gmail has daily sending limits (500 emails/day for free accounts)
- Check Gmail account for rate limit warnings
- Consider upgrading to Google Workspace for higher limits

**D. Email Service Provider Blocking**
- Some email providers block emails from free Gmail accounts
- Use a professional email service or domain email

---

### Issue 5: Slow Email Sending

**Symptoms:**
- Emails take a long time to send
- Timeout errors

**Solutions:**
- Emails are sent asynchronously (non-blocking)
- Check network connectivity
- Consider using a dedicated email service (SendGrid, Resend, Mailgun)

---

## 🔧 Production Setup Checklist

### Environment Variables (Render/Heroku/etc.)

✅ **Required Variables:**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  (16-character App Password, no spaces)
SMTP_FROM="Grievance Management System <your-email@gmail.com>"
```

### Gmail Account Setup

✅ **Checklist:**
- [ ] 2-Step Verification enabled
- [ ] App Password generated
- [ ] App Password copied (16 characters, no spaces)
- [ ] App Password added to `SMTP_PASS` environment variable
- [ ] `SMTP_USER` matches the email used for App Password

### Testing

✅ **Test Email Configuration:**
1. Deploy your application
2. Check server startup logs for email configuration status
3. Visit `/api/email/status` endpoint
4. Create a test ticket
5. Check server logs for email sending attempts
6. Verify email is received (check spam folder)

---

## 📊 Monitoring Email Status

### Check Server Logs

When emails are sent, you'll see logs like:
```
[Email Service] 📧 Attempting to send email...
[Email Service]   To: submitter@example.com
[Email Service]   Subject: Grievance Status Update: ...
[Email Service]   SMTP: smtp.gmail.com:587
[Email Service] 🔍 Verifying SMTP connection...
[Email Service] ✅ SMTP connection verified
[Email Service] 📤 Sending email...
[Email Service] ✅ Email sent successfully!
[Email Service]   Message ID: <message-id>
[Email Service]   Duration: 1234ms
```

### If Email Fails

You'll see detailed error logs:
```
[Email Service] ❌ Error sending email:
[Email Service]   To: submitter@example.com
[Email Service]   Error Code: EAUTH
[Email Service]   Error Message: Invalid login
[Email Service] ❌ Authentication failed. For Gmail:
   1. Make sure you're using an App Password...
```

---

## 🚀 Alternative Email Services

If Gmail doesn't work for your production environment, consider:

### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Resend
```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=your-resend-api-key
```

### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASS=your-mailgun-password
```

---

## 🆘 Still Having Issues?

1. **Check Server Logs:** Look for `[Email Service]` entries
2. **Verify Environment Variables:** Use `/api/email/status` endpoint
3. **Test SMTP Connection:** Check if your hosting platform allows SMTP
4. **Try Different Email Service:** Consider SendGrid or Resend for production
5. **Check Gmail Account:** Verify App Password is correct and not expired

---

## 📝 Quick Reference

**Gmail App Password Generator:**
https://myaccount.google.com/apppasswords

**Test Email Configuration Endpoint:**
`GET /api/email/status`

**Required Environment Variables:**
- `SMTP_HOST` (default: smtp.gmail.com)
- `SMTP_PORT` (default: 587)
- `SMTP_USER` (your email address)
- `SMTP_PASS` (Gmail App Password - 16 characters)
- `SMTP_FROM` (optional, defaults to using SMTP_USER)

---

**Last Updated:** December 2024

