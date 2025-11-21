import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
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
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);
  
  const [viewDate, setViewDate] = useState<Date>(() => {
    const parsed = parseDate(value);
    return parsed ? startOfMonth(parsed) : startOfMonth(new Date());
  });

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
       const target = e.target as HTMLElement;
       // If click is inside the button, toggle is handled by onClick.
       if (buttonRef.current && buttonRef.current.contains(target as Node)) return;
       
       // If click is inside the calendar popup
       if (target.closest('.datepicker-portal-content')) return;

       setOpen(false);
    };

    if (open) {
        document.addEventListener('mousedown', handleGlobalClick);
    }
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [open]);

  // Position calculation logic similar to Select component
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuStyle(null);
      return;
    }
    
    const updatePosition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        
        // Check if there is enough space below, otherwise open upwards (optional, keeping simple for now)
        // Also handle horizontal overflow if needed, but usually left alignment is fine unless close to edge.
        
        setMenuStyle({
          position: 'absolute',
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          minWidth: '280px', // Minimum width for calendar
          zIndex: 9999,
        });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true); // Capture scroll from any parent

    return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    const parsed = parseDate(value);
    if (parsed) {
      setViewDate(startOfMonth(parsed));
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
    
    for (let i = 0; i < startWeekDay; i++) days.push(null);
    for (let d = 1; d <= end.getDate(); d++) days.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
    return days;
  };

  const days = renderDays();
  const selected = parseDate(value);
  const today = new Date();

  return (
    <div className="relative block w-full" ref={ref}>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost" // Changed to ghost to override styles completely
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full justify-start text-left font-normal px-3 py-2 h-auto', // h-auto to adapt
          'rounded-lg border-2 border-border bg-input hover:bg-input', // Match input styles
          !value && 'text-muted-foreground',
          open && 'ring-2 ring-ring ring-offset-2'
        )}
        aria-label={ariaLabel}
        aria-required={required}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {selected ? selected.toLocaleDateString() : placeholder}
      </Button>

      {open && createPortal(
        <div 
            className="datepicker-portal-content absolute p-3 rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95"
            style={menuStyle || {}}
        >
          <div className="flex items-center justify-between space-x-2 mb-4">
            <Button variant="outline" size="icon" className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium capitalize">
              {viewDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
            </div>
            <Button variant="outline" size="icon" className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[0.8rem] text-muted-foreground mb-2">
            <div>Do</div><div>Lu</div><div>Ma</div><div>Mi</div><div>Ju</div><div>Vi</div><div>Sa</div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              if (!d) return <div key={i} />;
              const isSelected = selected && d.toDateString() === selected.toDateString();
              const isToday = d.toDateString() === today.toDateString();
              
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelect(d)}
                  className={cn(
                    "h-8 w-8 p-0 font-normal text-sm rounded-md flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isSelected 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                      : "hover:bg-accent hover:text-accent-foreground",
                    isToday && !isSelected && "text-accent-foreground bg-accent/50 font-semibold",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-2 border-t">
             <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs"
                onClick={() => { onChange?.(''); setOpen(false); }}
              >
                Borrar
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-2 text-xs text-primary"
                onClick={() => { 
                  const now = new Date();
                  onChange?.(formatDateYMD(now)); 
                  setOpen(false); 
                }}
              >
                Hoy
              </Button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
