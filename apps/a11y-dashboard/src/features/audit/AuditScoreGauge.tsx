/**
 * AuditScoreGauge — circular SVG dial for an accessibility score (0-100).
 *
 * Accessibility:
 *   - The SVG carries role="img" + an aria-label that reads the score, so the
 *     whole dial is announced as a single, meaningful image (the numeric label
 *     inside is decorative and hidden from AT via aria-hidden).
 *
 * Colour bands (via design tokens):
 *   - >= 90  → success (green)
 *   - >= 70  → warning (amber)
 *   - else   → error   (red)
 */

import { useTranslation } from "../../i18n/index.js";
import styles from "./AuditScoreGauge.module.css";

export interface AuditScoreGaugeProps {
  /** Score in the 0-100 range; values are clamped defensively. */
  score: number;
  /** Diameter of the dial in pixels. */
  size?: number;
  /** Stroke width of the ring in pixels. */
  thickness?: number;
}

type Band = "good" | "warn" | "bad";

/** Pure: map a 0-100 score to a colour band. Exported for unit testing. */
export function scoreBand(score: number): Band {
  if (score >= 90) return "good";
  if (score >= 70) return "warn";
  return "bad";
}

export function AuditScoreGauge({ score, size = 120, thickness = 12 }: AuditScoreGaugeProps) {
  const { t } = useTranslation();

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const band = scoreBand(clamped);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  const center = size / 2;
  const label = t("audit.gauge.label").replace("{score}", String(clamped));

  return (
    <div className={styles.gauge} style={{ width: size, height: size }}>
      <svg
        className={styles.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label}
      >
        <circle
          className={styles.track}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={thickness}
        />
        <circle
          className={`${styles.value} ${styles[`value--${band}`]}`}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className={styles.label} aria-hidden="true">
        <span className={styles.score}>{clamped}</span>
        <span className={styles.unit}>/ 100</span>
      </span>
    </div>
  );
}
