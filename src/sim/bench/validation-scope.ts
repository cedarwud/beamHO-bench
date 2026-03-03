export type ValidationExecutionScope = 'core' | 'all';

const EXTENSION_ID_PREFIXES = ['VAL-RL-', 'VAL-JBH-', 'VAL-BG-'] as const;

export function isExtensionValidationId(validationId: string): boolean {
  return EXTENSION_ID_PREFIXES.some((prefix) => validationId.startsWith(prefix));
}

export function isCoreValidationId(validationId: string): boolean {
  return !isExtensionValidationId(validationId);
}
