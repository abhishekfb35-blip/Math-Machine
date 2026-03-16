import { z } from 'zod';

export const addToCartSchema = z.object({
  productId: z.string(),
  quantity: z.number().min(1).default(1),
  personalizationName: z.string().optional(),
  selectedColor: z.string().optional(),
  selectedSize: z.string().optional(),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().min(0),
  personalizationName: z.string().optional(),
});

export const checkoutSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(10),
  shippingAddress: z.string().min(1),
  shippingCity: z.string().min(1),
  shippingState: z.string().min(1),
  shippingPincode: z.string().min(6).max(6),
  notes: z.string().optional(),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
