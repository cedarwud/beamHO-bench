export interface SimTestCase {
  name: string;
  kind: 'unit' | 'integration';
  run: () => void | Promise<void>;
}

export interface SimTestResult {
  name: string;
  kind: 'unit' | 'integration';
  pass: boolean;
  durationMs: number;
  error?: string;
}

export interface SimTestSummary {
  total: number;
  passed: number;
  failed: number;
  byKind: {
    unit: { total: number; passed: number; failed: number };
    integration: { total: number; passed: number; failed: number };
  };
  results: SimTestResult[];
}
