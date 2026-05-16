/**
 * CodeBlockCopy — Adds floating copy buttons to all <pre> code blocks
 * within rendered markdown content (similar to v0.dev / GitHub UX).
 *
 * Usage: wrap rendered markdown with <CodeBlockCopy>{children}</CodeBlockCopy>
 * or call attachCopyButtons(containerEl) imperatively.
 */
import { useEffect, useRef, useCallback } from "react";

const COPY_BTN_CLASS = "code-copy-btn";
const COPIED_CLASS = "is-copied";

function createCopyButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = COPY_BTN_CLASS;
  btn.title = "Copy code";
  btn.setAttribute("aria-label", "Copy code to clipboard");
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  return btn;
}

function handleCopyClick(event: Event): void {
  const btn = event.currentTarget as HTMLButtonElement;
  const pre = btn.closest("pre");
  if (!pre) return;

  const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
  void navigator.clipboard.writeText(code).then(() => {
    btn.classList.add(COPIED_CLASS);
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    setTimeout(() => {
      btn.classList.remove(COPIED_CLASS);
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
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
 * Wrapper component that adds copy buttons to code blocks in children.
 * Use with dangerouslySetInnerHTML rendered markdown.
 */
export function CodeBlockCopyContainer({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const attachButtons = useCallback(() => {
    if (!containerRef.current) return;
    attachCopyButtons(containerRef.current);
  }, []);

  useEffect(() => {
    attachButtons();
  }, [html, attachButtons]);

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
