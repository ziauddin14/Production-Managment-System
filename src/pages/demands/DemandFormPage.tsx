import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { ApiError, createDemand, getDemand, listAllMasterRecords, updateDemand } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  ErrorPanel,
  inputClass,
  LoadingRows,
  Notice,
  primaryButton,
  secondaryButton,
} from '../../components/ui';
import {
  todayInKarachi,
  type DemandDetail,
  type DemandPayload,
  type MasterRef,
} from '../../contracts/demands';
import type { MasterRecord } from '../../contracts/masterData';

interface LineState {
  key: string;
  id?: string;
  itemId: string;
  destinationDivisionId: string;
  quantity: string;
  receiverName: string;
  receiverPhone: string;
}

interface Options {
  departments: MasterRecord[];
  provinces: MasterRecord[];
  divisions: MasterRecord[];
  items: MasterRecord[];
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; options: Options; demand: DemandDetail | null };

let keySeq = 0;
const newKey = () => `line-${(keySeq += 1)}`;
const emptyLine = (): LineState => ({
  key: newKey(),
  itemId: '',
  destinationDivisionId: '',
  quantity: '',
  receiverName: '',
  receiverPhone: '',
});

/** Adds a referenced record that is no longer active, so an existing demand still shows it. */
function withCurrent(list: MasterRecord[], ref: MasterRef | null | undefined, extra?: object) {
  if (!ref || list.some((r) => r.id === ref.id)) return list;
  return [
    ...list,
    {
      ...ref,
      name: `${ref.name} (inactive)`,
      rev: 0,
      createdAt: '',
      updatedAt: '',
      ...extra,
    } as MasterRecord,
  ];
}

export function DemandFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { session, handleApiError } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    Promise.all([
      listAllMasterRecords('departments', 'active', signal),
      listAllMasterRecords('provinces', 'active', signal),
      listAllMasterRecords('divisions', 'active', signal),
      listAllMasterRecords('items', 'active', signal),
      id ? getDemand(id, signal) : Promise.resolve(null),
    ])
      .then(([departments, provinces, divisions, items, demand]) =>
        setState({
          kind: 'ready',
          options: { departments, provinces, divisions, items },
          demand,
        }),
      )
      .catch((error: unknown) => {
        if (signal.aborted || handleApiError(error)) return;
        setState({
          kind: 'error',
          message: error instanceof ApiError ? error.message : 'The form could not be loaded.',
        });
      });
    return () => controller.abort();
  }, [id, handleApiError]);

  if (session?.user.role !== 'OPERATOR') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Demands</h1>
        <Notice kind="error">Only the Production Operator can register or change demands.</Notice>
        <Link to="/demands" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">
          ← All demands
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to={id ? `/demands/${id}` : '/demands'}
        className="inline-flex text-sm font-medium text-emerald-700 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        ← {id ? 'Back to demand' : 'All demands'}
      </Link>
      {state.kind === 'loading' && <LoadingRows label="Loading form" rows={6} />}
      {state.kind === 'error' && <ErrorPanel message={state.message} />}
      {state.kind === 'ready' && state.demand?.status === 'CANCELLED' && (
        <Notice kind="error">This demand is cancelled and cannot be changed.</Notice>
      )}
      {state.kind === 'ready' && state.demand?.status !== 'CANCELLED' && (
        <DemandForm
          options={state.options}
          demand={state.demand}
          editing={editing}
          csrfToken={session.csrfToken}
          onSaved={(saved) =>
            navigate(`/demands/${saved.id}`, {
              state: {
                notice: editing ? `Saved ${saved.code}.` : `Registered demand ${saved.code}.`,
              },
            })
          }
          onApiError={handleApiError}
        />
      )}
    </div>
  );
}

function DemandForm({
  options,
  demand,
  editing,
  csrfToken,
  onSaved,
  onApiError,
}: {
  options: Options;
  demand: DemandDetail | null;
  editing: boolean;
  csrfToken: string;
  onSaved(demand: DemandDetail): void;
  onApiError(error: unknown): boolean;
}) {
  const today = todayInKarachi();
  const [demandDate, setDemandDate] = useState(demand?.demandDate ?? today);
  const [departmentId, setDepartmentId] = useState(demand?.department.id ?? '');
  const [provinceId, setProvinceId] = useState(demand?.province.id ?? '');
  const [divisionId, setDivisionId] = useState(demand?.division?.id ?? '');
  const [sourceReference, setSourceReference] = useState(demand?.sourceReference ?? '');
  const [lines, setLines] = useState<LineState[]>(
    demand
      ? demand.lines.map((l) => ({
          key: newKey(),
          id: l.id,
          itemId: l.item.id,
          destinationDivisionId: l.destinationDivision.id,
          quantity: String(l.quantity),
          receiverName: l.receiverName ?? '',
          receiverPhone: l.receiverPhone ?? '',
        }))
      : [emptyLine()],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Current references stay selectable even if they were deactivated after the demand was made.
  const departments = withCurrent(options.departments, demand?.department);
  const provinces = withCurrent(options.provinces, demand?.province);
  const allDivisions = useMemo(() => {
    let list = withCurrent(options.divisions, demand?.division, {
      provinceId: demand?.province.id,
    });
    for (const line of demand?.lines ?? []) list = withCurrent(list, line.destinationDivision);
    return list;
  }, [options.divisions, demand]);
  const items = useMemo(() => {
    let list = options.items;
    for (const line of demand?.lines ?? []) list = withCurrent(list, line.item);
    return list;
  }, [options.items, demand]);
  const provinceNames = new Map(provinces.map((p) => [p.id, p.name]));
  const requestingDivisions = allDivisions.filter((d) => d.provinceId === provinceId);

  const updateLine = (key: string, patch: Partial<LineState>) =>
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const validate = (): Record<string, string> => {
    const next: Record<string, string> = {};
    if (!demandDate) next.demandDate = 'Enter the demand date.';
    else if (demandDate > today) next.demandDate = 'Date cannot be in the future.';
    if (!departmentId) next.departmentId = 'Choose a department.';
    if (!provinceId) next.provinceId = 'Choose a province.';
    if (lines.length === 0) next.lines = 'Add at least one item.';
    const pairs = new Map<string, number>();
    lines.forEach((line, i) => {
      if (!line.itemId) next[`lines.${i}.itemId`] = 'Choose an item.';
      if (!line.destinationDivisionId) {
        next[`lines.${i}.destinationDivisionId`] = 'Choose a destination.';
      }
      const qty = Number(line.quantity);
      if (!line.quantity.trim() || !Number.isInteger(qty) || qty < 1) {
        next[`lines.${i}.quantity`] = 'Enter a whole number of at least 1.';
      }
      if (line.itemId && line.destinationDivisionId) {
        const pair = `${line.itemId}:${line.destinationDivisionId}`;
        const first = pairs.get(pair);
        if (first !== undefined) {
          next[`lines.${i}`] =
            `Same item and destination as line ${first + 1}. Combine the quantities instead.`;
        } else {
          pairs.set(pair, i);
        }
      }
    });
    return next;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) {
      setFormError('Please correct the highlighted fields.');
      errorRef.current?.focus();
      return;
    }
    const payload: DemandPayload = {
      demandDate,
      departmentId,
      provinceId,
      divisionId: divisionId || null,
      sourceReference: sourceReference.trim() || null,
      lines: lines.map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        itemId: l.itemId,
        destinationDivisionId: l.destinationDivisionId,
        quantity: Number(l.quantity),
        receiverName: l.receiverName.trim() || null,
        receiverPhone: l.receiverPhone.trim() || null,
      })),
    };
    setSaving(true);
    try {
      const saved =
        editing && demand
          ? await updateDemand(demand.id, { rev: demand.rev, ...payload }, csrfToken)
          : await createDemand(payload, csrfToken);
      onSaved(saved);
    } catch (error) {
      if (onApiError(error)) return;
      if (error instanceof ApiError && error.details.length > 0) {
        setErrors(Object.fromEntries(error.details.map((d) => [d.path, d.message])));
        setFormError('The server rejected some fields. Please correct them.');
      } else {
        setFormError(error instanceof ApiError ? error.message : 'The demand could not be saved.');
      }
      errorRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          {editing && demand ? `Edit ${demand.code}` : 'New demand'}
        </h1>
        {!editing && (
          <p className="mt-1 text-sm text-slate-600">
            A Demand Number (DMD-…) is assigned when the demand is saved.
          </p>
        )}
      </header>

      <div ref={errorRef} tabIndex={-1} className="outline-none">
        {formError && <Notice kind="error">{formError}</Notice>}
      </div>

      <section
        aria-labelledby="header-heading"
        className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 id="header-heading" className="text-base font-semibold text-slate-900">
          Demand details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="demandDate" label="Demand date" error={errors.demandDate}>
            <input
              id="demandDate"
              type="date"
              value={demandDate}
              max={today}
              onChange={(e) => setDemandDate(e.target.value)}
              aria-invalid={Boolean(errors.demandDate)}
              className={inputClass(Boolean(errors.demandDate))}
            />
          </FormField>
          <FormField id="departmentId" label="Department" error={errors.departmentId}>
            <select
              id="departmentId"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              aria-invalid={Boolean(errors.departmentId)}
              className={inputClass(Boolean(errors.departmentId))}
            >
              <option value="">Choose a department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="provinceId" label="Requesting province" error={errors.provinceId}>
            <select
              id="provinceId"
              value={provinceId}
              onChange={(e) => {
                setProvinceId(e.target.value);
                setDivisionId('');
              }}
              aria-invalid={Boolean(errors.provinceId)}
              className={inputClass(Boolean(errors.provinceId))}
            >
              <option value="">Choose a province</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField
            id="divisionId"
            label="Requesting division (optional)"
            error={errors.divisionId}
          >
            <select
              id="divisionId"
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              disabled={!provinceId}
              aria-invalid={Boolean(errors.divisionId)}
              className={inputClass(Boolean(errors.divisionId))}
            >
              <option value="">{provinceId ? 'None' : 'Choose a province first'}</option>
              {requestingDivisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="sm:col-span-2">
            <FormField
              id="sourceReference"
              label="Source reference (e-mail subject, optional)"
              error={errors.sourceReference}
            >
              <input
                id="sourceReference"
                value={sourceReference}
                maxLength={200}
                onChange={(e) => setSourceReference(e.target.value)}
                aria-invalid={Boolean(errors.sourceReference)}
                className={inputClass(Boolean(errors.sourceReference))}
              />
            </FormField>
          </div>
        </div>
      </section>

      <section aria-labelledby="lines-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="lines-heading" className="text-base font-semibold text-slate-900">
            Items
          </h2>
          <button
            type="button"
            onClick={() => setLines((current) => [...current, emptyLine()])}
            disabled={lines.length >= 200}
            className={secondaryButton}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add item
          </button>
        </div>
        {errors.lines && <p className="text-sm text-red-700">{errors.lines}</p>}
        <ol className="space-y-3">
          {lines.map((line, index) => {
            const err = (field: string) => errors[`lines.${index}.${field}`];
            return (
              <li
                key={line.key}
                aria-label={`Item line ${index + 1}`}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">Line {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                    disabled={lines.length === 1}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-40"
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Remove
                  </button>
                </div>
                {errors[`lines.${index}`] && (
                  <p className="mb-3 text-sm text-red-700">{errors[`lines.${index}`]}</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <FormField id={`item-${line.key}`} label="Item" error={err('itemId')}>
                    <select
                      id={`item-${line.key}`}
                      value={line.itemId}
                      onChange={(e) => updateLine(line.key, { itemId: e.target.value })}
                      aria-invalid={Boolean(err('itemId'))}
                      className={inputClass(Boolean(err('itemId')))}
                    >
                      <option value="">Choose an item</option>
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField
                    id={`dest-${line.key}`}
                    label="Destination division"
                    error={err('destinationDivisionId')}
                  >
                    <select
                      id={`dest-${line.key}`}
                      value={line.destinationDivisionId}
                      onChange={(e) =>
                        updateLine(line.key, { destinationDivisionId: e.target.value })
                      }
                      aria-invalid={Boolean(err('destinationDivisionId'))}
                      className={inputClass(Boolean(err('destinationDivisionId')))}
                    >
                      <option value="">Choose a destination</option>
                      {allDivisions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                          {d.provinceId && provinceNames.get(d.provinceId)
                            ? ` — ${provinceNames.get(d.provinceId)}`
                            : ''}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField id={`qty-${line.key}`} label="Quantity" error={err('quantity')}>
                    <input
                      id={`qty-${line.key}`}
                      inputMode="numeric"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      aria-invalid={Boolean(err('quantity'))}
                      className={inputClass(Boolean(err('quantity')))}
                    />
                  </FormField>
                  <FormField
                    id={`rname-${line.key}`}
                    label="Receiver name (optional)"
                    error={err('receiverName')}
                  >
                    <input
                      id={`rname-${line.key}`}
                      value={line.receiverName}
                      maxLength={100}
                      autoComplete="off"
                      onChange={(e) => updateLine(line.key, { receiverName: e.target.value })}
                      aria-invalid={Boolean(err('receiverName'))}
                      className={inputClass(Boolean(err('receiverName')))}
                    />
                  </FormField>
                  <FormField
                    id={`rphone-${line.key}`}
                    label="Receiver phone (optional)"
                    error={err('receiverPhone')}
                  >
                    <input
                      id={`rphone-${line.key}`}
                      type="tel"
                      value={line.receiverPhone}
                      maxLength={30}
                      autoComplete="off"
                      onChange={(e) => updateLine(line.key, { receiverPhone: e.target.value })}
                      aria-invalid={Boolean(err('receiverPhone'))}
                      className={inputClass(Boolean(err('receiverPhone')))}
                    />
                  </FormField>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link to={demand ? `/demands/${demand.id}` : '/demands'} className={secondaryButton}>
          Cancel
        </Link>
        <button type="submit" disabled={saving} className={primaryButton}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Register demand'}
        </button>
      </div>
    </form>
  );
}

function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
