import { z } from 'zod';
import { ApiError, apiRequest } from './api';
import type { DocumentRef } from './contracts/operations';

/** Mirror of the backend upload contract (backend: `src/contracts/operations.ts`). */
export const uploadPurposes = ['dispatch', 'payment', 'receipt', 'purchase-order'] as const;
export type UploadPurpose = (typeof uploadPurposes)[number];

export const uploadConfigSchema = z.object({ enabled: z.boolean() });
export const uploadSignatureSchema = z.object({
  uploadUrl: z.string().url(),
  apiKey: z.string(),
  timestamp: z.string(),
  folder: z.string(),
  allowedFormats: z.string(),
  signature: z.string(),
  maxBytes: z.number().int(),
});
export type UploadSignature = z.infer<typeof uploadSignatureSchema>;

const cloudinaryResponseSchema = z.object({ secure_url: z.string().url() });

let configPromise: Promise<boolean> | null = null;

/** Whether image upload is set up on the server (cached for the page's lifetime). */
export function uploadsEnabled(): Promise<boolean> {
  configPromise ??= apiRequest('/api/uploads/config', uploadConfigSchema)
    .then((c) => c.enabled)
    .catch(() => {
      configPromise = null; // try again next time
      return false;
    });
  return configPromise;
}

/** Test hook: forget the cached setting. */
export function resetUploadConfigCache(): void {
  configPromise = null;
}

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Makes phone photos small before upload (longest side 1600 px, JPEG). PDFs, and images the
 * browser cannot decode (e.g. HEIC outside Safari), are sent unchanged.
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Name for the document row: the file name without its extension. */
export function labelFromFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return (base || 'Photo').slice(0, 100);
}

/**
 * Uploads one photo or PDF straight from the browser to Cloudinary, using a short-lived signature
 * from the PMS server (the Cloudinary secret never reaches the browser). Returns the document
 * reference to store with the record.
 */
export async function uploadDocument(
  file: File,
  purpose: UploadPurpose,
  csrfToken: string,
): Promise<DocumentRef> {
  const signed = await apiRequest('/api/uploads/signature', uploadSignatureSchema, {
    method: 'POST',
    body: { purpose },
    csrfToken,
  });
  const body = await prepareImage(file);
  if (body.size > signed.maxBytes) {
    throw new ApiError(
      413,
      'PAYLOAD_TOO_LARGE',
      `The file is too large (max ${Math.round(signed.maxBytes / 1024 / 1024)} MB).`,
    );
  }
  const form = new FormData();
  form.append('file', body, file.name);
  form.append('api_key', signed.apiKey);
  form.append('timestamp', signed.timestamp);
  form.append('folder', signed.folder);
  form.append('allowed_formats', signed.allowedFormats);
  form.append('signature', signed.signature);

  let response: Response;
  try {
    response = await fetch(signed.uploadUrl, { method: 'POST', body: form });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'The photo could not be uploaded. Check the connection.',
    );
  }
  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      'UPLOAD_FAILED',
      response.status === 400
        ? 'This file type is not accepted. Use a photo (JPG, PNG, WEBP, HEIC) or a PDF.'
        : 'The photo could not be uploaded. Please try again.',
    );
  }
  const parsed = cloudinaryResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(502, 'UPLOAD_FAILED', 'The upload service gave an unexpected answer.');
  }
  return { label: labelFromFileName(file.name), url: parsed.data.secure_url };
}

/** True for links that show a picture (uploaded photos or links ending in an image type). */
export function isImageUrl(url: string): boolean {
  return (
    (/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url) && !/\.pdf$/i.test(url)) ||
    /\.(jpe?g|png|webp|gif)$/i.test(url)
  );
}

/** A small preview of a Cloudinary image (other links are used as they are). */
export function thumbnailUrl(url: string): string {
  return url.replace(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)/,
    '$1c_limit,w_320,q_auto,f_auto/',
  );
}
