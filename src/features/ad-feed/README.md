# Ad Feed Feature

## Summary
Displays scraped ads in table or card view with filtering by subscription and platform. Provides detailed ad information including media, descriptions, and external links.

## Files Touched

### Backend
- `/convex/ads/functions.ts` - Ad queries (getByUser, getById, getBySubscription) and mutations (createExamples, remove)
- `/convex/schema.ts` - `ads` table definition with indexes on userId, subscriptionId, and scrapedAt

### Frontend
- `/src/routes/index.tsx` - Main dashboard/home page showing ad feed
- `/src/components/app-sidebar.tsx` - Navigation link (Home/Dashboard)

## Components

- `ad-columns.tsx` - Table column definitions for ads with thumbnail preview
- `ad-card-view.tsx` - Card grid view for displaying ads

## Types

- `types.ts` - Ad type definition

## Database Schema

The ads table includes:
- `userId` (string) - Foreign key to users table
- `subscriptionId` (Id<"subscriptions">) - Foreign key to subscriptions table
- `platform` (string) - Ad platform where scraped from
- `adId` (string) - Platform's unique ad identifier
- `title` (string) - Ad headline/title
- `description` (string) - Ad body text
- `link` (optional string) - Destination URL
- `mediaUrls` (string[]) - Array of media URLs
- `thumbnailUrl` (optional string) - Thumbnail image URL
- `scrapedAt` (number) - Timestamp when ad was scraped
- `rawData` (optional any) - Full platform response for debugging

Indexes:
- `by_user` on `userId`
- `by_subscription` on `subscriptionId`
- `by_scraped_at` on `scrapedAt`

## Features

- Table and card view toggle (preference saved to localStorage)
- Filter by subscription
- Sort by scrape date (most recent first)
- Display ad media with thumbnails
- External link to original ad
