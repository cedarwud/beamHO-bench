/**
 * Provenance:
 * - sdd/completed/beamHO-bench-sdd.md
 * - todo.md
 *
 * Notes:
 * - NTPU scene config retains original campus coordinates for GLB model placement.
 *   Simulation observer location is defined separately in scenario-defaults.ts (40°N, 116°E).
 */

export type Vec3 = [number, number, number];

interface SceneConfig {
  observer: {
    name: string;
    latitude: number;
    longitude: number;
    altitude: number;
  };
  scene: {
    modelPath: string;
    position: Vec3;
    rotation: Vec3;
    scale: number;
    material: {
      roughness: number;
      metalness: number;
    };
  };
  uav: {
    modelPath: string;
    position: Vec3;
    scale: number;
    light: {
      intensity: number;
      distance: number;
      decay: number;
      color: string;
      position: Vec3;
    };
  };
  satellite: {
    renderMode: 'primitive' | 'glb';
    modelPath: string;
    modelScale: number;
  };
  camera: {
    initialPosition: Vec3;
    target: Vec3;
    fov: number;
    near: number;
    far: number;
  };
  controls: {
    enableDamping: boolean;
    dampingFactor: number;
    minDistance: number;
    maxDistance: number;
    minPolarAngle: number;
    maxPolarAngle: number;
  };
  render: {
    frameloop: 'always' | 'demand' | 'never';
    antialias: boolean;
    toneMappingExposure: number;
    desktopMaxDpr: number;
    mobileMaxDpr: number;
    performanceMin: number;
  };
  lighting: {
    hemisphere: [number, number, number];
    ambientIntensity: number;
    directional: {
      position: Vec3;
      intensity: number;
      shadow: {
        mapSizeDesktop: number;
        mapSizeMobile: number;
        cameraNear: number;
        cameraFar: number;
        cameraFrustum: number;
        bias: number;
        radius: number;
      };
    };
  };
}

export const NTPU_CONFIG: SceneConfig = {
  observer: {
    name: 'National Taipei University',
    latitude: 24.9441667, // 度
    longitude: 121.3713889, // 度
    altitude: 50, // 米
  },
  scene: {
    modelPath: '/scenes/NTPU.glb',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 1,
    material: {
      roughness: 0.8,
      metalness: 0.1,
    },
  },
  uav: {
    modelPath: '/models/uav.glb',
    position: [0, 10, 0],
    scale: 10,
    light: {
      intensity: 0.3,
      distance: 50,
      decay: 2,
      color: '#ffffff',
      position: [0, 2, 0],
    },
  },
  satellite: {
    // Default to GLB satellite model; runtime still falls back to primitive on load failure.
    renderMode: 'glb',
    modelPath: '/models/sat.glb',
    modelScale: 5.5,
  },
  camera: {
    initialPosition: [0, 400, 500],
    target: [0, 0, 0],
    fov: 60,
    near: 0.1,
    far: 10000,
  },
  controls: {
    enableDamping: true,
    dampingFactor: 0.05,
    minDistance: 10,
    maxDistance: 2000,
    minPolarAngle: 0,
    maxPolarAngle: Math.PI / 2,
  },
  render: {
    // 'demand' 僅在場景變化時渲染；若加入持續動畫（如 UAV 飛行），需切換為 'always'
    frameloop: 'demand',
    antialias: true,
    toneMappingExposure: 1.2,
    desktopMaxDpr: 2,
    mobileMaxDpr: 1.5,
    performanceMin: 0.6,
  },
  lighting: {
    hemisphere: [0xffffff, 0x444444, 1.0],
    ambientIntensity: 0.2,
    directional: {
      position: [0, 50, 0],
      intensity: 1.5,
      shadow: {
        mapSizeDesktop: 1024,
        mapSizeMobile: 512,
        cameraNear: 1,
        cameraFar: 1000,
        // 此值需涵蓋場景模型的 bounding box 範圍，否則陰影會被裁切
        cameraFrustum: 500,
        bias: -0.0004,
        radius: 8,
      },
    },
  },
};
