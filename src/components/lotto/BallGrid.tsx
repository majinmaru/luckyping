import { useState, useCallback } from 'react';
import { colorClass } from '@/lib/lotto';
import { toast } from 'sonner';

interface BallGridProps {
  selectedNums: number[];
  onSelect: (nums: number[]) => void;
}

export function BallGrid({ selectedNums, onSelect }: BallGridProps) {
  const toggle = (n: number) => {
    if (selectedNums.includes(n)) {
      onSelect(selectedNums.filter(x => x !== n));
    } else {
      if (selectedNums.length >= 6) {
        toast('6개만 선택할 수 있어요');
        return;
      }
      onSelect([...selectedNums, n]);
    }
  };

  return (
    <div className="grid grid-cols-9 gap-1.5 mb-4">
      {Array.from({ length: 45 }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          onClick={() => toggle(n)}
          className={`aspect-square rounded-full flex items-center justify-center font-mono text-[11px] font-bold border-[1.5px] transition-all select-none ${
            selectedNums.includes(n)
              ? `${colorClass(n)} scale-105 shadow-[0_0_12px_rgba(245,200,66,0.5)]`
              : 'border-border bg-surface2 text-muted-foreground hover:border-primary hover:text-primary'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function MiniBall({ n, size = 28 }: { n: number; size?: number }) {
  return (
    <div
      className={`${colorClass(n)} rounded-full flex items-center justify-center font-mono font-bold flex-shrink-0`}
      style={{ width: size, height: size, fontSize: size > 28 ? 12 : 9 }}
    >
      {n}
    </div>
  );
}

export function SelectedRow({ nums }: { nums: number[] }) {
  const sorted = [...nums].sort((a, b) => a - b);
  return (
    <div className="flex gap-2 min-h-[44px] items-center mb-4 px-3 py-2.5 bg-surface2 rounded-xl border border-dashed border-border">
      {sorted.length === 0 ? (
        <span className="text-xs text-muted-foreground">번호를 선택하세요</span>
      ) : (
        <>
          {sorted.map(n => <MiniBall key={n} n={n} size={34} />)}
          <span className="ml-auto text-xs text-muted-foreground">{sorted.length}/6</span>
        </>
      )}
    </div>
  );
}
