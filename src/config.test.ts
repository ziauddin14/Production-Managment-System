import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './config';

describe('resolveApiBaseUrl', () => {
  it('defaults to the local API', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://127.0.0.1:4000');
    expect(resolveApiBaseUrl('')).toBe('http://127.0.0.1:4000');
  });
  it('treats "/" as same origin (Vercel /api rewrite)', () => {
    expect(resolveApiBaseUrl('/')).toBe('');
  });
  it('strips trailing slashes from absolute URLs', () => {
    expect(resolveApiBaseUrl('https://api.example.org//')).toBe('https://api.example.org');
  });
});
