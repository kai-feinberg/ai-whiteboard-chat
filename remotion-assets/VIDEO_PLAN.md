# Splat AI Hype Video - Remotion Plan

## About Splat AI

Splat AI is an infinite canvas for AI conversations with rich context inputs. Drop in YouTube videos, TikTok clips, Facebook ads, websites, and documents—then connect them to AI chat nodes. The AI sees the full context from all connected sources (transcripts, content, metadata) so you can research, brainstorm, and create without juggling tabs and copy-pasting. Built for content creators, marketers, and teams who need to feed AI real context, not just prompts.

---

## Video Overview
- **Duration:** 25-30 seconds (750-900 frames @ 30fps)
- **Aspect Ratio:** 1920x1080 (16:9) for social media/landing page
- **Style:** Warm, organic, premium - matching brand
- **Tone:** Fast-paced, exciting, showcasing key features

---

## Brand Guidelines

### Colors (Light Mode - Primary)
```
Primary (Terracotta):     oklch(0.55 0.15 40) - #B5543D approx
Background (Warm Cream):  oklch(0.97 0.008 75) - #F7F5F0 approx
Card (Soft White):        oklch(0.99 0.005 70) - #FEFDFB approx
Sidebar (Chocolate):      oklch(0.25 0.028 35) - #3D352D approx
Secondary (Sage):         oklch(0.88 0.05 140) - #C7DBC5 approx
Accent (Sand):           oklch(0.85 0.08 80) - #E8D9B5 approx
```

### Typography
- **Display/Headlines:** Lexend (weight 600, letter-spacing -0.01em)
- **Body:** DM Sans
- **Code:** JetBrains Mono

### Design Characteristics
- Rounded corners (16px radius)
- Warm earth tones
- Subtle noise textures
- Organic feel with soft shadows
- Smooth transitions (cubic-bezier 0.4, 0, 0.2, 1)

---

## Scene Breakdown

### Scene 1: Logo Intro (0-3 seconds / 0-90 frames)
**Content:** "Splat AI" logo animates in
**Animation:**
- Background: Warm cream gradient
- Logo fades and scales in from center
- Subtle particle/splash effect around logo (referencing "Splat")
**Text:** "Splat AI"
**Screenshot:** None needed - pure text animation

---

### Scene 2: Problem Statement (3-6 seconds / 90-180 frames)
**Content:** Quick text flash showing the pain point
**Animation:**
- Typewriter effect or slide in
- Dark sidebar background with warm text
**Text:**
- "Content research scattered everywhere?"
- OR "Too many tabs. Too many tools."
**Screenshot:** None needed - text only

---

### Scene 3: Connect Your Context (6-11 seconds / 180-330 frames)
**Content:** Hero shot - multiple content nodes connecting to AI chat
**Animation:**
- Nodes animate in from edges of screen
- Connection lines draw between nodes and chat
- Pulse effect on "Context from 3 connected nodes" indicator
- Camera settles on the connected view
**Screenshot Used:** `11-connect-context.jpg` (PRIMARY HERO SHOT)
**Highlights:**
- YouTube, TikTok, Website nodes all connected to Chat Node
- Visible connection lines (dashed, warm gradient)
- "Context from 3 connected nodes" indicator
- "View Context" button showing transparency
- This is THE core value proposition visual

---

### Scene 4: AI Chat Feature (11-16 seconds / 330-480 frames)
**Content:** Show the AI chat interaction
**Animation:**
- Zoom/focus on chat panel
- Simulate message typing animation
- Show AI response appearing
**Screenshot Used:** `02-chat-fullscreen.png`
**Highlights:**
- User message bubble (terracotta)
- AI response (soft white)
- Model selector dropdown visible (Claude Haiku 4.5)

---

### Scene 5: Link Reading Tool (16-21 seconds / 480-630 frames)
**Content:** Showcase the URL content extraction feature
**Animation:**
- Show loading state animation
- Transition to completed state
- Pulse/glow effect on the tool card
**Screenshots Used:**
- `07-link-tool-loading.png`
- `08-link-tool-complete.png`
**Highlights:**
- YouTube badge/platform detection
- Content preview with transcript
- "View full content" button

---

### Scene 6: Feature Montage (21-25 seconds / 630-750 frames)
**Content:** Quick cuts of other features
**Animation:**
- Fast slide transitions between screens
- Each screen visible for ~1 second
**Screenshots Used:**
- `12-add-anything.jpg` - Platform variety (YouTube, TikTok, Facebook Ad, Website)
- `01-dashboard.png` - Canvas list
- `04-documents.png` - Documents system
- `10-canvas-switcher-dropdown.png` - Quick canvas switching
**Highlights:**
- Add anything: YouTube, TikTok, Facebook Ads, Websites
- Multiple canvases
- Document management
- Team collaboration (organization switcher)

---

### Scene 7: Call to Action (25-30 seconds / 750-900 frames)
**Content:** Closing with brand and CTA
**Animation:**
- All elements fade/slide out
- Logo centers
- CTA text appears below
- Subtle glow/pulse on CTA
**Text:**
- "Splat AI"
- "Your AI-powered creative canvas"
- "Try it free"
**Screenshot:** None needed - text/logo only

---

## Technical Requirements

### Remotion Setup
```typescript
// Composition settings
{
  id: "SplatAIHypeVideo",
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 900 // 30 seconds
}
```

### Required Packages
- `remotion` (core)
- `@remotion/transitions` (fade, slide, wipe)
- `@remotion/media` (for any sound effects)

### Assets to Place in `public/` folder
1. All screenshots from `remotion-assets/screenshots/`
2. Logo file (if exists, or create text-based)
3. Optional: Background music track
4. Optional: Sound effects for transitions

### Fonts to Load
```typescript
// Load Google Fonts
import { loadFont } from '@remotion/google-fonts/Lexend';
import { loadFont as loadDMSans } from '@remotion/google-fonts/DMSans';

const { fontFamily: lexend } = loadFont();
const { fontFamily: dmSans } = loadDMSans();
```

---

## Animation Patterns

### Fade In
```typescript
const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
```

### Scale Bounce
```typescript
const scale = spring({ frame, fps, config: { damping: 12, stiffness: 200 } });
```

### Slide From Side
```typescript
const x = interpolate(frame, [0, 20], [100, 0], { extrapolateRight: 'clamp' });
```

### Timing Curve (Brand Standard)
```typescript
// Match the app's cubic-bezier(0.4, 0, 0.2, 1)
import { Easing } from 'remotion';
const customEase = Easing.bezier(0.4, 0, 0.2, 1);
```

---

## Screenshot Assets Summary

| File | Scene | Purpose |
|------|-------|---------|
| 01-dashboard.png | 6 | Canvas list view |
| 02-chat-fullscreen.png | 4 | AI chat interface |
| 03-canvas-with-chat.png | - | Alternate canvas view |
| 04-documents.png | 6 | Documents feature |
| 05-custom-agents.png | - | Optional (PRO feature) |
| 06-canvas-toolbar.png | - | Canvas with toolbar (alternate) |
| 07-link-tool-loading.png | 5 | Loading state |
| 08-link-tool-complete.png | 5 | Completed state |
| 09-link-tool-modal.png | - | Optional detail |
| 10-canvas-switcher-dropdown.png | 6 | Quick switching |
| 11-connect-context.jpg | 3 | **HERO** - Nodes connected to chat |
| 12-add-anything.jpg | 6 | Platform variety showcase |

---

## Next Steps for Coding Agent

1. **Initialize Remotion project** (if not exists)
2. **Copy screenshots** to `public/screenshots/`
3. **Create component files:**
   - `src/scenes/LogoIntro.tsx`
   - `src/scenes/ProblemStatement.tsx`
   - `src/scenes/CanvasOverview.tsx`
   - `src/scenes/ChatFeature.tsx`
   - `src/scenes/LinkReadingTool.tsx`
   - `src/scenes/FeatureMontage.tsx`
   - `src/scenes/CallToAction.tsx`
4. **Create main composition** that sequences all scenes
5. **Add transitions** between scenes
6. **Test and refine** timing
7. **Render** final video

---

## Optional Enhancements

- **Background Music:** Upbeat, tech/creative vibe (royalty-free)
- **Sound Effects:** Subtle whooshes on transitions
- **Particle Effects:** On logo intro (splat theme)
- **Screen Recording:** Could replace screenshots with actual recordings for smoother demo

---

## Files in remotion-assets/

```
remotion-assets/
├── screenshots/
│   ├── 01-dashboard.png
│   ├── 02-chat-fullscreen.png
│   ├── 03-canvas-with-chat.png
│   ├── 04-documents.png
│   ├── 05-custom-agents.png
│   ├── 06-canvas-toolbar.png
│   ├── 07-link-tool-loading.png
│   ├── 08-link-tool-complete.png
│   ├── 09-link-tool-modal.png
│   ├── 10-canvas-switcher-dropdown.png
│   ├── 11-connect-context.jpg      ← HERO SHOT
│   └── 12-add-anything.jpg         ← Platform variety
└── VIDEO_PLAN.md (this file)
```
