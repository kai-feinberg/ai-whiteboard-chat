# Code Review: TikTok Search Implementation (US-TK-001)

**Reviewed File:** `/Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts`

**Stats:**
- Files Modified: 1
- Files Added: 0
- Files Deleted: 0
- New lines: 208
- Deleted lines: 2

---

## Acceptance Criteria Verification

| Criteria | Status | Notes |
|----------|--------|-------|
| Create `fetchTikTokSearch` function in `convex/chat/tools.ts` | PASS | Lines 327-392 |
| Call Scrape Creators search endpoint: `GET /v1/tiktok/search/keyword` | PASS | Line 342-343 |
| Query params: `sort_by: most-liked`, `trim: true` | PASS | Lines 345-346 |
| Parse WebVTT transcripts to plain text (`parseWebVTT` helper) | PASS | Lines 251-275 |
| Fetch transcripts in parallel via `GET /v1/tiktok/video/transcript` | PASS | Lines 383-385 |
| Return array with correct shape | PASS | Lines 388-391 |
| Handle API errors (rate limits, invalid key) | PASS | Lines 352-360 |
| Silent fallback to `"[No speech detected]"` if transcript fails | PASS | Lines 302-315 |

---

## Issues Found

### HIGH: parseWebVTT may include WebVTT metadata/styling tags

```
severity: high
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 259-270
issue: parseWebVTT does not strip WebVTT styling tags or NOTE blocks
detail: WebVTT format can include:
  - NOTE blocks (comments): "NOTE This is a comment"
  - Cue settings: "<v Speaker1>text</v>"
  - Styling tags: "<b>bold</b>", "<i>italic</i>", "<u>underline</u>"
  - Class spans: "<c.classname>text</c>"
  - Ruby annotations: "<ruby>text<rt>annotation</rt></ruby>"
  - Timestamp tags: "<00:00:00.000>text"
  
  These could appear in the final transcript output, polluting the text.
suggestion: Add filtering for NOTE lines and strip HTML-like tags:
  ```typescript
  // Skip NOTE blocks
  if (trimmed.startsWith("NOTE")) {
    continue;
  }
  // Strip WebVTT styling tags
  const cleanedLine = trimmed.replace(/<[^>]+>/g, "");
  if (cleanedLine) {
    textLines.push(cleanedLine);
  }
  ```
```

### MEDIUM: parseWebVTT does not handle STYLE blocks

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 259-270
issue: WebVTT STYLE blocks not filtered out
detail: WebVTT files can contain STYLE blocks that define CSS for the subtitles:
  ```
  WEBVTT
  
  STYLE
  ::cue {
    color: yellow;
  }
  
  00:00:00.000 --> 00:00:02.000
  Hello world
  ```
  The STYLE and CSS content would currently be included in the transcript.
suggestion: Track state to skip STYLE blocks:
  ```typescript
  let inStyleBlock = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "STYLE") {
      inStyleBlock = true;
      continue;
    }
    if (inStyleBlock && !trimmed) {
      inStyleBlock = false;
      continue;
    }
    if (inStyleBlock) continue;
    // ... rest of logic
  }
  ```
```

### MEDIUM: parseWebVTT does not handle REGION blocks

```
severity: medium
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 259-270
issue: WebVTT REGION blocks not filtered out
detail: Similar to STYLE blocks, REGION blocks define positioning and would be included in output if not filtered.
suggestion: Same pattern as STYLE blocks - track state and skip until empty line.
```

### LOW: Duplicate text fragments in WebVTT

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 273
issue: WebVTT cues may have overlapping text that creates duplicates
detail: Some WebVTT files have overlapping cues where the same text appears in consecutive cues for karaoke-style display. Joining all text lines results in duplicate words/phrases.
suggestion: Consider deduplicating consecutive identical lines before joining, or accept as known limitation.
```

### LOW: TikTokSearchItem type may be incomplete

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 45-67
issue: TikTokSearchItem type may not match actual API response
detail: The type was defined based on expected API shape but wasn't validated against actual API documentation or responses. Fields like `video.cover.url_list` may be optional or structured differently.
suggestion: Validate against actual Scrape Creators API response or add more defensive optional chaining (already partially done at line 375).
```

### LOW: TranscriptResponse type may be incomplete

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 69-73
issue: TranscriptResponse type may not include all response fields
detail: The actual transcript API likely returns more fields. Current type only declares `id`, `url`, `transcript`. This is fine if only those are needed, but documenting expected response shape would help maintenance.
suggestion: Add comment noting this is intentional minimal type, or expand to match actual API response.
```

### LOW: Empty videoUrl passed to fetchTikTokTranscript

```
severity: low
file: /Users/kai/Desktop/projects/ai-whiteboard-chat/convex/chat/tools.ts
line: 384
issue: If item.url is empty string, fetchTikTokTranscript is called with ""
detail: Line 374 sets `videoUrl: item.url || ""`. If url is missing, fetchTikTokTranscript is called with empty string, makes API call with empty url param, wastes API call.
suggestion: Either skip transcript fetch for empty URLs or validate URL before API call:
  ```typescript
  async function fetchTikTokTranscript(videoUrl: string): Promise<string> {
    if (!videoUrl) {
      return "[No speech detected]";
    }
    // ... rest
  }
  ```
```

---

## Code Quality Observations

### Positive
1. Good separation of concerns - parseWebVTT is exported and testable
2. Parallel transcript fetching for performance
3. Silent fallback pattern correctly implemented
4. Error handling distinguishes 401 vs 429 vs other errors
5. Input validation for empty query
6. Matches existing codebase patterns (see convex/canvas/tiktok.ts for comparison)

### Suggestions
1. The WebVTT parsing in convex/canvas/tiktok.ts (lines 183-196) and the new parseWebVTT function have slightly different logic. Consider consolidating to use parseWebVTT in both places for consistency.

---

## Data Flow Analysis

```
fetchTikTokSearch(query, limit)
  │
  ├─ Validate: API key exists, query not empty
  │
  ├─ Call: GET /v1/tiktok/search/keyword
  │    └─ Params: query, trim=true, sort_by=most-liked
  │
  ├─ Handle errors: 401, 429, other HTTP errors
  │
  ├─ Parse response → TikTokSearchResponse
  │    └─ Check: data.success && data.search_item_list
  │
  ├─ Slice items to limit → items[]
  │
  ├─ Map to partial results (no transcript yet)
  │    └─ Handle missing fields with || "" and ?? 0
  │
  ├─ Parallel: fetchTikTokTranscript(url) for each
  │    ├─ Call: GET /v1/tiktok/video/transcript
  │    ├─ Parse WebVTT → plain text
  │    └─ Silent fallback: "[No speech detected]"
  │
  └─ Return: TikTokVideoResult[]
```

Flow is correct. Error states propagate properly. Silent fallback works as expected.

---

## Summary

The implementation correctly meets all PRD acceptance criteria. The main issues are edge cases in WebVTT parsing that may cause unexpected content in transcripts (styling tags, NOTE/STYLE/REGION blocks). These are non-critical but should be addressed for robustness.

**Recommendation:** Address the HIGH severity WebVTT tag stripping issue before merging. The MEDIUM severity issues are nice-to-have improvements.
