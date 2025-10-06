# Profile Feature

## Summary
Displays user account information including email and name. Will eventually include AI model configuration and search preferences (Phase 2+).

## Files Touched

### Backend
- `/convex/profile/functions.ts` - User profile queries (getCurrentUser, etc.)
- `/convex/schema.ts` - `users` table (from authTables)

### Frontend
- `/src/routes/profile.tsx` - Profile page route
- `/src/components/app-sidebar.tsx` - Navigation link to profile

## Components

Currently no dedicated components - the profile page is self-contained. Components will be added as features are built out.

## Database Schema

Uses the `users` table from Convex Auth's `authTables`:
- `email` (optional string) - User's email address
- `name` (optional string) - User's display name
- `image` (optional string) - Profile image URL
- `emailVerificationTime` (optional number) - When email was verified
- `phone` (optional string) - Phone number
- `phoneVerificationTime` (optional number) - When phone was verified
- `isAnonymous` (optional boolean) - If user is anonymous

Indexes: `["email"]`, `["phone"]`

## Future Features (Phase 2+)

- AI model configuration (GPT-4, Claude, etc.)
- Search preferences
- Notification settings
- API keys management
