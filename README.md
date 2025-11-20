# Grievance Management System

A full-stack web application for managing student grievances/petitions in an educational institution. Built with Next.js frontend and Express.js backend with PostgreSQL database.

## Project Structure

```
v0-grievance-management-system/
├── client/          # Next.js frontend application
│   ├── app/         # Next.js app router pages
│   ├── components/  # React components
│   ├── lib/         # Utility functions and stores
│   └── styles/      # CSS styles
│
└── server/          # Express.js backend API
    └── config/
        ├── controllers/  # API controllers
        ├── routes/      # API routes
        ├── middleware/  # Express middleware
        ├── prisma/      # Database schema
        ├── db.ts        # Prisma client instance
        └── server.ts    # Express server entry point
```

## Features

- 🔐 User authentication (JWT-based)
- 📝 Create and manage petitions/grievances
- 👥 Role-based access (Student, Class Advisor, HOD, Registrar)
- 💬 Comments and internal notes on petitions
- 📊 Petition status tracking and history
- 🔔 Notification system
- 📈 Analytics dashboard
- 🔍 Audit logging

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database

### Backend Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy the `.env` file and update:
     - `DATABASE_URL` - Your PostgreSQL connection string
     - `JWT_SECRET` - A secure random string for JWT signing
     - `PORT` - Server port (default: 5000)

4. Generate Prisma client:
```bash
npm run prisma:generate
```

5. Push database schema:
```bash
npm run prisma:push
```

6. Start the development server:
```bash
npm run dev
```

The backend API will be available at `http://localhost:5000`

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables (if needed):
   - Create `.env.local` and add any required variables
   - Set the API URL if different from default

4. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## API Documentation

See [server/README.md](server/README.md) for detailed API endpoint documentation.

### Key Endpoints

- **Authentication**
  - `POST /api/auth/register` - Register new user
  - `POST /api/auth/login` - Login user

- **Petitions** (Protected)
  - `POST /api/petitions` - Create petition
  - `GET /api/petitions` - List all petitions
  - `GET /api/petitions/my` - Get user's petitions
  - `GET /api/petitions/:id` - Get petition details
  - `PATCH /api/petitions/:id/status` - Update status
  - `POST /api/petitions/:id/comments` - Add comment

## Database Schema

The application uses Prisma ORM with PostgreSQL. Key models include:

- **User** - User accounts with role-based access
- **Petition** - Main grievance/petition records
- **PetitionComment** - Comments on petitions
- **PetitionStatusHistory** - Audit trail of status changes
- **Notification** - User notifications
- **AuditLog** - System-wide audit logging

See [server/config/prisma/schema.prisma](server/config/prisma/schema.prisma) for the complete schema.

## Development

### Backend Development
```bash
cd server
npm run dev     # Development with hot reload
npm run build   # Build for production
npm start       # Start production server
```

### Frontend Development
```bash
cd client
npm run dev     # Development server
npm run build   # Build for production
npm start       # Start production server
npm run lint    # Run ESLint
```

## Production Deployment

### Backend
1. Build the server: `cd server && npm run build`
2. Set production environment variables
3. Run database migrations: `npm run prisma:push`
4. Start the server: `npm start`

### Frontend
1. Build the client: `cd client && npm run build`
2. Start the Next.js server: `npm start`

Consider using a process manager like PM2 for production deployments.

## Tech Stack

### Frontend
- Next.js 14 (React framework)
- TypeScript
- Tailwind CSS
- Radix UI components
- Zustand (State management)
- React Hook Form
- Recharts (Analytics)

### Backend
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication
- bcrypt (Password hashing)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.
