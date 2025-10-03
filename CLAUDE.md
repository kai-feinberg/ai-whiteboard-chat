AdScout - Claude Development Guide

If you have made changes to the backend then when you are done developing make sure to run pnpm dev which will both start the dev server and run a typecheck on the backend code. After you have confirmed the check passes kill the task.


Quick Start Philosophy 🚀
AdScout is a B2B ad intelligence platform built for SPEED over perfection.
Core Principles

Speed over perfection - Launch in ≤1 day, iterate based on feedback
Manual over automated - Users/VAs handle complex setup initially
Simple over robust - Choose scrappiest solution that solves core problem
B2B tolerance - Business users accept manual workarounds for value

When Building ANY Feature
Ask these questions FIRST:

Does this solve the core pain point?
Can this be done manually/by VA instead?
Is this implementable in <1 day?
Are we solving for edge cases too early?
Will users tolerate a manual workaround?


Tech Stack & Architecture
Core Stack

Frontend: TanStack Start (SSR React)
Database: Convex (real-time, serverless)
Auth: Magic link (passwordless)
AI: OpenAI + Claude Sonnet
Vector Search: Convex Vector Search (RAG)
Media Storage: Convex file storage
Deployment: Convex deployment platform

File Structure Pattern
/features/[feature-name]/
  README.md           # ⚠️ READ THIS FIRST for gotchas
  components/         # Feature UI components
  hooks/             # Smart hooks with auth built-in
  types.ts           # Feature TypeScript types
  utils.ts           # Pure functions only

/convex/[feature-name]/
  functions.ts       # ALL queries/mutations for feature
  schema.ts          # Table definitions

Core Features Overview

Authentication - Convex Auth with magic links
User Profile - AI model config, search preferences
Subscriptions - Manage search terms and company monitoring
Ad Dashboard - View scraped ads with filters/tags
Search Ads - Tag-based and semantic search through ad database
Chat - AI-powered ad analysis and variation generation
RAG System - Vector embeddings for semantic search


Ad Scraping & Analysis System
Scraping Flow (Automated)

Cron job triggers based on subscription frequencies
External API calls
Media download and storage in Convex
AI analysis generates tags 
RAG system indexes content for search

Analysis Pipeline

Content extraction from ad text and media
AI tagging
Vector embedding generation for semantic search
Media processing and storage optimization


Search System Architecture
Tag-Based Search

Filter ads by AI-generated categories
Company and platform filtering
Date range and performance metrics
User subscription scope limiting

Semantic Search

Vector similarity matching
Natural language queries
Context-aware results
Relevance scoring


Route Organization
Core Routes
/                          # Dashboard overview
/profile                   # User settings & AI config
/ad-subscriptions             # Manage search terms & companies

/ads                       # Ad dashboard
/ads/[id]                 # Ad detail view

/search-ads                   # Advanced search interface

/chat                     # AI chat sessions
/chat/[sessionId]         # Individual chat

Convex Function Patterns
tsx// All backend logic uses Convex functions, NOT REST APIs
export const getByUser = query({...})        # List with filters
export const getById = query({...})          # Single item  
export const update = mutation({...})        # Update (subscriptions/preferences)
export const remove = mutation({...})        # Delete
export const scrapeAds = action({...})       # Scrape from external APIs
export const analyzeAd = action({...})       # AI analysis and tagging
export const searchSemantic = action({...})  # Vector search
Use Convex patterns instead of REST:

Queries - Read data from database
Mutations - Write data to database
Actions - Interact with external APIs (ad platforms, AI services)

❌ Code Organization Mistakes

Cross-feature component imports → Features must be self-contained
Manual auth in components → Use smart hooks
Splitting functions prematurely → Keep related functions together
God components → Single responsibility principle
Not using vector search → Leverage Convex's built-in capabilities

Development Workflow
Starting a New Feature

Read feature README in /features/[name]/README.md for gotchas
Check database schema in docs for table relationships
Copy existing pattern from similar feature
Build smart hooks first with authentication built-in
Create Convex functions following CRUD pattern
Build UI components using smart hooks

After Completing a Feature

Update/create feature README with complete documentation
Test authentication and real-time sync across browser tabs
Test vector search and semantic queries
Document any gotchas encountered during development
Reflect on implementation - what worked well, what was difficult
Propose updates to this claude.md file based on learnings
Note performance considerations and edge cases discovered

Feature Reflection Template
After building a feature, document:

What went smoothly - patterns that worked well
Unexpected challenges - issues not covered in documentation
Authentication gotchas - Convex Auth edge cases encountered
Database issues - schema problems or relationship complications
Vector search issues - embedding generation or query problems
UI/UX discoveries - mobile responsiveness or real-time sync issues
Performance notes - query optimization needs or bottlenecks
Missing documentation - gaps in this guide that should be filled

Before Implementation
📚 REQUIRED READING:
- /features/[feature-name]/README.md (if exists)
- Database schema for related tables
- Vector search documentation for semantic features
- Routes documentation for API patterns
- Senior Architect Prompt for trade-off decisions
Testing Checklist

Authentication works (logged in/out states)
Real-time updates sync across tabs
Vector search returns relevant results
Error states handled gracefully
Loading states handled appropriately
Mobile responsive design
Media files load correctly


Critical Gotchas & Fixes

🚨 Update This Section When You Encounter Issues
This section will be populated as issues are discovered during development. When you encounter a significant problem, document it here for future reference.

When You Get Stuck

Read the feature README for known gotchas
Check database schema for relationship issues
Verify authentication is properly handled in smart hooks
Test vector search with sample queries
Test real-time updates across multiple browser tabs
Apply senior architect principles - is this over-engineered?

Remember: B2B users will tolerate manual workarounds for real value. Keep it simple and ship fast! 🚀