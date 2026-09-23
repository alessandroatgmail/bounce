import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useEventSearch } from '../hooks/useEventSearch';

interface Item {
  id: number;
  name: string;
}

interface EventMultiSearchSelectProps {
  token: string | null;
  label: string;
  selected: Item[];
  placeholder?: string;
  /** Scope the search to top-level events only (default true) — pass
   * false for pickers that need to reach individual occurrences too
   * (e.g. a membership's fixed events). */
  parentOnly?: boolean;
  onChange: (selected: Item[]) => void;
}

// Same picker UX as MultiSearchSelect (chips + type-ahead dropdown), but
// backed by a debounced server-side search (useEventSearch) instead of a
// pre-loaded array — for pickers over the full events table, which can
// hold thousands of rows once weekly courses and festivals pile up.
export function EventMultiSearchSelect({
  token,
  label,
  selected,
  placeholder = 'Search...',
  parentOnly = true,
  onChange,
}: EventMultiSearchSelectProps) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { results, loading } = useEventSearch(token, debounced, parentOnly);
  const filtered = results.filter(r => !selected.some(s => s.id === r.id));

  const add = (item: Item) => {
    onChange([...selected, item]);
    setSearch('');
    setOpen(false);
    setHighlightedIndex(0);
  };

  const remove = (id: number) => {
    onChange(selected.filter(s => s.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || filtered.length === 0) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      add(filtered[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(item => (
            <span key={item.id} className="flex items-center gap-1 bg-[#d4b896]/30 text-[#2b2b2b] text-sm px-2 py-1 rounded-full">
              {item.name}
              <button type="button" onClick={() => remove(item.id)} className="ml-1 text-gray-500 hover:text-red-500 leading-none">&times;</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); setHighlightedIndex(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
        />
        {open && debounced && (
          <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-2 text-sm text-gray-500">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">No results</p>
            ) : (
              filtered.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm ${idx === highlightedIndex ? 'bg-[#d4b896]/40' : 'hover:bg-[#d4b896]/20'}`}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={() => add(item)}
                >
                  {item.name}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
