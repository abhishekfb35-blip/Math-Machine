# Overview

This is the **Turtle Little** e-commerce web application — an online store selling personalised luxury embroidered towels and blankets. Customers can browse products by category, personalise items with a name to be embroidered, add to cart with automatic "Buy 2 Get 1 Free" discount, and place orders with shipping details.

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
- **UI Components**: shadcn/ui built on Radix UI primitives with Tailwind CSS
- **Styling**: Tailwind CSS with CSS variables for theming, light mode default with dark mode support
- **Fonts**: Outfit (headings/body), DM Mono (monospace)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Frontend Pages

- **Home** (`/`) — Hero banner, category highlights, featured products grid, promotional cards
- **Category** (`/category/:slug`) — Product grid filtered by category, offer banner
- **Product Detail** (`/product/:slug`) — Product image, description, price, personalisation name input, add-to-cart
- **Cart** (`/cart`) — Cart items with quantity controls, discount display, order summary
- **Checkout** (`/checkout`) — Address form with validation, order summary sidebar
- **Order Confirmation** (`/order/:id`) — Order details, shipping info, item list with free items marked

### Backend

- **Framework**: Express 5 on Node.js with cookie-parser middleware
- **Language**: TypeScript, executed via `tsx`
- **Cart Sessions**: Cookie-based (`cart_session` cookie, 30-day expiry)

### API Endpoints

- `GET /api/categories` — List all categories
- `GET /api/categories/:slug` — Get single category
- `GET /api/products` — List all active products
- `GET /api/products/category/:categoryId` — Products by category
- `GET /api/products/:slug` — Get single product
- `GET /api/cart` — Get current cart with items, pricing, and discount
- `POST /api/cart/items` — Add item to cart (productId, quantity, personalizationName)
- `PATCH /api/cart/items/:id` — Update cart item quantity
- `DELETE /api/cart/items/:id` — Remove item from cart
- `POST /api/checkout` — Place order with customer/shipping details
- `GET /api/orders/:id` — Get order with items

### Shared Layer (`shared/`)

- **`schema.ts`** — Drizzle ORM table definitions: categories, products, carts, cart_items, orders, order_items
- **`routes.ts`** — Zod validation schemas for cart and checkout inputs

### Database

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL, connected via `DATABASE_URL` environment variable
- **Tables**:
  - `categories` — id, name, slug, description, image_url, sort_order
  - `products` — id, name, slug, description, price (integer in INR), image_url, category_id, active, sort_order
  - `carts` — id, session_id, created_at
  - `cart_items` — id, cart_id, product_id, quantity, personalization_name
  - `orders` — id, customer details, shipping address, subtotal, discount, total, status, payment fields, created_at
  - `order_items` — id, order_id, product snapshot, personalization_name, is_free

### Product Categories

1. Girls Towels (₹999 each) — ~20 products
2. Boys Towels (₹999 each) — ~20 products
3. Couple Towels (₹2,499 per set) — 6 products
4. Boys Blankets (₹1,599 each) — 6 products
5. Girls Blankets (₹1,599 each) — 6 products

### Discount Logic

"Buy 2 Get 1 Free" offer: When cart has 3+ items, the cheapest floor(N/2) items are free. Sort by price descending, mark the bottom half as free.
- 3 items → 1 free (pay for 2)
- 5 items → 2 free (pay for 3)
- 7 items → 3 free (pay for 4)
Minimum 3 items required to activate discount.

### Build System

- **Dev**: `npm run dev` runs the Express server with Vite middleware for HMR
- **Build**: `npm run build` runs a custom build script
- **Production**: `npm start` serves the pre-built client as static files

### PWA

The app includes PWA support with manifest.json, service worker, and app icons.

### Key Features

- Product personalisation (name embroidery input)
- Automatic discount calculation at cart level
- Floating WhatsApp contact button (99900 79722)
- Dark/light theme toggle
- Mobile responsive design
- Cookie-based cart persistence

## Recent Changes

- **Feb 2026**: Complete rebuild from calculator app to Turtle Little e-commerce store
  - New database schema with 6 tables
  - 58 products seeded from turtlelittle.com
  - Full shopping cart with discount logic
  - Checkout flow with order placement
  - WhatsApp integration
  - Teal/green branding with light/dark mode

## Future Work

- Razorpay payment integration
- Admin panel for product management
- Customer accounts and order history
- Product search
- Image migration to CDN
