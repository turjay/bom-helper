import { ValidationError, BOMEntry, AssemblyRow, ColumnMapping } from '../types';

export function hasLetter(str: string): boolean {
  return /[a-zA-Z]/.test(str);
}

export function isValidPositiveNumber(val: string): boolean {
  const trimmed = val.trim();
  if (trimmed === '') return false;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return false;
  const num = parseFloat(trimmed);
  return !isNaN(num) && num > 0;
}

export function containsDecimalComma(val: string): boolean {
  return val.includes(',');
}

export function validateBOM(
  entries: BOMEntry[],
  assemblies: AssemblyRow[],
  originalEntries: BOMEntry[],
  mapping: ColumnMapping | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Lookup of valid assemblies if snapshot loaded
  const assemblyMap = new Map<string, AssemblyRow>();
  if (mapping) {
    assemblies.forEach((a) => {
      const key = `${String(a[mapping.assemblies.system])}:${String(a[mapping.assemblies.name])}`.toLowerCase();
      assemblyMap.set(key, a);
    });
  }

  const originalMap = new Map(originalEntries.map((e) => [e.id, e]));

  entries.forEach((entry) => {
    const identifier = entry.id;

    // 1. Part name must not be empty
    if (!entry.part.trim()) {
      errors.push({
        id: `empty-part-${identifier}`,
        type: 'error',
        entryId: entry.id,
        field: 'part',
        message: 'Part name is required.',
      });
    }

    // 2. Quantity must be a valid positive number
    if (!entry.quantity.trim()) {
      errors.push({
        id: `empty-qty-${identifier}`,
        type: 'error',
        entryId: entry.id,
        field: 'quantity',
        message: 'Quantity is required.',
      });
    } else if (!isValidPositiveNumber(entry.quantity)) {
      errors.push({
        id: `invalid-qty-${identifier}`,
        type: 'error',
        entryId: entry.id,
        field: 'quantity',
        message: `Quantity "${entry.quantity}" must be a positive number.`,
      });
    }

    // 3. System and Assembly must be specified
    if (!entry.system) {
      errors.push({
        id: `empty-system-${identifier}`,
        type: 'error',
        entryId: entry.id,
        field: 'system',
        message: 'System selection is required.',
      });
    }
    if (!entry.assembly) {
      errors.push({
        id: `empty-assembly-${identifier}`,
        type: 'error',
        entryId: entry.id,
        field: 'assembly',
        message: 'Assembly selection is required.',
      });
    }

    // 4. Validate assembly mapping if snapshot is loaded
    if (mapping && entry.system && entry.assembly) {
      const key = `${entry.system}:${entry.assembly}`.toLowerCase();
      if (!assemblyMap.has(key)) {
        errors.push({
          id: `invalid-mapping-${identifier}`,
          type: 'error',
          entryId: entry.id,
          field: 'assembly',
          message: `Selected Assembly "${entry.assembly}" in System "${entry.system}" does not exist in the official assemblies database.`,
        });
      }
    }

    // 5. Cost / Emission fields must use decimal points, reject commas
    Object.keys(entry).forEach((key) => {
      if (key.startsWith('_') || key === 'id') return;
      const lowerKey = key.toLowerCase();
      const val = String(entry[key] || '').trim();

      if (val && (lowerKey.includes('cost') || lowerKey.includes('emission') || lowerKey.includes('emissions'))) {
        if (containsDecimalComma(val)) {
          errors.push({
            id: `comma-error-${key}-${identifier}`,
            type: 'error',
            entryId: entry.id,
            field: key,
            message: `Field "${key}" value "${val}" must use decimal point (e.g. 1.23) instead of a comma.`,
          });
        } else {
          const num = parseFloat(val);
          if (isNaN(num)) {
            errors.push({
              id: `number-warning-${key}-${identifier}`,
              type: 'warning',
              entryId: entry.id,
              field: key,
              message: `Field "${key}" value "${val}" should be a valid number.`,
            });
          }
        }
      }
    });

    // 6. Check restricted reference changes for existing imported entries
    const original = originalMap.get(entry.id);
    if (original) {
      const restrictedFields = ['_part_uid', '_subpart_uid', '_parent_part_uid', '_assembly_uid'];
      restrictedFields.forEach((field) => {
        if (entry[field] !== original[field]) {
          errors.push({
            id: `restricted-field-change-${field}-${identifier}`,
            type: 'error',
            entryId: entry.id,
            field,
            message: `Official reference column "${field}" cannot be modified for existing rows.`,
          });
        }
      });

      // Moving assembly check
      if (entry.system !== original.system || entry.assembly !== original.assembly) {
        errors.push({
          id: `restricted-move-${identifier}`,
          type: 'error',
          entryId: entry.id,
          field: 'assembly',
          message: `Cannot move an existing imported item to another assembly. Create a new part and delete the old one instead.`,
        });
      }
    }
  });

  return errors;
}
