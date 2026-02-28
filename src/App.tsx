import { Suspense, lazy } from 'react';

const MainScene = lazy(async () => {
  const mod = await import('./components/scene/MainScene');
  return { default: mod.MainScene };
});

export function App() {
  return (
    <Suspense fallback={<div className="scene-bootstrap-loader">Preparing 3D scene...</div>}>
      <MainScene />
    </Suspense>
  );
}
