# Subscriptions Feature

## Summary
Allows users to create and manage ad tracking subscriptions by search term or company. Supports multiple platforms (Facebook, Google, LinkedIn, Twitter) with configurable scraping frequencies (real-time, daily, weekly).

## Files Touched

### Backend
- `/convex/subscriptions/functions.ts` - CRUD operations (getByUser, getById, create, update, remove)
- `/convex/schema.ts` - `subscriptions` table definition with userId index

### Frontend
- `/src/routes/subscriptions.tsx` - Main subscriptions management page
- `/src/components/app-sidebar.tsx` - Navigation link to subscriptions
- `/src/routes/index.tsx` - References subscriptions for ad filtering dropdown

## Components

- `subscription-columns.tsx` - Table column definitions with delete action

## Types

- `types.ts` - Subscription type definition

## Database Schema

The subscriptions table includes:
- `userId` (string) - Foreign key to users table
- `searchTerm` (optional string) - Ad search term to track
- `company` (optional string) - Company name to track
- `platform` (string) - Ad platform (facebook, google, linkedin, twitter)
- `frequency` (string) - Scraping frequency (realtime, daily, weekly)
- `isActive` (boolean) - Whether subscription is active
- `lastScrapedAt` (optional number) - Last scrape timestamp

Index: `by_user` on `userId`

## Critical Notes

⚠️ Must provide either `searchTerm` OR `company` when creating a subscription - at least one is required.
