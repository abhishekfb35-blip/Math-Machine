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

export class LocalFileStorage implements IFileStorage {
  readonly name = "local";
  private uploadsDir: string;

  constructor(uploadsDir?: string) {
    this.uploadsDir = uploadsDir || path.join(process.cwd(), "uploads");
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async upload(file: Buffer, originalName: string, _mimeType: string): Promise<UploadResult> {
    const ext = path.extname(originalName).toLowerCase();
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const filePath = path.join(this.uploadsDir, filename);
    await fs.promises.writeFile(filePath, file);
    return {
      url: `/uploads/${filename}`,
      filename,
    };
  }

  async copy(sourceUrl: string): Promise<UploadResult> {
    const sourceName = sourceUrl.startsWith("/uploads/") ? sourceUrl.slice("/uploads/".length) : path.basename(sourceUrl);
    const ext = path.extname(sourceName).toLowerCase();
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const sourcePath = path.join(this.uploadsDir, sourceName);
    const destPath = path.join(this.uploadsDir, filename);
    await fs.promises.copyFile(sourcePath, destPath);
    return {
      url: `/uploads/${filename}`,
      filename,
    };
  }

  async delete(url: string): Promise<void> {
    const filename = url.replace("/uploads/", "");
    const filePath = path.join(this.uploadsDir, filename);
    try {
      await fs.promises.unlink(filePath);
    } catch {
    }
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
