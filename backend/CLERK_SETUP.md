# Clerk Authentication Setup

This guide explains how to set up Clerk authentication for the Practice Journal backend.

## Backend Auth Infrastructure

The authentication is **optional** currently. The app works without Clerk configured - the new `/api/user/me` endpoint will simply return `authenticated: false` if no token is provided.

### Optional: Test with Clerk

If you want to test JWT validation:

1. **Create a Clerk account** at https://clerk.com
2. **Create a new application** in Clerk Dashboard
3. **Get your API keys**:
   - Go to "API Keys" in the sidebar
   - Copy the "Secret Key" (starts with `sk_test_...`)
   - Copy the "Publishable Key" (starts with `pk_test_...`)

4. **Add to backend/.env**:
   ```bash
   CLERK_SECRET_KEY=sk_test_your_key_here
   CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   ```

5. **Test the endpoint**:
   ```bash
   # Without authentication (should work)
   curl http://localhost:8000/api/user/me
   
   # Response:
   # {"authenticated": false, "message": "No authentication provided"}
   ```

## Next Steps

In upcoming changes, authentication will become **required** for all endpoints except `/health` and `/`.

## Notes

- The current JWT validation uses `verify_signature: False` for simplicity in development
- In production, you should verify signatures using Clerk's JWKS endpoint
- User records are automatically created in the database on first authenticated request

