# Overview

This is the **Turtle Little** e-commerce web application, an online store selling personalised luxury embroidered towels and blankets. The platform enables customers to browse products, personalise items for embroidery, add them to a cart with automatic "Buy 2 Get 1 Free" discounts, and place orders with shipping details. The business vision is to provide a premium, app-style shopping experience with a focus on handcrafted quality and personalised products.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

The project employs a **monorepo layout** with distinct `client/` (React frontend), `server/` (Express backend), and `shared/` (common code) directories.

## Frontend

- **Framework**: React with TypeScript, bundled by Vite.
- **Routing**: Wouter for client-side routing.
- **State/Data Fetching**: TanStack React Query.
- **UI/Styling**: shadcn/ui built on Radix UI with Tailwind CSS, supporting light/dark modes.
- **Key Pages**:
    - **Home** (`/`): Dynamic hero banner, audience cards, featured products, promo cards.
    - **Shop** (`/shop`): Unified browsing with filter chips by audience.
    - **Product Detail** (`/product/:slug`): Image gallery, pricing, specifications, personalisation input, add-to-cart, related products.
    - **Cart** (`/cart`): Item management, discount display, order summary.
    - **Checkout** (`/checkout`): Address form and order summary.
    - **Order Confirmation** (`/order/:id`): Order details.
    - **Admin Builder** (`/admin/builder`): Dynamic homepage layout and collection management.
    - **Admin Catalog** (`/admin/catalog`): CMS for managing categories and products.
- **Core UI Components**: AnnouncementBar, Header, BottomNav (mobile), Footer, ProductCardNew with quick-add, QuickAddSheet for personalization, and a floating WhatsAppButton.

## Backend

- **Framework**: Express 5 on Node.js with TypeScript.
- **Cart Sessions**: Cookie-based for persistence.
- **API Endpoints**: Comprehensive REST API for categories, products, cart management, checkout, orders, and site configuration.

## Shared Layer (`shared/`)

- **`types.ts`**: Database-agnostic TypeScript interfaces for all data models, insulating application logic from database specifics.
- **`schema.ts`**: Drizzle ORM table definitions for PostgreSQL, used exclusively by the server's storage layer.
- **`routes.ts`**: Zod validation schemas for API inputs.

## Architecture Patterns

- **Database Insulation**: Separation of database-specific code (`shared/schema.ts`, `server/storage.ts`) from application logic (`shared/types.ts`) via an `IStorage` interface, allowing for database changes without impacting core business logic.
- **Provider Abstraction Layer (`server/providers/`)**: Swappable interfaces for Payment (`IPaymentProvider`), File Storage (`IFileStorage`), and Notifications (`INotificationService`), controlled by environment variables. Current implementations include `CodPaymentProvider` (Cash on Delivery), `LocalFileStorage`, and `ConsoleNotificationService`.
- **Service Layer (`server/services/`)**: Business logic (e.g., `discountService.ts`, `cartService.ts`, `orderService.ts`) is encapsulated in service classes, decoupling it from HTTP route handlers.

## Database

- **ORM**: Drizzle ORM with PostgreSQL dialect.
- **Tables**: Includes `categories`, `products`, `tags`, `product_tags` (many-to-many), `product_images`, `product_reviews`, `carts`, `cart_items`, `orders`, `order_items`, and `site_config`.
- **Product Categories**: Flat structure with a tagging system for cross-cutting attributes.
- **Discount Logic**: "Buy 2 Get 1 Free" applied automatically, making the cheapest `floor(N/2)` items free for carts with 3+ items.

## Key Features

- Product personalisation (name embroidery).
- Automatic "Buy 2 Get 1 Free" discount.
- Floating WhatsApp contact button (99900 79722).
- Dark/light theme toggle and mobile-responsive design.
- Cookie-based cart persistence.
- Progressive Web App (PWA) support.
- Dynamic homepage content management.
- Comprehensive product data and customer reviews.
- Optimized product images for various sizes (Small, Medium, Large) served from `client/public/images/products/`.

# External Dependencies

- **Database**: PostgreSQL
- **Frontend Libraries**: React, Vite, Wouter, TanStack React Query, shadcn/ui, Radix UI, Tailwind CSS
- **Backend Libraries**: Express, cookie-parser, tsx
- **ORM**: Drizzle ORM
- **Validation**: Zod
- **Payment Gateway**: CodPaymentProvider (Cash on Delivery)
- **File Storage**: LocalFileStorage (disk-based)
- **Notifications**: ConsoleNotificationService