# AURA Interaction Tracker Backend

API server for AURA Interaction Tracker with MongoDB integration.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file (copy from `.env.example`)

3. Start server:
   ```bash
   npm start
   ```

## API Endpoints

See [MONGODB_SETUP.md](../MONGODB_SETUP.md) for complete documentation.

## Environment Variables

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## Models

- **User** - User accounts with authentication
- **Interaction** - User interaction records
- **Stats** - Aggregated statistics per user

## Security

- Password hashing with bcrypt
- JWT authentication
- CORS protection
- Input validation
- Auto-deletion of old data (30 days)

