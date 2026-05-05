export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number | null;
}

export interface InsertCategory {
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number | null;
}

export interface AgeGroup {
  id: string;
  name: string;
  sortOrder: number | null;
}

export interface InsertAgeGroup {
  name: string;
  sortOrder?: number | null;
}

export interface Gender {
  id: string;
  name: string;
  sortOrder: number | null;
}

export interface InsertGender {
  name: string;
  sortOrder?: number | null;
}

export interface Theme {
  id: string;
  name: string;
  sortOrder: number | null;
}

export interface InsertTheme {
  name: string;
  sortOrder?: number | null;
}

export interface Style {
  id: string;
  name: string;
  sortOrder: number | null;
}

export interface InsertStyle {
  name: string;
  sortOrder?: number | null;
}

export interface Attributes {
  ageGroups: AgeGroup[];
  genders: Gender[];
  themes: Theme[];
  styles: Style[];
}

export interface Product {
  id: string;
  sku: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  mrp: number | null;
  imageUrl: string;
  categoryId: string;
  amazonAsin: string | null;
  color: string | null;
  material: string | null;
  gsm: number | null;
  dimensions: string | null;
  weightGrams: number | null;
  itemsInSet: number | null;
  specialFeatures: string | null;
  bulletPoints: string | null;
  searchKeywords: string | null;
  productType: string | null;
  ageGroups: string[];
  genders: string[];
  themes: string[];
  styles: string[];
  active: boolean | null;
  sortOrder: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  averageRating?: number;
  reviewCount?: number;
  tagNames?: string[];
}

export interface InsertProduct {
  sku?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  mrp?: number | null;
  imageUrl?: string | null;
  categoryId: string;
  amazonAsin?: string | null;
  color?: string | null;
  material?: string | null;
  gsm?: number | null;
  dimensions?: string | null;
  weightGrams?: number | null;
  itemsInSet?: number | null;
  specialFeatures?: string | null;
  bulletPoints?: string | null;
  searchKeywords?: string | null;
  productType?: string | null;
  active?: boolean | null;
  sortOrder?: number | null;
}

export interface Cart {
  id: string;
  sessionId: string;
  customerId: string | null;
  updatedAt: Date | null;
  abandonedEmailSentAt: Date | null;
  createdAt: Date | null;
}

export interface InsertCart {
  sessionId: string;
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  personalizationName: string | null;
  selectedColor: string | null;
  selectedSize: string | null;
}

export interface InsertCartItem {
  cartId: string;
  productId: string;
  quantity?: number;
  personalizationName?: string | null;
  selectedColor?: string | null;
  selectedSize?: string | null;
}

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPincode: string | null;
  googleId: string | null;
  avatarUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface InsertCustomer {
  email: string;
  name?: string | null;
  phone?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingPincode?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
}

export interface Order {
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  status: string;
  paymentId: string | null;
  razorpayOrderId: string | null;
  paymentStatus: string | null;
  currency: string | null;
  notes: string | null;
  emailStatus: unknown | null;
  courierPartner: string | null;
  serviceType: string | null;
  trackingNumber: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface InsertOrder {
  customerId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  subtotal: number;
  discount?: number;
  shippingFee?: number;
  total: number;
  status?: string;
  paymentId?: string | null;
  razorpayOrderId?: string | null;
  paymentStatus?: string | null;
  currency?: string | null;
  notes?: string | null;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  personalizationName: string | null;
  selectedColor: string | null;
  selectedSize: string | null;
  isFree: boolean | null;
  imageUrl?: string | null;
  sku?: string | null;
}

export interface InsertOrderItem {
  orderId: string;
  productId: string;
  productName: string;
  productPrice: number;
  quantity?: number;
  personalizationName?: string | null;
  selectedColor?: string | null;
  selectedSize?: string | null;
  isFree?: boolean | null;
}

export interface SiteConfig {
  key: string;
  value: string;
}

export interface InsertSiteConfig {
  key: string;
  value: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  imageUrl: string;
  sortOrder: number | null;
  isPrimary: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface InsertProductImage {
  productId: string;
  imageUrl: string;
  sortOrder?: number | null;
  isPrimary?: boolean | null;
}

export interface ProductReview {
  id: string;
  productId: string;
  customerId: string | null;
  reviewerName: string;
  rating: number;
  title: string | null;
  body: string;
  amzReviewDate: string | null;
  verifiedPurchase: boolean | null;
  createdAt: Date | null;
}

export interface InsertProductReview {
  productId: string;
  customerId?: string | null;
  reviewerName: string;
  rating: number;
  title?: string | null;
  body: string;
  amzReviewDate?: string | null;
  verifiedPurchase?: boolean | null;
}

export interface TagType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number | null;
}

export interface InsertTagType {
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number | null;
}

export interface Tag {
  id: string;
  name: string;
  description: string | null;
  tagTypeId: string | null;
  sortOrder: number | null;
}

export interface InsertTag {
  name: string;
  description?: string | null;
  tagTypeId?: string | null;
  sortOrder?: number | null;
}

export interface Occasion {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  boostTags: Record<string, number> | null;
  penaltyTags: Record<string, number> | null;
  preferredStyles: string | null;
  preferredThemes: string | null;
  active: boolean | null;
  sortOrder: number | null;
}

export interface InsertOccasion {
  name: string;
  slug: string;
  description?: string | null;
  boostTags?: Record<string, number> | null;
  penaltyTags?: Record<string, number> | null;
  preferredStyles?: string | null;
  preferredThemes?: string | null;
  active?: boolean | null;
  sortOrder?: number | null;
}

export interface ProductTag {
  id: string;
  productId: string;
  tagId: string;
}

export interface InsertProductTag {
  productId: string;
  tagId: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  action: string;
  changes: string | null;
  username: string;
  createdAt: Date | null;
}

export interface InsertAuditLog {
  entityType: string;
  entityId: string;
  entityName?: string | null;
  action: string;
  changes?: string | null;
  username: string;
}

export interface CustomerConsent {
  id: string;
  customerId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  consentType: string;
  consentGiven: boolean;
  discountCode: string | null;
  discountUsed: boolean | null;
  ipAddress: string | null;
  userAgent: string | null;
  pageUrl: string | null;
  consentMethod: string | null;
  consentText: string | null;
  consentedAt: Date | null;
  revokedAt: Date | null;
}

export interface InsertCustomerConsent {
  customerId?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  consentType: string;
  consentGiven: boolean;
  discountCode?: string | null;
  discountUsed?: boolean | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  pageUrl?: string | null;
  consentMethod?: string | null;
  consentText?: string | null;
}

export interface ColorOption {
  name: string;
  hexCode: string;
  blurOnFront: boolean;
  hideFromFront: boolean;
}

export interface SizeOption {
  name: string;
  value: string;
  description?: string;
  isDefault: boolean;
  blurOnFront: boolean;
  hideFromFront: boolean;
}

export interface CategoryVariantOptions {
  categoryId: string;
  colors: ColorOption[];
  sizes: SizeOption[];
}

export interface VariantColor {
  id: string;
  name: string;
  swatchUrl?: string;
  blurOnFront: boolean;
  sortOrder: number;
}

export interface VariantSize {
  id: string;
  name: string;
  description?: string;
  descriptionFontSize?: number;
  priceAdd: number;
  isDefault: boolean;
  blurOnFront: boolean;
  sortOrder: number;
  colors: VariantColor[];
}

export interface CategoryTagVariantConfig {
  id: string;
  categoryId: string;
  tagId: string | null;
  sortOrder: number;
  sizes: VariantSize[];
}

export interface ProductVariantOptions {
  productId: string;
  sizes: VariantSize[];
}

export interface ProductVariant {
  id: string;
  productId: string;
  color: string;
  size: string;
  available: boolean;
}

export interface InsertProductVariant {
  productId: string;
  color: string;
  size: string;
  available?: boolean;
}

export interface CurrencyRate {
  id: string;
  currency: string;
  rateFromInr: number;
  updatedAt: Date;
}

export interface InsertCurrencyRate {
  currency: string;
  rateFromInr: number;
}

export interface PricingRule {
  id: string;
  currency: string;
  symbol: string;
  displayName: string | null;
  markupPercent: number;
  roundingRule: string;
  enabled: boolean;
}

export interface InsertPricingRule {
  currency: string;
  symbol: string;
  displayName?: string | null;
  markupPercent?: number;
  roundingRule?: string;
  enabled?: boolean;
}

export interface Wishlist {
  id: string;
  customerId: string;
  productId: string;
  createdAt: Date | null;
}

export interface InsertWishlist {
  customerId: string;
  productId: string;
}

export interface AdminUser {
  id: string;
  username: string;
  passwordHash: string;
  permissions: string[];
  isActive: boolean;
  createdAt: Date | null;
}

export interface InsertAdminUser {
  username: string;
  passwordHash: string;
  permissions?: string[];
  isActive?: boolean;
}

export interface RateLimitStats {
  id: string;
  tier: string;
  endpointCategory: string;
  bucketHour: Date;
  blockCount: number;
  createdAt: Date | null;
}

export interface InsertRateLimitStats {
  tier: string;
  endpointCategory: string;
  bucketHour: Date;
  blockCount: number;
}
