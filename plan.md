AdScout - Development Plan & Roadmap
Phase 1: Foundation Setup (Day 1) 🏗️
Goals

Basic project structure with authentication
Core database schema for ads and subscriptions
Simple UI with sidebar navigation
Table and card views for ads

Tasks

Project Setup

Initialize TanStack Start + Convex project
Set up Convex Auth with magic links
Configure basic routing structure


Database Schema

users table (basic profile)
subscriptions table (search terms, companies)
ads table (scraped content, basic fields)
Set up indexes for user relationships


Basic UI Components

Sidebar navigation with main sections
Ad table view (sortable, filterable)
Ad card view (grid layout with thumbnails)
View toggle (table/card switch)


Authentication Flow

Login/logout functionality
Protected routes setup
User profile basic page



Deliverable
Working app where users can sign up, see empty dashboard with proper navigation and views

Phase 2: Manual Scraping (Day 2) 🔧
Goals

Button-triggered scraping functionality
Basic ad data collection and storage
Media download and storage

Tasks

Scraping Infrastructure

Create scraping action in Convex
Integrate with Facebook Ads Library API (start with one platform)
Basic error handling and status tracking


Manual Trigger UI

"Scrape Now" button in subscriptions page
Loading states and progress indicators
Success/error feedback


Media Handling

Download ad images/videos to Convex storage
Generate thumbnails for quick loading
Handle different media formats


Data Display

Populate table/card views with real scraped data
Basic ad detail page
Pagination for large datasets



Deliverable
Users can create subscriptions, trigger scraping manually, and view real ad data

Phase 3: AI Analysis & RAG (Day 3-4) 🤖
Goals

AI-powered tagging and analysis
Vector embeddings for semantic search
Enhanced ad metadata

Tasks

AI Analysis Pipeline

Integrate OpenAI/Claude for ad analysis
Generate tags (theme, sentiment, audience, CTA type)
Confidence scoring for analysis quality


Vector Embeddings

Set up Convex Vector Search
Generate embeddings for ad text
Index ads for semantic search


Enhanced UI

Display AI tags in table/card views
Tag filtering and grouping
Confidence indicators
Re-analyze button for individual ads


Batch Processing

Analyze all ads after scraping
Background processing for large batches
Progress tracking for analysis jobs



Deliverable
All scraped ads have AI-generated tags and are searchable via semantic similarity

Phase 4: Advanced Search (Day 5-6) 🔍
Goals

Tag-based filtering and search
Semantic search interface
Advanced search combinations

Tasks

Tag-Based Search

Multi-select tag filters
Company and platform filters
Date range filtering
Saved search functionality


Semantic Search

Natural language search input
Vector similarity results
Relevance scoring display
Search result explanations


Search UI/UX

Advanced search page
Search suggestions and autocomplete
Search history
Export search results


Performance Optimization

Search result caching
Pagination for large result sets
Search analytics tracking



Deliverable
Users can find ads using both structured filters and natural language queries

Phase 5: AI Chat Integration (Day 7-8) 💬
Goals

AI chat interface for ad analysis
Ad variation generation
Context-aware conversations

Tasks

Chat Infrastructure

Chat sessions management
Message storage and retrieval
Real-time chat updates


RAG Integration

Context injection from relevant ads
Ad references in responses
Smart context selection


Chat Features

Ad variation generation
Competitive analysis discussions
Trend identification conversations
Export chat insights


Chat UI

Clean chat interface
Ad preview cards in chat
Copy/save generated variations
Session management



Deliverable
Users can chat with AI about their ad data and generate variations