import path from "path";
import fs from "fs";
import crypto from "crypto";

export interface UploadResult {
  url: string;
  filename: string;
}

export interface IFileStorage {
  readonly name: string;
  upload(file: Buffer, originalName: string, mimeType: string): Promise<UploadResult>;
  copy(sourceUrl: string): Promise<UploadResult>;
  delete(url: string): Promise<void>;
  getPublicUrl(storedPath: string): string;
}

const PRODUCT_IMAGES_DIR = path.join(process.cwd(), "client", "public", "images", "products");
const RESIZE_SIZES: Record<string, number> = {
  small: 150,
  medium: 400,
  large: 800,
};

async function generateResizedVariants(buffer: Buffer, filename: string): Promise<void> {
  const sharp = (await import("sharp")).default;
  for (const [sizeName, width] of Object.entries(RESIZE_SIZES)) {
    const dir = path.join(PRODUCT_IMAGES_DIR, sizeName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const outPath = path.join(dir, filename);
    await sharp(buffer)
      .resize(width, null, { withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outPath);
  }
}

export class LocalFileStorage implements IFileStorage {
  readonly name = "local";

  constructor() {
    if (!fs.existsSync(PRODUCT_IMAGES_DIR)) {
      fs.mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });
    }
  }

  async upload(file: Buffer, originalName: string, _mimeType: string): Promise<UploadResult> {
    const ext = path.extname(originalName).toLowerCase() || ".jpg";
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const filePath = path.join(PRODUCT_IMAGES_DIR, filename);
    await fs.promises.writeFile(filePath, file);
    try {
      await generateResizedVariants(file, filename);
    } catch (err) {
      console.warn(`[fileStorage] Resize failed for ${filename}:`, err);
    }
    return { url: `/images/products/medium/${filename}`, filename };
  }

  async copy(sourceUrl: string): Promise<UploadResult> {
    const ext = path.extname(sourceUrl).toLowerCase() || ".jpg";
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const srcPath = path.join(PRODUCT_IMAGES_DIR, path.basename(sourceUrl));
    const destPath = path.join(PRODUCT_IMAGES_DIR, filename);
    await fs.promises.copyFile(srcPath, destPath);
    const buffer = await fs.promises.readFile(destPath);
    try {
      await generateResizedVariants(buffer, filename);
    } catch (err) {
      console.warn(`[fileStorage] Resize failed for copy ${filename}:`, err);
    }
    return { url: `/images/products/medium/${filename}`, filename };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith("/images/products/")) return;
    const basename = path.basename(url);
    for (const sizeName of Object.keys(RESIZE_SIZES)) {
      try { await fs.promises.unlink(path.join(PRODUCT_IMAGES_DIR, sizeName, basename)); } catch {}
    }
    try { await fs.promises.unlink(path.join(PRODUCT_IMAGES_DIR, basename)); } catch {}
  }

  getPublicUrl(storedPath: string): string {
    return storedPath;
  }
}

export function createFileStorage(): IFileStorage {
  const provider = process.env.FILE_STORAGE_PROVIDER || "local";

  switch (provider) {
    case "local":
      return new LocalFileStorage();
    default:
      console.warn(`Unknown file storage provider "${provider}", falling back to local`);
      return new LocalFileStorage();
  }
}

export const fileStorage = createFileStorage();
