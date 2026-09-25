import { test, expect } from "@playwright/test";
import { storage } from "../server/storage";

async function findProductWithMultipleImages() {
  const products = await storage.getProducts();
  const categoryIds = [...new Set(products.map(product => product.categoryId))];

  for (const categoryId of categoryIds) {
    const imagesByProduct = await storage.getProductImagesByCategory(categoryId);
    const product = products.find(item =>
      item.categoryId === categoryId
      && item.imageUrl
      && (imagesByProduct[item.id] ?? []).some(image => image.imageUrl !== item.imageUrl),
    );
    if (product) return product;
  }

  return undefined;
}

test("touch swipes navigate the product gallery without opening zoom", async ({ page }) => {
  const product = await findProductWithMultipleImages();
  expect(product, "Expected an existing active product with multiple gallery images").toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/product/${product!.slug}`);

  const gallery = page.getByTestId("button-open-zoom");
  const mainImage = page.getByTestId("img-product-detail");
  const firstThumbnail = page.getByTestId("button-thumbnail-0");
  const secondThumbnail = page.getByTestId("button-thumbnail-1");
  const zoomDialog = page.getByTestId("dialog-image-zoom");
  await expect(mainImage).toBeVisible();
  await expect(firstThumbnail).toHaveClass(/border-primary/);
  await expect(gallery).toHaveCSS("touch-action", "pan-y");
  const firstImageSrc = await mainImage.getAttribute("src");
  expect(firstImageSrc).toBeTruthy();

  const swipe = async (startX: number, startY: number, endX: number, endY: number, dispatchClick: boolean) => {
    const pointer = { pointerId: 12, pointerType: "touch", isPrimary: true, button: 0 };
    await gallery.dispatchEvent("pointerdown", { ...pointer, clientX: startX, clientY: startY });
    await gallery.dispatchEvent("pointerup", { ...pointer, clientX: endX, clientY: endY });
    if (dispatchClick) {
      await gallery.dispatchEvent("click", { bubbles: true, detail: 1, clientX: endX, clientY: endY });
    }
  };

  await swipe(300, 300, 150, 305, true);
  await expect(mainImage).not.toHaveAttribute("src", firstImageSrc!);
  await expect(secondThumbnail).toHaveClass(/border-primary/);
  await expect(zoomDialog).not.toBeVisible();
  const secondImageSrc = await mainImage.getAttribute("src");

  await swipe(200, 250, 205, 350, false);
  await expect(mainImage).toHaveAttribute("src", secondImageSrc!);
  await expect(secondThumbnail).toHaveClass(/border-primary/);

  await swipe(150, 305, 300, 300, true);
  await expect(mainImage).toHaveAttribute("src", firstImageSrc!);
  await expect(firstThumbnail).toHaveClass(/border-primary/);
  await expect(zoomDialog).not.toBeVisible();

  await gallery.click();
  await expect(zoomDialog).toBeVisible();
});