# Testing Authentication

## PR #3: Backend Auth Enforcement - Testing Guide

All API endpoints (except `/health` and `/`) now require authentication.

### ✅ Verified: Unauthenticated Requests Rejected

```bash
# All these return 401 Unauthorized
curl http://localhost:8000/api/instruments/
curl http://localhost:8000/api/templates/
curl http://localhost:8000/api/logs/
curl http://localhost:8000/api/analytics/

# Response:
# {"detail":"Authentication required"}
```

### ✅ Verified: Health Check Still Works

```bash
curl http://localhost:8000/health

# Response:
# {"status":"healthy"}
```

### Testing with Clerk Authentication (PR #4+ with Frontend)

Once the frontend is integrated (PR #4), you can test authenticated requests:

1. **Sign in through the frontend** (after PR #4 is implemented)
2. **Get your JWT token** from browser dev tools:
   - Open Developer Tools → Application/Storage → Cookies
   - Find the Clerk session cookie
   - Or use: `await window.Clerk.session.getToken()`

3. **Test authenticated API calls**:
```bash
# Replace <YOUR_TOKEN> with actual JWT
curl -H "Authorization: Bearer <YOUR_TOKEN>" http://localhost:8000/api/instruments/
```

### Expected Behavior

**When authenticated:**
- ✅ Users see their own instruments + system instruments
- ✅ Users see their own templates + system templates
- ✅ Users can create logs for their templates
- ✅ Users get analytics for their data only
- ✅ Users can copy system templates/instruments to their account
- ✅ Attempting to access another user's data returns 404

**User isolation tested via:**
- Database queries filter by `user_id`
- System templates accessible to all (`is_system=true`)
- 404 returned for unauthorized access (not 403, for security)

### New Endpoints Added

```bash
# Copy system template to user account
POST /api/templates/{id}/copy
Authorization: Bearer <token>

# Copy system instrument to user account  
POST /api/instruments/{id}/copy
Authorization: Bearer <token>
```

## Manual Testing Checklist

- [x] Unauthenticated requests return 401
- [x] Health check works without auth
- [x] `/api/user/me` works with and without auth (for testing)
- [ ] Authenticated user can see system instruments *(requires frontend/Clerk)*
- [ ] Authenticated user can copy system templates *(requires frontend/Clerk)*
- [ ] User A cannot see User B's data *(requires frontend/Clerk)*
- [ ] Analytics only show user's own data *(requires frontend/Clerk)*

**Note:** Items marked *(requires frontend/Clerk)* will be tested in PR #4 and PR #5.

