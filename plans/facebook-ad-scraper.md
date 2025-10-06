# Facebook Ad Library API Integration

## 1. Database Design

### New/Adjusted Tables
- **ads table**: Add fields to match Facebook Ad Library response
  - `page_name` (string)
  - `page_id` (string)
  - `archive_id` (string) - replaces generic `adId`
  - `start_date` (number)
  - `end_date` (number)
  - `publisher_platform` (array of strings) - FB, IG, etc
  - `cta_text` (string)
  - `display_format` (string)
  - Keep `rawData` for full API response

### Queries

**scrapeFromFacebookAdLibrary (action)**
- Input: `subscriptionId`, hardcoded query = "n8n"
- Output: Array of created ad IDs
- Purpose: Fetch first 3-5 results from Facebook Ad Library API, store in DB

**getByUser (existing query)**
- Already exists, no changes needed
- Returns user's ads with filters

## 2. Data Flow

1. User clicks "Scrape Facebook Ads" button on dashboard
2. Frontend calls `scrapeFromFacebookAdLibrary` action
3. Action makes GET request to ScrapeCreators API with hardcoded query "n8n"
4. Action processes first 3-5 results from `searchResults` array
5. For each result: map API fields → ads table schema
6. Insert ads into database with `subscriptionId` reference
7. Return success/error toast to user

### Key Transformations
- `searchResults[0].ad_archive_id` → `archive_id`
- `searchResults[0].snapshot.body.text` → `description`
- `searchResults[0].snapshot.images[0].resized_image_url` → `thumbnailUrl`
- `searchResults[0].snapshot.images` → map all to `mediaUrls` array
- `searchResults[0].page_name` → `title` (or create from page_name)
- Full API response → `rawData`

## 3. User Flows

### Admin/User Flow (same for B2B)
- Navigate to dashboard (index route)
- See existing subscriptions dropdown
- Click "Scrape Facebook Ads" button (new)
- Loading state shows during API call
- Success toast: "5 ads scraped from Facebook"
- Ads appear in table/card view immediately (real-time Convex)
- Filter by subscription to see new Facebook ads

## 4. UI Components

### ScrapeFacebookAdsButton (new)
- **Purpose**: Trigger manual Facebook Ad Library scrape
- **Location**: Dashboard page (index.tsx), next to "Add Example Ads" button
- **Key interactions**: onClick calls action, shows loading state
- **Data requirements**: Active subscription ID (use first subscription or show dropdown)

### Dashboard (index.tsx - modified)
- Add new button in header actions area
- Display loading spinner during scrape
- Show toast notifications for success/error
- Existing table/card views display new ads automatically

## 5. API Routes

**External API Call (not internal route)**
- **Endpoint**: `GET https://api.scrapecreators.com/v1/facebook/adLibrary/search/ads`
- **Purpose**: Fetch Facebook ads by keyword from Meta Ad Library
- **Input**:
  - Headers: `x-api-key: process.env.SCRAPE_CREATORS_API_KEY`
  - Query params: `query=n8n` (hardcoded), `trim=true`
- **Output**: JSON with `searchResults` array and `cursor`

**Convex Action**
- `convex/ads/functions.ts::scrapeFromFacebookAdLibrary`
- Purpose: Fetch from external API, transform, store in DB
- Input: `{ subscriptionId: Id<"subscriptions"> }`
- Output: `{ success: boolean, count: number, error?: string }`

## 6. Patterns to Reuse

### Auth Pattern
- Use `getAuthUserId()` in action handler
- Verify subscription ownership before scraping
- Pattern from `convex/subscriptions/functions.ts`

### Mutation Pattern
- Similar to `createExamples` mutation in `convex/ads/functions.ts`
- Loop through results, insert multiple ads
- Return array of created IDs

### Action Pattern (NEW - need to add)
- Use `action()` instead of `mutation()` for external API calls
- Import `fetch` available in Convex runtime
- Error handling: try/catch with descriptive messages
- Store API response in `rawData` field for debugging

### UI Toast Pattern
- From subscriptions page: `toast.success()` / `toast.error()`
- useMutation pattern from Convex React

### Loading State Pattern
- Use mutation state: `const scrapeAds = useMutation(...)`
- Check `scrapeAds.isLoading` for button disabled state
- Pattern from existing mutations in index.tsx

## Implementation Checklist

**Backend (Convex)**
- [ ] Add scrapeFromFacebookAdLibrary action to `convex/ads/functions.ts`
- [ ] Add API key to `.env.local`: `SCRAPE_CREATORS_API_KEY`
- [ ] Map Facebook API response to ads table schema
- [ ] Handle errors (API rate limits, invalid responses)
- [ ] Limit to first 5 results with `.slice(0, 5)`

**Frontend**
- [ ] Add "Scrape Facebook Ads" button to dashboard
- [ ] Use first active subscription or show dropdown to select
- [ ] Add loading spinner to button
- [ ] Show success toast with count
- [ ] Show error toast with message
- [ ] Ensure ads auto-update via Convex reactivity

**Environment**
- [ ] Add SCRAPE_CREATORS_API_KEY to Convex environment variables
- [ ] Add to `.env.local` for local development

## Scrappiest MVP Notes

- **Hardcode query**: Start with "n8n" only, don't build search input yet
- **Manual trigger**: Button click only, no cron/automation
- **First subscription**: Use `subscriptions[0]._id`, don't build subscription picker yet
- **5 results max**: Don't implement pagination initially
- **No deduplication**: Accept duplicate ads for MVP
- **No media download**: Store external URLs only, don't upload to Convex storage
- **Trim response**: Use `trim=true` param to reduce API response size
