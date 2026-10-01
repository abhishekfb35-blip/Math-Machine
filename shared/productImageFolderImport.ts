export const productImageFolderExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"] as const;
export const maxProductImageFolderFiles = 100;
export const maxProductImageFileSize = 5 * 1024 * 1024;
export const maxProductImageFolderSize = 50 * 1024 * 1024;

export type ProductImageFileIdentity = {
  productId: string;
  extension: string;
  supported: boolean;
};

export type ProductImageFolderFile = {
  name: string;
  size: number;
};

export type ProductImageFolderPreviewRow = {
  name: string;
  productId: string;
  errors: string[];
};

export function productImageFileIdentity(fileName: string): ProductImageFileIdentity {
  const baseName = fileName.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = baseName.lastIndexOf(".");
  const extension = dot > 0 ? baseName.slice(dot).toLowerCase() : "";
  return {
    productId: dot > 0 ? baseName.slice(0, dot) : "",
    extension,
    supported: productImageFolderExtensions.includes(extension as typeof productImageFolderExtensions[number]),
  };
}

export function previewProductImageFolder(
  files: readonly ProductImageFolderFile[],
  knownProductIds: ReadonlySet<string> | undefined,
  sequenceText: string,
): { rows: ProductImageFolderPreviewRow[]; errors: string[] } {
  const errors: string[] = [];
  const sequence = /^\d+$/.test(sequenceText.trim()) ? Number(sequenceText) : NaN;
  const validSequence = Number.isSafeInteger(sequence) && sequence >= 2 && sequence <= 2147483647;

  if (files.length > maxProductImageFolderFiles) {
    errors.push(`Select no more than ${maxProductImageFolderFiles} images at a time.`);
  }
  if (files.reduce((total, file) => total + file.size, 0) > maxProductImageFolderSize) {
    errors.push("The selected images must total 50 MB or less.");
  }
  if (!validSequence) {
    errors.push("Sequence must be a whole number of 2 or greater.");
  }

  const identities = files.map(file => productImageFileIdentity(file.name));
  const duplicateIndices = new Set<number>();
  const firstByProduct = new Map<string, number>();
  identities.forEach((identity, index) => {
    if (!identity.productId) return;
    const first = firstByProduct.get(identity.productId);
    if (first !== undefined) {
      duplicateIndices.add(first);
      duplicateIndices.add(index);
    } else {
      firstByProduct.set(identity.productId, index);
    }
  });

  const rows = files.map((file, index): ProductImageFolderPreviewRow => {
    const identity = identities[index];
    const rowErrors: string[] = [];
    if (file.size === 0) rowErrors.push("Image file is empty.");
    if (!identity.supported) rowErrors.push("Use a .jpg, .jpeg, .png, .gif, or .webp file.");
    if (!identity.productId) rowErrors.push("Name the file with its product ID, such as product-id.jpg.");
    if (identity.productId && knownProductIds && !knownProductIds.has(identity.productId)) {
      rowErrors.push("Product ID not found.");
    }
    if (duplicateIndices.has(index)) rowErrors.push("Only one file per product can use this sequence.");
    if (file.size > maxProductImageFileSize) rowErrors.push("Each image must be 5 MB or smaller.");
    if (!validSequence) rowErrors.push("Sequence must be a whole number of 2 or greater.");
    return { name: file.name.replace(/\\/g, "/").split("/").pop() ?? file.name, productId: identity.productId, errors: rowErrors };
  });

  return { rows, errors };
}