export interface ValidationIssue {
  path: string;
  message: string;
}

export interface JsonSchema {
  $id?: string;
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  required?: string[];
  properties?: Record<string, JsonSchema>;
  additionalProperties?: boolean;
  enum?: unknown[];
  pattern?: string;
  minLength?: number;
  minItems?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  items?: JsonSchema;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  path: string,
  issues: ValidationIssue[],
): void {
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) {
    issues.push({
      path,
      message: `must be one of: ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}`,
    });
    return;
  }

  if (!schema.type) {
    return;
  }

  if (schema.type === 'object') {
    if (!isPlainObject(value)) {
      issues.push({ path, message: 'must be an object' });
      return;
    }

    const properties = schema.properties ?? {};

    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in value)) {
          issues.push({ path: `${path}.${key}`, message: 'is required' });
        }
      }
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) {
          issues.push({ path: `${path}.${key}`, message: 'is not allowed' });
        }
      }
    }

    for (const [key, childSchema] of Object.entries(properties)) {
      if (key in value) {
        validateAgainstSchema(value[key], childSchema, `${path}.${key}`, issues);
      }
    }

    return;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      issues.push({ path, message: 'must be an array' });
      return;
    }

    if (schema.minItems !== undefined && value.length < schema.minItems) {
      issues.push({ path, message: `must contain at least ${schema.minItems} item(s)` });
    }

    if (schema.items) {
      value.forEach((item, index) => {
        validateAgainstSchema(item, schema.items as JsonSchema, `${path}[${index}]`, issues);
      });
    }

    return;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      issues.push({ path, message: 'must be a string' });
      return;
    }

    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({ path, message: `length must be >= ${schema.minLength}` });
    }

    if (schema.pattern) {
      const pattern = new RegExp(schema.pattern);
      if (!pattern.test(value)) {
        issues.push({ path, message: `must match pattern ${schema.pattern}` });
      }
    }

    return;
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      issues.push({ path, message: 'must be a boolean' });
    }
    return;
  }

  if (schema.type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      issues.push({ path, message: 'must be an integer' });
      return;
    }

    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({ path, message: `must be >= ${schema.minimum}` });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({ path, message: `must be <= ${schema.maximum}` });
    }

    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      issues.push({ path, message: `must be > ${schema.exclusiveMinimum}` });
    }

    return;
  }

  if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ path, message: 'must be a finite number' });
      return;
    }

    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({ path, message: `must be >= ${schema.minimum}` });
    }

    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({ path, message: `must be <= ${schema.maximum}` });
    }

    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      issues.push({ path, message: `must be > ${schema.exclusiveMinimum}` });
    }
  }
}

export function validateOverridePaths(
  overrides: unknown,
  schema: JsonSchema,
  path: string,
  issues: ValidationIssue[],
): void {
  if (overrides === undefined || overrides === null) {
    return;
  }

  if (schema.type === 'object') {
    if (!isPlainObject(overrides)) {
      return;
    }

    const properties = schema.properties ?? {};

    for (const [key, value] of Object.entries(overrides)) {
      const nextSchema = properties[key];

      if (!nextSchema) {
        issues.push({ path: `${path}.${key}`, message: 'is not a valid override path' });
        continue;
      }

      validateOverridePaths(value, nextSchema, `${path}.${key}`, issues);
    }

    return;
  }

  if (schema.type === 'array' && Array.isArray(overrides) && schema.items) {
    overrides.forEach((item, index) => {
      validateOverridePaths(item, schema.items as JsonSchema, `${path}[${index}]`, issues);
    });
  }
}
