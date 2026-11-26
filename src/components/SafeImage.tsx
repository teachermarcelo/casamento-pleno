import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { isValidImageUrl } from '../lib/utils';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
}) => {
  const [failed, setFailed] = useState(false);
  const valid = isValidImageUrl(src) && !failed;

  if (!valid) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-stone-100 dark:bg-stone-800/80 text-stone-500 dark:text-stone-400 p-4 text-center ${className}`}
        aria-label={alt}
      >
        <Heart className="w-6 h-6 opacity-50 mb-2" />
        <span className="font-editorial text-base font-medium text-stone-700 dark:text-stone-300">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
