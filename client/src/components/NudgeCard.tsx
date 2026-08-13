import { ShoppingCart, ArrowRight } from "lucide-react";

export interface EngineThresholds {
  retailFreeItemTrigger: number;
  retailBonusDiscountPct: number;
  wholesaleThreshold: number;
}

interface NudgeCardProps {
  itemCount: number;
  engineThresholds: EngineThresholds | null;
  compact?: boolean;
  showTeaser?: boolean;
}

function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const Hi = ({ children }: { children: React.ReactNode }) => (
  <strong className="text-amber-600 dark:text-amber-400 font-bold">{children}</strong>
);

export default function NudgeCard({
  itemCount,
  engineThresholds,
  compact = false,
  showTeaser = false,
}: NudgeCardProps) {
  if (!engineThresholds) return null;
  if (itemCount === 0 && !showTeaser) return null;

  const {
    retailFreeItemTrigger: trigger,
    retailBonusDiscountPct: bonusPct,
    wholesaleThreshold: wholesale,
  } = engineThresholds;

  const nodes: number[] = [];
  for (let i = 1; i <= wholesale; i++) nodes.push(i);

  const atWholesale = itemCount >= wholesale;

  const fillPct =
    wholesale <= 1
      ? 100
      : Math.min(100, Math.max(0, ((Math.min(itemCount, wholesale) - 1) / (wholesale - 1)) * 100));

  function nodeState(pos: number): "complete" | "active" | "locked" {
    if (itemCount === 0) return pos === 1 ? "active" : "locked";
    if (pos <= itemCount) return "complete";
    if (pos === itemCount + 1 && !atWholesale) return "active";
    return "locked";
  }

  function nodeLabel(pos: number): string {
    if (pos === wholesale) return "Bulk Rates!";
    if (pos === trigger + 1) return `${bonusPct}% Off*`;
    if (pos === trigger) return "Free*";
    return `Item ${pos}`;
  }

  function rewardIcon(pos: number): string | null {
    if (pos === trigger + 1) return null;
    if (pos === trigger) return null;
    return null;
  }

  const atBonus = !atWholesale && itemCount >= trigger + 1;
  const atFree = !atWholesale && !atBonus && itemCount >= trigger;

  let line1: React.ReactNode;
  let line2: React.ReactNode = null;

  if (itemCount === 0) {
    line1 = <>🎁 Add {trigger} items and get <Hi>1 FREE</Hi> — automatically!</>;
  } else if (atWholesale) {
    line1 = <>🏆 You've unlocked <Hi>Our Absolute Best Rates</Hi> on everything!</>;
  } else if (atBonus) {
    const need = wholesale - itemCount;
    line1 = <>🎉 Awesome! You have <Hi>1 FREE item</Hi> + <Hi>{bonusPct}% OFF</Hi> an item.</>;
    line2 = <>Add {need} more item{need === 1 ? "" : "s"} to get <Hi>Our Absolute Best Rates</Hi>!</>;
  } else if (atFree) {
    line1 = <>🎉 Awesome! You have <Hi>1 FREE item</Hi>.</>;
    line2 = <>Add a {ord(trigger + 1)} item to get <Hi>{bonusPct}% OFF</Hi>!</>;
  } else if (itemCount === 1) {
    line1 = <>🛍️ Add 2 items to start unlocking rewards!</>;
  } else {
    line1 = <>🎉 Awesome! You have {itemCount} items.</>;
    line2 = <>Add a {ord(trigger)} item to unlock <Hi>1 FREE item</Hi>!</>;
  }

  const hasAsterisk = nodes.some((p) => nodeLabel(p).includes("*"));

  /*
   * Fluid sizing strategy
   * ──────────────────────
   * Icons use CSS min(100%, Npx) + aspect-ratio:1 so they shrink proportionally when
   * `wholesaleThreshold` is large and many nodes share limited horizontal space.
   *
   * Arrows are a fixed narrow width; all remaining space goes to flex-1 nodes.
   *
   * Max icon sizes (px):
   *   compact → regular 24, wholesale 32, arrow 12
   *   normal  → regular 36, wholesale 48, arrow 14
   *
   * Budget check at 375 px (page px-4 + card p-5 = 303 px content):
   *   With N nodes, N-1 arrows at 14 px each:
   *     per-node = (303 − (N−1)×14) / N
   *   N=5  → 49.4 px each → icon capped at 36/48 px  ✓
   *   N=7  → 33.2 px each → icon capped at 33.2 px   ✓
   *   N=10 → 18.6 px each → icon scales to 18.6 px   ✓
   * Labels wrap naturally (no whitespace-nowrap) so they never widen the node.
   */
  const iconMaxPx   = compact ? 24 : 36;   // regular cart icon cap (px)
  const wsIconMaxPx = compact ? 32 : 48;   // wholesale cart icon cap (px)
  const arrowPx     = compact ? 12 : 14;   // fixed arrow container width (px)
  const trackH      = compact ? "h-10"     : "h-12";  // uniform track row height

  const msgFont   = compact ? "text-xs"     : "text-sm";
  const line2Font = compact ? "text-[13px]" : "text-[15px]";
  const pad       = compact ? "p-3.5"       : "p-5";

  return (
    <div
      className={`bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40 rounded-xl ${pad} space-y-4 shadow-sm`}
      data-testid="nudge-card"
    >
      <div className="flex items-start" data-testid="nudge-track">
        {nodes.flatMap((pos, idx) => {
          const state = nodeState(pos);
          const isMilestone = nodeLabel(pos) !== `Item ${pos}`;
          const icon = rewardIcon(pos);
          const label = pos === wholesale ? `${wholesale}+` : String(pos);
          const isComplete = state === "complete";
          const isWholesale = pos === wholesale;
          const isLocked = state === "locked";

          const iconClass = isWholesale
            ? "w-full h-full fill-none stroke-orange-500 text-orange-500"
            : isComplete
            ? "w-full h-full fill-amber-500 stroke-amber-500 text-amber-700"
            : state === "active"
            ? "w-full h-full fill-none stroke-orange-400 text-orange-400 nudge-active-pulse cart-stroke-dashed"
            : "w-full h-full fill-none stroke-orange-300 text-orange-300 opacity-80";

          const arrowColor =
            isComplete
              ? "text-amber-500 dark:text-amber-400"
              : state === "active"
              ? "text-orange-400 dark:text-orange-400"
              : "text-orange-300 dark:text-orange-300 opacity-80";

          /* Cap at design max; when flex allocation is smaller, icon shrinks to fit */
          const iconCapPx = isWholesale ? wsIconMaxPx : iconMaxPx;

          const nodeEl = (
            <div
              key={pos}
              className="relative z-10 flex flex-col flex-1 min-w-0 items-center"
              data-testid={`nudge-node-${pos}`}
            >
              {/* Track row: uniform height, icon fluid-centered within the flex share */}
              <div className={`relative w-full flex items-center justify-center ${trackH}`}>
                {/*
                 * Icon box: width = min(100% of parent, iconCapPx).
                 * aspect-ratio:1 keeps it square at any size.
                 * Badges are positioned relative to this box.
                 */}
                <div
                  className="relative"
                  style={{ width: `min(100%, ${iconCapPx}px)`, aspectRatio: "1" }}
                >
                  <ShoppingCart
                    className={iconClass}
                    strokeWidth={isWholesale || isComplete ? 2 : 1.5}
                  />
                  <span
                    className={`absolute -top-1.5 -right-1.5 rounded-full flex items-center justify-center px-0.5 font-black text-white leading-none pointer-events-none shadow-sm ${
                      isWholesale
                        ? compact
                          ? "min-w-[18px] h-[18px] text-[9px]"
                          : "min-w-[22px] h-[22px] text-[11px]"
                        : compact
                          ? "min-w-[15px] h-[15px] text-[9px]"
                          : "min-w-[18px] h-[18px] text-[10px]"
                    } ${
                      isWholesale
                        ? "bg-orange-700 border border-white"
                        : isComplete
                        ? "bg-orange-500"
                        : isLocked
                        ? "bg-orange-400 opacity-80"
                        : "bg-orange-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </div>

              {/* Milestone label — breaks freely within the node's flex-1 width */}
              {isMilestone && (
                <span
                  className={`mt-1 w-full text-center font-bold leading-tight ${
                    compact ? "text-[10px]" : "text-[11px] sm:text-[13px]"
                  } ${
                    isWholesale ? "font-extrabold" : ""
                  } ${
                    isWholesale
                      ? "text-orange-500 dark:text-orange-400 nudge-blink"
                      : isComplete
                      ? "text-amber-600 dark:text-amber-400"
                      : isLocked
                      ? "text-orange-400 dark:text-orange-300 opacity-80"
                      : "text-orange-500 dark:text-orange-400"
                  }`}
                >
                  {isWholesale && !isComplete && (
                    <span className="block font-black tracking-tight">Unlock</span>
                  )}
                  {icon && !isComplete && <span>{icon}</span>}
                  {pos === trigger + 1 ? (
                    <span className="block">{bonusPct}%<br />Off*</span>
                  ) : (
                    <span className="block">{nodeLabel(pos)}</span>
                  )}
                </span>
              )}
            </div>
          );

          const arrowEl = idx < nodes.length - 1 ? (
            <div
              key={`arrow-${pos}`}
              className={`flex-shrink-0 flex items-center justify-center ${arrowColor} ${trackH}`}
              style={{ width: `${arrowPx}px` }}
            >
              <ArrowRight
                className={compact ? "w-2.5 h-2.5" : "w-3 h-3"}
                strokeWidth={5}
              />
            </div>
          ) : null;

          return arrowEl ? [nodeEl, arrowEl] : [nodeEl];
        })}
      </div>

      <div className="text-left space-y-0.5 px-0.5" data-testid="nudge-hook">
        <p className={`${msgFont} font-bold text-amber-700 dark:text-amber-400 leading-snug`}>
          {line1}
        </p>
        {line2 && (
          <p className={`${line2Font} font-semibold text-slate-800 dark:text-slate-200 leading-snug`}>
            {line2}
          </p>
        )}
      </div>

      {hasAsterisk && (
        <p
          className="text-[12px] text-slate-600 dark:text-slate-400 text-left border-t border-dashed border-amber-200 dark:border-amber-800/40 pt-2.5 leading-tight px-0.5"
          data-testid="nudge-footnote"
        >
          *Discounts apply to the lowest-priced items in your order.
        </p>
      )}
    </div>
  );
}
