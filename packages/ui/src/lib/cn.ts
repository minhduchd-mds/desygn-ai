/**
 * cn — Tiny classname combiner.
 *
 * Joins truthy strings with spaces. Inspired by `clsx` but dependency-free.
 * Use for Tailwind class merging when array-based composition isn't enough.
 */

export function cn(...args: Array<string | undefined | null | false>): string {
  return args.filter(Boolean).join(" ");
}
