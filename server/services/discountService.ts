export interface PricingResult {
  subtotal: number;
  discount: number;
  total: number;
  freeIndices: number[];
}

export function calculateDiscount(items: { price: number; quantity: number }[]): PricingResult {
  const expanded: { price: number; originalIndex: number }[] = [];
  items.forEach((item, idx) => {
    for (let i = 0; i < item.quantity; i++) {
      expanded.push({ price: item.price, originalIndex: idx });
    }
  });

  const subtotal = expanded.reduce((sum, item) => sum + item.price, 0);
  const count = expanded.length;

  if (count < 3) {
    return { subtotal, discount: 0, total: subtotal, freeIndices: [] };
  }

  expanded.sort((a, b) => b.price - a.price);

  const numFree = Math.floor(count / 2);
  let discount = 0;
  const freeIndices: number[] = [];

  for (let i = count - 1; i >= count - numFree; i--) {
    discount += expanded[i].price;
    freeIndices.push(i);
  }

  return { subtotal, discount, total: subtotal - discount, freeIndices };
}
