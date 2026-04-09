import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  label: string;
}

export default function DatePickerField({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const dateObj = value ? new Date(value + 'T00:00:00') : undefined;

  return (
    <div className="mb-4">
      <label className="block text-xs text-muted-foreground mb-2 tracking-widest">{label}</label>

      {/* Mobile: native date input, PC: calendar popover */}
      <div className="block md:hidden">
        <input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full min-w-0 bg-surface2 border border-border rounded-lg px-4 py-3 text-base text-foreground focus:outline-none focus:border-primary box-border"
          style={{ maxWidth: '100%' }}
        />
      </div>

      <div className="hidden md:block">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-2 bg-surface2 border border-border rounded-lg px-4 py-3 text-sm text-left transition focus:outline-none focus:border-primary',
                !value && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              {dateObj ? format(dateObj, 'yyyy-MM-dd') : '날짜 선택'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-[60]" align="start">
            <Calendar
              mode="single"
              selected={dateObj}
              onSelect={(d) => {
                if (d) {
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, '0');
                  const day = String(d.getDate()).padStart(2, '0');
                  onChange(`${y}-${m}-${day}`);
                }
                setOpen(false);
              }}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
