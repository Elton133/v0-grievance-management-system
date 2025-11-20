# Grievance Management System - Backend Server

This is the backend API server for the Grievance Management System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env` and update the `DATABASE_URL` with your PostgreSQL connection string
   - Update `JWT_SECRET` with a secure random string

3. Generate Prisma client:
```bash
npm run prisma:generate
```

4. Push database schema:
```bash
npm run prisma:push
```

## Development

Run the development server with hot reload:
```bash
npm run dev
```

The server will start on http://localhost:5000 (or the PORT specified in .env)

## Production

Build the project:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
  - Body: `{ name, email, password, role?, studentId?, department? }`
  
- `POST /api/auth/login` - Login user
  - Body: `{ email, password }`
  - Returns: `{ token, user }`

### Petitions (Protected - requires Bearer token)

- `POST /api/petitions` - Create a new petition
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ subject, description, type, department?, year?, priority? }`
  
- `GET /api/petitions` - Get all petitions
  - Headers: `Authorization: Bearer <token>`
  
- `GET /api/petitions/my` - Get current user's petitions
  - Headers: `Authorization: Bearer <token>`
  
- `GET /api/petitions/:id` - Get petition by ID
  - Headers: `Authorization: Bearer <token>`
  
- `PATCH /api/petitions/:id/status` - Update petition status
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ status, comment? }`
  
- `POST /api/petitions/:id/comments` - Add comment to petition
  - Headers: `Authorization: Bearer <token>`
  - Body: `{ content, isInternal? }`

### Health Check

- `GET /health` - Server health check

## Project Structure

```
server/
├── config/
│   ├── controllers/
│   │   ├── authController.ts
│   │   └── petitionController.ts
│   ├── middleware/
│   │   └── auth.ts
│   ├── routes/
│   │   ├── authRoutes.ts
│   │   └── petitionRoutes.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── db.ts
│   └── server.ts
├── package.json
└── tsconfig.json
```
