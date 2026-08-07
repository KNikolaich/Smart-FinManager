import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Download, ImagePlus } from 'lucide-react';
import { CashbackData, CashbackEntry, CashbackCategory } from '../types';
import { cn } from '../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Position = 'top' | 'center' | 'bottom';
type FontColor = 'white' | 'black';

interface ResolvedEntry {
  id: string;
  categoryName: string;
  categoryColor: string;
  percent: number;
  comment?: string;
}

interface ResolvedGroup {
  assetId: string;
  entries: ResolvedEntry[];
}

interface Props {
  cashbackData: CashbackData;
  groupedEntries: Record<string, CashbackEntry[]>;
  onClose: () => void;
}

// ─── Canvas export size: use physical screen pixels (portrait orientation) ────

function getExportSize(): { w: number; h: number } {
  const sw = window.screen.width  * (window.devicePixelRatio || 1);
  const sh = window.screen.height * (window.devicePixelRatio || 1);
  // always portrait
  const w = Math.min(sw, sh);
  const h = Math.max(sw, sh);
  return { w, h };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fillBg(
  ctx: CanvasRenderingContext2D,
  W: number, H: number,
  img: HTMLImageElement | null,
  fallback: string
) {
  if (!img) {
    ctx.fillStyle = fallback;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// Font scale: step 1–5 → multiplier
// step 3 = 1.0 (default), linear between 0.55 (step 1) and 1.55 (step 5)
function fontMultiplier(step: number): number {
  return 0.55 + (step - 1) * 0.25; // 0.55, 0.80, 1.05, 1.30, 1.55
}

// Side pad: step 1–5 → OUTER_PAD in virtual px (at 1080 base)
function sidePadPx(step: number): number {
  return 20 + (step - 1) * 25; // 20, 45, 70, 95, 120
}

// ─── Core draw function (shared for preview and full export) ──────────────────

function drawCashback(
  canvas: HTMLCanvasElement,
  W: number,
  H: number,
  groups: ResolvedGroup[],
  bgImg: HTMLImageElement | null,
  position: Position,
  fontColor: FontColor,
  blur: boolean,
  fontSizeStep: number,
  sidePadStep: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const s  = W / 1080; // spatial scale factor
  const fs = fontMultiplier(fontSizeStep); // font scale multiplier

  ctx.clearRect(0, 0, W, H);

  // ── Background ────────────────────────────────────────────────────────────
  fillBg(ctx, W, H, bgImg, '#1a1a2e');

  // ── Layout math ───────────────────────────────────────────────────────────
  const OUTER_PAD   = sidePadPx(sidePadStep) * s;
  const COL_GAP     = 40 * s;
  const INNER_PH    = 44 * s;   // inner horizontal padding
  const INNER_PV    = 44 * s;   // inner vertical padding
  const HDR_H       = 26 * s;   // bank header text height
  const HDR_MB      = 14 * s;   // margin below header
  const ENTRY_H     = 46 * s;   // height per entry (without comment)
  const CMT_H       = 22 * s;   // extra height when comment present
  const SEC_GAP     = 30 * s;   // gap between bank sections
  const DOT_R       = 5  * s;

  const tableAreaW  = W - OUTER_PAD * 2;
  const colW        = (tableAreaW - COL_GAP) / 2 - INNER_PH;

  const mid = Math.ceil(groups.length / 2);
  const leftGroups  = groups.slice(0, mid);
  const rightGroups = groups.slice(mid);

  function colContentH(col: ResolvedGroup[]) {
    return col.reduce((sum, g, i) => {
      const entriesH = g.entries.reduce((eh, e) => eh + ENTRY_H + (e.comment ? CMT_H : 0), 0);
      return sum + HDR_H + HDR_MB + entriesH + (i < col.length - 1 ? SEC_GAP : 0);
    }, 0);
  }

  const contentH = Math.max(colContentH(leftGroups), colContentH(rightGroups));
  const tableH   = contentH + INNER_PV * 2;
  const tableW   = tableAreaW + INNER_PH * 2;
  const tableX   = OUTER_PAD - INNER_PH;
  const tableY   =
    position === 'top'    ? OUTER_PAD :
    position === 'bottom' ? H - OUTER_PAD - tableH :
                            (H - tableH) / 2;

  // ── Blur under table ──────────────────────────────────────────────────────
  if (blur && bgImg) {
    const bScale = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
    const dw = bgImg.naturalWidth  * bScale;
    const dh = bgImg.naturalHeight * bScale;
    const dx = (W - dw) / 2;
    const dy = (H - dh) / 2;

    ctx.save();
    ctx.filter = `blur(${Math.round(18 * s)}px)`;
    roundRect(ctx, tableX, tableY, tableW, tableH, 24 * s);
    ctx.clip();
    ctx.drawImage(bgImg, dx, dy, dw, dh);
    ctx.restore();
  }

  // ── Overlay ───────────────────────────────────────────────────────────────
  const ovAlpha = blur ? 0.18 : (fontColor === 'white' ? 0.45 : 0.35);
  ctx.save();
  ctx.fillStyle = fontColor === 'white'
    ? `rgba(0,0,0,${ovAlpha})`
    : `rgba(255,255,255,${ovAlpha})`;
  roundRect(ctx, tableX, tableY, tableW, tableH, 24 * s);
  ctx.fill();
  ctx.restore();

  // ── Text colours ──────────────────────────────────────────────────────────
  const fcMain = fontColor === 'white' ? '#ffffff' : '#000000';
  const fcSub  = fontColor === 'white' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.38)';

  // ── Draw one column ───────────────────────────────────────────────────────
  function drawColumn(col: ResolvedGroup[], colX: number) {
    let y = tableY + INNER_PV;

    col.forEach((group, gi) => {
      // Bank header
      ctx.font = `600 ${Math.round(17 * s * fs)}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = fcSub;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(truncate(ctx, group.assetId.toUpperCase(), colW), colX, y);
      y += HDR_H + HDR_MB;

      // Divider line
      ctx.save();
      ctx.strokeStyle = fcSub;
      ctx.lineWidth = 0.5 * s;
      ctx.beginPath();
      ctx.moveTo(colX, y - HDR_MB * 0.5);
      ctx.lineTo(colX + colW, y - HDR_MB * 0.5);
      ctx.stroke();
      ctx.restore();

      // Entries
      group.entries.forEach(entry => {
        const midY = y + ENTRY_H / 2;

        // Dot
        ctx.beginPath();
        ctx.arc(colX + DOT_R, midY, DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = entry.categoryColor || fcMain;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;

        const textX = colX + DOT_R * 2 + 10 * s;
        const maxNameW = colW - DOT_R * 2 - 10 * s - 60 * s;

        // Category name
        ctx.font = `${Math.round(26 * s * fs)}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = fcMain;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(truncate(ctx, entry.categoryName, maxNameW), textX, midY);

        // Percent (right-aligned)
        ctx.font = `bold ${Math.round(26 * s * fs)}px system-ui, -apple-system, sans-serif`;
        ctx.fillStyle = fcMain;
        ctx.textAlign = 'right';
        ctx.fillText(`${entry.percent}%`, colX + colW, midY);
        ctx.textAlign = 'left';

        y += ENTRY_H;

        // Comment
        if (entry.comment) {
          ctx.font = `italic ${Math.round(19 * s * fs)}px system-ui, -apple-system, sans-serif`;
          ctx.fillStyle = fcSub;
          ctx.textBaseline = 'top';
          ctx.fillText(truncate(ctx, entry.comment, colW), textX, y - CMT_H + 2 * s);
          y += CMT_H;
        }
      });

      if (gi < col.length - 1) y += SEC_GAP;
    });
  }

  const leftX  = tableX + INNER_PH;
  const rightX = tableX + INNER_PH + colW + INNER_PH + COL_GAP;

  drawColumn(leftGroups, leftX);
  drawColumn(rightGroups, rightX);
}

// ─── Modal component ──────────────────────────────────────────────────────────

export default function CashbackExportModal({ cashbackData, groupedEntries, onClose }: Props) {
  const [bgImg, setBgImg]           = useState<HTMLImageElement | null>(null);
  const [bgName, setBgName]         = useState<string | null>(null);
  const [position, setPosition]     = useState<Position>('center');
  const [fontColor, setFontColor]   = useState<FontColor>('white');
  const [blur, setBlur]             = useState(true);
  const [fontSizeStep, setFontSizeStep] = useState(3); // 1–5, default middle
  const [sidePadStep, setSidePadStep]   = useState(3); // 1–5, default middle

  const previewRef = useRef<HTMLCanvasElement>(null);
  const PW = 270;
  const PH = 480;

  // Resolve groups (categories → names/colors)
  const groups: ResolvedGroup[] = Object.entries(groupedEntries).map(([assetId, entries]) => ({
    assetId,
    entries: entries.map(e => {
      const cat = cashbackData.categories.find(c => c.id === e.categoryId);
      return {
        id: e.id,
        categoryName: cat?.name || 'Неизвестно',
        categoryColor: cat?.color || '#aaaaaa',
        percent: e.percent,
        comment: e.comment,
      };
    }),
  }));

  // Redraw preview whenever options change
  const redraw = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width  = PW;
    canvas.height = PH;
    drawCashback(canvas, PW, PH, groups, bgImg, position, fontColor, blur, fontSizeStep, sidePadStep);
  }, [groups, bgImg, position, fontColor, blur, fontSizeStep, sidePadStep]);

  useEffect(() => { redraw(); }, [redraw]);

  // Handle wallpaper file
  const handleBgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgName(file.name);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setBgImg(img);
    img.src = url;
  };

  // Full-res export
  const handleExport = () => {
    const { w: EXP_W, h: EXP_H } = getExportSize();
    const canvas = document.createElement('canvas');
    canvas.width  = EXP_W;
    canvas.height = EXP_H;
    drawCashback(canvas, EXP_W, EXP_H, groups, bgImg, position, fontColor, blur, fontSizeStep, sidePadStep);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href    = url;
      a.download = `cashback-${new Date().toISOString().slice(0,10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-theme-main w-full max-w-md rounded-2xl border border-theme-base shadow-2xl flex flex-col overflow-hidden max-h-[95dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme-base shrink-0">
          <h3 className="text-sm font-black text-theme-main uppercase tracking-widest">Экспорт в картинку</h3>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl bg-theme-surface border border-theme-base text-theme-muted hover:text-rose-500 transition-all active:scale-95">
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-5">

          {/* Preview */}
          <div className="flex justify-center">
            <div className="rounded-2xl overflow-hidden shadow-xl border border-theme-base" style={{ width: PW, height: PH }}>
              <canvas ref={previewRef} width={PW} height={PH} style={{ display: 'block' }} />
            </div>
          </div>

          {/* Wallpaper picker */}
          <div>
            <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2">Фон (обои телефона)</p>
            <label className={cn(
              "flex items-center gap-3 w-full h-12 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all",
              bgImg ? "border-theme-primary/40 bg-theme-primary/5" : "border-theme-base hover:border-theme-primary/30"
            )}>
              <ImagePlus size={18} className="text-theme-muted shrink-0" />
              <span className="text-sm text-theme-muted truncate">
                {bgName || 'Выбрать фото…'}
              </span>
              <input type="file" accept="image/*" className="sr-only" onChange={handleBgFile} />
            </label>
          </div>

          {/* Position */}
          <div>
            <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2">Расположение таблицы</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { v: 'top',    label: 'Сверху'  },
                { v: 'center', label: 'По центру' },
                { v: 'bottom', label: 'Снизу'   },
              ] as const).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setPosition(v)}
                  className={cn(
                    "py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all border",
                    position === v
                      ? "bg-theme-primary text-theme-on-primary border-theme-primary shadow-md"
                      : "bg-theme-surface text-theme-muted border-theme-base hover:border-theme-primary/40"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Font colour */}
          <div>
            <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2">Цвет текста</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: 'white', label: 'Белый', bg: '#111', fg: '#fff' },
                { v: 'black', label: 'Чёрный', bg: '#f5f5f5', fg: '#111' },
              ] as const).map(({ v, label, bg, fg }) => (
                <button
                  key={v}
                  onClick={() => setFontColor(v)}
                  style={fontColor === v ? { backgroundColor: bg, color: fg } : {}}
                  className={cn(
                    "py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all border",
                    fontColor === v
                      ? "border-transparent shadow-md"
                      : "bg-theme-surface text-theme-muted border-theme-base hover:border-theme-primary/40"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Blur toggle */}
          <div>
            <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest mb-2">Фон под таблицей</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: true,  label: 'С размытием' },
                { v: false, label: 'Исходный'    },
              ] as const).map(({ v, label }) => (
                <button
                  key={String(v)}
                  onClick={() => setBlur(v)}
                  className={cn(
                    "py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all border",
                    blur === v
                      ? "bg-theme-primary text-theme-on-primary border-theme-primary shadow-md"
                      : "bg-theme-surface text-theme-muted border-theme-base hover:border-theme-primary/40"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Font size slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">Размер шрифта</p>
              <span className="text-[10px] font-black text-theme-primary tabular-nums">{fontSizeStep} / 5</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-theme-muted">А</span>
              <input
                type="range"
                min={1} max={5} step={1}
                value={fontSizeStep}
                onChange={e => setFontSizeStep(Number(e.target.value))}
                className="flex-1 h-1.5 accent-[var(--color-primary)] cursor-pointer"
              />
              <span className="text-[14px] font-black text-theme-muted">А</span>
            </div>
            <div className="flex justify-between mt-1 px-0.5">
              {[1,2,3,4,5].map(n => (
                <span key={n} className={cn("text-[9px] tabular-nums", n === fontSizeStep ? "text-theme-primary font-black" : "text-theme-muted/50")}>
                  {n}
                </span>
              ))}
            </div>
          </div>

          {/* Side padding slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-theme-muted uppercase tracking-widest">Боковые отступы</p>
              <span className="text-[10px] font-black text-theme-primary tabular-nums">{sidePadStep} / 5</span>
            </div>
            <div className="flex items-center gap-3">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-theme-muted">
                <rect x="1" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/>
                <rect x="3.5" y="5" width="7" height="4" rx="1" fill="currentColor" opacity="0.4"/>
                <rect x="11.5" y="2" width="1.5" height="10" rx="0.75" fill="currentColor"/>
              </svg>
              <input
                type="range"
                min={1} max={5} step={1}
                value={sidePadStep}
                onChange={e => setSidePadStep(Number(e.target.value))}
                className="flex-1 h-1.5 accent-[var(--color-primary)] cursor-pointer"
              />
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 text-theme-muted">
                <rect x="0" y="2" width="2.5" height="10" rx="1" fill="currentColor"/>
                <rect x="4" y="5" width="6" height="4" rx="1" fill="currentColor" opacity="0.4"/>
                <rect x="11.5" y="2" width="2.5" height="10" rx="1" fill="currentColor"/>
              </svg>
            </div>
            <div className="flex justify-between mt-1 px-0.5">
              {[1,2,3,4,5].map(n => (
                <span key={n} className={cn("text-[9px] tabular-nums", n === sidePadStep ? "text-theme-primary font-black" : "text-theme-muted/50")}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-theme-base">
          <button
            onClick={handleExport}
            className="w-full h-12 bg-theme-primary text-theme-on-primary rounded-xl font-black uppercase tracking-widest text-[12px] shadow-lg shadow-theme-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Download size={17} />
            {(() => { const { w, h } = getExportSize(); return `Скачать PNG (${w}×${h})`; })()}
          </button>
          <p className="text-center text-[10px] text-theme-muted mt-2 leading-snug">
            После скачивания установите картинку как обои телефона вручную
          </p>
        </div>
      </div>
    </div>
  );
}
