import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DocumentList } from './components/Documents';
import { json, mockApi } from './test/mockApi';
import {
  isImageUrl,
  labelFromFileName,
  resetUploadConfigCache,
  thumbnailUrl,
  uploadDocument,
  uploadsEnabled,
} from './uploads';

afterEach(() => {
  vi.unstubAllGlobals();
  resetUploadConfigCache();
});

// Synthetic, non-working values only.
const signature = {
  uploadUrl: 'https://api.cloudinary.com/v1_1/synthetic-cloud/auto/upload',
  apiKey: '123456789012345',
  timestamp: '1767225600',
  folder: 'mab-pms/dispatch',
  allowedFormats: 'jpg,jpeg,png,webp,heic,pdf',
  signature: 'synthetic-signature',
  maxBytes: 10 * 1024 * 1024,
};
const photoUrl =
  'https://res.cloudinary.com/synthetic-cloud/image/upload/v1/mab-pms/dispatch/a.jpg';

describe('photo uploads', () => {
  it('asks the server whether uploads are set up', async () => {
    mockApi({ 'GET /api/uploads/config': json(200, { enabled: true }) });
    expect(await uploadsEnabled()).toBe(true);
  });

  it('treats an unreachable or unset server as uploads disabled', async () => {
    mockApi({});
    expect(await uploadsEnabled()).toBe(false);
  });

  it('gets a signature with the CSRF token, then sends the file straight to Cloudinary', async () => {
    const { calls } = mockApi({
      'POST /api/uploads/signature': json(200, signature),
      'POST /v1_1/synthetic-cloud/auto/upload': json(200, { secure_url: photoUrl }),
    });
    const file = new File(['synthetic'], 'Synthetic Bilty.jpg', { type: 'image/jpeg' });
    const doc = await uploadDocument(file, 'dispatch', 'synthetic-csrf');
    expect(doc).toEqual({ label: 'Synthetic Bilty', url: photoUrl });

    const signCall = calls.find((c) => c.path === '/api/uploads/signature');
    expect((signCall?.init?.headers as Record<string, string>)['X-CSRF-Token']).toBe(
      'synthetic-csrf',
    );
    expect(JSON.parse(String(signCall?.init?.body))).toEqual({ purpose: 'dispatch' });
    const upload = calls.find((c) => c.path.endsWith('/auto/upload'));
    const form = upload?.init?.body as FormData;
    expect(form.get('signature')).toBe('synthetic-signature');
    expect(form.get('folder')).toBe('mab-pms/dispatch');
    expect(form.get('api_key')).toBe('123456789012345');
    // The browser never sends cookies or the CSRF token to Cloudinary.
    expect(upload?.init?.credentials).toBeUndefined();
    expect(upload?.init?.headers).toBeUndefined();
  });

  it('explains a rejected file type', async () => {
    mockApi({
      'POST /api/uploads/signature': json(200, signature),
      'POST /v1_1/synthetic-cloud/auto/upload': json(400, { error: { message: 'x' } }),
    });
    const file = new File(['x'], 'synthetic.exe', { type: 'application/octet-stream' });
    await expect(uploadDocument(file, 'payment', 'synthetic-csrf')).rejects.toThrow(
      /file type is not accepted/,
    );
  });

  it('recognises photos and builds small previews', () => {
    expect(isImageUrl(photoUrl)).toBe(true);
    expect(isImageUrl('https://drive.google.com/file/d/x/view')).toBe(false);
    expect(isImageUrl('https://res.cloudinary.com/c/image/upload/v1/a.pdf')).toBe(false);
    expect(thumbnailUrl(photoUrl)).toBe(
      'https://res.cloudinary.com/synthetic-cloud/image/upload/c_limit,w_320,q_auto,f_auto/v1/mab-pms/dispatch/a.jpg',
    );
    expect(labelFromFileName('.jpg')).toBe('Photo');
  });

  it('shows uploaded photos as thumbnails and other documents as links', () => {
    render(
      <DocumentList
        documents={[
          { label: 'Synthetic Bilty', url: photoUrl },
          { label: 'Synthetic Drive file', url: 'https://drive.google.com/file/d/x/view' },
        ]}
      />,
    );
    const photos = screen.getByRole('list', { name: 'Photos' });
    expect(within(photos).getByRole('img', { name: 'Synthetic Bilty' })).toHaveAttribute(
      'src',
      thumbnailUrl(photoUrl),
    );
    expect(screen.getByRole('link', { name: 'Synthetic Drive file' })).toHaveAttribute(
      'href',
      'https://drive.google.com/file/d/x/view',
    );
  });
});
