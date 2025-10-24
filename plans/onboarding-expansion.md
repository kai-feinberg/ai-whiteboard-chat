# Onboarding Expansion - Development Plan

## 1. Database Design

### Modified Tables
**onboardingProfiles**
- Add: `additionalIdeas: v.optional(v.string())` - freeform field for random ideas/notes

### No schema changes needed
- generatedDocuments already supports dynamic documentType field
- Just add 3 new document types: `build_a_buyer`, `pain_core_wound`, `competitors`

### Queries

**getOnboardingProfile**
- Input: organizationId (from auth)
- Output: full profile including new additionalIdeas field
- Purpose: Load profile for form and advanced view

**getGeneratedDocuments**
- Input: profileId
- Output: all 7 documents with status, content, errors
- Purpose: Display generation progress and content

**getDocumentAnalysis** (NEW)
- Input: profileId, documentType
- Output: { completeness: number, suggestions: string[], missingElements: string[] }
- Purpose: AI-powered analysis for Advanced Onboarding view

## 2. Data Flow

1. User fills form (now with 6 fields including additionalIdeas)
2. Submit triggers workflow with 7 parallel document generations
3. Each document generates independently, updates status
4. Advanced view fetches documents + runs AI analysis on each
5. "Edit in Chat" button passes document to chat playground with context

## 3. User Flows

### Basic Onboarding Flow
- Fill 5 required fields + 1 optional additionalIdeas field
- Click "Generate Documents"
- See 7 documents generating in parallel
- View completed documents inline (existing behavior)

### Advanced Onboarding Flow (NEW)
- Navigate to Advanced Onboarding section
- See grid/list of 7 documents with:
  - Status indicator
  - Completion percentage
  - AI-generated improvement suggestions
  - Quick preview
- Click document to see full content + detailed analysis
- Click "Edit in Chat" to open in AI playground

### Chat Editing Flow (FUTURE - Phase 2)
- Click "Edit in Chat" on any document
- Opens chat playground with document pre-loaded
- Document context included in system prompt
- AI can read/edit document based on user requests
- Manual editing also available in editor

## 4. UI Components

### OnboardingForm (MODIFIED)
**Purpose**: Collect org info + random ideas
**Changes**:
- Add Textarea for additionalIdeas field (optional)
- Update submission to include new field

### DocumentCard (MODIFIED)
**Purpose**: Show generation progress + preview
**Changes**:
- Support 7 document types instead of 4
- Add document type labels for new docs

### AdvancedOnboardingView (NEW)
**Purpose**: Deep dive into each document with AI analysis
**Components**:
- DocumentGrid: 7 cards showing status + quick analysis
- DocumentDetail: Full content + comprehensive analysis
- AnalysisPanel: AI suggestions + completeness metrics
**Data**: documents, analysis results

### DocumentEditButton (FUTURE - Phase 2)
**Purpose**: Bridge to chat playground
**Interaction**:
- Pass documentId + documentType to chat
- Pre-populate editor with content
- Include profile context in system prompt

## 5. Backend Actions

### New Actions

**generateBuildABuyer**
- Purpose: Generate buyer persona document
- Input: profileId
- Output: markdown document with ideal customer profile, psychographics, pain points

**generatePainCoreWound**
- Purpose: Generate deep pain/wound analysis
- Input: profileId
- Output: markdown analyzing core emotional wounds, surface vs deep pains

**generateCompetitors**
- Purpose: Generate competitor analysis
- Input: profileId
- Output: markdown with competitive landscape, differentiation opportunities

**analyzeDocument** (NEW)
- Purpose: AI-powered document quality analysis
- Input: profileId, documentType
- Output: { completeness: %, suggestions: [], missingElements: [] }
- Uses Claude to analyze if document is thorough, actionable

### Modified Actions

**documentGenerationWorkflow**
- Extend to generate 7 documents in parallel (4 existing + 3 new)
- Update createPendingDocuments to create 7 records

**submitOnboardingForm**
- Accept additionalIdeas field
- Pass to workflow for context

## 6. Patterns to Reuse

### Document Generation Pattern
- Copy existing action structure from generateOfferBrief
- Each new doc type needs:
  - System prompt in SYSTEM_PROMPTS object
  - Internal action function
  - Entry in workflow Promise.all
  - Entry in createPendingDocuments array
  - Label in documentTitles object

### AI Analysis Pattern
- Similar to document generation but lighter weight
- Uses profile + document content as context
- Returns structured analysis instead of long-form content
- Can cache/store results in generatedDocuments table

### Chat Integration Pattern (FUTURE)
- Reuse existing chat playground infrastructure
- Pass documentId as query param
- Load document content into editor on mount
- Include document metadata in thread context
- Similar to how ai-chat.tsx loads playground document

### Auth & Organization Scoping
- All queries check organizationId from identity
- All mutations verify org ownership
- Use by_organization indexes for efficiency

## Implementation Phases

### Phase 1 (MVP - 1 day)
1. Add additionalIdeas field to schema + form
2. Create 3 new document generation actions with system prompts
3. Update workflow to generate 7 documents
4. Update UI to display 7 documents

### Phase 2 (Advanced View - 1 day)
1. Create Advanced Onboarding route/page
2. Build document analysis action
3. Create AdvancedOnboardingView component
4. Add navigation to advanced view

### Phase 3 (Chat Integration - 1 day)
1. Add documentId context to chat system
2. Create "Edit in Chat" button flow
3. Update chat agent to handle document editing
4. Test manual + AI editing

## System Prompts for New Documents

### Build-A-Buyer
```
You are a customer research expert specializing in buyer persona development.

Create a detailed Build-A-Buyer analysis with:
1. **Demographics** - Age, income, location, occupation
2. **Psychographics** - Values, beliefs, lifestyle, identity
3. **Pain Points** - Problems, frustrations, fears
4. **Desires** - Goals, aspirations, dream outcomes
5. **Buying Triggers** - What makes them ready to purchase
6. **Objections** - What holds them back

Use markdown formatting. Aim for 400-600 words.
```

### Pain and Core Wound
```
You are a marketing psychologist specializing in emotional drivers.

Analyze the customer's pain layers:
1. **Surface Pain** - Obvious problems they're aware of
2. **Deeper Pain** - Underlying issues they may not articulate
3. **Core Wound** - Fundamental emotional wound driving behavior
4. **Pain Amplification** - How pain compounds over time
5. **False Solutions** - What they've tried that didn't work
6. **True Resolution** - How this product addresses the core wound

Use markdown formatting. Aim for 350-500 words.
```

### Competitors
```
You are a competitive intelligence analyst.

Analyze the competitive landscape:
1. **Direct Competitors** - Same solution, same market
2. **Indirect Competitors** - Different solution, same pain
3. **Competitor Positioning** - How they position themselves
4. **Market Gaps** - What competitors miss
5. **Differentiation Opportunities** - How to stand out
6. **Competitive Advantages** - Unique strengths to emphasize

Use markdown formatting. Aim for 400-600 words.
```
