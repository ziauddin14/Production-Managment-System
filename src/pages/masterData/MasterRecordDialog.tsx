import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import {
  ApiError,
  createMasterRecord,
  listMasterRecords,
  updateMasterRecord,
  type MasterWriteFields,
} from '../../api';
import {
  MASTER_ENTITY_META,
  ancestorsOf,
  type LocationLevel,
  type MasterEntityKey,
  type MasterParentField,
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

type FieldName = 'name' | 'contactPerson' | MasterParentField;
type Errors = Partial<Record<FieldName, string>>;

const NAME_MAX = 100;
const FIELD_NAMES: FieldName[] = [
  'name',
  'contactPerson',
  'provinceId',
  'divisionId',
  'districtId',
];

const inputClass = (invalid: boolean) =>
  [
    'mt-1 block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm',
    'focus:outline-none focus:ring-2 disabled:bg-slate-50',
    invalid
      ? 'border-red-400 focus:ring-red-200'
      : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-200',
  ].join(' ');

export function MasterRecordDialog({
  entity,
  record,
  csrfToken,
  onClose,
  onSaved,
  onApiError,
}: Props) {
  const meta = MASTER_ENTITY_META[entity];
  // Location lists choose their parent step by step: province → division → district.
  const levels = ancestorsOf(entity);
  const parentLevel = levels.at(-1);
  const hasContact = entity === 'vendors';

  const [name, setName] = useState(record?.name ?? '');
  const [contactPerson, setContactPerson] = useState(record?.contactPerson ?? '');
  const [chosen, setChosen] = useState<string[]>(() =>
    levels.map((level) => record?.[level.field] ?? ''),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const choose = (index: number, value: string) =>
    // A new choice clears every level below it.
    setChosen((current) => current.map((v, i) => (i === index ? value : i > index ? '' : v)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    const contact = contactPerson.trim().replace(/\s+/g, ' ');
    const parentId = chosen.at(-1) ?? '';
    const next: Errors = {};
    if (!trimmed) next.name = 'Enter a name.';
    else if (trimmed.length > NAME_MAX) next.name = `Use at most ${NAME_MAX} characters.`;
    if (contact.length > NAME_MAX) next.contactPerson = `Use at most ${NAME_MAX} characters.`;
    levels.forEach((level, i) => {
      if (!chosen[i]) next[level.field] = `Choose a ${level.label.toLowerCase()}.`;
    });
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    const extra: MasterWriteFields = {};
    if (parentLevel && (!record || parentId !== record[parentLevel.field])) {
      extra[parentLevel.field] = parentId;
    }
    if (hasContact && (record ? contact !== (record.contactPerson ?? '') : contact)) {
      extra.contactPerson = contact;
    }

    setSaving(true);
    try {
      const saved = record
        ? await updateMasterRecord(
            entity,
            record.id,
            { rev: record.rev, ...(trimmed !== record.name ? { name: trimmed } : {}), ...extra },
            csrfToken,
          )
        : await createMasterRecord(entity, { name: trimmed, ...extra }, csrfToken);
      onSaved(saved, !record);
    } catch (error) {
      if (onApiError(error)) return;
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED' && error.details.length) {
        const fieldErrors: Errors = {};
        const other: string[] = [];
        for (const detail of error.details) {
          if ((FIELD_NAMES as string[]).includes(detail.path)) {
            fieldErrors[detail.path as FieldName] = detail.message;
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="master-dialog-title"
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-t-xl bg-white p-6 shadow-xl sm:rounded-xl"
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
          {levels.map((level, i) => (
            <ParentSelect
              key={level.entity}
              level={level}
              parentId={i === 0 ? null : (chosen[i - 1] ?? '')}
              parentLabel={levels[i - 1]?.label}
              value={chosen[i] ?? ''}
              currentId={
                levels.slice(0, i).every((above, j) => chosen[j] === record?.[above.field])
                  ? record?.[level.field]
                  : undefined
              }
              currentName={record?.[level.nameField]}
              error={errors[level.field]}
              onChange={(value) => choose(i, value)}
              onApiError={onApiError}
            />
          ))}

          <div>
            <label htmlFor="master-name" className="block text-sm font-medium text-slate-700">
              {levels.length > 0 ? `${meta.nameHeader} name` : hasContact ? 'Company name' : 'Name'}
            </label>
            <input
              id="master-name"
              autoFocus={levels.length === 0}
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

          {hasContact && (
            <div>
              <label htmlFor="master-contact" className="block text-sm font-medium text-slate-700">
                Contact person <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="master-contact"
                value={contactPerson}
                maxLength={NAME_MAX + 20}
                onChange={(e) => setContactPerson(e.target.value)}
                aria-invalid={Boolean(errors.contactPerson)}
                aria-describedby={errors.contactPerson ? 'master-contact-error' : undefined}
                className={inputClass(Boolean(errors.contactPerson))}
              />
              {errors.contactPerson && (
                <p id="master-contact-error" className="mt-1 text-xs text-red-700">
                  {errors.contactPerson}
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

interface Option {
  id: string;
  name: string;
}
type OptionsState =
  | { key: string; kind: 'loading' }
  | { key: string; kind: 'ready'; options: Option[] }
  | { key: string; kind: 'error' };

/** One step of the location chain, loading the active records under the chosen parent. */
function ParentSelect({
  level,
  parentId,
  parentLabel,
  value,
  currentId,
  currentName,
  error,
  onChange,
  onApiError,
}: {
  level: LocationLevel;
  /** null for the top level; '' while the level above is not chosen yet. */
  parentId: string | null;
  parentLabel?: string;
  value: string;
  /** The record's current choice, kept selectable even if it has since been deactivated. */
  currentId?: string;
  currentName?: string;
  error?: string;
  onChange(value: string): void;
  onApiError(error: unknown): boolean;
}) {
  const waiting = parentId === '';
  const requestKey = parentId ?? 'top';
  const [state, setState] = useState<OptionsState | null>(null);

  useEffect(() => {
    if (waiting) return;
    const controller = new AbortController();
    listMasterRecords(
      level.entity,
      {
        status: 'active',
        pageSize: 100,
        ...(level.parentField && parentId ? { [level.parentField]: parentId } : {}),
      },
      controller.signal,
    )
      .then((result) => {
        const options = result.items.map((r) => ({ id: r.id, name: r.name }));
        if (currentId && !options.some((o) => o.id === currentId)) {
          options.push({
            id: currentId,
            name: `${currentName ?? `Current ${level.label.toLowerCase()}`} (inactive)`,
          });
        }
        setState({ key: requestKey, kind: 'ready', options });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || onApiError(err)) return;
        setState({ key: requestKey, kind: 'error' });
      });
    return () => controller.abort();
  }, [waiting, level, parentId, requestKey, currentId, currentName, onApiError]);

  const loaded = state && state.key === requestKey ? state : null;
  const fieldId = `master-${level.field}`;
  const plural = level.label === 'City' ? 'cities' : `${level.label.toLowerCase()}s`;
  const placeholder = waiting
    ? `Choose a ${parentLabel?.toLowerCase() ?? 'parent'} first`
    : !loaded || loaded.kind === 'loading'
      ? `Loading ${plural}…`
      : loaded.kind === 'error'
        ? `${level.label}s could not be loaded`
        : `Choose a ${level.label.toLowerCase()}`;

  return (
    <div>
      <label htmlFor={fieldId} className="block text-sm font-medium text-slate-700">
        {level.label}
      </label>
      <select
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={waiting || loaded?.kind !== 'ready'}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className={inputClass(Boolean(error))}
      >
        <option value="">{placeholder}</option>
        {loaded?.kind === 'ready' &&
          loaded.options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
      </select>
      {!waiting && loaded?.kind === 'ready' && loaded.options.length === 0 && (
        <p className="mt-1 text-xs text-slate-500">
          No active {plural} {parentLabel ? `in this ${parentLabel.toLowerCase()}` : 'yet'}. Add one
          first.
        </p>
      )}
      {error && (
        <p id={`${fieldId}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
