import { test, expect, type Page } from "@playwright/test";

type Product = {
  id: string;
  sku: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  mrp: number | null;
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
  active: boolean | null;
  sortOrder: number | null;
  variantColors: string;
  variantSizes: string;
  wholesalePrice: number | null;
  imageUrl?: string | null;
};

type ProductImage = {
  imageUrl: string;
  sortOrder: number | null;
  isPrimary: boolean | null;
};

type ProductSnapshot = {
  product: Record<string, unknown>;
  tagIds: string[];
  audienceIds: string[];
  genderIds: string[];
  themeIds: string[];
  styleIds: string[];
  images: Array<Pick<ProductImage, "imageUrl" | "sortOrder" | "isPrimary">>;
  variants: Array<{ color: string; size: string; available: boolean }>;
};

const PRODUCT_COPY_FIELDS: Array<keyof Product> = [
  "description",
  "price",
  "mrp",
  "categoryId",
  "amazonAsin",
  "color",
  "material",
  "gsm",
  "dimensions",
  "weightGrams",
  "itemsInSet",
  "specialFeatures",
  "bulletPoints",
  "searchKeywords",
  "productType",
  "active",
  "sortOrder",
  "variantColors",
  "variantSizes",
  "wholesalePrice",
  "imageUrl",
];

async function json<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(path);
  expect(response.ok(), `GET ${path} should succeed`).toBeTruthy();
  return response.json() as Promise<T>;
}

async function snapshotProduct(page: Page, productId: string): Promise<ProductSnapshot> {
  const [product, tags, attributes, images, variants] = await Promise.all([
    json<Product>(page, `/api/admin/products/${productId}`),
    json<Array<{ id: string }>>(page, `/api/admin/products/${productId}/tags`),
    json<{
      audienceIds?: string[];
      genderIds?: string[];
      themeIds?: string[];
      styleIds?: string[];
    }>(page, `/api/admin/products/${productId}/attributes`),
    json<ProductImage[]>(page, `/api/products/${productId}/images`),
    json<Array<{ color: string; size: string; available: boolean }>>(
      page,
      `/api/admin/products/${productId}/variants`,
    ),
  ]);

  return {
    product: Object.fromEntries(
      PRODUCT_COPY_FIELDS.map(field => [field, product[field]]),
    ),
    tagIds: tags.map(tag => tag.id).sort(),
    audienceIds: [...(attributes.audienceIds ?? [])].sort(),
    genderIds: [...(attributes.genderIds ?? [])].sort(),
    themeIds: [...(attributes.themeIds ?? [])].sort(),
    styleIds: [...(attributes.styleIds ?? [])].sort(),
    images: images
      .map(({ imageUrl, sortOrder, isPrimary }) => ({ imageUrl, sortOrder, isPrimary }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    variants: variants
      .map(({ color, size, available }) => ({ color, size, available }))
      .sort((a, b) => `${a.color}:${a.size}`.localeCompare(`${b.color}:${b.size}`)),
  };
}

function expectedCopySlug(sourceSlug: string, existingSlugs: string[]): string {
  const slugs = new Set(existingSlugs);
  const baseSlug = `${sourceSlug}-copy`;
  let slug = baseSlug;
  for (let suffix = 2; slugs.has(slug); suffix++) {
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}

async function openCopyDraft(page: Page, productId: string): Promise<Page> {
  page.once("dialog", dialog => dialog.accept());
  const pagesBefore = page.context().pages().length;
  const newPagePromise = page.context().waitForEvent("page");
  await page.getByTestId(`button-copy-product-${productId}`).click();
  const draftPage = await newPagePromise;

  expect(page.context().pages()).toHaveLength(pagesBefore + 1);
  await draftPage.waitForURL(/\/admin\/catalog\/product\/new\?copyFrom=/);
  await draftPage.waitForLoadState("domcontentloaded");
  await expect(draftPage.getByTestId("page-admin-product-edit")).toBeVisible({
    timeout: 15_000,
  });

  // The copy handler focuses the popup synchronously after opening it.
  await expect.poll(() => draftPage.evaluate(() => document.hasFocus())).toBe(true);
  return draftPage;
}

test.describe("Admin product copy drafts", () => {
  test("opens a focused unsaved copy, discards it cleanly, and saves staged relationships", async ({
    page,
  }) => {
    test.skip(
      !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD,
      "ADMIN_USERNAME and ADMIN_PASSWORD are required for the authenticated catalog flow",
    );

    const loginResponse = await page.request.post("/api/admin/login", {
      data: {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      },
    });
    expect(loginResponse.ok(), "admin login should succeed").toBeTruthy();

    const session = await json<{
      authenticated: boolean;
      isSuperAdmin: boolean;
      permissions: string[];
    }>(page, "/api/admin/check");
    expect(session.authenticated).toBe(true);
    expect(session.isSuperAdmin || session.permissions.includes("catalog")).toBe(true);

    const [products, categories] = await Promise.all([
      json<Product[]>(page, "/api/admin/products"),
      json<Array<{ id: string; name: string }>>(page, "/api/admin/categories"),
    ]);
    expect(products.length, "the catalog needs a source product").toBeGreaterThan(0);

    const source = products.find(product => product.categoryId && product.name) ?? products[0];
    const sourceCategory = categories.find(category => category.id === source.categoryId);
    expect(sourceCategory).toBeTruthy();

    const sourceDetails = await json<Product>(page, `/api/admin/products/${source.id}`);
    const sourceSnapshot = await snapshotProduct(page, source.id);
    const sourceCount = products.length;
    const sourceSlugs = products.map(product => product.slug);
    const expectedSlug = expectedCopySlug(source.slug, sourceSlugs);
    let draftPages: Page[] = [];
    let createdProductId: string | undefined;

    try {
      await page.goto("/admin/catalog");
      await expect(page.getByTestId("text-cms-title")).toBeVisible();
      // Click the category label so the card's nested repository controls do not
      // receive the click on the narrow mobile layout.
      await page.getByTestId(`text-category-name-${source.categoryId}`).click();
      await expect(page.getByTestId("text-products-title")).toHaveText(sourceCategory!.name);

      const categoryFilter = page.getByTestId("input-category-filter");
      await categoryFilter.fill(source.name);
      const sourceCard = page.getByTestId(`card-product-${source.id}`);
      await expect(sourceCard).toBeVisible();

      const firstDraft = await openCopyDraft(page, source.id);
      draftPages.push(firstDraft);
      await expect(firstDraft).toHaveURL(
        new RegExp(`/admin/catalog/product/new\\?copyFrom=${source.id}`),
      );
      await expect(firstDraft.getByTestId("badge-unsaved-product-draft")).toBeVisible();
      await expect(firstDraft.getByTestId("button-save-product")).toHaveText("Create");
      await expect(firstDraft.getByTestId("input-product-name")).toHaveValue(
        `${sourceDetails.name} (Copy)`,
      );
      await expect(firstDraft.getByTestId("input-product-slug")).toHaveValue(expectedSlug);
      await expect(firstDraft.getByTestId("input-product-description")).toHaveValue(
        (sourceDetails.description ?? "").replace(/\r\n?/g, "\n"),
      );
      await expect(firstDraft.getByTestId("input-product-price")).toHaveValue(
        String(sourceDetails.price),
      );
      await expect(firstDraft.getByTestId("input-product-mrp")).toHaveValue(
        sourceDetails.mrp == null ? "" : String(sourceDetails.mrp),
      );
      await expect(firstDraft.getByTestId("input-product-material")).toHaveValue(
        sourceDetails.material ?? "",
      );
      await expect(firstDraft.getByTestId("input-product-color")).toHaveValue(
        sourceDetails.color ?? "",
      );

      await firstDraft.getByTestId("button-close-tab").click();
      await expect.poll(() => page.context().pages().length).toBe(1);
      draftPages = [];

      const afterDiscardProducts = await json<Product[]>(page, "/api/admin/products");
      expect(afterDiscardProducts).toHaveLength(sourceCount);
      expect(await snapshotProduct(page, source.id)).toEqual(sourceSnapshot);

      const secondDraft = await openCopyDraft(page, source.id);
      draftPages.push(secondDraft);
      await expect(secondDraft.getByTestId("badge-unsaved-product-draft")).toBeVisible();

      const createResponse = secondDraft.waitForResponse(response =>
        response.url().endsWith("/api/admin/products/from-draft") &&
        response.request().method() === "POST",
      );
      await secondDraft.getByTestId("button-save-product").click();
      expect((await createResponse).status()).toBe(201);
      await secondDraft.waitForURL(/\/admin\/catalog\/product\/(?!new)/);

      const createdUrl = new URL(secondDraft.url());
      createdProductId = createdUrl.pathname.split("/").pop();
      expect(createdProductId).toBeTruthy();

      const [afterSaveProducts, createdSnapshot] = await Promise.all([
        json<Product[]>(page, "/api/admin/products"),
        snapshotProduct(page, createdProductId!),
      ]);
      expect(afterSaveProducts).toHaveLength(sourceCount + 1);
      expect(createdSnapshot.product).toEqual(sourceSnapshot.product);
      expect(createdSnapshot.tagIds).toEqual(sourceSnapshot.tagIds);
      expect(createdSnapshot.audienceIds).toEqual(sourceSnapshot.audienceIds);
      expect(createdSnapshot.genderIds).toEqual(sourceSnapshot.genderIds);
      expect(createdSnapshot.themeIds).toEqual(sourceSnapshot.themeIds);
      expect(createdSnapshot.styleIds).toEqual(sourceSnapshot.styleIds);
      expect(createdSnapshot.images).toEqual(sourceSnapshot.images);
      expect(createdSnapshot.variants).toEqual(sourceSnapshot.variants);
      expect(await snapshotProduct(page, source.id)).toEqual(sourceSnapshot);
    } finally {
      for (const draftPage of draftPages) {
        if (!draftPage.isClosed()) await draftPage.close();
      }
      if (createdProductId) {
        const deleteResponse = await page.request.delete(
          `/api/admin/products/${createdProductId}`,
        );
        expect(deleteResponse.ok(), "test copy cleanup should succeed").toBeTruthy();
      }
    }
  });
});