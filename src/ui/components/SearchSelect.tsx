import { useId, useMemo, useRef, useState, type ReactNode } from 'react';

interface Props<T> {
  /** Text shown when the field isn't being edited (the current selection). */
  value: string;
  options: readonly T[];
  getKey: (o: T) => string;
  getLabel: (o: T) => string;
  renderOption?: (o: T) => ReactNode;
  onSelect: (o: T | null) => void;
  placeholder?: string;
  /** Show a "(none)" choice that selects null. */
  allowEmpty?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel: string;
  maxResults?: number;
}

/**
 * Accessible type-to-filter combobox. Only listed options can be chosen; typing
 * filters by substring (prefix matches first). Escape or blur restores the value.
 */
export function SearchSelect<T>({
  value, options, getKey, getLabel, renderOption, onSelect, placeholder, allowEmpty, disabled, invalid, ariaLabel, maxResults = 60,
}: Props<T>) {
  const listId = useId();
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const open = query !== null;

  const results = useMemo(() => {
    if (query === null) return [];
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxResults);
    const starts: T[] = [];
    const contains: T[] = [];
    for (const o of options) {
      const label = getLabel(o).toLowerCase();
      if (label.startsWith(q)) starts.push(o);
      else if (label.includes(q)) contains.push(o);
      if (starts.length >= maxResults) break;
    }
    return [...starts, ...contains].slice(0, maxResults);
  }, [query, options, getLabel, maxResults]);

  const entries: (T | null)[] = allowEmpty ? [null, ...results] : results;
  const close = () => { setQuery(null); setActive(0); };
  const choose = (o: T | null) => { onSelect(o); close(); inputRef.current?.blur(); };

  return (
    <div className={`combo ${invalid ? 'invalid' : ''}`}>
      <input
        ref={inputRef}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && entries.length ? `${listId}-${active}` : undefined}
        value={open ? query : value}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        onFocus={e => { setQuery(''); setActive(0); e.target.select(); }}
        onBlur={close}
        onChange={e => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={e => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, entries.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (entries.length) choose(entries[active]); }
          else if (e.key === 'Escape') { close(); inputRef.current?.blur(); }
        }}
      />
      {open && (
        <ul id={listId} role="listbox" className="combo-list" aria-label={ariaLabel}>
          {entries.map((o, i) => (
            <li
              key={o === null ? '__none' : getKey(o)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              // mousedown (not click) so the input's blur doesn't close the list first
              onMouseDown={e => { e.preventDefault(); choose(o); }}
            >
              {o === null ? <span className="muted">(none)</span> : renderOption ? renderOption(o) : getLabel(o)}
            </li>
          ))}
          {!entries.length && <li className="muted combo-empty">No matches</li>}
        </ul>
      )}
    </div>
  );
}
