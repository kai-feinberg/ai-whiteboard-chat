# UI2
All routes within this app should have sidebar navigation displaying the accessible routes and the users profile information at the bottom.

For the sources routes (which display information from external sources) they should all display tables of data. When a row is hovered two buttons should appear, one to generate content, and one to delete the content. Additionally above each table there should be a section where starred content is present (for that specific source type). When a row is clicked it should open up a detail page with more information regarding that content. Users should also be able to star specific pieces of content so they appear above the table for easy access.



# Route Organization by Feature
## Content Generation
Routes:

/content - Generated content listing
/content/[id] - Content detail/edit page

APIs:

GET /api/content - List user's generated content (with filters)
GET /api/content/[id] - Get specific content
PUT /api/content/[id] - Update content (edit, star, mark used)
DELETE /api/content/[id] - Delete content
POST /api/generate - Generate content from any source type

## Product Management
Routes:
- none, UI displayed within the profile page

APIs:

GET /api/products - List user products
POST /api/products - Create product
PUT /api/products/[id] - Update product
DELETE /api/products/[id] - Delete product

## Audience Management
Routes:
- none, UI displayed within the profile page

APIs:

GET /api/audiences - List user audiences
POST /api/audiences - Create audience
PUT /api/audiences/[id] - Update audience
DELETE /api/audiences/[id] - Delete audience

User Profile
Routes:

/profile - User settings (model config, preferences)

APIs:

GET /api/profile - Get user profile
PUT /api/profile - Update user profile

Content Sources
Routes:

/sources - Source management dashboard
/sources/daily-questions - Daily Q&A listing
/sources/daily-questions/[id] - Q&A detail
/sources/news - News ideas listing
/sources/news/[id] - News detail
/sources/scraped - Scraped content listing
/sources/scraped/[id] - Scraped detail
/sources/coaching - Coaching calls listing
/sources/coaching/[id] - Coaching detail

APIs:

GET /api/sources/daily-questions - List daily questions
GET /api/sources/daily-questions/[id] - Get specific question
PUT /api/sources/daily-questions/[id] - Update (star/used status)
GET /api/sources/news - List news ideas
GET /api/sources/news/[id] - Get specific news
PUT /api/sources/news/[id] - Update news item
GET /api/sources/scraped - List scraped content
GET /api/sources/scraped/[id] - Get specific scraped item
PUT /api/sources/scraped/[id] - Update scraped item
GET /api/sources/coaching - List coaching calls
GET /api/sources/coaching/[id] - Get specific call
PUT /api/sources/coaching/[id] - Update coaching call
GET /api/sources/managed - List user-configured sources
POST /api/sources/managed - Add new source to monitor
DELETE /api/sources/managed/[id] - Remove monitored source