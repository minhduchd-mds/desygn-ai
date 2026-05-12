import React, { useState, useEffect, useRef, useMemo } from "react";
import type { ScanCategory } from "../../shared/types";
import { SCORE_WEIGHTS } from "../../shared/types";
import styles from "./ScoreOverview.module.css";
import { RING_COLORS } from "../../shared/constants";

interface ScoreOverviewProps {
  score: number;
  categories: ScanCategory[];
}

// Hardcoded hex required — SVG fill/stroke attributes cannot use CSS custom properties.
// Values mirror tokens.css: success=#1bc47d, warning=#f5a623, error=#f24822
function scoreColor(score: number): string {
  if (score >= 75) return "#1bc47d";
  if (score >= 50) return "#f5a623";
  return "#f24822";
}

const WEIGHTS = SCORE_WEIGHTS;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Thick arc as a path with inner/outer radius (for pattern fill)
function thickArcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngle: number,
  sweepAngle: number,
): string {
  if (sweepAngle <= 0.3) return "";
  const clampedSweep = Math.min(sweepAngle, 359.5);
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle + clampedSweep);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle + clampedSweep);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = clampedSweep > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    `Z`,
  ].join(" ");
}

function useAnimatedValue(target: number, duration = 500): number {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = to;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
  isTolerance: boolean;
}

export function ScoreOverview({ score, categories }: ScoreOverviewProps) {
  const color = scoreColor(score);
  const animatedScore = useAnimatedValue(score, 600);

  // Memoize the expensive segments + arc geometry — only recomputes when categories change.
  const { segments, arcs, tolArc } = useMemo(() => {
    const totalWeighted = categories.reduce((sum, cat) => sum + (WEIGHTS[cat.id] ?? 0.25) * cat.score, 0);
    const tolerance = 100 - Math.round(totalWeighted);

    const segs: DonutSegment[] = categories.map((cat, i) => ({
      label: cat.label,
      value: Math.round((WEIGHTS[cat.id] ?? 0.25) * cat.score),
      color: RING_COLORS[i % RING_COLORS.length],
      isTolerance: false,
    }));

    if (tolerance > 0) {
      segs.push({ label: "AI Tolerance", value: tolerance, color: "#444", isTolerance: true });
    }

    const cx = 100, cy = 100, r = 72, strokeW = 28, gap = 2;
    const computedArcs = segs.reduce(
      (acc, seg) => {
        const sweep = (seg.value / 100) * 360 - gap;
        acc.result.push({ ...seg, startAngle: acc.angle, sweepAngle: Math.max(0, sweep) });
        acc.angle += (seg.value / 100) * 360;
        return acc;
      },
      { angle: -90, result: [] as (DonutSegment & { startAngle: number; sweepAngle: number })[] },
    ).result;

    // expose cx/cy/r/strokeW for the SVG (constant values inlined below)
    void cx; void cy; void r; void strokeW;

    return { segments: segs, arcs: computedArcs, tolArc: computedArcs.find((a) => a.isTolerance) };
  }, [categories]);

  return (
    <div className={styles.root}>
      <div className={styles.title}>AI-Readiness</div>
      <p className={styles.description}>
        How well your design translates to code. Higher scores mean more accurate AI output with fewer manual fixes.
      </p>
      <hr className={styles.divider} aria-hidden />
      <span className={styles.sectionLabel}>Your score</span>
      <div className={styles.donutLayout}>
        <svg viewBox="0 0 200 200" className={styles.donutSvg}>
          <defs>
            {/* Diagonal hatch pattern for AI Tolerance */}
            <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="#999" strokeWidth="1.5" opacity="0.3" />
            </pattern>
          </defs>

          {/* Background track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--figma-color-border, #333)"
            strokeWidth={strokeW}
            opacity="0.15"
          />

          {/* Category segments with CSS transition */}
          {arcs
            .filter((a) => !a.isTolerance)
            .map((arc, i) => {
              const circumference = 2 * Math.PI * r;
              const dashLen = (arc.sweepAngle / 360) * circumference;
              const dashGap = circumference - dashLen;
              const offset = ((-90 - arc.startAngle) / 360) * circumference;

              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={strokeW}
                  strokeDasharray={`${dashLen} ${dashGap}`}
                  strokeDashoffset={offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ transition: "stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease" }}
                />
              );
            })}

          {/* AI Tolerance — hatched fill */}
          {tolArc && tolArc.sweepAngle > 0.5 && (
            <path
              d={thickArcPath(cx, cy, r - strokeW / 2, r + strokeW / 2, tolArc.startAngle, tolArc.sweepAngle)}
              fill="url(#hatch)"
              stroke="none"
            />
          )}

          {/* Center score */}
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            dominantBaseline="central"
            fill={color}
            fontSize="38"
            fontFamily="Inter, system-ui, sans-serif"
            fontWeight="700"
          >
            {animatedScore}
          </text>
        </svg>

        {/* Legend */}
        <div className={styles.legend}>
          {segments.map((seg, i) => (
            <React.Fragment key={i}>
              {seg.isTolerance && <hr className={styles.toleranceDivider} aria-hidden />}
              <LegendItem segment={seg} />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegendItem({ segment }: { segment: DonutSegment }) {
  const animVal = useAnimatedValue(segment.value, 500);

  return (
    <div className={styles.legendItem}>
      <span
        className={styles.legendDot}
        style={{ backgroundColor: segment.isTolerance ? "var(--figma-color-border, #444)" : segment.color }}
      />
      <span className={styles.legendLabel}>{segment.label}</span>
      <span
        className={styles.legendValue}
        style={{ color: segment.isTolerance ? "var(--figma-color-text-tertiary, #666)" : segment.color }}
      >
        {animVal}%
      </span>
    </div>
  );
}
