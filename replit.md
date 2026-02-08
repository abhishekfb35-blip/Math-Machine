# Overview

This is a **calculator web application** with persistent history storage. Users can perform mathematical calculations on the frontend, and each calculation's expression and result are saved to a PostgreSQL database via a REST API. The app features a modern dark-themed UI with a calculator component and a history sidebar that allows users to review, reuse, and clear past calculations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Full-Stack Structure

The project follows a **monorepo layout** with three top-level source directories:

- **`client/`** — React frontend (SPA)
- **`server/`** — Express backend (REST API)
- **`shared/`** — Code shared between client and server (schema, route definitions, types)

### Frontend

- **Framework**: React with TypeScript
- **Bundler**: Vite (config in `vite.config.ts`, client root at `client/`)
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query for server state management
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Styling**: Tailwind CSS with CSS variables for theming, dark mode by default, custom fonts (Outfit, DM Mono)
- **Math Evaluation**: `mathjs` library handles expression parsing/evaluation on the client side — the server only stores results
- **Animations**: Framer Motion for UI transitions
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend

- **Framework**: Express 5 on Node.js, wrapped in a standard HTTP server
- **Language**: TypeScript, executed via `tsx`
- **API Pattern**: Simple REST API with three endpoints all under `/api/history`:
  - `GET /api/history` — list all history items (newest first)
  - `POST /api/history` — create a new history entry (expression + result)
  - `DELETE /api/history` — clear all history
- **Validation**: Zod schemas for request validation, shared between client and server via `shared/routes.ts`
- **Development**: Vite dev server runs as middleware in development mode with HMR
- **Production**: Client is built to `dist/public/`, server is bundled with esbuild to `dist/index.cjs`

### Shared Layer (`shared/`)

- **`schema.ts`** — Drizzle ORM table definitions and Zod insert schemas. Single table: `history` with columns `id`, `expression`, `result`, `createdAt`
- **`routes.ts`** — API route contract definitions (paths, methods, input/output schemas). Acts as a type-safe contract between frontend and backend

### Database

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL, connected via `DATABASE_URL` environment variable
- **Connection**: `pg` Pool in `server/db.ts`
- **Schema Management**: `drizzle-kit push` for schema migrations (run via `npm run db:push`)
- **Schema**: Single `history` table:
  - `id` — serial primary key
  - `expression` — text (the math expression)
  - `result` — text (the computed result)
  - `created_at` — timestamp with default now

### Storage Pattern

The `server/storage.ts` file defines an `IStorage` interface and a `DatabaseStorage` class implementation. This pattern allows swapping storage backends if needed, though currently only the database implementation exists.

### Build System

- **Dev**: `npm run dev` runs the Express server with Vite middleware for HMR
- **Build**: `npm run build` runs a custom build script (`script/build.ts`) that builds the Vite client and bundles the server with esbuild
- **Production**: `npm start` serves the pre-built client as static files from `dist/public/`

## External Dependencies

### Required Services
- **PostgreSQL Database** — Required. Connection string must be provided via `DATABASE_URL` environment variable. Used for storing calculation history.

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit** — ORM and migration tooling for PostgreSQL
- **express** (v5) — HTTP server framework
- **mathjs** — Client-side math expression evaluation
- **@tanstack/react-query** — Server state management on the frontend
- **zod** + **drizzle-zod** — Schema validation shared across client/server
- **framer-motion** — Animation library
- **wouter** — Lightweight client-side routing
- **shadcn/ui** components (Radix UI + Tailwind CSS)
- **connect-pg-simple** — PostgreSQL session store (available but not actively used for this app)

### PWA (Progressive Web App)

The app is configured as a PWA, making it installable on Android (and iOS) devices via the browser's "Add to Home Screen" feature.

- **`client/public/manifest.json`** — Web app manifest with app name, icons, display mode, and theme color
- **`client/public/sw.js`** — Service worker with network-first caching strategy for navigation, cache-first for static assets, and graceful offline fallback for API calls
- **`client/public/icon-192.png`** and **`client/public/icon-512.png`** — App icons for home screen and splash screen
- **`client/src/main.tsx`** — Registers the service worker on page load
- **`client/index.html`** — Includes PWA meta tags (theme-color, apple-mobile-web-app-capable, manifest link, apple-touch-icon, Open Graph tags)

### Replit-Specific Plugins
- `@replit/vite-plugin-runtime-error-modal` — Runtime error overlay in development
- `@replit/vite-plugin-cartographer` — Dev tooling (conditionally loaded)
- `@replit/vite-plugin-dev-banner` — Dev environment banner (conditionally loaded)