import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

type Option = { value: string; label: React.ReactNode };

type SelectProps = {
  id?: string;
  label?: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

function parseOptions(children: React.ReactNode): Option[] {
  const opts: Option[] = [];
  React.Children.forEach(children, (child) => {
    if (!child) return;
    // handle <option value="x">Label</option>
    // @ts-ignore
    const props = child.props as any;
    if (props && 'value' in props) {
      opts.push({ value: String(props.value), label: props.children });
    }
  });
  return opts;
}

export function Select({ id, label, helper, value, onChange, children, className }: SelectProps) {
  const options = parseOptions(children);
  const selected = options.find((o) => o.value === value) || options[0];

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    options.findIndex((o) => o.value === value)
  );
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => setActiveIndex(options.findIndex((o) => o.value === value)), [value, children]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') return setOpen(false);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min((i === -1 ? 0 : i) + 1, options.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max((i === -1 ? 0 : i) - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && options[activeIndex]) {
          onChange(options[activeIndex].value);
          setOpen(false);
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, activeIndex, options, onChange]);

  return (
    <div className={clsx('w-full', className)} ref={ref}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
      <div className="relative">
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={clsx(
            'w-full rounded-md border border-input bg-input px-3 py-2 text-left text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring',
            'flex items-center justify-between',
          )}
        >
          <span className="truncate">{selected ? selected.label : ''}</span>
          <svg className="h-4 w-4 text-muted-foreground ml-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" />
          </svg>
        </button>

        {open && (
          <ul
            role="listbox"
            tabIndex={-1}
            className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-md bg-popover shadow-lg ring-1 ring-black/10 focus:outline-none"
          >
            {options.map((opt, idx) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={value === opt.value}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={clsx(
                  'cursor-pointer px-4 py-2 text-sm',
                  value === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : activeIndex === idx
                    ? 'bg-muted text-foreground'
                    : 'text-foreground'
                )}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
    </div>
  );
}

export default Select;
