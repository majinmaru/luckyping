import { useRef, useEffect, useState, useCallback } from 'react';
import { colorClass } from '@/lib/lotto';
import { MiniBall } from './BallGrid';
import { toast } from 'sonner';
import DatePickerField from './DatePickerField';

interface Ball {
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

function getBallColor(n: number): string {
  if (n <= 10) return '#fbc400';
  if (n <= 20) return '#69c8f2';
  if (n <= 30) return '#ff7272';
  if (n <= 40) return '#aaaaaa';
  return '#b0d840';
}

function getBallTextColor(n: number): string {
  if (n <= 10) return '#1a1000';
  if (n <= 20) return '#0a1a2a';
  if (n <= 30) return '#1a0000';
  if (n <= 40) return '#1a1a1a';
  return '#1a2800';
}

interface BallGameProps {
  onComplete?: (nums: number[]) => void;
  addTicket: (nums: number[], purchase: { date: string; memo: string }) => Promise<void>;
}

export default function BallGame({ onComplete, addTicket }: BallGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const selectedRef = useRef<number[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [saveDate, setSaveDate] = useState(new Date().toISOString().split('T')[0]);
  const [saveMemo, setSaveMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const animRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const initBalls = useCallback((w: number, h: number) => {
    const r = Math.min(w, h) < 350 ? 16 : 19;
    const balls: Ball[] = [];
    for (let i = 1; i <= 45; i++) {
      let x: number, y: number, overlap: boolean;
      let attempts = 0;
      do {
        x = r + Math.random() * (w - 2 * r);
        y = r + Math.random() * (h - 2 * r);
        overlap = balls.some(b => Math.hypot(b.x - x, b.y - y) < r * 2.2);
        attempts++;
      } while (overlap && attempts < 100);

      const speed = 2.5 + Math.random() * 2.5;
      const angle = Math.random() * Math.PI * 2;
      balls.push({ n: i, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r });
    }
    return balls;
  }, []);

  const resetGame = useCallback(() => {
    selectedRef.current = [];
    setSelected([]);
    setShowSave(false);
    setSaveMemo('');
    const canvas = canvasRef.current;
    if (canvas) {
      ballsRef.current = initBalls(canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
    }
  }, [initBalls]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      return { w: rect.width, h: rect.height };
    };

    const { w, h } = resizeCanvas();
    ballsRef.current = initBalls(w, h);

    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const rect = container.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;

      ctx.clearRect(0, 0, cw, ch);

      const grad = ctx.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, Math.max(cw, ch) / 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.03)');
      grad.addColorStop(1, 'rgba(255,255,255,0.01)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(0, 0, cw, ch, 16);
      ctx.fill();

      const balls = ballsRef.current;
      const sel = selectedRef.current;

      for (const b of balls) {
        if (sel.includes(b.n)) continue;

        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.02;
        b.vx *= 0.9995;
        b.vy *= 0.9995;

        const speed = Math.hypot(b.vx, b.vy);
        if (speed < 0.5) {
          const angle = Math.random() * Math.PI * 2;
          b.vx += Math.cos(angle) * 0.3;
          b.vy += Math.sin(angle) * 0.3;
        }

        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.9; }
        if (b.x + b.r > cw) { b.x = cw - b.r; b.vx = -Math.abs(b.vx) * 0.9; }
        if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.9; }
        if (b.y + b.r > ch) { b.y = ch - b.r; b.vy = -Math.abs(b.vy) * 0.9; }
      }

      for (let i = 0; i < balls.length; i++) {
        if (sel.includes(balls[i].n)) continue;
        for (let j = i + 1; j < balls.length; j++) {
          if (sel.includes(balls[j].n)) continue;
          const a = balls[i], bb = balls[j];
          const dx = bb.x - a.x, dy = bb.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.r + bb.r;
          if (dist < minDist && dist > 0) {
            const nx = dx / dist, ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap / 2;
            a.y -= ny * overlap / 2;
            bb.x += nx * overlap / 2;
            bb.y += ny * overlap / 2;
            const dvx = a.vx - bb.vx, dvy = a.vy - bb.vy;
            const dvn = dvx * nx + dvy * ny;
            if (dvn > 0) {
              a.vx -= dvn * nx * 0.8;
              a.vy -= dvn * ny * 0.8;
              bb.vx += dvn * nx * 0.8;
              bb.vy += dvn * ny * 0.8;
            }
          }
        }
      }

      for (const b of balls) {
        if (sel.includes(b.n)) continue;
        ctx.save();
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        const ballGrad = ctx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.3, 0, b.x, b.y, b.r);
        const color = getBallColor(b.n);
        ballGrad.addColorStop(0, color);
        ballGrad.addColorStop(1, color + 'cc');
        ctx.fillStyle = ballGrad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
        ctx.fillStyle = getBallTextColor(b.n);
        ctx.font = `bold ${b.r * 0.85}px "Space Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(b.n), b.x, b.y + 1);
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [initBalls]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (selectedRef.current.length >= 6) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const balls = ballsRef.current;
    const sel = selectedRef.current;

    let closest: Ball | null = null;
    let closestDist = Infinity;
    for (const b of balls) {
      if (sel.includes(b.n)) continue;
      const dist = Math.hypot(b.x - x, b.y - y);
      if (dist < b.r + 8 && dist < closestDist) {
        closest = b;
        closestDist = dist;
      }
    }

    if (closest) {
      const newSel = [...sel, closest.n];
      selectedRef.current = newSel;
      setSelected([...newSel]);
      if (newSel.length === 6) {
        toast('🎉 6개 번호를 모두 뽑았어요!');
        if (onComplete) onComplete(newSel);
      }
    }
  }, [onComplete]);

  const openSave = () => {
    if (selected.length !== 6) { toast('6개 번호를 먼저 뽑아주세요'); return; }
    setShowSave(true);
  };

  const doSave = async () => {
    if (!saveDate) { toast('날짜를 선택해주세요'); return; }
    setSaving(true);
    await addTicket(selected, { date: saveDate, memo: saveMemo });
    setSaving(false);
    resetGame();
  };

  return (
    <div className="animate-fade-in-up">
      <div className="bg-card border border-border rounded-lg p-5 mb-4 shadow-lg">
        <h3 className="font-display text-base text-primary mb-4 tracking-wide">🎰 공 뽑기 게임</h3>
        <p className="text-xs text-muted-foreground mb-3">
          날아다니는 공을 클릭/터치해서 6개를 뽑아보세요!
        </p>
        <div
          ref={containerRef}
          className="relative w-full rounded-2xl border-2 border-border mb-4 overflow-hidden"
          style={{
            height: 320,
            background: 'linear-gradient(180deg, hsl(240 15% 6%) 0%, hsl(240 15% 10%) 100%)',
            boxShadow: 'inset 0 0 40px rgba(245,200,66,0.05), 0 4px 20px rgba(0,0,0,0.3)',
          }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            onTouchStart={handleClick}
            className="w-full h-full cursor-pointer"
            style={{ touchAction: 'none' }}
          />
          <div className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)',
            }}
          />
        </div>
        <div className="flex gap-2 min-h-[44px] items-center mb-4 px-3 py-2.5 bg-surface2 rounded-xl border border-dashed border-border">
          {selected.length === 0 ? (
            <span className="text-xs text-muted-foreground">공을 클릭해서 뽑아주세요</span>
          ) : (
            <>
              {[...selected].sort((a, b) => a - b).map(n => <MiniBall key={n} n={n} size={34} />)}
              <span className="ml-auto text-xs text-muted-foreground">{selected.length}/6</span>
            </>
          )}
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button onClick={resetGame} className="px-5 py-3 rounded-lg border border-border bg-transparent text-muted-foreground text-sm hover:border-primary hover:text-primary transition">
            ↺ 다시 뽑기
          </button>
          <button onClick={openSave} className="ml-auto px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-gold-glow transition">
            저장하기
          </button>
        </div>
      </div>
      {showSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5" onClick={() => setShowSave(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-lg text-primary mb-5">✅ 티켓 저장</h3>
            <div className="flex gap-1.5 flex-wrap mb-5">
              {[...selected].sort((a, b) => a - b).map(n => <MiniBall key={n} n={n} size={34} />)}
            </div>
            <DatePickerField label="구매 일자" value={saveDate} onChange={setSaveDate} />
            <div className="mb-4">
              <label className="block text-xs text-muted-foreground mb-2 tracking-widest">메모 (선택)</label>
              <input type="text" value={saveMemo} onChange={e => setSaveMemo(e.target.value)} placeholder="ex. 이번주엔 꼭!"
                className="w-full bg-surface2 border border-border rounded-lg px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setShowSave(false)} className="px-5 py-3 rounded-lg border border-border text-muted-foreground text-sm hover:border-primary hover:text-primary transition">취소</button>
              <button onClick={doSave} disabled={saving} className="ml-auto px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-gold-glow transition disabled:opacity-50">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
