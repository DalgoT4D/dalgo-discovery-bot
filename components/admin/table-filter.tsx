'use client';
import { useId, useMemo, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/components/ui/cn';

/**
 * Reusable client-side filtering for admin list tables.
 *
 * Designed for fully-loaded tables (no server pagination yet): all rows live in
 * memory, so filtering is a pure derive over the array.
 *
 * Search is "smart":
 *  - empty query           → everything matches
 *  - `/pattern/flags`       → treated as a regular expression (case-insensitive
 *                             unless you pass your own flags), so you can do
 *                             `^How `, `data|impact`, `ngo\.org$`, etc.
 *  - anything else          → whitespace-separated terms, ALL must appear as a
 *                             case-insensitive substring somewhere in the row's
 *                             searchable text (so "data ngo" matches a title
 *                             containing both words in any order).
 */

export interface Facet<T> {
  /** Stable key for the facet (used for state + labels). */
  key: string;
  /** Human label shown above the dropdown. */
  label: string;
  /** Value for a given row; rows are grouped/filtered by this. */
  value: (item: T) => string | null | undefined;
}

export interface DateFacet<T> {
  label: string;
  /** ISO-ish date string (or null) for a given row. */
  value: (item: T) => string | null | undefined;
}

export interface TableFilterConfig<T> {
  /** Fields concatenated into the searchable text for each row. */
  search: (item: T) => Array<string | null | undefined>;
  /** Placeholder for the search box. */
  searchPlaceholder?: string;
  /** Dropdown facets (e.g. category, status). */
  facets?: Facet<T>[];
  /** Optional date-range filter over a single date field. */
  date?: DateFacet<T>;
}

export interface TableFilterResult<T> {
  /** The filtered rows — render these. */
  rows: T[];
  /** The ready-to-render filter toolbar. */
  bar: ReactNode;
  /** Whether any filter is currently narrowing results. */
  active: boolean;
}

/**
 * Build a predicate for the search box. Exported for unit testing.
 * See the module docstring for the matching rules.
 */
export function buildMatcher(query: string): (text: string) => boolean {
  const q = query.trim();
  if (!q) return () => true;

  // /pattern/flags → regex mode
  const m = q.match(/^\/(.*)\/([a-z]*)$/i);
  if (m && m[1]) {
    try {
      const flags = m[2].includes('i') ? m[2] : `${m[2]}i`;
      const rx = new RegExp(m[1], flags);
      return (text) => rx.test(text);
    } catch {
      // invalid regex → fall through to substring matching
    }
  }

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return (text) => {
    const t = text.toLowerCase();
    return terms.every((term) => t.includes(term));
  };
}

/** Local date boundary from a yyyy-mm-dd input. `null` if blank/invalid. */
function dayBound(value: string): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

const selectCls = cn(
  'h-10 rounded-md border border-input bg-card px-2 text-sm text-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
);

export function useTableFilter<T>(
  items: T[] | undefined,
  config: TableFilterConfig<T>,
): TableFilterResult<T> {
  const baseId = useId();
  const [search, setSearch] = useState('');
  const [facetValues, setFacetValues] = useState<Record<string, string>>({});
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const data = useMemo(() => items ?? [], [items]);

  // Distinct option lists per facet, derived from the data present.
  const facetOptions = useMemo(() => {
    const out: Record<string, string[]> = {};
    for (const f of config.facets ?? []) {
      const set = new Set<string>();
      for (const it of data) {
        const v = f.value(it);
        if (v != null && v !== '') set.add(String(v));
      }
      out[f.key] = [...set].sort((a, b) => a.localeCompare(b));
    }
    return out;
  }, [data, config.facets]);

  const rows = useMemo(() => {
    const matcher = buildMatcher(search);
    const from = dayBound(fromDate);
    // "to" is inclusive of the whole selected day.
    const toRaw = dayBound(toDate);
    const to = toRaw == null ? null : toRaw + 24 * 60 * 60 * 1000 - 1;

    return data.filter((it) => {
      // text search
      if (search.trim()) {
        const text = config
          .search(it)
          .filter((s): s is string => !!s)
          .join('  '); // separator that won't appear in content
        if (!matcher(text)) return false;
      }
      // facets
      for (const f of config.facets ?? []) {
        const selected = facetValues[f.key];
        if (selected) {
          const v = f.value(it);
          if (String(v ?? '') !== selected) return false;
        }
      }
      // date range
      if (config.date && (from != null || to != null)) {
        const raw = config.date.value(it);
        const t = raw ? new Date(raw).getTime() : NaN;
        if (Number.isNaN(t)) return false;
        if (from != null && t < from) return false;
        if (to != null && t > to) return false;
      }
      return true;
    });
  }, [data, search, facetValues, fromDate, toDate, config]);

  const active =
    !!search.trim() ||
    Object.values(facetValues).some(Boolean) ||
    !!fromDate ||
    !!toDate;

  const clearAll = () => {
    setSearch('');
    setFacetValues({});
    setFromDate('');
    setToDate('');
  };

  const bar = (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1 min-w-[16rem] flex-1">
        <label htmlFor={`${baseId}-q`} className="text-xs text-muted-foreground">
          Search
        </label>
        <Input
          id={`${baseId}-q`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={config.searchPlaceholder ?? 'Search… (use /regex/ for patterns)'}
        />
      </div>

      {(config.facets ?? []).map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label htmlFor={`${baseId}-${f.key}`} className="text-xs text-muted-foreground">
            {f.label}
          </label>
          <select
            id={`${baseId}-${f.key}`}
            className={selectCls}
            value={facetValues[f.key] ?? ''}
            onChange={(e) =>
              setFacetValues((prev) => ({ ...prev, [f.key]: e.target.value }))
            }
          >
            <option value="">All</option>
            {facetOptions[f.key]?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      ))}

      {config.date && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">{config.date.label}</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label={`${config.date.label} from`}
              className={selectCls}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">→</span>
            <input
              type="date"
              aria-label={`${config.date.label} to`}
              className={selectCls}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 h-10">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {rows.length} of {data.length}
        </span>
        {active && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-primary underline whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );

  return { rows, bar, active };
}
