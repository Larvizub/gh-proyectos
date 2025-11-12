import { useEffect, useRef, useState } from 'react';

interface Props {
  color: string;
  onChange: (c: string) => void;
  presetColors: string[];
}

export default function ColorPickerButton({ color, onChange, presetColors }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const defaultColor = '#e5e7eb'; // gray-200

  return (
  <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-lg px-3 py-2 bg-popover border border-border text-foreground shadow-sm hover:shadow-md transition-all"
      >
        <span className="h-4 w-4 rounded-sm" style={{ backgroundColor: color || defaultColor, border: '1px solid rgba(0,0,0,0.08)' }} />
        <span className="text-sm font-medium">Seleccionar color del proyecto</span>
      </button>

      {open && (
        <div className="absolute left-0 mt-2 min-w-[18rem] rounded-md bg-popover p-3 shadow-lg z-50 border border-border text-foreground">
          <div className="grid grid-cols-6 gap-2 mb-3">
            {presetColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                aria-label={`Seleccionar color ${c}`}
                className={`h-7 w-7 rounded-md transition-transform transform hover:scale-110 focus:outline-none ${
                  color === c ? 'ring-2 ring-offset-1 ring-primary' : 'border border-border'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color || defaultColor}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 w-12 rounded-md border-2 border-border cursor-pointer bg-input"
                aria-label="Color personalizado"
              />
              <div
                className="h-6 w-6 rounded-md shadow-sm border border-border"
                style={{ backgroundColor: color || defaultColor }}
                aria-hidden
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  onChange(defaultColor);
                  setOpen(false);
                }}
                className="px-3 py-1 rounded-md border bg-popover text-foreground hover:bg-muted"
              >
                Restablecer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
