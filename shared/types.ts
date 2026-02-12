export interface Category {
  id: number;
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

export interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  imageUrl: string;
  categoryId: number;
  active: boolean | null;
  sortOrder: number | null;
}

export interface InsertProduct {
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  imageUrl: string;
  categoryId: number;
  active?: boolean | null;
  sortOrder?: number | null;
}

export interface Cart {
  id: number;
  sessionId: string;
  createdAt: Date | null;
}

export interface InsertCart {
  sessionId: string;
}

export interface CartItem {
  id: number;
  cartId: number;
  productId: number;
  quantity: number;
  personalizationName: string | null;
}

export interface InsertCartItem {
  cartId: number;
  productId: number;
  quantity?: number;
  personalizationName?: string | null;
}

export interface Order {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  paymentId: string | null;
  paymentStatus: string | null;
  notes: string | null;
  createdAt: Date | null;
}

export interface InsertOrder {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  subtotal: number;
  discount?: number;
  total: number;
  status?: string;
  paymentId?: string | null;
  paymentStatus?: string | null;
  notes?: string | null;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity: number;
  personalizationName: string | null;
  isFree: boolean | null;
}

export interface InsertOrderItem {
  orderId: number;
  productId: number;
  productName: string;
  productPrice: number;
  quantity?: number;
  personalizationName?: string | null;
  isFree?: boolean | null;
}

export interface SiteConfig {
  id: number;
  key: string;
  value: string;
}

export interface InsertSiteConfig {
  key: string;
  value: string;
}
