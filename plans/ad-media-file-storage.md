# Ad Media File Storage Migration

## 1. Database Design

### Adjusted Tables

**ads table**:
- Add `thumbnailStorageId: v.optional(v.id("_storage"))` - Convex storage ID for thumbnail
- Add `mediaStorageIds: v.optional(v.array(v.id("_storage")))` - Array of storage IDs for images/videos
- Keep existing `thumbnailUrl` and `mediaUrls` for backward compatibility during migration
- Add `mediaMetadata: v.optional(v.array(v.object({ type: v.string(), storageId: v.id("_storage"), originalUrl: v.string() })))` - Track media type and source

**advertisers table**:
- Add `pageProfilePictureStorageId: v.optional(v.id("_storage"))` - Convex storage ID for profile pic
- Keep existing `pageProfilePictureUrl` for backward compatibility

### Key Queries

**storeMediaFile**
- Input: URL (string), type (string: "image" | "video")
- Output: Storage ID (Id<"_storage">)
- Purpose: Fetch external media, upload to Convex storage, return storage ID

**getAdWithMedia**
- Input: adId (Id<"ads">)
- Output: Ad object with Convex URLs for all media
- Purpose: Fetch ad and generate Convex URLs for stored media

**getMediaUrl**
- Input: storageId (Id<"_storage">)
- Output: Signed URL (string)
- Purpose: Generate URL for frontend to display media

## 2. Data Flow

1. **Scrape**: External API returns ad with Facebook media URLs
2. **Download & Store**: Action downloads each media file, uploads to Convex storage, receives storage IDs
3. **Save Reference**: Store storage IDs in ads table (thumbnailStorageId, mediaStorageIds)
4. **Query**: Frontend queries ads, backend generates signed URLs from storage IDs
5. **Display**: Frontend renders media using Convex-hosted URLs

### Key Transformations

- External URL → Binary data (fetch)
- Binary data → Convex storage ID (ctx.storage.store)
- Storage ID → Signed URL (ctx.storage.getUrl)
- Migration: Keep old URLs, add storage IDs, gradually phase out external URLs

## 3. User Flows

### Admin Flow
- Trigger scrape via subscription (existing)
- System downloads media from Facebook URLs automatically
- System stores in Convex, saves storage IDs
- Admin views ads dashboard with Convex-hosted media

### End User Flow
- View ads feed at /ads
- Media loads from Convex storage (transparent to user)
- Click through to ad detail page
- All images/videos load from Convex

## 4. UI Components

**AdCardView** ([ad-card-view.tsx](../src/features/ad-feed/components/ad-card-view.tsx))
- Purpose: Display ad cards in grid layout
- Key interactions: Click to expand description, click external link
- Data requirements: Ad with thumbnailStorageId → needs URL generation
- Change: Use Convex URL instead of thumbnailUrl when available

**AdColumns** ([ad-columns.tsx](../src/features/ad-feed/components/ad-columns.tsx))
- Purpose: Define table columns for ad list view
- Key interactions: Sort, filter, view advertiser profile pic
- Data requirements: Advertiser with pageProfilePictureStorageId → needs URL
- Change: Use Convex URL for profile pictures when available

**AdDetailView** (if exists)
- Purpose: Show full ad with all media (images, videos, carousel cards)
- Key interactions: View full-size media, navigate carousel
- Data requirements: All mediaStorageIds → generate URLs for gallery
- Change: Render all media from Convex storage

## 5. API Routes

**Convex Actions**

**scrapeFromFacebookAdLibrary** (existing, needs update)
- Purpose: Scrape ads and store media
- Input: subscriptionId
- Output: { success, count, message }
- Changes: After extracting media URLs, download and store in Convex before creating ad record

**storeMediaFromUrl** (new internal action)
- Purpose: Download external media and store in Convex
- Input: { url: string, type: "image" | "video" }
- Output: storageId (Id<"_storage">)
- Logic: fetch URL → blob → ctx.storage.store → return ID

**Convex Queries**

**getByUser** (existing, needs update)
- Purpose: List ads with media URLs
- Input: platform, subscriptionId (optional)
- Output: Ads with generated media URLs
- Changes: Generate Convex URLs from storage IDs for display

**getById** (existing, needs update)
- Purpose: Get single ad with all media
- Input: adId
- Output: Ad with all media URLs generated
- Changes: Generate URLs for thumbnailStorageId + all mediaStorageIds

## 6. Patterns to Reuse

**Authentication**: Use `getAuthUserId()` pattern from existing ad queries
**Batch Processing**: Similar to advertiser upsert pattern - process media in parallel during scrape
**Internal Mutations**: Use internal mutations for storage operations (like `insertAd` pattern)
**Error Handling**: Continue processing on failure - store what succeeds, log what fails
**Backward Compatibility**: Keep old URL fields, add new storage ID fields - migrate gradually

## 7. Code Snippets - File Storage Implementation

### Fetching and Storing External Media

**Action: Download and store media from external URL**
```typescript
// convex/ads/mediaStorage.ts
import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

export const storeMediaFromUrl = action({
  args: {
    url: v.string(),
    type: v.union(v.literal("image"), v.literal("video"))
  },
  handler: async (ctx, args) => {
    try {
      // Fetch the media from external URL
      const response = await fetch(args.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.statusText}`);
      }

      // Convert to blob
      const blob = await response.blob();

      // Store in Convex storage
      const storageId = await ctx.storage.store(blob);

      return { storageId, originalUrl: args.url };
    } catch (error) {
      console.error("Error storing media:", error);
      return null;
    }
  },
});
```

### Saving Storage IDs to Database

**Internal Mutation: Save storage IDs to ads table**
```typescript
// convex/ads/functions.ts
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const saveAdWithMedia = internalMutation({
  args: {
    // ... other ad fields
    thumbnailStorageId: v.optional(v.id("_storage")),
    mediaStorageIds: v.optional(v.array(v.id("_storage"))),
    mediaMetadata: v.optional(v.array(v.object({
      type: v.string(),
      storageId: v.id("_storage"),
      originalUrl: v.string()
    })))
  },
  handler: async (ctx, args) => {
    const adId = await ctx.db.insert("ads", {
      ...args,
      // Store both old URLs (backward compatibility) and new storage IDs
    });
    return adId;
  },
});
```

### Retrieving Media URLs for Display

**Query: Get ad with generated media URLs**
```typescript
// convex/ads/functions.ts
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getAdWithMedia = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad) return null;

    // Generate URLs from storage IDs
    const thumbnailUrl = ad.thumbnailStorageId
      ? await ctx.storage.getUrl(ad.thumbnailStorageId)
      : ad.thumbnailUrl; // Fallback to old URL

    // Generate URLs for all media files
    const mediaUrls = ad.mediaStorageIds
      ? await Promise.all(
          ad.mediaStorageIds.map(id => ctx.storage.getUrl(id))
        )
      : ad.mediaUrls; // Fallback to old URLs

    return {
      ...ad,
      thumbnailUrl,
      mediaUrls,
    };
  },
});
```

### Complete Scraping Flow with Media Storage

**Action: Scrape ads and store media**
```typescript
// convex/ads/scraping.ts
import { action } from "../_generated/server";
import { internal } from "../_generated/api";

export const scrapeAndStoreAds = action({
  args: { subscriptionId: v.id("subscriptions") },
  handler: async (ctx, args) => {
    // 1. Fetch ads from external API
    const externalAds = await fetchFromFacebookAPI(args.subscriptionId);

    for (const externalAd of externalAds) {
      // 2. Download and store thumbnail
      const thumbnailResult = await ctx.runAction(
        internal.ads.mediaStorage.storeMediaFromUrl,
        { url: externalAd.thumbnailUrl, type: "image" }
      );

      // 3. Download and store all media files in parallel
      const mediaResults = await Promise.all(
        externalAd.mediaUrls.map(url =>
          ctx.runAction(internal.ads.mediaStorage.storeMediaFromUrl, {
            url,
            type: externalAd.mediaType || "image"
          })
        )
      );

      // 4. Filter successful uploads
      const successfulMedia = mediaResults.filter(r => r !== null);

      // 5. Save ad with storage IDs
      await ctx.runMutation(internal.ads.functions.saveAdWithMedia, {
        ...externalAd,
        thumbnailStorageId: thumbnailResult?.storageId,
        mediaStorageIds: successfulMedia.map(m => m.storageId),
        mediaMetadata: successfulMedia.map(m => ({
          type: "image",
          storageId: m.storageId,
          originalUrl: m.originalUrl
        }))
      });
    }

    return { success: true, count: externalAds.length };
  },
});
```

### Deleting Orphaned Files (Cleanup)

**Mutation: Delete files when ad is deleted**
```typescript
// convex/ads/functions.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const deleteAdWithMedia = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const ad = await ctx.db.get(args.adId);
    if (!ad) throw new Error("Ad not found");

    // Delete the ad document
    await ctx.db.delete(args.adId);

    // Delete associated media files
    if (ad.thumbnailStorageId) {
      await ctx.storage.delete(ad.thumbnailStorageId);
    }

    if (ad.mediaStorageIds) {
      await Promise.all(
        ad.mediaStorageIds.map(id => ctx.storage.delete(id))
      );
    }

    return { success: true };
  },
});
```

### Frontend: Displaying Media

**React Component: Show ad with Convex-hosted media**
```tsx
// src/features/ad-feed/components/ad-card-view.tsx
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function AdCardView({ adId }: { adId: Id<"ads"> }) {
  const ad = useQuery(api.ads.functions.getAdWithMedia, { adId });

  if (!ad) return <div>Loading...</div>;

  return (
    <div className="ad-card">
      {/* Thumbnail from Convex storage */}
      {ad.thumbnailUrl && (
        <img
          src={ad.thumbnailUrl}
          alt="Ad thumbnail"
          className="ad-thumbnail"
        />
      )}

      {/* All media from Convex storage */}
      <div className="ad-media-gallery">
        {ad.mediaUrls?.map((url, idx) => (
          <img
            key={idx}
            src={url}
            alt={`Ad media ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
```

## 8. Implementation Notes

### Storage Limits (from Convex docs)
- **Starter**: 1 GiB storage included
- **Professional**: 100 GiB storage included ($0.03/month per additional GiB)
- **Bandwidth**: 1 GiB/month (Starter), 50 GiB/month (Professional)

### Best Practices
- MVP: Focus on images first (thumbnails + mediaUrls), add video support later
- Use actions for file storage (external fetch → Convex storage) - actions can access external APIs
- Add retry logic for failed downloads (external URLs can be unreliable)
- Store original URLs in metadata for debugging/re-processing if needed
- Consider file size limits - validate before storing
- Process media downloads in parallel for better performance
- Add cleanup job to delete orphaned storage files (future enhancement)
- Keep backward compatibility by maintaining old URL fields during migration
