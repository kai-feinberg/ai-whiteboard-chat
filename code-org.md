# Exodus Codebase Best Practices Guide

## Core Organization Principles

• **Feature isolation** - Each feature owns its domain completely
• **Shared utilities at root** - Only truly cross-cutting concerns go in `/lib`
• **Database queries stay close to features** - No centralized data layer complexity

## Feature File Structure

### Standard Feature Layout

```
/features/sources/daily-questions/
  README.md           # Feature overview & gotchas
  components/         # Feature-specific UI components
    QuestionCard.tsx
    QuestionForm.tsx
    QuestionList.tsx
  api/               # API route handlers
    index.ts         # GET /api/sources/daily-questions
    [id].ts          # GET/PUT /api/sources/daily-questions/[id]
  hooks/             # React hooks for this feature
    useQuestions.ts
    useQuestionActions.ts
  database/          # Database operations
    queries.ts       # All DB operations for this feature
  types.ts           # Feature-specific TypeScript types
  utils.ts           # Pure functions & helpers
  constants.ts       # Feature constants/enums
```

### Database Organization (Using Nested Folder Pattern)

```
/features/sources/daily-questions/database/
  queries.ts         # All database operations
  types.ts           # DB-specific types (if needed)
  utils.ts           # DB utility functions (if needed)
```

## Required Features for Exodus

### Core Features

#### 1. Authentication (`/features/auth/`)
- Magic link login/logout
- Admin user detection
- Session management
- User impersonation for admins

#### 2. User Profile (`/features/user-profile/`)
- AI model configuration (fine-tuned, default, temperature, etc.)
- Content preferences (audience, news filter)
- Integration URLs (Google Drive, Slack, etc.)
- Account settings

#### 3. Content Generation (`/features/content-generation/`)
- Generation modal with parameters
- Real-time status tracking
- Content editing interface
- AI model selection
- Background job management

#### 4. Content Management (`/features/content-management/`)
- Generated content dashboard
- Content listing with filters
- Content detail pages
- Edit/star/mark as used actions
- Search and filtering

### Content Source Features

#### 5. Daily Questions (`/features/daily-questions/`)
- Telegram Q&A display
- Question/answer detail pages
- Star/use tracking
- Content generation from Q&As

#### 6. News Ideas (`/features/news-ideas/`)
- Curated news feed
- News-based content ideas
- Article linking
- Topic filtering

#### 7. Scraped Content (`/features/scraped-content/`)
- Social media content feed
- Source management interface
- Platform filtering
- Engagement metrics display

#### 8. Coaching Calls (`/features/coaching-calls/`)
- Call transcript display
- Core notes extraction
- Call-to-content generation
- Date/title search

### Management Features

#### 9. Products (`/features/products/`)
- Product catalog CRUD
- Product selection for content
- Price/description management
- Usage tracking

#### 10. Audiences (`/features/audiences/`)
- Audience segment CRUD
- Targeting options
- Usage analytics

#### 11. Sources (`/features/sources/`)
- Content feed management
- Source subscriptions
- Platform configuration
- Active/inactive toggles

## What Gets Shared vs Feature-Owned

### Always Shared (`/lib/`)

#### Database Layer
```
/lib/database/
  connection.ts     # Drizzle setup & connection
  schema.ts         # All table definitions
  migrations/       # Schema change files
  types.ts          # Global DB types
```

#### Authentication
```
/lib/auth/
  magic-link.ts     # Magic link generation/validation
  session.ts        # Session management
  middleware.ts     # Auth middleware
  utils.ts          # getCurrentUser(), requireAuth()
```

#### AI Integration
```
/lib/ai/
** eventually... ignore for now
```

#### UI Components (Truly Generic)
```
/components/ui/
  Button.tsx        # Generic button component
  Input.tsx         # Form inputs
  Modal.tsx         # Modal wrapper
  Table.tsx         # Reusable data table
  Card.tsx          # Generic card container
  Badge.tsx         # Status badges
  Spinner.tsx       # Loading indicators
  Toast.tsx         # Notification system
  Pagination.tsx    # Table pagination
  SearchInput.tsx   # Search with debouncing
  FilterDropdown.tsx # Filter controls
  SortableHeader.tsx # Table column sorting
```

#### Layout Components
```
/components/layout/
  AppLayout.tsx     # Main app wrapper
  Navigation.tsx    # Site navigation
  Header.tsx        # App header
  Sidebar.tsx       # Side navigation
  Footer.tsx        # App footer
```

#### Utilities
```
/lib/utils/
  formatting.ts     # Date/number formatting
  validation.ts     # Zod schemas
  constants.ts      # App-wide constants
  api.ts            # API client utilities
  errors.ts         # Error handling
```

### Always Feature-Owned

#### Database Operations
- All queries that touch feature's primary tables
- Even cross-table queries stay in the feature that initiates them
- Business logic around data manipulation

#### API Handlers
- Route handlers and business logic
- Request/response validation
- Feature-specific error handling

#### Feature Components
- Domain-specific UI components
- Forms for that feature's data
- Display components with business logic

#### Feature Hooks
- Data fetching hooks
- State management for feature
- Action hooks (star, delete, etc.)

## Component Organization Examples

### Simple Features (1-3 components)
```
/features/products/components/
  ProductCard.tsx     # Display component
  ProductForm.tsx     # Create/edit form
  ProductList.tsx     # Table view
```

### Complex Features (4+ components)
```
/features/content-management/components/
  /cards/
    ContentCard.tsx
    ContentPreview.tsx
  /forms/
    ContentEditor.tsx
    FilterForm.tsx
  /lists/
    ContentTable.tsx
    ContentGrid.tsx
  /modals/
    DeleteModal.tsx
    ShareModal.tsx
  index.ts           # Export all components
```

## API Route Structure

### Standard RESTful Pattern
```
/features/daily-questions/api/
  index.ts           # GET /api/sources/daily-questions (list)
  [id].ts            # GET/PUT/DELETE /api/sources/daily-questions/[id]
  actions.ts         # POST /api/sources/daily-questions/bulk-update
```

### For Complex Operations
```
/features/content-generation/api/
  index.ts           # Basic CRUD
  generate.ts        # POST /api/content/generate
  status.ts          # GET /api/content/generation-status/[id]
  regenerate.ts      # POST /api/content/regenerate/[id]
```

## Database Query Patterns

### Standard CRUD per feature
```typescript
// /features/daily-questions/database/queries.ts
export async function getQuestionsByUser(userId: string) { }
export async function updateQuestionStatus(id: string, data: UpdateData) { }
export async function deleteQuestion(id: string) { }
export async function getQuestionForGeneration(questionId: string) { }
```

### Cross-feature queries are OK
```typescript
// /features/content-generation/database/queries.ts
export async function getQuestionForGeneration(questionId: string) {
  // It's fine to query daily_questions table from here
  // The business logic lives in content-generation
}
```

## Hooks Pattern

```typescript
// hooks/useQuestions.ts
export function useQuestions(filters?: QuestionFilters) {
  // Data fetching with React Query/SWR
}

// hooks/useQuestionActions.ts  
export function useQuestionActions() {
  return {
    starQuestion: (id: string) => {},
    markAsUsed: (id: string) => {},
    deleteQuestion: (id: string) => {}
  }
}
```

## Feature README Template

```markdown
# [Feature Name] Feature

## Purpose
Brief description of what this feature does and why it exists.

## Key Files
- `database/queries.ts` - All database operations
- `components/MainComponent.tsx` - Primary UI component
- `hooks/useFeature.ts` - Data fetching & caching
- `api/` - REST endpoints

## Database Tables
- Primary: `table_name`
- Relationships: Links to other tables

## External Dependencies
- List any external services or APIs
- Note any automation dependencies

## Gotchas & Notes
- ⚠️ **Important warnings**
- 🔄 **Behavioral notes**
- 📱 **UI considerations**

## API Endpoints
- `GET /api/endpoint` - Description
- `POST /api/endpoint` - Description

## Common Tasks
- **Task**: How to accomplish it
- **Another task**: Step-by-step

## Testing Notes
- What to mock in development
- Edge cases to test
- Performance considerations
```

## Anti-Patterns to Avoid

• **No shared query builders** - Keep SQL/Drizzle calls simple and direct
• **No repository pattern** - Adds complexity without B2B value
• **No cross-feature component imports** - Features should be self-contained
• **No premature abstractions** - Wait until you have 3+ similar patterns
• **No God components** - Keep components focused on single responsibility

## File Naming Conventions

• `database/queries.ts` or `db_queries.ts` - Database operations
• `api.ts` or `api/index.ts` - API route handlers
• `types.ts` - Feature-specific TypeScript types
• `hooks.ts` or `hooks/useFeature.ts` - React hooks
• `utils.ts` - Pure functions & helpers
• `constants.ts` - Feature constants/enums
• `components/` - React components folder

## Key Benefits

• **Self-documenting** - README explains everything needed
• **Isolated testing** - Test entire feature independently  
• **Clear ownership** - Everything for one feature in one place
• **Fast navigation** - Predictable structure across all features
• **Easy onboarding** - New devs read README and understand immediately
• **Rapid iteration** - Supports the "one day rule" for feature development

This structure keeps your codebase fast to navigate and modify while preventing the over-engineering your senior architect warns against.