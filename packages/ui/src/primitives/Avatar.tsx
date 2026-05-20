/**
 * Avatar — user avatar primitive with initials fallback.
 *
 * Renders an <img> when `src` is given (with alt text), otherwise shows
 * initials derived from `name`. The container is labelled so screen
 * readers announce who it represents even in the initials state.
 */

import { avatarClass, initials, type AvatarSize } from "./variants.js";

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string;
  size?: AvatarSize;
}

export function Avatar({ name, src, size = "md", className, ...props }: AvatarProps) {
  return (
    <span
      className={avatarClass(size, className)}
      role="img"
      aria-label={name}
      title={name}
      {...props}
    >
      {src ? (
        <img className="dsg-avatar__img" src={src} alt="" />
      ) : (
        <span className="dsg-avatar__initials" aria-hidden="true">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
