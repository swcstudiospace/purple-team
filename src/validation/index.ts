/**
 * Schema Validation Utility
 *
 * AJV-based argument validation for tool calls with schema depth enforcement.
 * AJV is lazy-loaded on first call to keep startup fast.
 */

import type { ToolParameter, ToolValidationError } from '../types/index.js';
import { createRequire } from 'node:module';

// Lazy-loaded AJV instance
let ajv: any; // eslint-disable-line @typescript-eslint/no-explicit-any
const require = createRequire(import.meta.url);
function getAjv(): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!ajv) {
    const AjvModule = require('ajv');
    ajv = new AjvModule.default({
      allErrors: true,
      strict: false,
      useDefaults: true,
    });
  }
  return ajv;
}

const MAX_SCHEMA_DEPTH = 3;

/**
 * Build a JSON Schema object from ToolParameter[] definition.
 * Converts the T3MP3ST parameter format to standard JSON Schema.
 */
export function buildJsonSchema(params: ToolParameter[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of params) {
    const resolvedType =
      param.allowedTypes && param.allowedTypes.length > 0
        ? param.allowedTypes.length === 1
          ? param.allowedTypes[0]
          : [...param.allowedTypes]
        : param.type;
    const prop: Record<string, unknown> = {
      type: resolvedType,
      description: param.description,
    };

    if (param.enum !== undefined) {
      prop.enum = param.enum;
    }

    if (param.default !== undefined) {
      prop.default = param.default;
    }

    if (param.type === 'array' && param.items) {
      prop.items = buildItemsSchema(param.items);
    }

    if (param.type === 'object' && param.properties) {
      const nested = buildObjectProperties(param.properties);
      prop.properties = nested.properties;
      if (nested.required.length > 0) {
        prop.required = nested.required;
      }

      if (param.additionalProperties === false) {
        prop.additionalProperties = false;
      }
    }

    if (param.required) {
      required.push(param.name);
    }

    properties[param.name] = prop;
  }

  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

/**
 * Build properties schema for object parameters (recursive).
 */
function buildObjectProperties(
  properties: Record<string, ToolParameter>,
): { properties: Record<string, unknown>; required: string[] } {
  const props: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(properties)) {
    const resolvedType =
      param.allowedTypes && param.allowedTypes.length > 0
        ? param.allowedTypes.length === 1
          ? param.allowedTypes[0]
          : [...param.allowedTypes]
        : param.type;
    const prop: Record<string, unknown> = {
      type: resolvedType,
      description: param.description,
    };

    if (param.enum !== undefined) {
      prop.enum = param.enum;
    }

    if (param.default !== undefined) {
      prop.default = param.default;
    }

    if (param.type === 'array' && param.items) {
      prop.items = buildItemsSchema(param.items);
    }

    if (param.type === 'object' && param.properties) {
      const nested = buildObjectProperties(param.properties);
      prop.properties = nested.properties;
      if (nested.required.length > 0) {
        prop.required = nested.required;
      }
      if (param.additionalProperties === false) {
        prop.additionalProperties = false;
      }
    }

    if (param.required) {
      required.push(key);
    }

    props[key] = prop;
  }

  return { properties: props, required };
}

/**
 * Build items schema for array parameters.
 */
function buildItemsSchema(items: ToolParameter['items']): Record<string, unknown> {
  if (!items) return { type: 'string' };

  const schema: Record<string, unknown> = {
    type: items.type,
  };

  if (items.description) {
    schema.description = items.description;
  }

  if (items.properties) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, param] of Object.entries(items.properties)) {
      properties[key] = {
        type: param.type,
        description: param.description,
      };

      if (param.enum !== undefined) {
        (properties[key] as Record<string, unknown>).enum = param.enum;
      }

      if (param.required) {
        required.push(key);
      }
    }

    schema.properties = properties;
    if (required.length > 0) {
      schema.required = required;
    }
  }

  return schema;
}

/**
 * Enforce maximum schema depth. Throws if depth exceeds limit.
 * Called at tool registration time to prevent overly complex schemas.
 * Depth counts object/array nesting levels — leaf properties don't add depth.
 */
export function assertSchemaDepth(params: ToolParameter[], maxDepth: number = MAX_SCHEMA_DEPTH): void {
  function getMaxDepth(param: ToolParameter, current: number): number {
    if (param.type === 'object' && param.properties) {
      // Each nested object property adds 1 to depth
      let maxNested = current;
      for (const nested of Object.values(param.properties)) {
        // For object/array children, they are at current+1 depth
        // For leaf types, they stay at current depth
        const childDepth = (nested.type === 'object' || nested.type === 'array')
          ? getMaxDepth(nested, current + 1)
          : current;
        maxNested = Math.max(maxNested, childDepth);
      }
      return maxNested;
    }

    if (param.type === 'array' && param.items?.properties) {
      // Array items type is at current+1; items' properties are at current+2
      let maxNested = current;
      for (const nested of Object.values(param.items.properties)) {
        const childDepth = (nested.type === 'object' || nested.type === 'array')
          ? getMaxDepth(nested, current + 2)
          : current + 1;
        maxNested = Math.max(maxNested, childDepth);
      }
      return maxNested;
    }

    // Leaf types (string, number, boolean) don't add depth
    return current;
  }

  for (const param of params) {
    const depth = getMaxDepth(param, 1);
    if (depth > maxDepth) {
      throw new Error(
        `Schema depth ${depth} exceeds maximum ${maxDepth} for parameter "${param.name}"`,
      );
    }
  }
}

// Compiled schema cache to avoid re-compiling the same schemas
const compiledSchemas = new Map<string, ReturnType<typeof getAjv>['compile']>();

function coerceModelScalars(
  values: Record<string, unknown>,
  schema: ToolParameter[],
): void {
  for (const param of schema) {
    const value = values[param.name];
    if (typeof value === 'string' && param.type === 'number') {
      const trimmed = value.trim();
      if (trimmed !== '' && Number.isFinite(Number(trimmed))) {
        values[param.name] = Number(trimmed);
      }
    } else if (typeof value === 'string' && param.type === 'boolean') {
      if (value === 'true') values[param.name] = true;
      else if (value === 'false') values[param.name] = false;
    } else if (value && typeof value === 'object' && !Array.isArray(value) && param.properties) {
      coerceModelScalars(
        value as Record<string, unknown>,
        Object.entries(param.properties).map(([name, nested]) => ({ ...nested, name })),
      );
    } else if (Array.isArray(value) && param.items?.properties) {
      const itemSchema = Object.entries(param.items.properties)
        .map(([name, nested]) => ({ ...nested, name }));
      for (const item of value) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          coerceModelScalars(item as Record<string, unknown>, itemSchema);
        }
      }
    }
  }
}

/**
 * Validate tool arguments against a parameter schema.
 * Returns an array of validation errors (empty if valid).
 *
 * @param toolName - Name of the tool being validated (for error messages)
 * @param args - The arguments to validate
 * @param schema - The tool's parameter schema
 * @returns Array of validation errors, empty if valid
 */
export function validateToolArgs(
  _toolName: string,
  args: Record<string, unknown>,
  schema: ToolParameter[],
): ToolValidationError[] {
  // No schema → no validation needed
  if (!schema || schema.length === 0) {
    return [];
  }

  // Local/text models commonly serialize numeric and boolean schema values as
  // strings. Coerce only those safe directions; never stringify malformed
  // numbers or objects to make an invalid call appear valid.
  coerceModelScalars(args, schema);

  const jsonSchema = buildJsonSchema(schema);
  const schemaKey = JSON.stringify(jsonSchema);

  let validate: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (compiledSchemas.has(schemaKey)) {
    validate = compiledSchemas.get(schemaKey);
  } else {
    const ajvInstance = getAjv();
    validate = ajvInstance.compile(jsonSchema);
    compiledSchemas.set(schemaKey, validate);
  }

  const valid = validate(args);

  if (valid) {
    return [];
  }

  const errors: ToolValidationError[] = [];

  for (const error of validate.errors || []) {
    const field = error.instancePath
      ? error.instancePath.replace(/^\//, '').replace(/\//g, '.')
      : error.params?.missingProperty || error.params?.additionalProperty || 'unknown';

    errors.push({
      field,
      message: error.message || 'Validation failed',
      received: getFieldValue(args, field),
      expected: formatExpected(error),
    });
  }

  return errors;
}

/**
 * Get the value at a dotted path in an object.
 */
function getFieldValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Format expected value from AJV error.
 */
function formatExpected(error: any): string { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (error.keyword === 'type') {
    const t = error.params?.type;
    if (Array.isArray(t)) return t.join(' | ');
    return t || 'unknown type';
  }
  if (error.keyword === 'enum') {
    return `one of: ${(error.params?.allowedValues || []).join(', ')}`;
  }
  if (error.keyword === 'required') {
    return `required field "${error.params?.missingProperty || ''}"`;
  }
  if (error.keyword === 'additionalProperties') {
    return `no additional properties allowed (found "${error.params?.additionalProperty || ''}")`;
  }
  return error.message || 'valid value';
}

// =============================================================================
// BOUNDED INLINE ARTIFACT FIELD CHECKS (Phase 26)
// =============================================================================

/**
 * Bounded field-level checks for an inline artifact element that cannot live
 * in contracts.ts: envelope shape (array, at most one element) plus per-field
 * bounds expressed through the shared validateToolArgs path. The authoritative
 * bind (server-issued id, server-computed hash) stays in
 * src/teams/contracts.ts bindInlineArtifact; this helper only reports
 * field errors without minting anything. No per-tool condition chains.
 */
export const BOUND_ARTIFACT_MEDIA_TYPES: readonly string[] = ['text/plain'] as const;
export const BOUND_ARTIFACT_ENCODINGS: readonly string[] = ['utf8'] as const;
export const BOUND_ARTIFACT_MAX_ITEMS = 1;
export const BOUND_ARTIFACT_MAX_BYTES = 64 * 1024;

const BOUND_ARTIFACT_SCHEMA: ToolParameter[] = [
  { name: 'mediaType', type: 'string', required: true, description: 'Inline artifact media type' },
  { name: 'encoding', type: 'string', required: true, description: 'Inline artifact encoding' },
  { name: 'data', type: 'string', required: true, description: 'Inline artifact bytes as text' },
];

export function validateBoundArtifactFields(input: unknown): ToolValidationError[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) {
    return [{ field: 'inlineArtifacts', message: 'inlineArtifacts must be an array', received: typeof input, expected: 'array' }];
  }
  if (input.length > BOUND_ARTIFACT_MAX_ITEMS) {
    return [{ field: 'inlineArtifacts', message: `inlineArtifacts accepts at most ${BOUND_ARTIFACT_MAX_ITEMS} element`, received: input.length, expected: `<= ${BOUND_ARTIFACT_MAX_ITEMS} elements` }];
  }
  if (input.length === 0) return [];
  const element = input[0] as Record<string, unknown>;
  if (!element || typeof element !== 'object' || Array.isArray(element)) {
    return [{ field: 'inlineArtifacts[0]', message: 'inline artifact must be an object', received: typeof input[0], expected: 'object' }];
  }
  const errors = validateToolArgs('inline-artifact', element as Record<string, unknown>, BOUND_ARTIFACT_SCHEMA);
  if (typeof element.mediaType === 'string' && !BOUND_ARTIFACT_MEDIA_TYPES.includes(element.mediaType)) {
    errors.push({ field: 'mediaType', message: `mediaType must be one of: ${BOUND_ARTIFACT_MEDIA_TYPES.join(', ')}`, received: element.mediaType, expected: BOUND_ARTIFACT_MEDIA_TYPES.join(', ') });
  }
  if (typeof element.encoding === 'string' && !BOUND_ARTIFACT_ENCODINGS.includes(element.encoding)) {
    errors.push({ field: 'encoding', message: `encoding must be one of: ${BOUND_ARTIFACT_ENCODINGS.join(', ')}`, received: element.encoding, expected: BOUND_ARTIFACT_ENCODINGS.join(', ') });
  }
  if (typeof element.data === 'string' && Buffer.byteLength(element.data, 'utf8') > BOUND_ARTIFACT_MAX_BYTES) {
    errors.push({ field: 'data', message: `inline artifact exceeds the ${BOUND_ARTIFACT_MAX_BYTES / 1024} KiB cap`, received: Buffer.byteLength(element.data, 'utf8'), expected: `<= ${BOUND_ARTIFACT_MAX_BYTES} bytes` });
  }
  return errors;
}
