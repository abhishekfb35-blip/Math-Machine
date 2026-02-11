type ImageSize = "small" | "medium" | "large";

export function getProductImageUrl(imageUrl: string, size: ImageSize = "large"): string {
  if (!imageUrl) return imageUrl;

  if (imageUrl.startsWith("/images/products/") && !imageUrl.includes("/small/") && !imageUrl.includes("/medium/") && !imageUrl.includes("/large/")) {
    const filename = imageUrl.replace("/images/products/", "");
    return `/images/products/${size}/${filename}`;
  }

  if (imageUrl.startsWith("/uploads/")) {
    return imageUrl;
  }

  return imageUrl;
}
