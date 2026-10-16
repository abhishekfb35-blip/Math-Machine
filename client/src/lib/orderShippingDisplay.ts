export function formatOrderCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatShippingCharge(shippingFee: number): string {
  return shippingFee > 0 ? formatOrderCurrency(shippingFee) : "FREE";
}
