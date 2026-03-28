# مكتبة المعرفة العالمية (World Knowledge Library)

## Overview
An Arabic digital library application with a navy blue and gold theme. Features book management, user authentication, star ratings, QR codes, dark mode, multi-language support (Arabic, English, Chinese), and admin dashboard.

## Architecture
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js with session-based auth
- **Database**: PostgreSQL with Drizzle ORM
- **Session Store**: PostgreSQL via connect-pg-simple (persists across autoscale restarts)
- **Routing**: wouter (client-side)

## Key Features
- RTL Arabic layout with Cairo/Amiri fonts
- Dark/light mode with gold accents
- Live search with instant results
- Star rating system with arithmetic average
- Favorites system per session
- QR code generation
- PDF/file viewer with bookmarks
- Admin dashboard (manage authors + all books, full delete permissions)
- Author dashboard (manage own books only, with ownership-based filtering)
- Drag & drop file upload (max 10MB) to `public/uploads`
- Multi-language (AR/EN/ZH) with settings gear
- Smart book suggestions based on related categories
- External cover image support with `referrerPolicy="no-referrer"`

## Project Structure
```
client/src/
  App.tsx           - Main router
  lib/
    auth.tsx        - Auth context/provider
    theme.tsx       - Theme context (dark mode + language)
    i18n.ts         - Translations (AR/EN/ZH)
    queryClient.ts  - TanStack Query setup
  pages/
    home.tsx        - Main page with hero, stats, categories, book grid
    login.tsx       - Login page
    setup.tsx       - First-time admin setup
    add-book.tsx    - Add book form with drag & drop
    book-viewer.tsx - PDF viewer with bookmarks + suggestions
    dashboard.tsx   - Admin/author dashboard
  components/
    book-card.tsx   - Book card with rating, favorites, volumes
    settings-panel.tsx - Settings overlay (language, theme, logout)

server/
  routes.ts         - All API endpoints
  storage.ts        - Database operations (PostgreSQL)
  index.ts          - Express server entry
  static.ts         - Production static file serving

shared/
  schema.ts         - Drizzle schema + categories + types

public/uploads/     - File upload directory (served via express.static)
```

## Database Seeding & Resilience
On startup, the server seeds the database with retry logic (handles Neon cold starts):
- An admin user (username=`admin`, password=`admin123`) if none exists
- A sample book: "ديوان المتنبي" by أبو الطيب المتنبي if no books exist
- Retry logic: 5 attempts with 3s delay for Neon endpoint disabled/connection errors
- Pool error handler prevents crash on connection termination
- All routes wrapped in try-catch for graceful error responses

## Auth System
- Hardcoded admin: username=`admin`, password=`admin123` — always works via plaintext match in login route, creates DB user if missing
- Regular users: authenticated via bcrypt password comparison
- Author ownership: books linked to authorId on creation; `/api/books/my` returns only the author's own books
- Authors can only delete their own books; admin can delete any book or author
- Sessions stored in PostgreSQL (connect-pg-simple) to survive autoscale restarts

## Image Handling
- Cover images: external URLs stored in `coverUrl` field, displayed with `referrerPolicy="no-referrer"` to avoid hotlink blocking
- Fallback: SVG placeholder displayed on image load error via `onError` handler
- Uploaded files: saved to `public/uploads/`, served via `express.static`

## Database Tables
- users (id, username, password, role, is_active)
- books (id, title, author_name, author_id, main_category, sub_category, volumes, cover_url, description, file_url, file_name, total_rating, rating_count, created_at)
- ratings (id, book_id, session_id, rating)
- favorites (id, book_id, session_id)
- bookmarks (id, book_id, session_id, page)
- site_stats (id, visits)
- session (auto-created by connect-pg-simple for session persistence)
