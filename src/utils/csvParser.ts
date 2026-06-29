import Papa from 'papaparse';
import { ColumnMapping, AssemblyRow, BOMEntry } from '../types';

// Helper to detect column mappings from CSV headers
export function detectColumnMapping(
  assembliesHeaders: string[],
  partsHeaders: string[],
  subpartsHeaders: string[]
): ColumnMapping {
  const findHeader = (headers: string[], patterns: RegExp[], fallback: string): string => {
    for (const pattern of patterns) {
      const match = headers.find((h) => pattern.test(h.trim()));
      if (match) return match;
    }
    return headers.includes(fallback) ? fallback : headers[0] || fallback;
  };

  return {
    assemblies: {
      uid: findHeader(assembliesHeaders, [/assembly_uid/i], 'assembly_uid'),
      name: findHeader(assembliesHeaders, [/^assembly$/i, /assembly_name/i], 'assembly'),
      system: findHeader(assembliesHeaders, [/system/i], 'system'),
    },
    parts: {
      uid: findHeader(partsHeaders, [/part_uid/i], 'part_uid'),
      assemblyUid: findHeader(partsHeaders, [/assembly_uid/i], 'assembly_uid'),
      partNo: findHeader(partsHeaders, [/part_no/i, /part_number/i], 'part_no'),
      name: findHeader(partsHeaders, [/^part$/i, /part_name/i, /^name$/i], 'part'),
      makeBuy: findHeader(partsHeaders, [/make_buy|makebuy|make\/buy|make_or_buy/i], 'make_buy'),
      quantity: findHeader(partsHeaders, [/quantity/i, /qty/i], 'quantity'),
      comments: findHeader(partsHeaders, [/comments/i, /comment/i, /description/i], 'comments'),
      customId: findHeader(partsHeaders, [/custom_id|custom_part_id|part_no_custom/i], 'custom_id'),
      delete: findHeader(partsHeaders, [/^delete$/i, /deleted/i], 'delete'),
    },
    subparts: {
      uid: findHeader(subpartsHeaders, [/subpart_uid/i], 'subpart_uid'),
      partUid: findHeader(subpartsHeaders, [/part_uid/i], 'part_uid'),
      partNo: findHeader(subpartsHeaders, [/part_no/i, /part_number/i], 'part_no'),
      name: findHeader(subpartsHeaders, [/^subpart$/i, /^part$/i, /subpart_name/i, /part_name/i, /^name$/i, /^subtype$/i, /^type$/i], 'part'),
      makeBuy: findHeader(subpartsHeaders, [/make_buy|makebuy|make\/buy|make_or_buy/i], 'make_buy'),
      quantity: findHeader(subpartsHeaders, [/quantity/i, /qty/i], 'quantity'),
      comments: findHeader(subpartsHeaders, [/comments/i, /comment/i, /description/i], 'comments'),
      delete: findHeader(subpartsHeaders, [/^delete$/i, /deleted/i], 'delete'),
    },
  };
}

export function extractFilePrefix(filename: string): string | null {
  const match = filename.trim().match(/^(.+?)_(assemblies|parts|subparts)\.csv$/i);
  return match ? match[1] : null;
}

export function parseCSV<T = Record<string, string>>(csvText: string): { data: T[]; headers: string[] } {
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: 'greedy',
    dynamicTyping: false,
  });

  return {
    data: parsed.data as T[],
    headers: parsed.meta.fields || [],
  };
}

export function formatNumericValue(val: string | number | undefined): string {
  if (val === undefined || val === null) return '';
  const valStr = String(val).trim();
  if (valStr === '') return '';
  const dotStr = valStr.replace(',', '.');
  const num = parseFloat(dotStr);
  if (isNaN(num)) return valStr;
  return dotStr;
}

export function generateCSV<T extends Record<string, any>>(data: T[], headers: string[]): string {
  const processedData = data.map((row) => {
    const newRow = { ...row } as any;
    for (const key of Object.keys(newRow)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('cost') ||
        lowerKey.includes('emission') ||
        lowerKey.includes('qty') ||
        lowerKey.includes('quantity') ||
        lowerKey.includes('mass')
      ) {
        newRow[key] = formatNumericValue(newRow[key]);
      }
    }
    return newRow;
  });

  return Papa.unparse({
    fields: headers,
    data: processedData,
  }, {
    quotes: false,
    header: true,
    newline: '\r\n',
  });
}

// Convert flat CSV rows from official snapshot to our unified BOMEntry array
export function importSnapshotToEntries(
  partsData: any[],
  subpartsData: any[],
  assembliesData: any[],
  mapping: ColumnMapping
): BOMEntry[] {
  const entries: BOMEntry[] = [];

  // Create lookups
  const assemblyMap = new Map(assembliesData.map((a) => [String(a[mapping.assemblies.uid]), a]));
  const partMap = new Map(partsData.map((p) => [String(p[mapping.parts.uid]), p]));

  // Track part UIDs that are used as sub-assemblies (i.e. parent parts of subparts)
  const parentPartUids = new Set(subpartsData.map((s) => String(s[mapping.subparts.partUid])));

  // 1. Process all Parts
  partsData.forEach((part, index) => {
    const partUid = String(part[mapping.parts.uid] || '');
    const assemblyUid = String(part[mapping.parts.assemblyUid] || '');
    const assembly = assemblyMap.get(assemblyUid);

    const system = assembly ? String(assembly[mapping.assemblies.system]) : '';
    const assemblyName = assembly ? String(assembly[mapping.assemblies.name]) : '';

    const isSubAssembly = parentPartUids.has(partUid);

    // Add Part Entry
    entries.push({
      id: `part-${partUid || index}`,
      system,
      assembly: assemblyName,
      subAssembly: 'none', // Its own entry in parts.csv has no sub-assembly grouping column
      part: String(part[mapping.parts.name] || ''),
      make_buy: String(part[mapping.parts.makeBuy] || 'make'),
      quantity: String(part[mapping.parts.quantity] || '1'),
      comments: String(part[mapping.parts.comments] || ''),
      custom_id: String(part[mapping.parts.customId] || ''),
      delete: String(part[mapping.parts.delete] || '0'),
      
      // Keep references
      _part_uid: partUid,
      _assembly_uid: assemblyUid,
      
      // Preserve other fields
      ...part,
    });
  });

  // 2. Process all Subparts
  subpartsData.forEach((sub, index) => {
    const subpartUid = String(sub[mapping.subparts.uid] || '');
    const parentPartUid = String(sub[mapping.subparts.partUid] || '');
    const parentPart = partMap.get(parentPartUid);
    
    let system = '';
    let assemblyName = '';
    let subAssembly = 'Unknown Sub-Assembly';
    let assemblyUid = '';

    if (parentPart) {
      assemblyUid = String(parentPart[mapping.parts.assemblyUid] || '');
      subAssembly = String(parentPart[mapping.parts.name] || '');
      const assembly = assemblyMap.get(assemblyUid);
      if (assembly) {
        system = String(assembly[mapping.assemblies.system]);
        assemblyName = String(assembly[mapping.assemblies.name]);
      }
    }

    entries.push({
      id: `subpart-${subpartUid || index}`,
      system,
      assembly: assemblyName,
      subAssembly,
      part: String(sub[mapping.subparts.name] || ''),
      make_buy: String(sub[mapping.subparts.makeBuy] || 'make'),
      quantity: String(sub[mapping.subparts.quantity] || '1'),
      comments: String(sub[mapping.subparts.comments] || ''),
      custom_id: '', // subparts don't have custom_id in parts.csv logic
      delete: String(sub[mapping.subparts.delete] || '0'),
      
      // Keep references
      _subpart_uid: subpartUid,
      _part_uid: parentPartUid, // Keep track of parent part UID
      _parent_part_uid: parentPartUid,
      _assembly_uid: assemblyUid,

      ...sub,
    });
  });

  return entries;
}

// Translate unified BOMEntry[] back into parts.csv and subparts.csv records
export function exportEntriesToCSV(
  entries: BOMEntry[],
  assemblies: AssemblyRow[],
  mapping: ColumnMapping,
  partsHeaders: string[],
  subpartsHeaders: string[]
): { parts: any[]; subparts: any[] } {
  const parts: any[] = [];
  const subparts: any[] = [];

  // Lookup map for assembly UIDs: (system + assemblyName) -> assembly_uid
  const assemblyUidLookup = new Map<string, string>();
  assemblies.forEach((a) => {
    const key = `${String(a[mapping.assemblies.system])}:${String(a[mapping.assemblies.name])}`.toLowerCase();
    assemblyUidLookup.set(key, String(a[mapping.assemblies.uid]));
  });

  // Track parent Parts created for sub-assemblies
  // subAssemblyName -> Part record
  const subAssemblyPartMap = new Map<string, any>();
  let tempPartIdCounter = 1;

  // Initialize existing parts in map to allow subparts to bind to them
  entries.forEach((e) => {
    if (e.subAssembly === 'none' && e._part_uid) {
      subAssemblyPartMap.set(e.part.toLowerCase(), {
        uid: e._part_uid,
        assembly_uid: e._assembly_uid,
        name: e.part,
        record: e,
      });
    }
  });

  // Step 1: Export Parts (where subAssembly === 'none')
  const directParts = entries.filter((e) => e.subAssembly === 'none');
  directParts.forEach((e) => {
    const partUid = e._part_uid || '';
    
    // Resolve assembly_uid
    const aKey = `${e.system}:${e.assembly}`.toLowerCase();
    const assemblyUid = e._assembly_uid || assemblyUidLookup.get(aKey) || '';

    // Create a base parts record mapping fields
    const partRecord: Record<string, any> = { ...e };
    
    // Set official keys
    partRecord[mapping.parts.uid] = partUid;
    partRecord[mapping.parts.assemblyUid] = assemblyUid;
    partRecord[mapping.parts.name] = e.part;
    partRecord[mapping.parts.makeBuy] = e.make_buy;
    partRecord[mapping.parts.quantity] = e.quantity;
    partRecord[mapping.parts.comments] = e.comments;
    partRecord[mapping.parts.customId] = e.custom_id;
    partRecord[mapping.parts.delete] = e.delete;

    // Clean up internal _ keys
    Object.keys(partRecord).forEach((k) => {
      if (k.startsWith('_')) delete partRecord[k];
    });

    parts.push(partRecord);

    // Keep tracked for potential children subparts
    subAssemblyPartMap.set(e.part.toLowerCase(), {
      uid: partUid,
      assembly_uid: assemblyUid,
      name: e.part,
      record: partRecord,
    });
  });

  // Step 2: Export Subparts & Ensure parent Sub-Assemblies exist
  const subpartEntries = entries.filter((e) => e.subAssembly !== 'none');
  
  subpartEntries.forEach((e) => {
    const parentName = e.subAssembly;
    const parentKey = parentName.toLowerCase();
    
    let parentInfo = subAssemblyPartMap.get(parentKey);
    
    // If parent Part does not exist in our map (so it is not in the parts.csv), we must generate it!
    if (!parentInfo) {
      // Find system / assembly from the subpart entry
      const aKey = `${e.system}:${e.assembly}`.toLowerCase();
      const assemblyUid = e._assembly_uid || assemblyUidLookup.get(aKey) || '';
      
      const tempId = `NEW-${tempPartIdCounter++}`;
      
      // Create a default Part container
      const newPartRecord: Record<string, any> = {};
      partsHeaders.forEach((h) => {
        newPartRecord[h] = '';
      });

      newPartRecord[mapping.parts.uid] = tempId;
      newPartRecord[mapping.parts.assemblyUid] = assemblyUid;
      newPartRecord[mapping.parts.name] = parentName;
      newPartRecord[mapping.parts.makeBuy] = 'make'; // Default make
      newPartRecord[mapping.parts.quantity] = '1';
      newPartRecord[mapping.parts.comments] = 'Auto-generated sub-assembly container';
      newPartRecord[mapping.parts.delete] = e.delete; // If the child subpart is deleted, the container? Default delete=0

      parts.push(newPartRecord);
      
      parentInfo = {
        uid: tempId,
        assembly_uid: assemblyUid,
        name: parentName,
        record: newPartRecord,
      };
      
      subAssemblyPartMap.set(parentKey, parentInfo);
    } else {
      // If the parent exists, but it was a brand-new direct part with no numeric UID yet,
      // it might need a temporary ID so subparts can attach to it in the upload bundle!
      if (!parentInfo.uid) {
        // Generate a new temporary ID if it doesn't have one
        const tempId = `NEW-${tempPartIdCounter++}`;
        parentInfo.uid = tempId;
        
        // Update the parent's actual record in parts
        const targetPart = parts.find((p) => p[mapping.parts.name] === parentInfo.name);
        if (targetPart) {
          targetPart[mapping.parts.uid] = tempId;
        }
      }
    }

    // Now write the subpart row
    const subRecord: Record<string, any> = { ...e };

    subRecord[mapping.subparts.uid] = e._subpart_uid || '';
    subRecord[mapping.subparts.partUid] = parentInfo.uid;
    subRecord[mapping.subparts.name] = e.part;
    subRecord[mapping.subparts.makeBuy] = e.make_buy;
    subRecord[mapping.subparts.quantity] = e.quantity;
    subRecord[mapping.subparts.comments] = e.comments;
    subRecord[mapping.subparts.delete] = e.delete;

    // Clean up internal _ keys
    Object.keys(subRecord).forEach((k) => {
      if (k.startsWith('_')) delete subRecord[k];
    });

    subparts.push(subRecord);
  });

  return { parts, subparts };
}
