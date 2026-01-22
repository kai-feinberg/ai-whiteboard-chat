# ScrapeCreators API Integration Guide

Complete reference for integrating ScrapeCreators API (https://api.scrapecreators.com) for social media content scraping across multiple platforms.

---

## Table of Contents
1. [Authentication & Error Handling](#authentication--error-handling)
2. [YouTube Integration](#youtube-integration)
3. [Twitter/X Integration](#twitterx-integration)
4. [TikTok Integration](#tiktok-integration)
5. [Facebook Ad Library Integration](#facebook-ad-library-integration)
6. [Status Management Pattern](#status-management-pattern)

---

## Authentication & Error Handling

### Authentication
All API requests require an API key passed via header:

```typescript
const response = await fetch(apiUrl, {
  method: 'GET',
  headers: {
    'x-api-key': process.env.SCRAPE_CREATORS_API_KEY,
  },
});
```

**Environment Variable:**
```
SCRAPE_CREATORS_API_KEY=your_api_key_here
```

### Common Error Handling Pattern

```typescript
if (!response.ok) {
  const errorText = await response.text();
  console.error(`[Platform] API error (${response.status}):`, errorText);
  throw new Error(`API request failed: ${response.status} ${response.statusText}`);
}

const data = await response.json();

// Platform-specific validation here...
```

### Status Lifecycle
All scraped content follows this status pattern:
1. **`pending`** - Node created, scraping not started
2. **`processing`** - API request in progress
3. **`completed`** - Successfully scraped and saved
4. **`failed`** - Error occurred (stored in `error` field)

---

## YouTube Integration

### API Endpoint
```
GET https://api.scrapecreators.com/v1/youtube/video/transcript
```

### Request Format
```typescript
const videoUrl = "https://www.youtube.com/watch?v=VIDEO_ID"; // or https://youtu.be/VIDEO_ID

const response = await fetch(
  `https://api.scrapecreators.com/v1/youtube/video/transcript?url=${encodeURIComponent(videoUrl)}`,
  {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
    },
  }
);
```

**URL Extraction:**
```typescript
function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/);
  return match?.[1] ?? null;
}
```

### Response Schema
```json
{
  "videoId": "dQw4w9WgXcQ",
  "transcript_only_text": "Full transcript text here...",
  "language": "en"
}
```

### Data Extraction
```typescript
const data = await response.json();

// Extract transcript text
const transcript = data.transcript_only_text;
if (!transcript || transcript.length === 0) {
  throw new Error("Transcript not available for this video");
}

// Extract metadata
const videoId = data.videoId;
const language = data.language || 'unknown';

// Fallback title (if video metadata not in response)
const title = `YouTube Video ${videoId}`;

// Generate thumbnail URL
const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
```

### Storage Schema
```typescript
{
  organizationId: string,
  url: string,                    // Full YouTube URL
  videoId: string,                // Extracted video ID
  title?: string,                 // Video title
  transcript?: string,            // Full transcript text
  thumbnailUrl?: string,          // Video thumbnail
  status: "pending" | "processing" | "completed" | "failed",
  error?: string,
  createdAt: number,
  updatedAt: number,
}
```

---

## Twitter/X Integration

### API Endpoint
```
GET https://api.scrapecreators.com/v1/twitter/tweet
```

### Request Format
```typescript
const tweetUrl = "https://twitter.com/username/status/1234567890";
// Also supports x.com URLs

const response = await fetch(
  `https://api.scrapecreators.com/v1/twitter/tweet?url=${encodeURIComponent(tweetUrl)}`,
  {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
    },
  }
);
```

**Tweet ID Extraction:**
```typescript
function extractTwitterId(url: string): string | null {
  // Supports: twitter.com and x.com
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match?.[1] ?? null;
}
```

### Response Schema
```json
{
  "legacy": {
    "full_text": "Tweet text for regular tweets..."
  },
  "note_tweet": {
    "note_tweet_results": {
      "result": {
        "text": "Full text for long-form tweets (Twitter Notes)..."
      }
    }
  },
  "core": {
    "user_results": {
      "result": {
        "legacy": {
          "name": "Display Name",
          "screen_name": "username"
        }
      }
    }
  }
}
```

### Data Extraction
```typescript
const data = await response.json();

// Extract tweet text (handles both regular tweets and long-form notes)
const fullText = data.legacy?.full_text || data.note_tweet?.note_tweet_results?.result?.text;
if (!fullText || fullText.length === 0) {
  throw new Error("Tweet text not available");
}

// Extract author information
const authorName = data.core?.user_results?.result?.legacy?.name;
const authorUsername = data.core?.user_results?.result?.legacy?.screen_name;
```

### Storage Schema
```typescript
{
  organizationId: string,
  url: string,                    // Full tweet URL
  tweetId: string,                // Extracted tweet ID
  fullText?: string,              // Tweet text content
  authorName?: string,            // Author display name
  authorUsername?: string,        // Author @username
  status: "pending" | "processing" | "completed" | "failed",
  error?: string,
  createdAt: number,
  updatedAt: number,
}
```

---

## TikTok Integration

### API Endpoint
```
GET https://api.scrapecreators.com/v2/tiktok/video
```

### Request Format
```typescript
const tiktokUrl = "https://www.tiktok.com/@username/video/1234567890";

const apiUrl = new URL("https://api.scrapecreators.com/v2/tiktok/video");
apiUrl.searchParams.append("url", tiktokUrl);
apiUrl.searchParams.append("get_transcript", "true");
apiUrl.searchParams.append("trim", "true");

const response = await fetch(apiUrl.toString(), {
  method: 'GET',
  headers: {
    'x-api-key': apiKey,
  },
});
```

### Response Schema
```json
{
  "success": true,
  "aweme_detail": {
    "aweme_id": "1234567890",
    "desc": "Video description/caption",
    "author": {
      "nickname": "Display Name",
      "unique_id": "username"
    }
  },
  "transcript_only_text": "Parsed transcript text...",
  "transcript": "WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nTranscript line 1\n\n00:00:02.000 --> 00:00:04.000\nTranscript line 2"
}
```

### Data Extraction
```typescript
const data = await response.json();

// Check for success
if (!data.success) {
  throw new Error("API request was not successful");
}

// Extract video information
const awemeDetail = data.aweme_detail;
if (!awemeDetail) {
  throw new Error("Invalid API response: missing aweme_detail");
}

// Extract title/description
const title = awemeDetail.desc || "TikTok Video";

// Extract author - try multiple fields
const author = awemeDetail.author?.nickname || awemeDetail.author?.unique_id || "Unknown";

// Extract video ID
const videoId = awemeDetail.aweme_id || undefined;

// Extract transcript - could be pre-parsed or WEBVTT format
let transcript = data.transcript_only_text || data.transcript;

// Parse WEBVTT format if needed
if (transcript && transcript.includes('WEBVTT')) {
  const lines = transcript.split('\n');
  const textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip WEBVTT header, timestamps, and empty lines
    if (line &&
        !line.startsWith('WEBVTT') &&
        !line.includes('-->') &&
        !line.match(/^\d{2}:\d{2}:\d{2}/)) {
      textLines.push(line);
    }
  }

  transcript = textLines.join(' ');
}

if (!transcript || transcript.length === 0) {
  console.warn("No transcript available for video");
  // Note: Some videos may not have transcripts - this is not always an error
}
```

### Storage Schema
```typescript
{
  organizationId: string,
  url: string,                    // Full TikTok URL
  videoId?: string,               // Extracted video ID from API
  title?: string,                 // Video description/caption
  transcript?: string,            // Parsed transcript text
  author?: string,                // Video author/creator
  status: "pending" | "processing" | "completed" | "failed",
  error?: string,
  createdAt: number,
  updatedAt: number,
}
```

---

## Facebook Ad Library Integration

### API Endpoint
```
GET https://api.scrapecreators.com/v1/facebook/adLibrary/ad
```

### Request Format
```typescript
const adId = "1234567890"; // Facebook Ad Archive ID

const apiUrl = new URL("https://api.scrapecreators.com/v1/facebook/adLibrary/ad");
apiUrl.searchParams.append("id", adId);
apiUrl.searchParams.append("get_transcript", "true");
apiUrl.searchParams.append("trim", "true");

const response = await fetch(apiUrl.toString(), {
  method: 'GET',
  headers: {
    'x-api-key': apiKey,
  },
});
```

### Response Schema
```json
{
  "success": true,
  "adArchiveID": "1234567890",
  "url": "https://www.facebook.com/ads/library?id=1234567890",
  "pageName": "Advertiser Page Name",
  "publisherPlatform": ["facebook", "instagram"],
  "snapshot": {
    "title": "Ad Title",
    "body": "Ad copy text...",
    "link_description": "Link description text...",
    "page_name": "Page Name",
    "cards": [
      {
        "title": "Card Title (prioritized if available)"
      }
    ],
    "images": [
      {
        "original_image_url": "https://...",
        "resized_image_url": "https://..."
      }
    ],
    "videos": [
      {
        "video_hd_url": "https://...",
        "video_sd_url": "https://...",
        "video_preview_image_url": "https://...",
        "transcript": "Video transcript if available..."
      }
    ]
  }
}
```

### Data Extraction
```typescript
const data = await response.json();

// Check for success (may be undefined for some responses)
if (!data.success && data.success !== undefined) {
  throw new Error("API request was not successful");
}

// Extract ad information
const snapshot = data.snapshot;
if (!snapshot) {
  throw new Error("Invalid API response: missing snapshot");
}

// Extract title - prioritize cards if available
let title = snapshot.title;
if (snapshot.cards && snapshot.cards.length > 0 && snapshot.cards[0].title) {
  title = snapshot.cards[0].title;
}
title = title || data.pageName || "Facebook Ad";

// Extract ad copy
const body = snapshot.body || "";
const linkDescription = snapshot.link_description || "";

// Extract page name
const pageName = data.pageName || snapshot.page_name || "Unknown Page";

// Extract publisher platforms
const publisherPlatform = data.publisherPlatform || [];

// Extract Ad Archive ID and URL
const adArchiveID = data.adArchiveID?.toString() || adId;
const url = data.url || `https://www.facebook.com/ads/library?id=${adArchiveID}`;

// Determine media type and process media
let mediaType: "image" | "video" | "none" = "none";
let imageStorageIds: string[] | undefined;
let videoThumbnailStorageId: string | undefined;
let videoUrl: string | undefined;
let transcript: string | undefined;

// Check for videos first
if (snapshot.videos && snapshot.videos.length > 0) {
  mediaType = "video";
  const video = snapshot.videos[0];

  // Store video HD URL
  videoUrl = video.video_hd_url || video.video_sd_url;

  // Fetch and store video thumbnail
  if (video.video_preview_image_url) {
    try {
      const thumbnailResponse = await fetch(video.video_preview_image_url);
      if (thumbnailResponse.ok) {
        const thumbnailBlob = await thumbnailResponse.blob();
        videoThumbnailStorageId = await storageAPI.store(thumbnailBlob);
      }
    } catch (error) {
      console.warn("Failed to store video thumbnail:", error);
    }
  }

  // Extract transcript if available
  const videoTranscript = video.transcript;
  if (videoTranscript && typeof videoTranscript === 'string') {
    transcript = videoTranscript;
  }
}
// Check for images
else if (snapshot.images && snapshot.images.length > 0) {
  mediaType = "image";
  imageStorageIds = [];

  // Store each image (limit to first 5 to avoid excessive storage)
  const imagesToProcess = snapshot.images.slice(0, 5);
  for (let i = 0; i < imagesToProcess.length; i++) {
    const image = imagesToProcess[i];
    const imageUrl = image.resized_image_url || image.original_image_url;

    if (imageUrl) {
      try {
        const imageResponse = await fetch(imageUrl);
        if (imageResponse.ok) {
          const imageBlob = await imageResponse.blob();
          const storageId = await storageAPI.store(imageBlob);
          imageStorageIds.push(storageId);
        }
      } catch (error) {
        console.warn(`Failed to store image ${i + 1}:`, error);
      }
    }
  }
}
```

### Storage Schema
```typescript
{
  organizationId: string,
  adId: string,                   // Facebook Ad Archive ID (user input)
  adArchiveID?: string,           // Confirmed Ad Archive ID from API
  url?: string,                   // Ad Library URL
  title?: string,                 // Ad title
  body?: string,                  // Ad body text
  linkDescription?: string,       // Link description
  transcript?: string,            // Video transcript if available
  mediaType?: "image" | "video" | "none",
  imageStorageIds?: string[],     // Storage IDs for images
  videoThumbnailStorageId?: string, // Storage ID for video thumbnail
  videoUrl?: string,              // HD video URL
  pageName?: string,              // Page/advertiser name
  publisherPlatform?: string[],   // Platforms ad ran on
  status: "pending" | "processing" | "completed" | "failed",
  error?: string,
  createdAt: number,
  updatedAt: number,
}
```

---

## Status Management Pattern

All platforms follow the same status management pattern for async processing:

### 1. Create Node (Pending State)
```typescript
// Create node with "pending" status
const nodeId = await db.insert("platform_nodes", {
  organizationId,
  url, // or adId for Facebook
  status: "pending",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  // platform-specific fields...
});

// Schedule background processing
await scheduler.runAfter(0, internal.platform.fetchData, { nodeId });
```

### 2. Update to Processing
```typescript
// Update status before making API call
await db.patch(nodeId, {
  status: "processing",
  updatedAt: Date.now(),
});
```

### 3. Handle Success
```typescript
try {
  const data = await fetch(/* API call */);

  // Extract and parse data...

  // Update to completed with data
  await db.patch(nodeId, {
    status: "completed",
    // extracted data fields...
    updatedAt: Date.now(),
  });
} catch (error) {
  // Handle failure (see below)
}
```

### 4. Handle Failure
```typescript
catch (error: any) {
  let errorMessage = error?.message || "Failed to fetch data";

  // Handle common API errors
  if (error?.message?.includes('API request failed')) {
    errorMessage = "API request failed. Please check your API key and URL.";
  }

  // Update to failed with error message
  await db.patch(nodeId, {
    status: "failed",
    error: errorMessage,
    updatedAt: Date.now(),
  });
}
```

---

## Implementation Checklist

When implementing ScrapeCreators API for a new platform:

- [ ] Set up `SCRAPE_CREATORS_API_KEY` environment variable
- [ ] Define database schema with required fields + status management
- [ ] Implement URL/ID extraction function (if applicable)
- [ ] Create mutation to insert node with `pending` status
- [ ] Create action to fetch data from ScrapeCreators API
- [ ] Update status to `processing` before API call
- [ ] Parse API response according to platform-specific schema
- [ ] Handle media storage (images, videos) if applicable
- [ ] Update status to `completed` with extracted data
- [ ] Implement error handling with `failed` status
- [ ] Test with valid and invalid URLs/IDs
- [ ] Verify status transitions in UI

---

## Notes

- **Rate Limiting**: Check ScrapeCreators API documentation for rate limits
- **Cost**: Each API call may incur costs - implement usage tracking if needed
- **Caching**: Consider caching scraped content to avoid duplicate API calls
- **Retries**: Implement retry logic for transient failures (network issues, rate limits)
- **Validation**: Always validate URLs/IDs before making API calls to avoid wasted requests
- **Storage**: For platforms with media (Facebook, TikTok), ensure adequate storage capacity
- **Transcripts**: Not all videos have transcripts - handle gracefully when unavailable
