import { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerProps {
  value?: string; // YYYY-MM-DD
  onChange?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  required?: boolean;
}

function formatDateYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export default function DatePicker({ value = '', onChange, placeholder = 'dd/mm/aaaa', ariaLabel = 'Fecha', required = false }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const [viewDate, setViewDate] = useState<Date>(() => {
    if (value) {
      const [y, m] = value.split('-');
      return new Date(Number(y), Number(m) - 1, 1);
    }
    return startOfMonth(new Date());
  });

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (value) {
      const [y, m] = value.split('-');
      setViewDate(new Date(Number(y), Number(m) - 1, 1));
    }
  }, [value]);

  const handlePrev = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const handleNext = () => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const handleSelect = (d: Date) => {
    const ymd = formatDateYMD(d);
    onChange?.(ymd);
    setOpen(false);
  };

  const renderDays = () => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const startWeekDay = start.getDay(); // 0..6 (Sun..Sat)
    const days: Array<null | Date> = [];
    // Align to Monday? Keep Sunday first to match native locale; project uses spanish with do lu etc in native, but we'll render sun-sat
    for (let i = 0; i < startWeekDay; i++) days.push(null);
    for (let d = 1; d <= end.getDate(); d++) days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
    return days;
  };

  const days = renderDays();
  const selected = value ? new Date(value) : null;

  return (
    <div className="relative block w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn('w-full text-left rounded-lg border-2 border-border bg-input text-foreground px-4 py-2.5 pr-10 transition-all outline-none flex items-center justify-between', open ? 'ring-2 ring-primary/30' : '')}
        aria-label={ariaLabel}
        aria-required={required ? true : undefined}
      >
        <span className={cn(!value ? 'text-muted-foreground' : '')}>
          {value ? new Date(value).toLocaleDateString() : placeholder}
        </span>
        <CalendarIcon className="h-5 w-5 text-muted-foreground ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 left-0 min-w-full sm:min-w-[18rem] rounded-md bg-popover p-3 shadow-lg border border-border text-foreground">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={handlePrev} className="px-2 py-1 rounded hover:bg-muted">‹</button>
              <div className="font-medium">{viewDate.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
              <button type="button" onClick={handleNext} className="px-2 py-1 rounded hover:bg-muted">›</button>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { onChange?.(''); setOpen(false); }} className="text-sm px-2 py-1 rounded hover:bg-muted">Borrar</button>
              <button type="button" onClick={() => { const today = new Date(); const ymd = formatDateYMD(today); onChange?.(ymd); setOpen(false); }} className="text-sm px-2 py-1 rounded bg-primary text-primary-foreground">Hoy</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
            <div>do</div><div>lu</div><div>ma</div><div>mi</div><div>ju</div><div>vi</div><div>sa</div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => (
              <div key={i}>
                {d ? (
                  <button
                    type="button"
                    onClick={() => handleSelect(d)}
                    className={cn('w-full h-9 leading-9 rounded hover:bg-muted transition-colors',
                      selected && d.toDateString() === selected.toDateString() ? 'bg-primary text-primary-foreground' : 'text-foreground')}
                  >
                    {d.getDate()}
                  </button>
                ) : (<div className="h-8" />)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
