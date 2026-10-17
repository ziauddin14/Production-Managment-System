import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { ApiError, createMasterRecord, listMasterRecords, updateMasterRecord } from '../../api';
import {
  MASTER_ENTITY_META,
  type MasterEntityKey,
  type MasterRecord,
} from '../../contracts/masterData';

interface Props {
  entity: MasterEntityKey;
  /** Record to edit; absent when creating. */
  record?: MasterRecord;
  csrfToken: string;
  onClose(): void;
  onSaved(record: MasterRecord, created: boolean): void;
  onApiError(error: unknown): boolean;
}

interface ProvinceOption {
  id: string;
  name: string;
}

type ProvinceState =
  { kind: 'loading' } | { kind: 'ready'; options: ProvinceOption[] } | { kind: 'error' };

const NAME_MAX = 100;

export function MasterRecordDialog({
  entity,
  record,
  csrfToken,
  onClose,
  onSaved,
  onApiError,
}: Props) {
  const meta = MASTER_ENTITY_META[entity];
  const needsProvince = entity === 'divisions';
  const [name, setName] = useState(record?.name ?? '');
  const [provinceId, setProvinceId] = useState(record?.provinceId ?? '');
  const [errors, setErrors] = useState<{ name?: string; provinceId?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [provinces, setProvinces] = useState<ProvinceState>(
    needsProvince ? { kind: 'loading' } : { kind: 'ready', options: [] },
  );

  useEffect(() => {
    if (!needsProvince) return;
    const controller = new AbortController();
    listMasterRecords('provinces', { status: 'active', pageSize: 100 }, controller.signal)
      .then((result) => {
        const options = result.items.map((p) => ({ id: p.id, name: p.name }));
        // Keep the current province selectable even if it has since been deactivated.
        if (record?.provinceId && !options.some((o) => o.id === record.provinceId)) {
          options.push({
            id: record.provinceId,
            name: `${record.provinceName ?? 'Current province'} (inactive)`,
          });
        }
        setProvinces({ kind: 'ready', options });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || onApiError(error)) return;
        setProvinces({ kind: 'error' });
      });
    return () => controller.abort();
  }, [needsProvince, record, onApiError]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    const next: typeof errors = {};
    if (!trimmed) next.name = 'Enter a name.';
    else if (trimmed.length > NAME_MAX) next.name = `Use at most ${NAME_MAX} characters.`;
    if (needsProvince && !provinceId) next.provinceId = 'Choose a province.';
    setErrors(next);
    setFormError(null);
    if (next.name || next.provinceId) return;

    setSaving(true);
    try {
      const saved = record
        ? await updateMasterRecord(
            entity,
            record.id,
            {
              rev: record.rev,
              ...(trimmed !== record.name ? { name: trimmed } : {}),
              ...(needsProvince && provinceId !== record.provinceId ? { provinceId } : {}),
            },
            csrfToken,
          )
        : await createMasterRecord(
            entity,
            needsProvince ? { name: trimmed, provinceId } : { name: trimmed },
            csrfToken,
          );
      onSaved(saved, !record);
    } catch (error) {
      if (onApiError(error)) return;
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED' && error.details.length) {
        const fieldErrors: typeof errors = {};
        const other: string[] = [];
        for (const detail of error.details) {
          if (detail.path === 'name' || detail.path === 'provinceId') {
            fieldErrors[detail.path] = detail.message;
          } else {
            other.push(detail.message);
          }
        }
        setErrors(fieldErrors);
        setFormError(other.length ? other.join(' ') : null);
      } else {
        setFormError(error instanceof ApiError ? error.message : 'The record could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  const title = record ? `Edit ${meta.singular}` : `New ${meta.singular}`;
  const inputClass = (invalid: boolean) =>
    [
      'mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm',
      'focus:outline-none focus:ring-2',
      invalid
        ? 'border-red-400 focus:ring-red-200'
        : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-200',
    ].join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-dialog-title"
        className="relative w-full max-w-md rounded-t-xl bg-white p-6 shadow-xl sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="master-dialog-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {record && <p className="mt-0.5 text-xs text-slate-500">{record.code}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {formError && (
          <div
            className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label htmlFor="master-name" className="block text-sm font-medium text-slate-700">
              Name
            </label>
            <input
              id="master-name"
              autoFocus
              value={name}
              maxLength={NAME_MAX + 20}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'master-name-error' : undefined}
              className={inputClass(Boolean(errors.name))}
            />
            {errors.name && (
              <p id="master-name-error" className="mt-1 text-xs text-red-700">
                {errors.name}
              </p>
            )}
          </div>

          {needsProvince && (
            <div>
              <label htmlFor="master-province" className="block text-sm font-medium text-slate-700">
                Province
              </label>
              <select
                id="master-province"
                value={provinceId}
                onChange={(e) => setProvinceId(e.target.value)}
                disabled={provinces.kind !== 'ready'}
                aria-invalid={Boolean(errors.provinceId)}
                aria-describedby={errors.provinceId ? 'master-province-error' : undefined}
                className={inputClass(Boolean(errors.provinceId))}
              >
                <option value="">
                  {provinces.kind === 'loading'
                    ? 'Loading provinces…'
                    : provinces.kind === 'error'
                      ? 'Provinces could not be loaded'
                      : 'Choose a province'}
                </option>
                {provinces.kind === 'ready' &&
                  provinces.options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              {provinces.kind === 'ready' && provinces.options.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  No active provinces yet. Add a province first.
                </p>
              )}
              {errors.provinceId && (
                <p id="master-province-error" className="mt-1 text-xs text-red-700">
                  {errors.provinceId}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:opacity-70"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
