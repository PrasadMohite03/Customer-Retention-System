import React from 'react';

interface AaoLogoProps {
  variant?: 'full' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const AaoLogo: React.FC<AaoLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'h-5',
    sm: 'h-7',
    md: 'h-8 sm:h-9',
    lg: 'h-11',
    xl: 'h-14 sm:h-16',
  };

  const src =
    variant === 'icon'
      ? '/brand/Glossy Yellow AAO Smile Icon.png'
      : '/brand/Glossy AAO Smile Logo.png';

  return (
    <img
      src={src}
      alt="AAO"
      className={`inline-block object-contain select-none ${sizeClasses[size]} ${className}`}
      loading="eager"
    />
  );
};

export type MascotMood = 'hello' | 'stamp' | 'reward' | 'celebrate' | 'oops';

interface AaoMascotProps {
  mood: MascotMood;
  size?: number | string;
  className?: string;
  alt?: string;
}

export const AaoMascot: React.FC<AaoMascotProps> = ({
  mood,
  size = 80,
  className = '',
  alt,
}) => {
  const sources: Record<MascotMood, string> = {
    hello: '/brand/hello.png',
    stamp: '/brand/stamp.png',
    reward: '/brand/reward.png',
    celebrate: '/brand/celebrate.png',
    oops: '/brand/oops.png',
  };

  const defaultAlts: Record<MascotMood, string> = {
    hello: 'AAO Buddy saying hello',
    stamp: 'AAO Buddy stamped',
    reward: 'AAO Buddy holding reward',
    celebrate: 'AAO Buddy celebrating',
    oops: 'AAO Buddy looking concerned',
  };

  return (
    <img
      src={sources[mood]}
      alt={alt || defaultAlts[mood]}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: 'auto',
      }}
      className={`object-contain select-none pointer-events-none drop-shadow-xs transition-transform ${className}`}
      loading="lazy"
    />
  );
};
