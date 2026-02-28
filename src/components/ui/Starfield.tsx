import { useMemo } from 'react';

export interface StarfieldProps {
  starCount?: number;
  style?: React.CSSProperties;
}

interface Star {
  left: number;
  top: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
}

function createStars(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 2 + 1,
    opacity: Math.random() * 0.7 + 0.3,
    duration: Math.random() * 3 + 2,   // 2~5s 閃爍週期
    delay: Math.random() * 5,           // 0~5s 隨機延遲
  }));
}

export const Starfield: React.FC<StarfieldProps> = ({
  starCount = 180,
  style = {},
}) => {
  const stars = useMemo(() => createStars(starCount), [starCount]);

  return (
    <div className="starfield" style={style}>
      {stars.map((star, i) => (
        <div
          key={i}
          className="starfield__star"
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            '--star-opacity': star.opacity,
            '--twinkle-duration': `${star.duration}s`,
            '--twinkle-delay': `${star.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};
