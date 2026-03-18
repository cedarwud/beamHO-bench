/**
 * Provenance:
 * - sdd/completed/beamHO-bench-profile-baseline.md
 * - sdd/completed/beamHO-bench-paper-traceability.md
 *
 * Notes:
 * - PaperProfile is the typed schema surface used by runtime profile loading.
 */

export type ProfileMode = "paper-baseline" | "real-trace";

export type Deployment = "rural" | "suburban" | "dense-urban";

export type ConstellationType = "synthetic" | "tle";
export type SyntheticTrajectoryModel = "linear-drift" | "walker-circular";

export type BeamLayout = "hex-7" | "hex-16" | "hex-19" | "hex-50" | "custom";

export type GainModel = "flat" | "bessel-j1" | "bessel-j1-j3" | "custom";

export type FrequencyReuse = "FR1" | "reuse-4" | "custom";

export type SmallScaleModel = "none" | "shadowed-rician" | "loo" | "custom";

export type AlgorithmFidelity = "full" | "simplified";

export type ThroughputModel = "shannon" | "mcs-mapped";

export type HandoverBaseline =
  | "max-rsrp"
  | "max-elevation"
  | "max-remaining-time"
  | "a3"
  | "a4"
  | "cho"
  | "mc-ho";

export type KpiName =
  | "throughput"
  | "handover-rate"
  | "hof"
  | "rlf"
  | "uho"
  | "hopp"
  | "avg-dl-sinr"
  | "jain-fairness";

export interface PaperProfile {
  profileId: string;
  name: string;
  mode: ProfileMode;
  sourcePapers: string[];
  timeStepSec: number;
  scenario: {
    deployment: Deployment;
    areaKm: {
      width: number;
      height: number;
    };
  };
  constellation: {
    type: ConstellationType;
    constellationName: string;
    syntheticTrajectoryModel?: SyntheticTrajectoryModel;
    altitudeKm: number;
    inclinationDeg: number;
    orbitalPlanes: number;
    satellitesPerPlane: number;
    /**
     * Runtime display/compute budget: max satellites tracked per tick.
     * NOT a physical constraint — actual visible count is much higher
     * (e.g. Starlink ~74, OneWeb ~62 above 10° at any instant).
     * Handover decisions use candidateSatelliteLimit, not this value.
     * ASSUME-ACTIVE-WINDOW-DISPLAY-BUDGET
     */
    activeSatellitesInWindow?: number;
    satelliteSpeedKmps?: number;
    minElevationDeg: number;
    tle?: {
      provider: "starlink" | "oneweb" | "custom";
      pathPattern: string;
      selection?: {
        maxSatellites?: number;
        preferLatest?: boolean;
      };
    };
  };
  beam: {
    beamsPerSatellite: number;
    layout: BeamLayout;
    footprintDiameterKm: number;
    beamwidth3dBDeg: number;
    overlapRatio?: number;
    gainModel: GainModel;
    frequencyReuse: FrequencyReuse;
    eirpDensityDbwPerMHz: number;
  };
  channel: {
    carrierFrequencyGHz: number;
    bandwidthMHz: number;
    largeScaleModel: "3gpp-tr-38.811" | "custom";
    smallScaleModel: SmallScaleModel;
    throughputModel: {
      model: ThroughputModel;
      mcsTable: Array<{
        minSinrDb: number;
        spectralEfficiencyBpsHz: number;
      }>;
    };
    smallScaleParams?: {
      shadowedRician?: {
        kFactorMinDb: number;
        kFactorMaxDb: number;
        shadowingStdDevDb: number;
        multipathStdDevDb: number;
      };
      loo?: {
        shadowingStdDevDb: number;
        rayleighScaleDb: number;
      };
      temporalCorrelation?: {
        enabled: boolean;
        coefficient: number;
      };
      dopplerAware?: {
        enabled: boolean;
        velocityScale: number;
        speedOfLightMps: number;
      };
    };
    sfClSource: string;
    ueGTdBPerK: number;
    ueAntennaGainDbi: number;
    noiseTemperatureK: number;
    noiseFigureDb: number;
    systemLossDb: number;
  };
  rlfStateMachine: {
    qOutDb: number;
    qInDb: number;
    t310Ms: number;
    n310: number;
    n311: number;
    l3FilterK: number;
    harqMaxRetx: number;
    rlcMaxRetx: number;
    preambleMsg3MaxRetx: number;
    raResponseTimerSubframes: number;
    contentionResolutionTimerSubframes: number;
  };
  ue: {
    count: number;
    distribution: "uniform" | "clustered" | "custom";
    speedKmphOptions: number[];
  };
  scheduler: {
    mode: "uncoupled" | "coupled";
    windowPeriodSec: number;
    activeWindowFraction: number;
    minActiveBeamsPerSatellite: number;
    maxActiveBeamsPerSatellite: number;
    frequencyBlockCount: number;
    maxUsersPerActiveBeam: number;
    fairnessTargetJain: number;
  };
  handover: {
    algorithmFidelity: AlgorithmFidelity;
    baselines: HandoverBaseline[];
    params: {
      candidateSatelliteLimit?: number;
      a3OffsetDb?: number;
      a3TttMs?: number;
      a4ThresholdDbm?: number;
      homDb?: number;
      mtsSec?: number;
      timerAlphaOptions?: number[];
    };
  };
  kpis: KpiName[];
  notes?: string[];
}
