import { useState, type FormEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { RecordStatusFilter } from '../contracts/operations';
import { inputClass, secondaryButton } from './ui';

export interface RecordFilterValue {
  search: string;
  status: RecordStatusFilter;
  from: string;
  to: string;
}

export const DEFAULT_RECORD_FILTERS: RecordFilterValue = {
  search: '',
  status: 'open',
  from: '',
  to: '',
};

export function filtersActive(value: RecordFilterValue): boolean {
  return Boolean(value.search || value.status !== 'open' || value.from || value.to);
}

export function datesInvalid(value: { from: string; to: string }): boolean {
  return Boolean(value.from && value.to && value.from > value.to);
}

/**
 * Search, status and date-range filters shared by the receipt, dispatch and payment lists.
 * The search text is applied when the form is submitted; the other filters apply at once.
 */
export function RecordFilters({
  value,
  onChange,
  searchLabel,
  searchPlaceholder,
  statusLabels = { open: 'Active', cancelled: 'Cancelled', all: 'All statuses' },
  children,
}: {
  value: RecordFilterValue;
  onChange(value: RecordFilterValue): void;
  searchLabel: string;
  searchPlaceholder: string;
  statusLabels?: Record<RecordStatusFilter, string>;
  children?: ReactNode;
}) {
  const [searchText, setSearchText] = useState(value.search);
  const invalid = datesInvalid(value);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onChange({ ...value, search: searchText.trim() });
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs print:hidden">
      <form role="search" onSubmit={submit} className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${inputClass()} pl-9`}
            aria-label={searchLabel}
          />
        </div>
        <button type="submit" className={secondaryButton}>
          Search
        </button>
      </form>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-slate-600">
          Status
          <select
            value={value.status}
            onChange={(e) => onChange({ ...value, status: e.target.value as RecordStatusFilter })}
            className={`${inputClass()} mt-1`}
          >
            <option value="open">{statusLabels.open}</option>
            <option value="cancelled">{statusLabels.cancelled}</option>
            <option value="all">{statusLabels.all}</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-600">
          From date
          <input
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={`${inputClass(invalid)} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          To date
          <input
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className={`${inputClass(invalid)} mt-1`}
          />
        </label>
        {children}
      </div>
      {invalid && (
        <p className="text-xs text-red-700" role="alert">
          &quot;From&quot; date must not be after &quot;To&quot; date.
        </p>
      )}
      {filtersActive(value) && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              setSearchText('');
              onChange(DEFAULT_RECORD_FILTERS);
            }}
            className="text-xs font-medium text-emerald-800 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
