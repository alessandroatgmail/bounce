import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useUserList, type UserListItem } from '../hooks/useUserList';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface Props {
  token: string | null;
  label?: string;
  value: UserListItem | null;
  onChange: (user: UserListItem | null) => void;
  placeholder?: string;
}

export function UserPickerInput({ token, label, value, onChange, placeholder = 'Search by name...' }: Props) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { results } = useUserList(token, 1, { name: debounced });

  const select = (user: UserListItem) => {
    onChange(user);
    setSearch('');
    setOpen(false);
  };

  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      {value ? (
        <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
          <span>
            {value.first_name} {value.last_name}{' '}
            <span className="text-gray-400">({value.email})</span>
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-red-500">
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Input
            placeholder={placeholder}
            value={search}
            onChange={e => { setSearch(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && debounced && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">No results</p>
              ) : (
                results.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#d4b896]/20"
                    onMouseDown={() => select(u)}
                  >
                    {u.first_name} {u.last_name} <span className="text-gray-400">({u.email})</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
