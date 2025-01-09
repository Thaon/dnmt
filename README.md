# dnmt
A tiny polymorphic backend that supports auth, uploads and plugins out of the box

## Features
- 🔐 Built-in authentication system with register/login endpoints
- 📁 File upload support with configurable storage
- 🔌 Plugin system for extending functionality
- 🛡️ Security features with Helmet middleware
- 🚀 Dynamic schema generation based on requests
- 📊 SQLite database with automatic table creation
- ⚡ Rate limiting for authentication endpoints

## Tech Stack
- Express.js - Web framework
- SQLite3 - Database
- JWT - Authentication
- Multer - File uploads
- Helmet - Security middleware
- Bcrypt - Password hashing
- CORS - Cross-origin support

## Installation
```bash
npm install
```

## Usage

### Authentication Endpoints
- POST `/register` - Create a new user account
- POST `/login` - Authenticate and receive JWT token
- GET `/me` - Get current user information (requires authentication)

### Dynamic Endpoints
The backend automatically creates and updates endpoints based on incoming POST/PUT requests. When you make a request:
1. If the endpoint doesn't exist, it creates a new one with a schema based on your request
2. If it exists, it updates the schema to include any new fields (existing fields are preserved)

### File Uploads
- Supports file uploads through Multer middleware
- Files are stored in the `uploads` directory
- 5MB file size limit by default

### Security Features
- JWT-based authentication
- Rate limiting on auth endpoints (5 requests per 15 minutes)
- Helmet security middleware enabled
- Password hashing with bcrypt

## Environment
- Port: 1337 (default)
- Database: SQLite (database.db)

## Plugins
Place plugin files in the `plugins` directory. Each plugin should export an array of routes with the following structure:
```javascript
{
  method: 'GET|POST|PUT|DELETE',
  path: '/your-route',
  requiresAuth: true|false,
  handler: (context) => {
    // Your route logic here
  }
}
