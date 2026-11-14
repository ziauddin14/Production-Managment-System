import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { DocumentRef } from '../contracts/operations';
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

/**
 * Edits links to supporting documents (e.g. a scanned Bilty in Google Drive). The PMS stores
 * only the name and link, never the file.
 */
export function DocumentsEditor({
  rows,
  onChange,
  errors,
}: {
  rows: DocumentRow[];
  onChange(rows: DocumentRow[]): void;
  errors: Record<string, string>;
}) {
  const update = (key: string, patch: Partial<DocumentRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-700">Supporting documents</legend>
      <p className="text-xs text-slate-500">
        Add links (https://) to scanned documents stored elsewhere, e.g. Google Drive. Files are not
        uploaded to PMS.
      </p>
      {errors.documents && <p className="text-xs text-red-700">{errors.documents}</p>}
      {rows.map((row, index) => {
        const n = index + 1;
        const labelError = errors[`documents.${index}.label`];
        const urlError = errors[`documents.${index}.url`];
        return (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-start">
            <div>
              <input
                type="text"
                value={row.label}
                maxLength={100}
                onChange={(e) => update(row.key, { label: e.target.value })}
                placeholder="Document name, e.g. Bilty scan"
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
      {rows.length < 20 && (
        <button
          type="button"
          onClick={() => onChange([...rows, newDocumentRow()])}
          className={secondaryButton}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add document link
        </button>
      )}
    </fieldset>
  );
}

export function DocumentList({ documents }: { documents: DocumentRef[] }) {
  if (documents.length === 0) return <p className="text-sm text-slate-500">No documents linked.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {documents.map((doc, index) => (
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
  );
}
