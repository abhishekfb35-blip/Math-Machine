# Turtle Little — Functional Specification

> Status: Initial draft. Individual sections to be detailed in future iterations.

---

## 1. Platform Overview

Turtle Little is a direct-to-consumer e-commerce site selling personalized luxury embroidered towels, bathrobes, and blankets. Every product can be embroidered with a name. The site supports multi-currency pricing, customer accounts, Google login, a progressive web app (PWA) install flow, and a full admin back-office.

---

## 2. Customer-Facing (Public) Features

### 2.1 Homepage (`/`)
- Announcement bar scrolling promotional messages
- Sticky header with logo, category nav links, currency selector, search icon, account icon, and cart icon
- Dynamic content blocks managed from the admin builder: hero banners, featured collections, product grids, and text/image sections
- Bottom navigation bar (mobile) with Home, Shop, Wishlist, Cart shortcuts
- Floating WhatsApp button linking to a WhatsApp chat
- Google One Tap sign-in prompt for unauthenticated visitors
- Consent popup (configurable from admin) offering a 10% discount code in exchange for an email/phone opt-in
- PWA install banner for eligible browsers

### 2.2 Shop Page (`/shop`)
- Full product grid with filtering by category, audience (Men / Women / Kids / Unisex), and tags
- Sort controls (price, name, newest)
- "Quick Add" sheet — opens from any product card to select personalization name, size/color, and quantity before adding to cart

### 2.3 Category Pages (`/category/:slug`)
- Filtered views: Towels, Bathrobes, Blankets
- Same filtering and quick-add functionality as Shop

### 2.4 Collection Pages (`/collection/:audience`)
- Audience-scoped views: Men, Women, Kids

### 2.5 Product Detail Page (`/product/:slug`)
- Full product images gallery with multiple images
- Price in selected currency (with conversion)
- MRP displayed with strikethrough (discount visible)
- Personalization name input field (embroidery)
- Size selector (with per-size price add-ons where applicable)
- Color selector
- Quantity selector
- Add to Cart button
- Wishlist toggle (heart icon)
- Product reviews section
- Related products
- Full SEO: unique title, meta description, Open Graph, Twitter Card, JSON-LD structured data

### 2.6 Cart (`/cart`)
- Lists all cart items with product image, name, personalization, size, color, quantity, and line price
- Quantity adjustment and item removal
- Automatic Buy-X-Get-Y-Free discount applied inline (configurable from admin — currently "Buy 2 Get 1 Free")
- Discount code entry for the 10% welcome coupon
- Delivery fee shown (tiered by item count, configured from admin)
- Order total
- Proceed to Checkout button

### 2.7 Checkout (`/checkout`)
- Shipping address form (name, phone, address, city, state, pincode)
- Payment method selection: Razorpay (online) or Cash on Delivery
- Razorpay integration opens a payment modal; on success the order is created
- COD path creates the order directly
- Order summary sidebar showing items, discount, delivery fee, and total
- Currency shown at checkout (INR default)

### 2.8 Order Confirmation (`/order/:id`)
- Displays order number, items, totals, and delivery address
- Customer receives a confirmation email automatically

### 2.9 Customer Accounts

**Sign In (`/signin`)**
- Google OAuth login via Google One Tap or button
- OTP (email-based) login as fallback

**Account Page (`/account`)**
- View profile (name, email, phone)
- Order history with status badges
- Wishlist management

**Wishlist (`/wishlist`)**
- Saved products for logged-in customers
- Add/remove from any product card or product page
- Synced across devices via backend

### 2.10 Policy Pages
- About (`/about`)
- Terms & Conditions (`/terms`)
- Privacy Policy (`/privacy`)
- Refund Policy (`/refund-policy`)
- Shipping Policy (`/shipping`)

All managed and edited from the Admin Pages editor.

### 2.11 SEO & Technical
- Per-page `<title>`, `<meta description>`, canonical URL, Open Graph, Twitter Card tags
- JSON-LD structured data on product pages
- Dynamic `sitemap.xml` and `robots.txt`
- Open Graph middleware serves pre-rendered metadata for bots on `/` and `/product/:slug`
- PWA: manifest, dynamically generated icons, installable on mobile

---

## 3. Admin System

Access is at `/admin/login`. There are two tiers: **Superadmin** (env-var credentials, always full access) and **Admin users** (DB-stored, granular permission-based access).

### 3.1 Admin Dashboard (`/admin`)
- Grid of all available admin sections based on the logged-in user's permissions
- **Email Monitoring (BCC)** card — set a monitoring email address and choose which email types (new orders, shipping, abandoned cart, welcome coupon, etc.) are silently BCC'd
- Logout button

### 3.2 Admin Catalog (`/admin/catalog`) — permission: `catalog`
- Full product and category list
- Create/edit/delete categories with name, slug, audience, and sort order
- Create/edit/delete products with SKU, name, slug, price, MRP, description, active toggle, and category
- Bulk actions: activate/deactivate, reorder
- Image management per product (upload, reorder, delete)
- Tag assignment per product
- Variant options: sizes (with per-size price add-on) and colors (with swatch images)

### 3.3 Admin Product Edit (`/admin/catalog/product/:id`) — permission: `catalog`
- Full editing form for a single product
- Image gallery management
- Size and color variant configuration
- Personalization toggle and embroidery settings

### 3.4 Admin Builder (`/admin/builder`) — permission: `builder`
- Drag-and-drop homepage layout editor
- Manage content blocks: hero banners, featured collections, text sections, image sections
- Reorder and toggle visibility of blocks
- Collection management (custom curated product sets)

### 3.5 Admin Orders (`/admin/orders`) — permission: `orders`
- Full order list with search and status filter
- View individual order details: items, customer info, address, payment method, totals
- Update order status (Pending → Processing → Shipped → Delivered / Cancelled)
- Add internal notes per order
- Status change triggers customer notification emails

### 3.6 Admin Customers (`/admin/customers`) — permission: `customers`
- List all registered customers with name, email, signup date, and order count
- View individual customer profile and order history

### 3.7 Admin Pages (`/admin/pages`) — permission: `pages`
- Rich-text editor for all policy pages (About, Terms, Privacy, Refund, Shipping)
- Changes reflect immediately on the public site

### 3.8 Admin Brand Assets (`/admin/brand`) — permission: `brand`
- Upload and manage site logo and favicon
- Dynamically generates PWA icons from the uploaded favicon

### 3.9 Admin Consent (`/admin/consent`) — permission: `consent`
- Configure the consent popup: headline, description, consent text, button label, fields (first name, last name, email, phone), discount percentage
- Enable/disable the popup
- View all consent signups with timestamps
- Audit trail of who opted in and when

### 3.10 Admin International Pricing (`/admin/pricing`) — permission: `pricing`
- Manage exchange rates for all supported currencies (INR, USD, GBP, EUR, AED, AUD, CAD, SGD)
- Set per-currency markup percentage and rounding rules
- Enable/disable currencies for display

### 3.11 Admin Offers (`/admin/offers`) — permission: `offers`
- Configure Buy-X-Get-Y-Free tiers (e.g., Buy 2 Get 1 Free, Buy 3 Get 2 Free)
- Configure delivery fee tiers by item count
- Changes apply immediately at checkout and in the cart

### 3.12 Admin Audit Log (`/admin/audit-log`) — permission: `audit`
- Chronological log of all admin actions (product edits, order status changes, config updates, etc.)
- Shows who made the change, what entity was affected, and what changed
- Auto-pruned to keep log size manageable

### 3.13 Admin Export (`/admin/export`) — permission: `export`
- Export catalog tables as SQL dump or CSV
- Tables available: categories, products, tags, product images, product reviews

### 3.14 Admin Health Checks — permission: `health`

**Health Checks (`/admin/checks`)**
- Overview of all health check tools

**Deploy Check (`/admin/deploy-check`)**
- Verifies the live deployment is healthy (API reachable, config loaded, key routes responding)

**Data Check (`/admin/data-check`)**
- Validates data integrity within the database (no orphaned products, missing images, inconsistent states)

**DB Compare (`/admin/db-compare`)**
- Compares dev and production databases side-by-side for catalog tables (categories, products, tags, images, reviews)
- Shows what's only in dev, only in prod, and field-level mismatches
- "Sync to Prod" action to push dev catalog to production

### 3.15 Admin SEO Audit (`/admin/seo-audit`) — permission: `seo`
- Scans all products and categories for missing or thin SEO fields (title, description, slug issues)
- Lists problem items with links to fix them

### 3.16 Admin Users (`/admin/users`) — Superadmin only
- Create and manage sub-admin accounts
- Set granular permissions per user: builder, catalog, orders, customers, health, audit, pages, export, brand, consent, pricing, seo, offers
- Enable/disable accounts
- Reset passwords

### 3.17 Admin Security (`/admin/security`) — Superadmin only

**Rate Limit Configuration**
- Set request limits (max requests / time window) for three tiers:
  - Global: all `/api/*` endpoints
  - Moderate: cart mutations, wishlist writes
  - Strict: OTP, checkout, payment, consent, discount — sensitive actions
- Changes take effect immediately

**Alert Email**
- Configure an email address to receive alerts when blocks exceed a threshold in a 5-minute window
- Configurable cooldown between alerts to prevent inbox flooding

**Guest Cart Cleanup**
- Enable/disable automated daily cleanup of abandoned guest carts (no linked customer)
- Set retention period (default 30 days)
- Run cleanup manually at any time

**Security Report** (live, refreshes every 30 seconds)
- Live Snapshot:
  - Active admin and customer sessions
  - New customer signups in the last 7 days
  - Failed admin login attempts (last 1 hour and last 24 hours)
  - Last cart cleanup run (carts removed, time ago)
- Block History table: per-day rate-limit blocks broken down by tier (Global / Moderate / Strict), with a 7-day / 30-day toggle
- Recent cleanup history: last 20 cleanup runs with timestamp and carts removed

---

## 4. Notifications (Email)

All emails are sent via Resend. Triggered events:

| Event | Recipient | BCC-able |
|---|---|---|
| Order placed | Customer | Yes |
| Order confirmed (crafting started) | Customer | Yes |
| Order shipped | Customer | Yes |
| Order delivered | Customer | Yes |
| Order cancelled | Customer | Yes |
| Welcome coupon (consent opt-in) | Customer | Yes |
| Abandoned cart recovery (2h idle) | Customer | Yes |
| Security alert (rate-limit spike) | Admin | No |
| OTP code | Customer | Never |

---

## 5. Permission Reference

| Permission key | Controls access to |
|---|---|
| `builder` | Homepage builder |
| `catalog` | Products & categories |
| `orders` | Order management |
| `customers` | Customer list & profiles |
| `health` | Deploy check, data check, DB compare |
| `audit` | Audit log |
| `pages` | Policy page editor |
| `export` | SQL/CSV data export |
| `brand` | Logo & favicon upload |
| `consent` | Consent popup config & signups |
| `pricing` | Currency rates & rules |
| `seo` | SEO audit |
| `offers` | Discount tiers & delivery fees |
| *(superadmin only)* | Users, Security |

---

## 6. Database Tables Reference

| Table | Purpose |
|---|---|
| `categories` | Product categories (Towels, Bathrobes, Blankets) |
| `products` | Product catalog |
| `product_images` | Per-product image gallery |
| `product_reviews` | Customer reviews |
| `tags` | Product tags for filtering |
| `product_tags` | Many-to-many product ↔ tag |
| `product_variants` | Product variant metadata |
| `category_tag_variant_configs` | Variant option config per category/tag |
| `variant_sizes` | Available sizes with price add-ons |
| `variant_colors` | Available colors with swatch images |
| `carts` | Shopping carts (guest and customer) |
| `cart_items` | Line items in a cart |
| `orders` | Placed orders |
| `order_items` | Line items in an order |
| `customers` | Registered customer accounts |
| `customer_otps` | OTP codes for email login |
| `customer_sessions` | Active customer login sessions |
| `customer_consents` | Consent popup opt-in records |
| `wishlists` | Customer wishlisted products |
| `site_config` | Key-value store for all site configuration |
| `audit_logs` | Admin action audit trail |
| `currency_rates` | Exchange rates per currency |
| `pricing_rules` | Per-currency markup and rounding rules |
| `admin_users` | Sub-admin accounts with permissions |
| `rate_limit_stats` | Hourly rate-limit block counts per tier/category |
