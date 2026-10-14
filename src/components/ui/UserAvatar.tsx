import { useEffect, useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { isImageAvatar } from '../../lib/avatar';
import { cn } from '../../lib/utils';

interface UserAvatarProps {
  photoURL?: string | null;
  /** Shown as a letter when there is no avatar; falls back to the person icon. */
  name?: string | null;
  className?: string;
  /** Classes for the emoji / letter / icon (font size etc.). */
  contentClassName?: string;
  iconSize?: number;
}

/**
 * Profile picture: an uploaded image (cropped to fill the frame without
 * stretching), an emoji, the first letter of the name, or the person icon.
 * The frame (size, shape, background) comes from `className`.
 */
export function UserAvatar({ photoURL, name, className, contentClassName, iconSize = 24 }: UserAvatarProps) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photoURL]);
  const value = photoURL?.trim() || '';
  const letter = name?.trim().charAt(0).toUpperCase();

  let content;
  if (isImageAvatar(value) && !broken) {
    content = (
      <img
        src={value}
        alt=""
        draggable={false}
        onError={() => setBroken(true)}
        className="w-full h-full object-cover object-center"
      />
    );
  } else if (value && !isImageAvatar(value)) {
    content = <span className={cn('leading-none select-none', contentClassName)}>{value}</span>;
  } else if (letter) {
    content = <span className={cn('font-bold leading-none select-none', contentClassName)}>{letter}</span>;
  } else {
    content = <UserIcon size={iconSize} />;
  }

  return (
    <span className={cn('flex items-center justify-center overflow-hidden shrink-0', className)}>
      {content}
    </span>
  );
}
