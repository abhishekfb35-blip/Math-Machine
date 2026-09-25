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

test("touch drags follow the finger and settle without opening zoom", async ({ page }) => {
  const product = await findProductWithMultipleImages();
  expect(product, "Expected an existing active product with multiple gallery images").toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/product/${product!.slug}`);

  const gallery = page.getByTestId("button-open-zoom");
  const mainImage = page.getByTestId("img-product-detail");
  const track = page.getByTestId("product-gallery-track");
  const firstThumbnail = page.getByTestId("button-thumbnail-0");
  const secondThumbnail = page.getByTestId("button-thumbnail-1");
  const zoomDialog = page.getByTestId("dialog-image-zoom");
  await expect(mainImage).toBeVisible();
  await expect(firstThumbnail).toHaveClass(/border-primary/);
  await expect(gallery).toHaveCSS("touch-action", "pan-y");
  await expect(track).toBeVisible();
  const galleryBox = await gallery.boundingBox();
  expect(galleryBox).toBeTruthy();
  const galleryLeft = galleryBox!.x;
  const galleryRight = galleryBox!.x + galleryBox!.width;
  const firstImageSrc = await mainImage.getAttribute("src");
  expect(firstImageSrc).toBeTruthy();

  const slideX = async (index: number) => {
    return page.getByTestId(`product-gallery-slide-${index}`).evaluate(element => element.getBoundingClientRect().x);
  };
  const pointer = { pointerId: 12, pointerType: "touch", isPrimary: true, button: 0 };
  const dispatchPointer = async (type: "pointerdown" | "pointermove" | "pointerup", x: number, y: number) => {
    await gallery.dispatchEvent(type, { ...pointer, clientX: x, clientY: y });
  };
  const dispatchClick = async (x: number, y: number) => {
    await gallery.dispatchEvent("click", { bubbles: true, detail: 1, clientX: x, clientY: y });
  };

  const firstSlideStartX = await slideX(0);
  await dispatchPointer("pointerdown", 300, 300);
  await dispatchPointer("pointermove", 240, 302);
  await expect.poll(() => slideX(0)).toBeLessThan(firstSlideStartX - 20);
  await expect.poll(() => slideX(1)).toBeLessThan(galleryRight - 20);
  await dispatchPointer("pointerup", 150, 305);
  await dispatchClick(150, 305);

  await expect(mainImage).not.toHaveAttribute("src", firstImageSrc!);
  await expect(secondThumbnail).toHaveClass(/border-primary/);
  await expect(zoomDialog).not.toBeVisible();
  await expect.poll(async () => Math.abs(await slideX(1) - galleryLeft)).toBeLessThan(2);
  const secondImageSrc = await mainImage.getAttribute("src");

  const secondSlideStartX = await slideX(1);
  await dispatchPointer("pointerdown", 200, 250);
  await dispatchPointer("pointermove", 205, 300);
  await expect.poll(async () => Math.abs(await slideX(1) - secondSlideStartX)).toBeLessThan(2);
  await dispatchPointer("pointerup", 205, 350);
  await expect(mainImage).toHaveAttribute("src", secondImageSrc!);
  await expect(secondThumbnail).toHaveClass(/border-primary/);

  await dispatchPointer("pointerdown", 200, 250);
  await dispatchPointer("pointermove", 180, 250);
  await expect.poll(() => slideX(1)).toBeLessThan(galleryLeft - 5);
  await dispatchPointer("pointerup", 180, 250);
  await dispatchClick(180, 250);
  await expect(mainImage).toHaveAttribute("src", secondImageSrc!);
  await expect(secondThumbnail).toHaveClass(/border-primary/);
  await expect(zoomDialog).not.toBeVisible();
  await expect.poll(async () => Math.abs(await slideX(1) - galleryLeft)).toBeLessThan(2);

  await dispatchPointer("pointerdown", 150, 305);
  await dispatchPointer("pointermove", 225, 305);
  await expect.poll(async () => (await slideX(0)) + galleryBox!.width).toBeGreaterThan(galleryLeft + 20);
  await dispatchPointer("pointerup", 300, 300);
  await dispatchClick(300, 300);
  await expect(mainImage).toHaveAttribute("src", firstImageSrc!);
  await expect(firstThumbnail).toHaveClass(/border-primary/);
  await expect(zoomDialog).not.toBeVisible();
  await expect.poll(async () => Math.abs(await slideX(0) - galleryLeft)).toBeLessThan(2);

  const firstSlideBeforeEdgePull = await slideX(0);
  await dispatchPointer("pointerdown", 150, 305);
  await dispatchPointer("pointermove", 250, 305);
  const edgePullDistance = await slideX(0) - firstSlideBeforeEdgePull;
  expect(edgePullDistance).toBeGreaterThan(5);
  expect(edgePullDistance).toBeLessThan(100);
  await dispatchPointer("pointerup", 250, 305);
  await dispatchClick(250, 305);
  await expect(mainImage).toHaveAttribute("src", firstImageSrc!);
  await expect(firstThumbnail).toHaveClass(/border-primary/);
  await expect(zoomDialog).not.toBeVisible();
  await expect.poll(async () => Math.abs(await slideX(0) - galleryLeft)).toBeLessThan(2);

  await gallery.click();
  await expect(zoomDialog).toBeVisible();
});