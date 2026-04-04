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
  private uploadsDir: string;

  constructor(uploadsDir?: string) {
    this.uploadsDir = uploadsDir || path.join(process.cwd(), "uploads");
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
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
    return { url: `/images/products/${filename}`, filename };
  }

  async copy(sourceUrl: string): Promise<UploadResult> {
    const ext = path.extname(sourceUrl).toLowerCase() || ".jpg";
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const destPath = path.join(PRODUCT_IMAGES_DIR, filename);

    let srcPath: string;
    if (sourceUrl.startsWith("/images/products/")) {
      srcPath = path.join(PRODUCT_IMAGES_DIR, path.basename(sourceUrl));
    } else if (sourceUrl.startsWith("/uploads/")) {
      srcPath = path.join(this.uploadsDir, sourceUrl.slice("/uploads/".length));
    } else {
      srcPath = path.join(PRODUCT_IMAGES_DIR, path.basename(sourceUrl));
    }

    await fs.promises.copyFile(srcPath, destPath);
    const buffer = await fs.promises.readFile(destPath);
    try {
      await generateResizedVariants(buffer, filename);
    } catch (err) {
      console.warn(`[fileStorage] Resize failed for copy ${filename}:`, err);
    }
    return { url: `/images/products/${filename}`, filename };
  }

  async delete(url: string): Promise<void> {
    let filePath: string;
    if (url.startsWith("/images/products/")) {
      const basename = path.basename(url);
      filePath = path.join(PRODUCT_IMAGES_DIR, basename);
      for (const sizeName of Object.keys(RESIZE_SIZES)) {
        const variantPath = path.join(PRODUCT_IMAGES_DIR, sizeName, basename);
        try { await fs.promises.unlink(variantPath); } catch {}
      }
    } else if (url.startsWith("/uploads/")) {
      filePath = path.join(this.uploadsDir, url.slice("/uploads/".length));
    } else {
      return;
    }
    try {
      await fs.promises.unlink(filePath);
    } catch {}
  }

  getPublicUrl(storedPath: string): string {
    return storedPath;
  }

  getUploadsDir(): string {
    return this.uploadsDir;
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
