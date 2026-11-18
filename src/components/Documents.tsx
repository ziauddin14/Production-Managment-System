import { useEffect, useRef, useState } from 'react';
import { Camera, ExternalLink, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { ApiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { DocumentRef } from '../contracts/operations';
import {
  isImageUrl,
  thumbnailUrl,
  uploadDocument,
  uploadsEnabled,
  type UploadPurpose,
} from '../uploads';
import { FieldError, inputClass, secondaryButton } from './ui';

export interface DocumentRow {
  key: string;
  label: string;
  url: string;
}

let docSeq = 0;
export const newDocumentRow = (doc?: DocumentRef): DocumentRow => ({
  key: `doc-${(docSeq += 1)}`,
  label: doc?.label ?? '',
  url: doc?.url ?? '',
});

/** Client-side checks that mirror the server rules for supporting-document links. */
export function validateDocuments(rows: DocumentRow[], errors: Record<string, string>): void {
  rows.forEach((row, index) => {
    if (!row.label.trim()) errors[`documents.${index}.label`] = 'Document name is required';
    if (!/^https:\/\/\S+$/i.test(row.url.trim()))
      errors[`documents.${index}.url`] = 'Link must start with https://';
  });
  if (rows.length > 20) errors.documents = 'At most 20 documents';
}

export function documentsPayload(rows: DocumentRow[]): DocumentRef[] {
  return rows.map((row) => ({ label: row.label.trim(), url: row.url.trim() }));
}

const MAX_DOCUMENTS = 20;

/**
 * Edits supporting documents: upload photos / PDFs (stored in Cloudinary when uploads are set
 * up), or paste links to files kept elsewhere, e.g. Google Drive. The PMS stores name and link.
 */
export function DocumentsEditor({
  rows,
  onChange,
  errors,
  uploadPurpose,
  hint = 'e.g. Bilty photo',
}: {
  rows: DocumentRow[];
  onChange(rows: DocumentRow[]): void;
  errors: Record<string, string>;
  /** Shows the upload button; files go to this purpose's folder. */
  uploadPurpose?: UploadPurpose;
  /** Example document name shown as a placeholder. */
  hint?: string;
}) {
  const { session, handleApiError } = useAuth();
  const [canUpload, setCanUpload] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Uploads finish one by one; always append to the latest rows.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    if (!uploadPurpose) return;
    let active = true;
    void uploadsEnabled().then((enabled) => {
      if (active) setCanUpload(enabled);
    });
    return () => {
      active = false;
    };
  }, [uploadPurpose]);

  const update = (key: string, patch: Partial<DocumentRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const onFiles = async (files: FileList | null) => {
    if (!files || !uploadPurpose || !session) return;
    const list = Array.from(files).slice(0, MAX_DOCUMENTS - rowsRef.current.length);
    setUploadError(null);
    for (const file of list) {
      setUploading((n) => n + 1);
      try {
        const doc = await uploadDocument(file, uploadPurpose, session.csrfToken);
        const next = [...rowsRef.current, newDocumentRow(doc)];
        rowsRef.current = next;
        onChange(next);
      } catch (error) {
        if (handleApiError(error)) return;
        setUploadError(
          `${file.name}: ${error instanceof ApiError ? error.message : 'The file could not be uploaded.'}`,
        );
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const showUpload = Boolean(uploadPurpose) && canUpload;

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-700">Supporting documents</legend>
      <p className="text-xs text-slate-500">
        {showUpload
          ? 'Upload photos or PDFs (for example a Bilty or challan photo), or add a link (https://) to a file stored elsewhere, e.g. Google Drive.'
          : 'Add links (https://) to scanned documents stored elsewhere, e.g. Google Drive. Files are not uploaded to PMS.'}
      </p>
      {errors.documents && <p className="text-xs text-red-700">{errors.documents}</p>}
      {rows.map((row, index) => {
        const n = index + 1;
        const labelError = errors[`documents.${index}.label`];
        const urlError = errors[`documents.${index}.url`];
        return (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[auto_1fr_2fr_auto] sm:items-start">
            <DocumentPreview url={row.url} label={row.label} />
            <div>
              <input
                type="text"
                value={row.label}
                maxLength={100}
                onChange={(e) => update(row.key, { label: e.target.value })}
                placeholder={`Document name, ${hint}`}
                aria-label={`Document ${n} name`}
                aria-invalid={Boolean(labelError)}
                aria-describedby={labelError ? `doc-${row.key}-label-error` : undefined}
                className={inputClass(Boolean(labelError))}
              />
              <FieldError id={`doc-${row.key}-label-error`} message={labelError} />
            </div>
            <div>
              <input
                type="url"
                value={row.url}
                maxLength={1000}
                onChange={(e) => update(row.key, { url: e.target.value })}
                placeholder="https://"
                aria-label={`Document ${n} link`}
                aria-invalid={Boolean(urlError)}
                aria-describedby={urlError ? `doc-${row.key}-url-error` : undefined}
                className={inputClass(Boolean(urlError))}
              />
              <FieldError id={`doc-${row.key}-url-error`} message={urlError} />
            </div>
            <button
              type="button"
              onClick={() => onChange(rows.filter((r) => r.key !== row.key))}
              className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label={`Remove document ${n}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
      {uploadError && (
        <p className="text-xs text-red-700" role="alert">
          {uploadError}
        </p>
      )}
      {rows.length < MAX_DOCUMENTS && (
        <div className="flex flex-wrap gap-2">
          {showUpload && (
            <>
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="sr-only"
                id={`upload-${uploadPurpose}`}
                aria-label="Upload photo or PDF"
                onChange={(e) => void onFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading > 0}
                className={secondaryButton}
              >
                {uploading > 0 ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="h-4 w-4" aria-hidden="true" />
                )}
                {uploading > 0 ? 'Uploading…' : 'Upload photo / PDF'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => onChange([...rows, newDocumentRow()])}
            className={secondaryButton}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add document link
          </button>
        </div>
      )}
    </fieldset>
  );
}

function DocumentPreview({ url, label }: { url: string; label: string }) {
  if (url && isImageUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={thumbnailUrl(url)}
          alt={label || 'Uploaded photo'}
          loading="lazy"
          className="h-10 w-10 rounded border border-slate-200 object-cover"
        />
      </a>
    );
  }
  return (
    <span className="hidden h-10 w-10 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-400 sm:flex">
      <FileText className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

export function DocumentList({ documents }: { documents: DocumentRef[] }) {
  if (documents.length === 0) return <p className="text-sm text-slate-500">No documents linked.</p>;
  const images = documents.filter((doc) => isImageUrl(doc.url));
  const others = documents.filter((doc) => !isImageUrl(doc.url));
  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-3" aria-label="Photos">
          {images.map((doc, index) => (
            <li key={`${doc.url}-${index}`}>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-36 text-xs font-medium text-emerald-800 hover:underline"
              >
                <img
                  src={thumbnailUrl(doc.url)}
                  alt={doc.label}
                  loading="lazy"
                  className="mb-1 h-28 w-36 rounded-md border border-slate-200 object-cover print:h-40 print:w-auto"
                />
                {doc.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="space-y-1 text-sm">
          {others.map((doc, index) => (
            <li key={`${doc.url}-${index}`}>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-emerald-800 hover:underline"
              >
                {doc.label}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
