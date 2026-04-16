import { useState, useEffect, useRef, useCallback } from 'react';
import { apiUrl } from '../../lib/api';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Button } from './ui/button';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from './ui/utils';

export interface CityResult {
  id: number;
  name: string;
  country_id: number;
  country_name: string;
}

interface CitySearchProps {
  value: number | null;
  displayValue: string;
  onSelect: (city: CityResult) => void;
  placeholder?: string;
  error?: boolean;
}

export function CitySearch({ value, displayValue, onSelect, placeholder = 'Search city...', error }: CitySearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/auth/cities/?q=${encodeURIComponent(q)}`));
      if (res.ok) {
        setResults(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            !displayValue && 'text-muted-foreground',
            error && 'border-red-500',
          )}
        >
          {displayValue || placeholder}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading && (
              <CommandEmpty>Searching...</CommandEmpty>
            )}
            {!loading && query.length >= 2 && results.length === 0 && (
              <CommandEmpty>No cities found.</CommandEmpty>
            )}
            {!loading && query.length < 2 && (
              <CommandEmpty>Type at least 2 characters.</CommandEmpty>
            )}
            {results.length > 0 && (
              <CommandGroup>
                {results.map((city) => (
                  <CommandItem
                    key={city.id}
                    value={String(city.id)}
                    onSelect={() => {
                      onSelect(city);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <Check
                      className={cn('mr-2 size-4', value === city.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <span>{city.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{city.country_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
