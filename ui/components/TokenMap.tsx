import { useState, useMemo } from "react";
import type { ColorMapping } from "../../shared/types";
import styles from "./TokenMap.module.css";
import { TOKEN_MAP_DISPLAY_LIMIT } from "../../shared/constants";

interface TokenMapProps {
  mappings: ColorMapping[];
  profileName?: string;
}

export function TokenMap({ mappings, profileName }: TokenMapProps) {
  const [expanded, setExpanded] = useState(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const mappedCount = mappings.filter((m) => m.tokenName).length;
  const unknownCount = mappings.length - mappedCount;
  const needsExpand = mappings.length > TOKEN_MAP_DISPLAY_LIMIT;

  // Sort by usage count (highest first). Memoized so it only re-runs when mappings/expanded changes.
  const sortedMappings = useMemo(() => {
    const visible = expanded ? mappings : mappings.slice(0, TOKEN_MAP_DISPLAY_LIMIT);
    return [...visible].sort((a, b) => b.count - a.count);
  }, [mappings, expanded]);

  if (mappings.length === 0) return null;

  const copyToClipboard = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1800);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>Token Coverage</span>
        <span className={`${styles.ratio} ${unknownCount === 0 ? styles.ratioAllMapped : ""}`}>
          {mappedCount}/{mappings.length} mapped
        </span>
      </div>

      <p className={styles.description}>
        Colors found in your design. Mapped colors become CSS custom properties from Figma Variables.
      </p>

      {unknownCount > 0 && profileName && (
        <div className={styles.hint}>
          {unknownCount} color{unknownCount > 1 ? "s" : ""} not mapped in <strong>{profileName}</strong>. AI will
          hardcode them.
        </div>
      )}

      <div className={styles.list}>
        {sortedMappings.map((m) => (
          <div
            key={m.nodeId || m.hex}
            className={`${styles.row} ${m.tokenName ? styles.rowMapped : styles.rowUnknown}`}
          >
            {/* Clickable Swatch */}
            <button
              className={styles.swatch}
              style={{ backgroundColor: m.hex }}
              onClick={() => copyToClipboard(m.hex)}
              title={`Click to copy ${m.hex}`}
              aria-label={`Copy ${m.hex}`}
            >
              {copiedHex === m.hex && <span className={styles.copied}>✓ Copied</span>}
            </button>

            <span className={styles.hex}>{m.hex}</span>
            <span className={styles.arrow}>→</span>

            {m.tokenName ? (
              <span className={styles.name} title={m.tokenName}>
                {m.tokenName}
              </span>
            ) : (
              <span className={`${styles.name} ${styles.nameUnknown}`}> unknown</span>
            )}

            <span className={styles.count}>{m.count}×</span>
          </div>
        ))}
      </div>

      {needsExpand && (
        <button className={`btn-link ${styles.toggle}`} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show less" : `Show all ${mappings.length} colors`}
        </button>
      )}
    </div>
  );
}
