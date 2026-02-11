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

- **Home** (`/`) — Hero banner, audience cards (For Kids / For Couples), featured product sections, promo cards
- **Shop** (`/shop`) — Unified browsing with filter chips (All, Kids, Adults, Couples), full product catalog grouped by category
- **Category** (`/category/:slug`) — Product grid filtered by category, offer badge
- **Product Detail** (`/product/:slug`) — Product image, description, price, personalisation input, add-to-cart, related products
- **Cart** (`/cart`) — Cart items with quantity controls, discount display, order summary
- **Checkout** (`/checkout`) — Address form with validation, order summary sidebar
- **Order Confirmation** (`/order/:id`) — Order details, shipping info, item list with free items marked
- **Admin Builder** (`/admin/builder`) — CMS-style page builder for configuring all homepage content, header, footer, announcements, and dynamic homepage collections

### UI Components

- **AnnouncementBar** — Scrolling marquee promo bar at top with "Buy 2 Get 1 Free", "Free shipping", "Personalised embroidery"
- **Header** — Minimal top bar with brand name, Shop nav link, theme toggle, cart icon with badge
- **BottomNav** — Mobile bottom navigation (Home, Shop, Cart tabs) — hidden on desktop
- **Footer** — Full footer with brand story, shop links, contact info (inverted bg-foreground/text-background)
- **ProductCardNew** — Product card with image, name, price, "Buy 2 Get 1 Free" badge, and "+" quick-add button
- **QuickAddSheet** — Bottom sheet for personalization name input and quantity when quick-adding to cart
- **WhatsAppButton** — Floating WhatsApp contact button, positioned above bottom nav on mobile

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
- `GET /api/site-config` — Get all site configuration (returns key-value JSON)
- `GET /api/site-config/:key` — Get single config by key
- `POST /api/site-config/:key` — Upsert config (body: { value: any })

### Shared Layer (`shared/`)

- **`schema.ts`** — Drizzle ORM table definitions: categories, products, carts, cart_items, orders, order_items, site_config
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
  - `site_config` — id, key (unique), value (JSON string)

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

- **Feb 2026**: Dynamic homepage collections system
  - Homepage card grid sections (e.g. "Shop by Collection", "Shop by Product") are now fully dynamic
  - Sections can be added, deleted, and reordered in admin builder
  - Cards within each section can be added and deleted
  - Last 3 deleted sections stored in history and can be restored
  - Unified config key "homepageCollections" with backward-compatible migration from old "collections"/"productTypes" keys
  - Image preview in admin builder shows actual default/fallback images
- **Feb 2026**: snaan.in-inspired premium design improvements
  - Scrolling announcement/promo bar above header
  - "The Turtle Little Promise" brand section (Premium Fabric, Hand Embroidered, Made with Love)
  - Customer testimonials section with reviews and star ratings
  - Stats bar (58+ Products, 5 Collections, All India Free Delivery)
  - Full footer with brand story, shop links, contact info
  - Editorial descriptions on category banners in Shop page
  - Promo CTA section highlighting "Buy 2 Get 1 Free" offer
  - Banner images throughout Home, Shop, and Category pages
- **Feb 2026**: UI redesign to app-style shopping experience
  - Bottom navigation bar on mobile (Home, Shop, Cart)
  - New unified Shop page with audience filter chips (All, Kids, Adults, Couples)
  - Quick-add feature: "+" button on product cards opens bottom sheet for personalization
  - Redesigned Home page with audience cards (For Kids, For Couples)
  - Related products section on product detail pages
  - Simplified header with minimal navigation
  - Fixed discount calculation to mark cheapest items as free
- **Feb 2026**: Complete rebuild from calculator app to Turtle Little e-commerce store
  - New database schema with 6 tables
  - 58 products seeded from turtlelittle.com
  - Full shopping cart with discount logic
  - Checkout flow with order placement
  - WhatsApp integration
  - Teal/green branding with light/dark mode

### Image Optimization

Product images are served in 3 sizes for optimal performance:
- **Small** (150px wide, ~11KB) — Cart thumbnails, quick-add sheet, checkout items
- **Medium** (400px wide, ~78KB) — Product grid cards on Shop/Category/Home pages
- **Large** (original 567px wide, ~175KB) — Product detail page

Image files stored at:
- `client/public/images/products/small/` — 680KB total
- `client/public/images/products/medium/` — 3.8MB total
- `client/public/images/products/large/` — 18MB total (originals)

Frontend utility: `client/src/lib/imageUtils.ts` — `getProductImageUrl(imageUrl, "small" | "medium" | "large")` rewrites `/images/products/filename.jpg` to `/images/products/{size}/filename.jpg`. Uploaded images (`/uploads/...`) pass through unchanged.

## Future Work

- Razorpay payment integration
- Admin panel for product management
- Customer accounts and order history
- Product search
- Image migration to CDN
