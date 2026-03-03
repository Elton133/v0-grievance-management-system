# Submitter Grievance Management System

A comprehensive full-stack web application for managing submitter grievances and tickets in educational institutions. Built with modern web technologies including Next.js, Express.js, TypeScript, and Supabase PostgreSQL.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [User Roles & Permissions](#user-roles--permissions)
- [Workflow & Escalation](#workflow--escalation)
- [Development](#development)
- [Production Deployment](#production-deployment)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

The Submitter Grievance Management System is designed to streamline the process of handling submitter complaints, tickets, and grievances within an educational institution. The system provides:

- **Automated Workflow**: Tickets automatically escalate through a hierarchical review process
- **Role-Based Access**: Different interfaces for submitters, class advisors, HODs, and registrars
- **Real-Time Notifications**: Email alerts for all stakeholders when tickets are submitted or updated
- **Comprehensive Tracking**: Full audit trail of all ticket activities and status changes
- **Analytics Dashboard**: Insights into ticket trends, resolution rates, and group performance

## ✨ Features

### Core Functionality
- 🔐 **JWT-based Authentication** - Secure user authentication and authorization
- 📝 **Ticket Management** - Create, view, edit, and delete tickets (submitters can edit/delete only "submitted" tickets)
- 👥 **Multi-Role System** - Four distinct user roles with appropriate permissions
- 💬 **Comments System** - Public and internal comments on tickets
- 📊 **Status Tracking** - Real-time status updates with complete history
- 🔔 **Email Notifications** - Automated email alerts for all stakeholders
- 🔄 **Auto-Escalation** - Automatic assignment and escalation through review hierarchy
- 📈 **Analytics Dashboard** - Comprehensive reporting and analytics
- 🔍 **Audit Logging** - Complete audit trail of all system activities

### User Experience
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile devices
- 🎨 **Modern UI** - Built with Tailwind CSS and Radix UI components
- ⚡ **Fast Performance** - Optimized for speed and efficiency
- ♿ **Accessible** - Follows accessibility best practices

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI (shadcn/ui)
- **State Management**: React Context API
- **Icons**: Lucide React
- **Charts**: Recharts

### Backend
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs
- **Email Service**: Nodemailer
- **Rate Limiting**: express-rate-limit

## 📁 Project Structure

```
v0-grievance-management-system/
├── client/                    # Next.js frontend application
│   ├── app/                  # Next.js app router pages
│   │   ├── login/           # Login page
│   │   ├── register/         # Registration page
│   │   ├── dashboard/        # Submitter dashboard
│   │   ├── admin/            # Admin dashboard
│   │   ├── ticket/         # Ticket pages
│   │   │   ├── new/         # Create ticket
│   │   │   └── [id]/        # View/edit ticket
│   │   └── analytics/        # Analytics dashboard
│   ├── components/           # React components
│   │   ├── ui/              # Reusable UI components
│   │   ├── dashboard-header.tsx
│   │   ├── ticket-card.tsx
│   │   └── ...
│   ├── lib/                 # Utility functions
│   │   ├── api.ts           # API client
│   │   ├── auth-context.tsx  # Authentication context
│   │   ├── ticket-store.ts # Ticket data management
│   │   └── types.ts          # TypeScript types
│   └── public/              # Static assets
│
└── server/                  # Express.js backend API
    └── config/
        ├── controllers/     # API controllers
        │   ├── authController.ts
        │   └── ticketController.ts
        ├── routes/          # API routes
        │   ├── authRoutes.ts
        │   └── ticketRoutes.ts
        ├── middleware/      # Express middleware
        │   ├── auth.ts      # JWT authentication
        │   └── rateLimiter.ts
        ├── utils/           # Utility functions
        │   ├── emailService.ts    # Email notifications
        │   └── workflowService.ts # Workflow logic
        ├── prisma/          # Database schema
        │   └── schema.prisma
        ├── db.ts            # Prisma client
        ├── server.ts        # Express server
        └── seed.ts          # Database seeding script
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account ([Sign up free](https://supabase.com))
- Email service account (Gmail recommended for development)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd v0-grievance-management-system
   ```

2. **Set up the backend**
   ```bash
   cd server
   npm install
   ```
   
   See [SETUP.md](SETUP.md) for detailed configuration instructions.

3. **Set up the frontend**
   ```bash
   cd ../client
   npm install
   ```

4. **Start development servers**
   
   Backend (Terminal 1):
   ```bash
   cd server
   npm run dev
   ```
   
   Frontend (Terminal 2):
   ```bash
   cd client
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

For detailed setup instructions, see [SETUP.md](SETUP.md).

## 📡 API Documentation

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "submitter",
  "submitterId": "BIT0001526",
  "group": "ICT"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "token": "jwt-token-here",
  "user": { ... }
}
```

### Ticket Endpoints (Protected)

All ticket endpoints require authentication via Bearer token:
```http
Authorization: Bearer <jwt-token>
```

#### Create Ticket
```http
POST /api/tickets
{
  "subject": "Grade Discrepancy",
  "description": "Detailed description...",
  "type": "academic_issue",
  "priority": "high",
  "year": "3rd Year",
  "group": "ICT"
}
```

#### Get All Tickets
```http
GET /api/tickets
```

#### Get User's Tickets
```http
GET /api/tickets/my
```

#### Get Ticket by ID
```http
GET /api/tickets/:id
```

#### Update Ticket Status
```http
PATCH /api/tickets/:id/status
{
  "status": "under_review",
  "comment": "Reviewing the issue"
}
```

#### Add Comment
```http
POST /api/tickets/:id/comments
{
  "content": "Comment text",
  "isInternal": false
}
```

#### Update Ticket (Submitters only, submitted status only)
```http
PUT /api/tickets/:id
{
  "subject": "Updated subject",
  "description": "Updated description",
  "type": "academic_issue",
  "priority": "urgent"
}
```

#### Delete Ticket (Submitters only, submitted status only)
```http
DELETE /api/tickets/:id
```

## 🗄 Database Schema

The system uses PostgreSQL via Supabase with the following main models:

### User
- `id` (UUID, Primary Key)
- `email` (Unique)
- `passwordHash`
- `name`
- `role` (submitter, class_advisor, hod, registrar)
- `submitterId` (Optional, unique)
- `group` (Optional)

### Ticket
- `id` (UUID, Primary Key)
- `submitterId` (Foreign Key → User)
- `submitterName`, `submitterEmail`
- `group`, `year`
- `type` (academic_issue, administrative_issue, etc.)
- `priority` (low, medium, high, urgent)
- `subject`, `description`
- `status` (submitted, under_review, forwarded_to_hod, etc.)
- `escalationLevel` (1-3)
- `assignedTo` (Foreign Key → User)
- `submittedAt`, `updatedAt`

### TicketComment
- Comments on tickets (public or internal)
- Linked to author and ticket

### TicketStatusHistory
- Complete audit trail of status changes
- Tracks who changed what and when

### Notification
- User notifications for ticket updates

### AuditLog
- System-wide audit logging

See `server/config/prisma/schema.prisma` for the complete schema.

## 👥 User Roles & Permissions

### Submitter
- ✅ Create tickets
- ✅ View own tickets
- ✅ Edit own tickets (only if status is "submitted")
- ✅ Delete own tickets (only if status is "submitted")
- ✅ View ticket details and comments
- ❌ Cannot update ticket status
- ❌ Cannot view other submitters' tickets

### Class Advisor
- ✅ View all tickets from their group
- ✅ Update ticket status
- ✅ Add comments (public and internal)
- ✅ Forward tickets to HOD
- ✅ Resolve tickets
- ❌ Cannot view tickets from other groups

### Head of Group (HOD)
- ✅ View all escalated tickets from their group
- ✅ Update ticket status
- ✅ Add comments
- ✅ Forward tickets to Registrar
- ✅ Resolve tickets
- ❌ Cannot view tickets from other groups

### Registrar
- ✅ View all escalated tickets (university-wide)
- ✅ Update ticket status
- ✅ Add comments
- ✅ Resolve or reject tickets
- ✅ Full access to all tickets

## 🔄 Workflow & Escalation

The system implements an automated 3-level escalation hierarchy:

### Level 1: Class Advisor
- All new tickets are automatically assigned to the submitter's class advisor
- Class advisor reviews and can:
  - Mark as "under_review"
  - Forward to HOD
  - Resolve directly

### Level 2: Head of Group (HOD)
- When forwarded by class advisor, automatically assigned to group HOD
- HOD can:
  - Review and resolve
  - Forward to Registrar for university-level issues

### Level 3: Registrar
- Final escalation level
- Can resolve or reject tickets
- Handles university-wide administrative issues

### Status Flow
```
submitted → under_review → forwarded_to_hod → forwarded_to_registrar → resolved/rejected
```

### Email Notifications
- **Submitter**: Notified when ticket is submitted, status changes, or resolved
- **Reviewer**: Notified when a ticket is assigned to them
- **Next Reviewer**: Notified when a ticket is escalated to them

## 💻 Development

### Backend Development
```bash
cd server
npm run dev      # Development with hot reload
npm run build    # Build for production
npm start        # Start production server
npm run seed     # Seed database with test data
```

### Frontend Development
```bash
cd client
npm run dev      # Development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

### Database Management
```bash
cd server
npm run prisma:generate  # Generate Prisma client
npm run prisma:push      # Push schema to database
npm run prisma:studio    # Open Prisma Studio (database GUI)
```

## 🚢 Production Deployment

### Backend Deployment

1. Set production environment variables
2. Build the server:
   ```bash
   cd server
   npm run build
   ```
3. Run database migrations:
   ```bash
   npm run prisma:push
   ```
4. Start the server:
   ```bash
   npm start
   ```

### Frontend Deployment

1. Build the client:
   ```bash
   cd client
   npm run build
   ```
2. Start the Next.js server:
   ```bash
   npm start
   ```

### Recommended Production Setup

- Use a process manager like PM2
- Set up reverse proxy (Nginx)
- Configure SSL/TLS certificates
- Use production email service (SendGrid, Resend, etc.)
- Set up monitoring and logging
- Configure backup strategy for database

## 🧪 Testing

### Seed Test Data

The system includes a seed script to populate the database with test users:

```bash
cd server
npm run seed
```

This creates:
- 15 submitters across 3 groups
- 6 class advisors
- 3 HODs
- 2 registrars

See the seed script output for login credentials.

## 📚 Additional Documentation

- **[SETUP.md](SETUP.md)** - Detailed setup and configuration guide
- **[DOCUMENTATION.md](DOCUMENTATION.md)** - Methodology, implementation details, and technical documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 📞 Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Built with ❤️ for educational institutions**
