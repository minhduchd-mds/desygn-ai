/**
 * CodeBlockCopy — Adds floating copy buttons to all <pre> code blocks
 * within rendered markdown content (similar to v0.dev / GitHub UX).
 *
 * Usage: wrap rendered markdown with <CodeBlockCopy>{children}</CodeBlockCopy>
 * or call attachCopyButtons(containerEl) imperatively.
 */
import DOMPurify from "dompurify";
import { useEffect, useRef, useCallback, useMemo } from "react";

const COPY_BTN_CLASS = "code-copy-btn";
const COPIED_CLASS = "is-copied";
const SVG_NS = "http://www.w3.org/2000/svg";

function setCopyIcon(btn: HTMLButtonElement, copied: boolean): void {
  btn.replaceChildren();

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", copied ? "2.5" : "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  if (copied) {
    const check = document.createElementNS(SVG_NS, "polyline");
    check.setAttribute("points", "20 6 9 17 4 12");
    svg.appendChild(check);
  } else {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "9");
    rect.setAttribute("y", "9");
    rect.setAttribute("width", "13");
    rect.setAttribute("height", "13");
    rect.setAttribute("rx", "2");

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");

    svg.append(rect, path);
  }

  btn.appendChild(svg);
}

function createCopyButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = COPY_BTN_CLASS;
  btn.title = "Copy code";
  btn.setAttribute("aria-label", "Copy code to clipboard");
  setCopyIcon(btn, false);
  return btn;
}

function handleCopyClick(event: Event): void {
  const btn = event.currentTarget as HTMLButtonElement;
  const pre = btn.closest("pre");
  if (!pre) return;

  const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
  void navigator.clipboard.writeText(code).then(() => {
    btn.classList.add(COPIED_CLASS);
    setCopyIcon(btn, true);
    setTimeout(() => {
      btn.classList.remove(COPIED_CLASS);
      setCopyIcon(btn, false);
    }, 2000);
  });
}

/** Imperatively attach copy buttons to all <pre> blocks in a container. */
export function attachCopyButtons(container: HTMLElement): () => void {
  const pres = container.querySelectorAll("pre");
  const cleanups: (() => void)[] = [];

  pres.forEach((pre) => {
    // Skip if already has a copy button
    if (pre.querySelector(`.${COPY_BTN_CLASS}`)) return;

    // Make pre position relative for absolute button placement
    pre.style.position = "relative";

    const btn = createCopyButton();
    btn.addEventListener("click", handleCopyClick);
    pre.appendChild(btn);

    cleanups.push(() => {
      btn.removeEventListener("click", handleCopyClick);
      btn.remove();
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

/** Hook version: attaches copy buttons whenever content changes. */
export function useCodeBlockCopy(deps: unknown[]): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cleanup = attachCopyButtons(ref.current);
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Wrapper component that adds copy buttons to code blocks in rendered markdown.
 * The HTML is sanitized at the final DOM sink so callers cannot accidentally
 * bypass the markdown sanitization boundary.
 */
export function CodeBlockCopyContainer({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sanitizedHtml = useMemo(() => DOMPurify.sanitize(html), [html]);

  const attachButtons = useCallback(() => {
    if (!containerRef.current) return;
    attachCopyButtons(containerRef.current);
  }, []);

  // Attach copy buttons + image error fallback
  useEffect(() => {
    attachButtons();

    // Add error handlers for markdown images so broken URLs show a helpful placeholder
    if (!containerRef.current) return;
    const images = containerRef.current.querySelectorAll("img");
    const handlers: Array<() => void> = [];
    images.forEach((img) => {
      const onError = () => {
        img.style.display = "none";
        // Insert a fallback chip after the broken image
        if (!img.nextElementSibling?.classList.contains("img-error-chip")) {
          const chip = document.createElement("div");
          chip.className = "img-error-chip";
          chip.textContent = img.alt || "Image unavailable";
          img.parentElement?.insertBefore(chip, img.nextSibling);
        }
      };
      img.addEventListener("error", onError);
      handlers.push(() => img.removeEventListener("error", onError));
    });
    return () => handlers.forEach((fn) => fn());
  }, [sanitizedHtml, attachButtons]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
