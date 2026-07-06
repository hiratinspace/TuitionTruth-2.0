"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, cn } from "@tuitiontruth/ui";

export interface SearchFormValues {
  readonly q: string;
  readonly state: string;
  readonly sector: string;
  readonly type: string;
}

const selectClass = cn(
  "rounded-[var(--radius)] border border-border bg-paper px-3 py-2 font-body text-sm text-ink",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
);

/**
 * Directory search controls. All state is pushed into the URL (TUIT-31 AC #5),
 * so results are server-rendered, shareable, and reproducible on refresh — this
 * component holds only the transient input text before submit.
 */
export function SearchForm({ initial }: { readonly initial: SearchFormValues }) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q);
  const [state, setState] = useState(initial.state);
  const [sector, setSector] = useState(initial.sector);
  const [type, setType] = useState(initial.type);

  function submit(next: Partial<SearchFormValues>): void {
    const merged = { q, state, sector, type, ...next };
    const params = new URLSearchParams();
    if (merged.q.trim().length > 0) {
      params.set("q", merged.q.trim());
    }
    if (merged.state.length > 0) {
      params.set("state", merged.state);
    }
    if (merged.sector.length > 0) {
      params.set("sector", merged.sector);
    }
    if (merged.type.length > 0) {
      params.set("type", merged.type);
    }
    const query = params.toString();
    router.push(query.length > 0 ? `/search?${query}` : "/search");
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit({});
      }}
    >
      <label className="flex flex-1 flex-col gap-1">
        <span className="font-data text-xs uppercase tracking-wider text-ink/50">Institution</span>
        <input
          type="search"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
          placeholder="Search by name…"
          className={cn(selectClass, "min-w-56")}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-data text-xs uppercase tracking-wider text-ink/50">State</span>
        <input
          type="text"
          value={state}
          maxLength={2}
          onChange={(event) => {
            setState(event.target.value.toUpperCase());
          }}
          placeholder="e.g. CA"
          className={cn(selectClass, "w-24 uppercase")}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-data text-xs uppercase tracking-wider text-ink/50">Sector</span>
        <select
          value={sector}
          onChange={(event) => {
            setSector(event.target.value);
            submit({ sector: event.target.value });
          }}
          className={selectClass}
        >
          <option value="">Any</option>
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-data text-xs uppercase tracking-wider text-ink/50">Type</span>
        <select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            submit({ type: event.target.value });
          }}
          className={selectClass}
        >
          <option value="">Any</option>
          <option value="four_year">4-year</option>
          <option value="two_year">2-year</option>
        </select>
      </label>

      <Button type="submit">Search</Button>
    </form>
  );
}
