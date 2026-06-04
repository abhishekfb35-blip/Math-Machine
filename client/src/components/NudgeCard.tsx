export interface EngineThresholds {
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
  wholesaleThreshold: number;
}

interface NudgeCardProps {
  itemCount: number;
  engineThresholds: EngineThresholds | null;
  supplementaryText?: string;
  compact?: boolean;
}

function nodeClasses(reached: boolean, isNext: boolean, compact: boolean): string {
  const size = compact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  const base = `${size} rounded-full flex items-center justify-center font-bold border-2 transition-colors select-none shrink-0`;
  if (reached) return `${base} bg-emerald-500 border-emerald-500 text-white shadow-sm`;
  if (isNext) return `${base} bg-white dark:bg-emerald-950 border-emerald-500 text-emerald-700 dark:text-emerald-300`;
  return `${base} bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-700 text-emerald-300 dark:text-emerald-700`;
}

function lineClasses(filled: boolean): string {
  return `flex-1 h-px self-center ${filled ? "bg-emerald-500" : "bg-emerald-200 dark:bg-emerald-700/50"}`;
}

function labelClasses(reached: boolean, isNext: boolean): string {
  if (reached) return "text-emerald-700 dark:text-emerald-300";
  if (isNext) return "text-emerald-600 dark:text-emerald-400";
  return "text-emerald-300 dark:text-emerald-600";
}

function sublabelClasses(reached: boolean, isNext: boolean): string {
  if (reached || isNext) return "text-emerald-500 dark:text-emerald-400";
  return "text-emerald-200 dark:text-emerald-700";
}

export default function NudgeCard({ itemCount, engineThresholds, supplementaryText, compact = false }: NudgeCardProps) {
  if (!engineThresholds || itemCount === 0) return null;

  const { retailFreeItemTrigger: trigger, retailBonusDiscountPct: bonusPct, wholesaleThreshold: wholesale } = engineThresholds;

  const r0 = itemCount >= trigger;
  const r1 = itemCount >= trigger + 1;
  const r2 = itemCount >= wholesale;
  const n0 = !r0;
  const n1 = r0 && !r1;
  const n2 = r1 && !r2;

  const isDealActive = r0;

  let message: string;
  if (r2) {
    message = "★ Wholesale pricing active — best value on every item!";
  } else if (r1) {
    const need = wholesale - itemCount;
    message = `🎁 FREE + ✦ ${bonusPct}% off unlocked! Add ${need} more item${need === 1 ? "" : "s"} → ★ Wholesale`;
  } else if (r0) {
    message = `🎁 Cheapest item is FREE! Add 1 more → ✦ ${bonusPct}% off next item`;
  } else {
    const need = trigger - itemCount;
    message = `Add ${need} more item${need === 1 ? "" : "s"} → unlock 🎁 1 FREE item`;
  }

  const pillBg = isDealActive ? "bg-emerald-600" : "bg-amber-500";
  const pillText = isDealActive ? "Deal Active" : "Unlock Reward";

  return (
    <div
      className={`rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-dashed border-emerald-500 dark:border-emerald-600 shadow-sm ${compact ? "px-3 py-2.5 space-y-2" : "px-4 py-3.5 space-y-2.5"}`}
      data-testid="nudge-card"
    >
      <span className={`inline-block text-white text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${pillBg}`}>
        {pillText}
      </span>

      {compact ? (
        <div className="flex items-center">
          <div className={nodeClasses(r0, n0, true)}>🎁</div>
          <div className={lineClasses(r0)} />
          <div className={nodeClasses(r1, n1, true)}>✦</div>
          <div className={lineClasses(r1)} />
          <div className={nodeClasses(r2, n2, true)}>★</div>
        </div>
      ) : (
        <div>
          <div className="flex items-center">
            <div className={nodeClasses(r0, n0, false)}>🎁</div>
            <div className={lineClasses(r0)} />
            <div className={nodeClasses(r1, n1, false)}>✦</div>
            <div className={lineClasses(r1)} />
            <div className={nodeClasses(r2, n2, false)}>★</div>
          </div>
          <div className="flex items-start mt-1.5">
            <div className="w-10 shrink-0 flex flex-col items-center text-center">
              <span className={`text-[9px] font-bold uppercase tracking-wide leading-tight ${labelClasses(r0, n0)}`}>FREE item</span>
              <span className={`text-[8px] mt-0.5 ${sublabelClasses(r0, n0)}`}>{trigger} items</span>
            </div>
            <div className="flex-1" />
            <div className="w-10 shrink-0 flex flex-col items-center text-center">
              <span className={`text-[9px] font-bold uppercase tracking-wide leading-tight ${labelClasses(r1, n1)}`}>{bonusPct}% off</span>
              <span className={`text-[8px] mt-0.5 ${sublabelClasses(r1, n1)}`}>{trigger + 1} items</span>
            </div>
            <div className="flex-1" />
            <div className="w-10 shrink-0 flex flex-col items-center text-center">
              <span className={`text-[9px] font-bold uppercase tracking-wide leading-tight ${labelClasses(r2, n2)}`}>Wholesale</span>
              <span className={`text-[8px] mt-0.5 ${sublabelClasses(r2, n2)}`}>{wholesale}+ items</span>
            </div>
          </div>
        </div>
      )}

      <p className={`font-semibold text-emerald-900 dark:text-emerald-100 leading-snug ${compact ? "text-xs" : "text-sm"}`}>
        {message}
      </p>

      {supplementaryText && (
        <p className={`text-emerald-700 dark:text-emerald-300 leading-snug ${compact ? "text-[10px]" : "text-xs"}`}>
          {supplementaryText}
        </p>
      )}
    </div>
  );
}
