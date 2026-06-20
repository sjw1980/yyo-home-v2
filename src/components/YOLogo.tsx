import React from 'react';

interface YOLogoProps {
  className?: string;
  size?: number;
  variant?: 'original' | 'themed';
}

export default function YOLogo({ className = '', size = 40, variant = 'original' }: YOLogoProps) {
  const isOriginal = variant === 'original';

  // Original colors matching the user's attachment
  const originalColors = {
    bg: '#5450f3',      // Vivid blue-violet
    yMain: '#b1eba2',   // Emerald mint-green
    yShadow: '#ff897f', // Deep peach/coral-pink
    oColor: '#b9bdff',  // Soft periwinkle/lavender
  };

  // Coordinated website colors matching the dark forest teal theme
  const themedColors = {
    bg: '#1a2422',      // Deep forest-slate background
    border: '#314441',  // Subtle deep teal border
    yMain: '#7dbaaf',   // Signature mint-teal
    yShadow: '#56807d', // Muted slate-teal shadow
    oColor: '#a2b8b4',  // Light sage-grey
  };

  const colors = isOriginal ? originalColors : themedColors;

  return (
    <div 
      className={`relative flex-shrink-0 flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
      >
        {/* Rounded square container resembling the app icon */}
        <rect
          width="120"
          height="120"
          rx="26"
          fill={colors.bg}
          stroke={!isOriginal ? (colors as typeof themedColors).border : 'none'}
          strokeWidth={!isOriginal ? 4 : 0}
        />

        {/* Shadow layer for the Y (extruded coral-pink offset) */}
        <text
          x="44"
          y="83"
          fill={colors.yShadow}
          fontSize="72"
          fontWeight="bold"
          fontFamily="Georgia, Cambria, 'Times New Roman', serif"
          textAnchor="middle"
        >
          Y
        </text>

        {/* Foreground layer for the Y (shifted slightly up-right from shadow) */}
        <text
          x="48"
          y="80"
          fill={colors.yMain}
          fontSize="72"
          fontWeight="bold"
          fontFamily="Georgia, Cambria, 'Times New Roman', serif"
          textAnchor="middle"
        >
          Y
        </text>

        {/* Lowercase 'o' in the bottom-right corner */}
        <text
          x="88"
          y="98"
          fill={colors.oColor}
          fontSize="44"
          fontWeight="medium"
          fontFamily="Georgia, Cambria, 'Times New Roman', serif"
          textAnchor="middle"
        >
          o
        </text>
      </svg>
    </div>
  );
}
