# Auth Feature

## Summary
Handles user authentication using Convex Auth with magic links. Provides protected route wrapper and sign in/out components.

## Files Touched

### Backend
- `/convex/auth.ts` - Auth configuration and session management
- `/convex/auth.config.ts` - Auth provider setup (Resend for magic links)
- `/convex/http.ts` - HTTP routes for authentication flow
- `/convex/schema.ts` - `authTables` (users, authSessions, authAccounts, etc.)

### Frontend
- `/src/routes/__root.tsx` - ConvexAuthProvider setup
- All routes that use `ProtectedRoute` wrapper

## Components

- `ProtectedRoute.tsx` - Wrapper component that requires authentication
- `SignIn.tsx` - Magic link sign-in form
- `SignOutButton.tsx` - Sign-out button component

## Critical Notes

⚠️ **Always use `getAuthUserId()` from `@convex-dev/auth/server`** - Never use `getUserIdentity().subject` for user IDs. See CLAUDE.md Authentication System section for details.
