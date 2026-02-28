import { Html, useProgress } from '@react-three/drei';

interface SceneLoaderProps {
  label?: string;
}

export function SceneLoader({ label = 'Loading 3D assets...' }: SceneLoaderProps) {
  const { progress, item, loaded, total } = useProgress();
  const safeProgress = Number.isFinite(progress)
    ? Math.min(100, Math.max(0, progress))
    : 0;

  return (
    <Html center>
      <div className="scene-loader" role="status" aria-live="polite">
        <div className="scene-loader__title">{label}</div>
        <div className="scene-loader__progress">{Math.round(safeProgress)}%</div>
        {total > 0 && (
          <div className="scene-loader__detail">
            {loaded}/{total} assets{item ? ` - ${item}` : ''}
          </div>
        )}
      </div>
    </Html>
  );
}
