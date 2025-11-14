import React, { useState, useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}

export const FontSelector: React.FC<Props> = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [highlight, setHighlight] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlight(-1);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const filtered = options
    .filter(o => o.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 200);

  const choose = (val: string) => {
    onChange(val);
    setQuery(val);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && highlight < filtered.length) {
        choose(filtered[highlight]);
      } else if (query.trim()) {
        choose(query.trim());
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        className="mt-1 block w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        placeholder={placeholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      />

      {open && filtered.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-56 overflow-auto bg-slate-800 border border-slate-600 rounded-md shadow-lg p-1 text-sm"
        >
          {filtered.map((opt, idx) => (
            <li
              key={opt + idx}
              role="option"
              aria-selected={highlight === idx}
              className={`px-2 py-1 rounded cursor-pointer hover:bg-slate-700 ${highlight === idx ? 'bg-slate-700' : ''}`}
              onMouseEnter={() => setHighlight(idx)}
              onMouseLeave={() => setHighlight(-1)}
              onClick={() => choose(opt)}
            >
              <div className="flex items-center justify-between">
                <span>{opt}</span>
                <span style={{ fontFamily: opt }} className="text-xs text-slate-400">Aa</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {open && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-md shadow-lg p-2 text-sm text-slate-400">No matching fonts</div>
      )}
    </div>
  );
};
