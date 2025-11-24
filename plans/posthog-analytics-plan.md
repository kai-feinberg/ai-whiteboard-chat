# PostHog Analytics Implementation Plan
AI Whiteboard Chat (Splat AI)

## Executive Summary

Comprehensive **client-side only** plan to integrate PostHog analytics for tracking user behavior, product usage, feature adoption, AI costs, and business metrics across the AI canvas application. All tracking happens in the browser using PostHog's React SDK.

## Tech Stack Context

- **Frontend**: Tanstack Start (React SSR framework)
- **Backend**: Convex (serverless, real-time)
- **Auth**: Clerk with Organizations (multi-tenant)
- **AI**: Convex AI agent component with multiple models
- **Canvas**: Infinite canvas with multiple node types
- **Billing**: Autumn pricing + org-scoped credits

## PostHog Setup Strategy

### 1. Installation & Configuration

**Dependencies to add:**
```bash
pnpm add posthog-js
```

**Integration Points:**
- Client-side initialization in `__root.tsx` within `PostHogProvider`
- User identification via Clerk user ID + organization context
- Feature flags for A/B testing new features

**Configuration approach:**
- Initialize PostHog in root layout after Clerk authentication
- Set user properties from Clerk (userId, orgId, email, etc.)
- Use organization as `group` for multi-tenant analytics
- Enable autocapture for basic interactions
- Manual event tracking for business-critical actions
- **Client-side only** - all tracking happens in browser

### 2. Provider Setup Location

**File**: `src/routes/__root.tsx`

Add PostHogProvider inside `RootDocument`, after `ClerkProvider`:

```tsx
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

// Initialize PostHog
if (typeof window !== 'undefined') {
  posthog.init(
    import.meta.env.VITE_POSTHOG_API_KEY,
    {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com',
      autocapture: true,
      capture_pageview: true,
      capture_pageleave: true,
      session_recording: {
        maskAllInputs: false, // Show AI prompts for debugging
        maskTextSelector: '[data-mask]', // Selective masking
      },
      persistence: 'localStorage+cookie',
    }
  )
}

// Wrap in PostHogProvider after ClerkProvider
<PostHogProvider client={posthog}>
  <ConvexProviderWithClerk ...>
    ...
  </ConvexProviderWithClerk>
</PostHogProvider>
```

### 3. User Identification Strategy

**Identify users after Clerk authentication completes**

**File**: `src/routes/__root.tsx` in `AuthenticatedContent` component

```tsx
import { usePostHog } from 'posthog-js/react'

function AuthenticatedContent() {
  const posthog = usePostHog()
  const { organization, isLoaded } = useOrganization()
  const { user } = useUser()

  useEffect(() => {
    if (isLoaded && user && organization) {
      // Identify user with Clerk ID
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
        createdAt: user.createdAt,
      })

      // Set organization as group for multi-tenant tracking
      posthog.group('organization', organization.id, {
        name: organization.name,
        createdAt: organization.createdAt,
        memberCount: organization.membersCount,
      })
    }
  }, [isLoaded, user, organization, posthog])

  // ... rest of component
}
```

---

## Key Events to Track

### Authentication & Onboarding

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `user_signed_up` | `auth_method`, `timestamp` | New user registration | High |
| `user_signed_in` | `auth_method` | User login | High |
| `user_signed_out` | - | User logout | Medium |
| `organization_created` | `org_name`, `is_personal` | New org created | High |
| `organization_switched` | `from_org_id`, `to_org_id` | Org switch | Medium |
| `user_invited_to_org` | `inviter_id`, `org_id`, `role` | Invite sent | Medium |
| `user_accepted_org_invite` | `org_id`, `inviter_id` | Invite accepted | Medium |

### Canvas Operations

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `canvas_created` | `org_id`, `canvas_id`, `title` | New canvas | High |
| `canvas_opened` | `canvas_id`, `node_count`, `last_updated` | Canvas viewed | High |
| `canvas_deleted` | `canvas_id`, `node_count`, `age_days` | Canvas deleted | Medium |
| `canvas_renamed` | `canvas_id`, `old_title`, `new_title` | Title changed | Low |
| `canvas_duplicated` | `source_canvas_id`, `new_canvas_id` | Canvas cloned | Medium |

### Node Operations (High Value)

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `node_added` | `node_type`, `canvas_id`, `position` | Node created | High |
| `node_deleted` | `node_type`, `canvas_id`, `had_connections` | Node removed | Medium |
| `node_moved` | `node_type`, `canvas_id`, `distance_moved` | Position changed | Low |
| `node_edited` | `node_type`, `canvas_id`, `edit_type` | Content updated | Medium |
| `node_notes_added` | `node_type`, `canvas_id`, `notes_length` | User adds notes | High |

**Node Type Specific:**

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `youtube_node_added` | `video_id`, `url`, `duration`, `has_transcript` | YouTube added | High |
| `youtube_transcript_loaded` | `video_id`, `transcript_length`, `load_time_ms` | Transcript ready | High |
| `youtube_transcript_failed` | `video_id`, `error_reason` | Transcript error | High |
| `website_node_added` | `url`, `domain` | Website added | High |
| `website_scraped` | `url`, `markdown_length`, `scrape_time_ms` | Scrape complete | High |
| `website_scrape_failed` | `url`, `error_reason` | Scrape error | High |
| `tiktok_node_added` | `video_id`, `url` | TikTok added | High |
| `twitter_node_added` | `tweet_id`, `url`, `author` | Twitter added | High |
| `facebook_ad_node_added` | `ad_id`, `media_type` | FB ad added | High |
| `text_node_added` | `content_length` | Text node added | Medium |
| `chat_node_added` | `agent_id`, `model_id` | Chat node added | High |
| `group_node_created` | `canvas_id`, `child_count` | Group created | High |
| `node_added_to_group` | `node_type`, `group_id` | Node grouped | Medium |
| `node_removed_from_group` | `node_type`, `group_id` | Node ungrouped | Medium |

### Node Connections

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `edge_created` | `source_node_type`, `target_node_type`, `canvas_id` | Connection made | High |
| `edge_deleted` | `source_node_type`, `target_node_type` | Connection removed | Medium |
| `context_gathered` | `node_count`, `total_tokens`, `node_types[]` | Context assembled | High |

### AI Chat & Conversations

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `thread_created` | `canvas_id`, `agent_id`, `model_id` | New thread | High |
| `message_sent` | `thread_id`, `message_length`, `model_id`, `has_context` | User message | High |
| `ai_response_received` | `thread_id`, `response_length`, `response_time_ms`, `model_id` | AI responds | High |
| `ai_response_failed` | `thread_id`, `error_type`, `model_id` | AI error | High |
| `model_switched` | `thread_id`, `from_model`, `to_model` | Model changed | High |
| `agent_switched` | `thread_id`, `from_agent`, `to_agent` | Agent changed | High |
| `chat_fullscreen_opened` | `thread_id`, `canvas_id` | Full view opened | Medium |
| `chat_fullscreen_closed` | `thread_id`, `time_spent_seconds` | Full view closed | Medium |
| `connected_nodes_used` | `thread_id`, `node_count`, `node_types[]`, `total_context_tokens` | Context from connections | High |

### Custom Agents

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `custom_agent_created` | `org_id`, `agent_name`, `prompt_length` | New agent | High |
| `custom_agent_edited` | `agent_id`, `changes_made` | Agent updated | Medium |
| `custom_agent_deleted` | `agent_id`, `usage_count` | Agent removed | Medium |
| `custom_agent_used` | `agent_id`, `thread_id` | Agent selected | High |
| `custom_agent_set_default` | `agent_id`, `org_id` | Made default | Medium |

### Credits & Billing

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `credits_purchased` | `org_id`, `amount`, `price`, `payment_method` | Purchase complete | High |
| `credits_deducted` | `org_id`, `amount`, `reason`, `model_id`, `remaining_balance` | Usage charged | High |
| `credits_low_warning` | `org_id`, `remaining_credits`, `threshold` | Low balance | High |
| `credits_depleted` | `org_id`, `failed_action` | Out of credits | High |
| `pricing_table_viewed` | `org_id`, `current_tier` | Pricing page | Medium |
| `upgrade_clicked` | `org_id`, `from_tier`, `to_tier` | Upgrade intent | High |
| `checkout_started` | `org_id`, `product`, `price` | Checkout begin | High |
| `checkout_completed` | `org_id`, `product`, `price`, `transaction_id` | Purchase success | High |
| `checkout_abandoned` | `org_id`, `product`, `abandonment_stage` | Checkout exit | High |

### Business Context

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `business_context_added` | `org_id`, `context_length` | Org context set | High |
| `business_context_updated` | `org_id`, `old_length`, `new_length` | Context edited | Medium |
| `business_context_used_in_chat` | `thread_id`, `context_length` | Injected in chat | High |

### Content Reusability

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `node_reused_across_canvas` | `node_type`, `node_id`, `from_canvas`, `to_canvas` | Node duplicated | High |
| `transcript_reused` | `youtube_node_id`, `reuse_count` | Transcript reused | Medium |
| `website_content_reused` | `website_node_id`, `reuse_count` | Scrape reused | Medium |

### Feature Discovery & Adoption

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `feature_discovered` | `feature_name`, `discovery_method` | First interaction | High |
| `tooltip_viewed` | `tooltip_content`, `location` | Hover help | Low |
| `help_documentation_opened` | `page_url`, `section` | Help accessed | Medium |
| `keyboard_shortcut_used` | `shortcut_key`, `action` | Shortcut used | Low |

### Performance & Errors

| Event Name | Properties | When | Priority |
|------------|-----------|------|----------|
| `page_load_time` | `route`, `load_time_ms` | Page rendered | Medium |
| `canvas_render_time` | `canvas_id`, `node_count`, `render_time_ms` | Canvas rendered | Medium |
| `ai_streaming_latency` | `thread_id`, `first_token_ms`, `model_id` | Stream start time | High |
| `error_occurred` | `error_type`, `error_message`, `location`, `user_action` | Any error | High |
| `api_error` | `endpoint`, `status_code`, `error_message` | Backend error | High |

---

## Implementation Details

### Client-Side Event Tracking

**Location**: Component-specific files

**Example - Canvas Node Creation** (`src/routes/canvas/$canvasId/index.tsx`):

```tsx
import { usePostHog } from 'posthog-js/react'

function CanvasEditor() {
  const posthog = usePostHog()

  const handleAddTextNode = useCallback(async () => {
    try {
      const result = await createTextNode({ canvasId, position, content })

      // Track event
      posthog.capture('node_added', {
        node_type: 'text',
        canvas_id: canvasId,
        position: position,
        content_length: content.length,
      })

      // Also track specific node type
      posthog.capture('text_node_added', {
        canvas_id: canvasId,
        content_length: content.length,
      })
    } catch (error) {
      posthog.capture('error_occurred', {
        error_type: 'node_creation_failed',
        node_type: 'text',
        error_message: error.message,
      })
    }
  }, [createTextNode, canvasId, posthog])
}
```

**Example - AI Chat Message** (`src/features/chat/components/Chat.tsx`):

```tsx
const handleSendMessage = useCallback(async (message: string) => {
  const startTime = Date.now()

  posthog.capture('message_sent', {
    thread_id: threadId,
    message_length: message.length,
    model_id: selectedModel,
    agent_id: selectedAgent,
    has_context: connectedNodes.length > 0,
    connected_node_count: connectedNodes.length,
  })

  try {
    // Send to AI...
    const responseTime = Date.now() - startTime

    posthog.capture('ai_response_received', {
      thread_id: threadId,
      response_time_ms: responseTime,
      model_id: selectedModel,
      response_length: response.length,
    })
  } catch (error) {
    posthog.capture('ai_response_failed', {
      thread_id: threadId,
      error_type: error.code,
      model_id: selectedModel,
    })
  }
}, [posthog, threadId, selectedModel])
```

### Event Tracking - Client-Side Only

**All events tracked from browser** - no server-side tracking needed. Track high-value events (billing, credits) from client components after mutations complete.

**Example - Credits tracking after mutation** (`src/features/billing/components/CreditsPurchase.tsx`):

```tsx
import { usePostHog } from 'posthog-js/react'

function CreditsPurchase() {
  const posthog = usePostHog()
  const purchaseCredits = useMutation(api.billing.purchaseCredits)

  const handlePurchase = async (amount: number) => {
    try {
      const result = await purchaseCredits({ amount, price })

      // Track after successful purchase
      posthog.capture('credits_purchased', {
        org_id: organizationId,
        amount,
        price,
        payment_method: 'stripe',
      })
    } catch (error) {
      posthog.capture('error_occurred', {
        error_type: 'purchase_failed',
        error_message: error.message,
      })
    }
  }
}
```

---

## Custom Properties & User Traits

### User Properties (Set on identify)

```tsx
posthog.identify(userId, {
  // From Clerk
  email: user.primaryEmailAddress?.emailAddress,
  name: user.fullName,
  username: user.username,
  avatar: user.imageUrl,
  created_at: user.createdAt,

  // App-specific
  organization_count: userMemberships.length,
  primary_org_id: organization.id,
  is_org_admin: organization.role === 'admin',

  // Usage stats (can be updated periodically)
  total_canvases_created: canvasCount,
  total_nodes_created: nodeCount,
  total_messages_sent: messageCount,
  favorite_node_type: mostUsedNodeType,
  favorite_model: mostUsedModel,
})
```

### Organization Properties (Group)

```tsx
posthog.group('organization', orgId, {
  name: organization.name,
  created_at: organization.createdAt,
  member_count: organization.membersCount,

  // Subscription
  subscription_tier: subscriptionTier,
  subscription_status: subscriptionStatus,
  credits_balance: creditsBalance,

  // Usage
  total_canvases: orgCanvasCount,
  total_ai_messages: orgMessageCount,
  total_credits_spent: totalCreditsSpent,

  // Configuration
  has_custom_agents: customAgentCount > 0,
  has_business_context: !!businessContext,
})
```

---

## Dashboards & Insights to Build

### 1. Product Analytics Dashboard

**Metrics:**
- Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)
- User retention cohorts (D1, D7, D30)
- Session duration & frequency
- Feature adoption rates
- Canvas creation rate
- Node creation rate by type
- AI message volume

**Funnels:**
1. Sign up → Create org → Create canvas → Add first node
2. Add node → Connect nodes → Use in chat
3. View pricing → Start checkout → Complete purchase

### 2. AI Usage Dashboard

**Metrics:**
- Messages sent per model
- Average response time by model
- Error rate by model
- Context usage (connected nodes)
- Custom agent usage vs. default
- Model switching frequency

### 3. Revenue & Credits Dashboard

**Metrics:**
- Credit purchase volume
- Average credit balance by org
- Credit burn rate
- Conversion rate to paid
- Revenue by tier
- Churn prediction (low credits, low usage)

### 4. Node Type Analytics

**Metrics:**
- Most popular node types
- YouTube transcript success rate
- Website scraping success rate
- Social content adoption (TikTok, Twitter, FB)
- Group usage patterns

### 5. Feature Adoption

**Metrics:**
- Time to first custom agent
- Time to first business context
- Time to first node connection
- Full-screen chat usage
- Node reusability patterns

---

## Session Recording Strategy

**Enable for:**
- Error scenarios (automatically flag sessions with errors)
- Checkout flows (monitor abandonment)
- Onboarding (first 5 sessions per user)
- Beta features (when testing new functionality)

**Mask:**
- Credit card fields (use `data-mask` attribute)
- API keys / tokens
- Private business context (optional, based on privacy policy)

**Configuration:**
```tsx
posthog.init('...', {
  session_recording: {
    maskAllInputs: false,
    maskTextSelector: '[data-mask], [data-sensitive]',
    recordCrossOriginIframes: false,
  },
})
```

---

## A/B Testing & Feature Flags

### Potential Feature Flags

| Flag Name | Purpose | Variants |
|-----------|---------|----------|
| `new-canvas-ui` | Test redesigned canvas toolbar | control, variant-a |
| `ai-model-recommendations` | Suggest best model for task | on, off |
| `group-nodes-v2` | New group node interactions | on, off |
| `credit-bundles` | Different credit pricing tiers | control, bundle-a, bundle-b |
| `onboarding-tutorial` | Interactive onboarding flow | on, off |
| `social-media-batch-import` | Bulk import from social | on, off |

### Implementation Example

```tsx
import { useFeatureFlagEnabled } from 'posthog-js/react'

function CanvasToolbar() {
  const newUiEnabled = useFeatureFlagEnabled('new-canvas-ui')

  return newUiEnabled ? <NewCanvasToolbar /> : <LegacyCanvasToolbar />
}
```

---

## Privacy & Compliance

### Data Collection Policy

**User Consent:**
- Show analytics consent banner on first visit
- Allow opt-out of session recording
- Respect Do Not Track headers (optional)

**Data Retention:**
- Keep event data for 12 months
- Delete user data on account deletion
- Anonymize data after user requests deletion

**GDPR Compliance:**
- Use PostHog Cloud EU (if serving European users)
- Enable user data deletion via PostHog API
- Document data collection in privacy policy

---

## Environment Variables

Add to `.env.local` and deployment:

```bash
# PostHog (client-side only)
VITE_POSTHOG_API_KEY=phc_xxxxxxxxxxxxx
VITE_POSTHOG_HOST=https://app.posthog.com  # or https://eu.posthog.com
```

---

## Migration & Rollout Plan

### Phase 1: Foundation (Week 1)
- [ ] Install PostHog SDK
- [ ] Setup provider in `__root.tsx`
- [ ] Implement user identification
- [ ] Setup organization groups
- [ ] Add environment variables
- [ ] Test basic event capture

### Phase 2: Core Events (Week 2)
- [ ] Track authentication events
- [ ] Track canvas operations
- [ ] Track node creation/deletion
- [ ] Track AI chat messages
- [ ] Track errors

### Phase 3: Business Events (Week 3)
- [ ] Track credit purchases
- [ ] Track credit deductions
- [ ] Track subscription events
- [ ] Track custom agent usage
- [ ] Track content reusability

### Phase 4: Advanced Features (Week 4)
- [ ] Setup session recording
- [ ] Create dashboards
- [ ] Setup feature flags for 2-3 experiments
- [ ] Configure alerts (errors, credit depletion)
- [ ] Document for team

### Phase 5: Optimization (Ongoing)
- [ ] Review event volume & costs
- [ ] Remove unused events
- [ ] Add new events based on learnings
- [ ] Iterate on dashboards
- [ ] Run A/B tests

---

## Code Organization

```
src/
  lib/
    posthog.ts              # PostHog client initialization & config
    analytics/
      events.ts             # Event name constants
      track.ts              # Helper functions for tracking
      hooks.ts              # Custom hooks (useTrackPageView, etc.)

  routes/
    __root.tsx             # PostHogProvider setup + user identification

  features/
    [feature]/
      components/           # Track events in component handlers
```

---

## Success Metrics

After implementation, track these KPIs weekly:

1. **Event Volume**: 10k-50k events/day expected
2. **User Tracking**: 95%+ of users identified
3. **Error Tracking**: Catch 100% of errors
4. **Session Recording**: 5-10% of sessions recorded
5. **Dashboard Usage**: Team checks dashboards 3x/week
6. **Feature Flag Adoption**: 2+ experiments running per month
7. **Data Quality**: <5% events with missing critical properties

---

## Estimated Costs

**PostHog Pricing (as of 2024):**
- Events: $0.00031/event (first 1M free/month)
- Session Recordings: $0.005/recording (first 5k free/month)
- Feature Flags: $0.0001/request (first 1M free/month)

**Monthly Estimate:**
- 500k events/month → $0 (under free tier)
- 20k recordings/month → $75
- 2M feature flag requests → $100

**Total: ~$175/month** (scales with usage)

---

## Testing Strategy

### Pre-Launch Checklist

- [ ] Test event tracking in dev environment
- [ ] Verify user identification works
- [ ] Verify organization grouping works
- [ ] Test error event capture
- [ ] Test session recording (check masking)
- [ ] Test feature flags
- [ ] Verify events appear in PostHog dashboard
- [ ] Load test (ensure no performance impact)
- [ ] Test with ad blockers (graceful degradation)

### Monitoring Post-Launch

- [ ] Monitor PostHog ingestion dashboard
- [ ] Check for event drops/errors
- [ ] Verify user count matches Clerk analytics
- [ ] Review sample session recordings
- [ ] Check for PII leaks in events
- [ ] Monitor PostHog costs

---

## Resources & Documentation

- PostHog React SDK: https://posthog.com/docs/libraries/react
- PostHog API: https://posthog.com/docs/api
- PostHog Feature Flags: https://posthog.com/docs/feature-flags
- PostHog Session Recording: https://posthog.com/docs/session-replay
- Tanstack Start Docs: https://tanstack.com/start
- Convex Actions: https://docs.convex.dev/functions/actions

---

## Notes & Gotchas

1. **SSR Considerations**: PostHog should only initialize client-side (`typeof window !== 'undefined'`)
2. **Performance**: Autocapture adds minimal overhead (~2-3ms per interaction)
3. **Ad Blockers**: ~15-30% of users may block PostHog (graceful degradation needed)
4. **Event Volume**: Review monthly - might hit free tier limits faster than expected
5. **PII Concerns**: Be careful not to send sensitive business context or API keys
6. **Client-Side Only**: All tracking happens in browser - track events after mutations complete
7. **Multi-Tab Support**: PostHog handles multiple tabs automatically via localStorage
8. **Organization Switching**: Re-identify user when org changes to update group
9. **High-Value Events**: Track billing/credits events from client components after backend confirms success

---

## Next Steps

1. **Review this plan** with team
2. **Set up PostHog account** (self-hosted or cloud)
3. **Start with Phase 1** (foundation)
4. **Iterate based on learnings**
5. **Create dashboards** as events accumulate
6. **Run first A/B test** within 2-3 weeks

**Questions to resolve before starting:**
- Self-hosted PostHog or cloud?
- US or EU cloud region?
- Session recording opt-in or opt-out?
- Which features to A/B test first?
- Who monitors dashboards weekly?
