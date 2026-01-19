# Setup Guide

Complete step-by-step guide to set up the Student Grievance Management System from scratch.

## 📋 Prerequisites

- Node.js 18+ installed ([Download](https://nodejs.org/))
- npm (comes with Node.js)
- A Supabase account ([Sign up free](https://supabase.com))
- An email account for notifications (Gmail recommended for development)

## 🗄 Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in project details:
   - **Name**: Your project name (e.g., "grievance-management")
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier works fine for development
4. Click **"Create new project"** and wait for initialization (~2 minutes)

## 🔗 Step 2: Get Database Connection Strings

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll down to **Connection string** section

### Get DATABASE_URL (Connection Pooling)
- Select **"Connection pooling"** tab
- Select **"Session"** mode
- Copy the connection string (format):
  ```
  postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
  ```

### Get DIRECT_URL (Direct Connection)
- Select **"Connection string"** tab
- Select **"URI"** format
- Copy the connection string (format):
  ```
  postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
  ```

**Important:** Replace `[PASSWORD]` with your actual database password in both URLs.

## 📧 Step 3: Set Up Email Service (Optional but Recommended)

### For Gmail:

1. Go to your Google Account settings
2. Enable **2-Step Verification** (if not already enabled)
3. Go to **Security** → **2-Step Verification** → **App passwords**
4. Select **Mail** and **Other (Custom name)**
5. Enter "Grievance System" as the name
6. Click **Generate**
7. Copy the 16-character password

**Note:** If you don't set up email now, the system will still work but will log emails instead of sending them (useful for development).

## ⚙️ Step 4: Configure Backend Environment

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Create a `.env` file:
   ```bash
   # On Windows PowerShell
   New-Item .env
   
   # On Mac/Linux
   touch .env
   ```

3. Add the following to your `.env` file:

```env
# Server Configuration
PORT=5000

# JWT Secret (generate a random string)
# You can use: openssl rand -base64 32
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Supabase Database URLs
# Replace [PASSWORD] with your actual database password
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Email Service Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password-here
SMTP_FROM="Grievance Management System <your-email@gmail.com>"
```

## 📦 Step 5: Install Dependencies

### Backend
```bash
cd server
npm install
```

### Frontend
```bash
cd ../client
npm install
```

## 🗃 Step 6: Set Up Database

1. Generate Prisma Client:
   ```bash
   cd server
   npm run prisma:generate
   ```
   
   This creates TypeScript types for your database models.

2. Push schema to Supabase:
   ```bash
   npm run prisma:push
   ```
   
   This creates all tables in your Supabase database.

3. Verify in Supabase:
   - Go to Supabase dashboard → **Table Editor**
   - You should see tables: `User`, `Petition`, `PetitionComment`, etc.

## 🌱 Step 7: Seed Database (Optional)

Populate the database with test users:

```bash
cd server
npm run seed
```

This creates:
- 15 students (across 3 departments)
- 6 class advisors
- 3 HODs
- 2 registrars

The script will output login credentials for all users.

## 🚀 Step 8: Start Development Servers

### Terminal 1 - Backend
```bash
cd server
npm run dev
```

You should see:
```
🚀 Server running on http://localhost:5000
```

### Terminal 2 - Frontend
```bash
cd client
npm run dev
```

You should see:
```
✓ Ready on http://localhost:3000
```

## ✅ Step 9: Verify Setup

1. **Test Backend**: Open http://localhost:5000/health
   - Should return: `{ "status": "ok" }`

2. **Test Frontend**: Open http://localhost:3000
   - Should see the login page

3. **Test Login**: Use credentials from seed script or register a new user

## 🐛 Troubleshooting

### Prisma Errors

**Error: "Cannot find module '@prisma/client'"**
```bash
npm install
npm run prisma:generate
```

**Error: "PrismaClient is not configured"**
- Make sure you've run `npm run prisma:generate`
- Check that your `.env` file has `DATABASE_URL` and `DIRECT_URL`

**Error: "Schema engine binary not found"**
```bash
npm install prisma --save-dev
npm run prisma:generate
```

### Database Connection Errors

**Error: "Can't reach database server"**
- Check your `DATABASE_URL` and `DIRECT_URL` are correct
- Make sure you replaced `[PASSWORD]` with your actual password
- Verify your Supabase project is active (not paused)

**Error: "Connection timeout"**
- Check your internet connection
- Verify the region matches your Supabase project region
- Try using the direct connection URL format

**Error: "Migration failed"**
- Make sure `DIRECT_URL` is set correctly (direct connection, not pooled)
- Check that your database password is correct
- Try running `npm run prisma:push` again

### Email Not Sending

- If SMTP credentials are missing, emails will be logged but not sent (this is fine for development)
- Check server logs for email errors
- Verify Gmail App Password is correct
- Make sure 2-Step Verification is enabled on your Google account

### Port Already in Use

**Backend (port 5000):**
```bash
# Change PORT in server/.env
PORT=5001
```

**Frontend (port 3000):**
```bash
# Change port in client/package.json or use:
PORT=3001 npm run dev
```

## 📝 Environment Variables Checklist

- ✅ `DATABASE_URL` - Supabase pooled connection
- ✅ `DIRECT_URL` - Supabase direct connection  
- ✅ `JWT_SECRET` - Random secure string
- ✅ `SMTP_HOST` - Email server host
- ✅ `SMTP_PORT` - Email server port
- ✅ `SMTP_USER` - Email address
- ✅ `SMTP_PASS` - Email password/app password
- ✅ `SMTP_FROM` - Sender name and email

## 🎯 Next Steps

1. **Test the workflow:**
   - Register/login as a student
   - Create a petition
   - Login as different roles and test the escalation flow

2. **Customize:**
   - Update email templates in `server/config/utils/emailService.ts`
   - Customize UI colors in `client/app/globals.css`
   - Add your institution's logo

3. **Production Setup:**
   - Use a stronger JWT_SECRET
   - Set up a production email service (SendGrid, Resend, etc.)
   - Configure environment variables for production
   - Set up SSL/TLS certificates
   - Configure database backups

## 📚 Additional Resources

- Supabase Documentation: https://supabase.com/docs
- Prisma Documentation: https://www.prisma.io/docs
- Next.js Documentation: https://nextjs.org/docs
- Express.js Documentation: https://expressjs.com/

## 💡 Quick Reference Commands

```bash
# Backend
cd server
npm install              # Install dependencies
npm run prisma:generate  # Generate Prisma client
npm run prisma:push      # Push schema to database
npm run seed             # Seed test data
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server

# Frontend
cd client
npm install              # Install dependencies
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
```

---

**Need help?** Check the troubleshooting section above or open an issue on the repository.

