# Clerk Authentication Setup

This guide explains how to set up Clerk authentication for the Practice Journal backend.

## Authentication Status

⚠️ **Authentication is now REQUIRED** for all API endpoints (except `/health` and `/`).

## Setup Instructions

1. **Create a Clerk account** at https://clerk.com

2. **Create a new application** in Clerk Dashboard

3. **Get your API keys**:
   - Go to "API Keys" in the sidebar
   - Copy the "Secret Key" (starts with `sk_test_...` or `sk_live_...`)
   - Copy the "Publishable Key" (starts with `pk_test_...` or `pk_live_...`)

4. **Add to backend/.env**:
   ```bash
   CLERK_SECRET_KEY=sk_test_your_key_here
   CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   ```

5. **Restart the backend server** for the changes to take effect

## Testing Authentication

All endpoints now require a valid Clerk JWT token in the `Authorization` header:

```bash
# This will return 401 Unauthorized
curl http://localhost:8000/api/instruments/

# With a valid token (get from frontend after login)
curl -H "Authorization: Bearer <your_jwt_token>" http://localhost:8000/api/instruments/
```

## New Features

### User Data Isolation
- Users can only see their own instruments, templates, and logs
- System templates (marked with `is_system=true`) are visible to all users
- Attempting to access another user's data returns 404 (not 403, for security)

### Template Copying
- `POST /api/templates/{id}/copy` - Copy a system template to your account
- `POST /api/instruments/{id}/copy` - Copy a system instrument to your account
- Copies include all practice days, exercise blocks, and exercises

## Notes

- The current JWT validation uses `verify_signature: False` for simplicity in development
- In production, you should verify signatures using Clerk's JWKS endpoint
- User records are automatically created in the database on first authenticated request

