import Papa from 'papaparse';
import { ColumnMapping, AssemblyRow, BOMEntry } from '../types';
import { OFFICIAL_ASSEMBLY_UIDS, OFFICIAL_SYSTEMS } from '../fixtures/assemblyCatalog';

// Expand short system code to full portal format: 'ET' → 'ET - Engine and Tractive System'
function expandSystemCode(code: string): string {
  const sys = OFFICIAL_SYSTEMS.find((s) => s.code === code.toUpperCase());
  return sys ? `${sys.code} - ${sys.name}` : code;
}

// Extract short 2-letter system code: 'ET - Engine and Tractive System' → 'et', 'ET' → 'et'
function getSystemCode(systemStr: string): string {
  if (!systemStr) return '';
  const trimmed = systemStr.trim();
  const prefixMatch = trimmed.match(/^([A-Z]{2})\b/i);
  if (prefixMatch) {
    const code = prefixMatch[1].toUpperCase();
    if (OFFICIAL_SYSTEMS.some((s) => s.code === code)) {
      return code.toLowerCase();
    }
  }
  const sysByName = OFFICIAL_SYSTEMS.find(
    (s) => s.name.toLowerCase() === trimmed.toLowerCase() || trimmed.toLowerCase().includes(s.name.toLowerCase())
  );
  if (sysByName) return sysByName.code.toLowerCase();
  return trimmed.toLowerCase();
}

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
      makeBuy: findHeader(partsHeaders, [/make_buy|makebuy|make\/buy|make_or_buy/i], 'makebuy'),
      quantity: findHeader(partsHeaders, [/quantity/i, /qty/i], 'quantity'),
      comments: findHeader(partsHeaders, [/comments/i, /comment/i, /description/i], 'comments'),
      customId: findHeader(partsHeaders, [/custom_id|custom_part_id|part_no_custom/i], 'part_no_custom'),
      delete: findHeader(partsHeaders, [/^delete$/i, /deleted/i], 'delete'),
    },
    subparts: {
      uid: findHeader(subpartsHeaders, [/subpart_uid/i], 'subpart_uid'),
      partUid: findHeader(subpartsHeaders, [/part_uid/i], 'part_uid'),
      partNo: findHeader(subpartsHeaders, [/part_no/i, /part_number/i], 'part_no'),
      name: findHeader(subpartsHeaders, [/^subpart$/i, /^part$/i, /subpart_name/i, /part_name/i, /^name$/i, /^subtype$/i, /^type$/i], 'subtype'),
      makeBuy: findHeader(subpartsHeaders, [/make_buy|makebuy|make\/buy|make_or_buy/i], 'makebuy'),
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
  });
}

// Convert parts.csv, subparts.csv, assemblies.csv into unified BOMEntry[]
export function parseBOMCSVs(
  assembliesData: Record<string, string>[],
  partsData: Record<string, string>[],
  subpartsData: Record<string, string>[],
  mapping: ColumnMapping
): BOMEntry[] {
  const entries: BOMEntry[] = [];

  // Maps for fast cross-referencing
  const assemblyMap = new Map<string, Record<string, string>>();
  assembliesData.forEach((a) => {
    const uid = String(a[mapping.assemblies.uid] || '');
    if (uid) assemblyMap.set(uid, a);
  });

  const partMap = new Map<string, Record<string, string>>();
  partsData.forEach((p) => {
    const uid = String(p[mapping.parts.uid] || '');
    if (uid) partMap.set(uid, p);
  });

  // 1. Process all Parts
  partsData.forEach((part, index) => {
    const partUid = String(part[mapping.parts.uid] || '');
    const assemblyUid = String(part[mapping.parts.assemblyUid] || '');
    const assembly = assemblyMap.get(assemblyUid);

    let system = '';
    let assemblyName = '';

    if (assembly) {
      system = String(assembly[mapping.assemblies.system] || '');
      assemblyName = String(assembly[mapping.assemblies.name] || '');
    }

    entries.push({
      id: `part-${partUid || index}`,
      system,
      assembly: assemblyName,
      subAssembly: 'none', // Direct part under assembly
      part: String(part[mapping.parts.name] || ''),
      make_buy: String(part[mapping.parts.makeBuy] || 'make'),
      quantity: String(part[mapping.parts.quantity] || '1'),
      comments: String(part[mapping.parts.comments] || ''),
      custom_id: String(part[mapping.parts.customId] || ''),
      delete: String(part[mapping.parts.delete] || '0'),
      
      _part_uid: partUid,
      _assembly_uid: assemblyUid,
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
        system = String(assembly[mapping.assemblies.system] || '');
        assemblyName = String(assembly[mapping.assemblies.name] || '');
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
      custom_id: '',
      delete: String(sub[mapping.subparts.delete] || '0'),
      
      _subpart_uid: subpartUid,
      _part_uid: parentPartUid,
      _parent_part_uid: parentPartUid,
      _assembly_uid: assemblyUid,

      ...sub,
    });
  });

  return entries;
}

// Convert portal snapshot (parts + assemblies) into unified BOMEntry[]
export function importSnapshotToEntries(
  partsData: Record<string, string>[],
  assembliesData: Record<string, string>[],
  subpartsData: Record<string, string>[] = [],
  mapping: ColumnMapping
): BOMEntry[] {
  return parseBOMCSVs(assembliesData, partsData, subpartsData, mapping);
}

/**
 * Step 1 of the 2-step FSG portal workflow:
 * Generate assemblies.csv with EMPTY assembly_uid for new custom assemblies
 * so the portal creates new assembly records and assigns real UIDs.
 */
export function exportAssembliesRegistrationCSV(
  entries: BOMEntry[],
  assemblies: AssemblyRow[],
  mapping: ColumnMapping,
  assembliesHeaders: string[] = ['assembly_uid', 'system', 'assembly', 'sub_assembly', 'assembly_no', 'comments']
): string {
  const seen = new Map<string, { system: string; assembly: string }>();
  entries.forEach((e) => {
    if (e.system && e.assembly) {
      const key = `${e.system}:${e.assembly}`.toLowerCase();
      if (!seen.has(key)) seen.set(key, { system: e.system, assembly: e.assembly });
    }
  });

  const rows: any[] = [];
  seen.forEach((val) => {
    const sysCode = getSystemCode(val.system);
    const catalogKey = `${sysCode}:${val.assembly.trim()}`.toLowerCase();
    
    // Skip official FSG assemblies (they already exist in the portal)
    if (OFFICIAL_ASSEMBLY_UIDS[catalogKey]) return;

    // Skip assemblies already in the imported snapshot
    const existsInSnapshot = assemblies.some((a) => {
      const sysVal = a[mapping.assemblies.system];
      const nameVal = a[mapping.assemblies.name];
      return (
        sysVal && nameVal &&
        getSystemCode(String(sysVal)) === sysCode &&
        String(nameVal).trim().toLowerCase() === val.assembly.trim().toLowerCase()
      );
    });
    if (existsInSnapshot) return;

    const row: Record<string, any> = {};
    assembliesHeaders.forEach((h) => { row[h] = ''; });
    row[mapping.assemblies.uid] = ''; // EMPTY — portal assigns the real UID
    row[mapping.assemblies.system] = expandSystemCode(val.system);
    row[mapping.assemblies.name] = val.assembly;
    row['sub_assembly'] = 'none';
    row['assembly_no'] = '';
    row['comments'] = '';
    rows.push(row);
  });

  return Papa.unparse(rows, { header: true, columns: assembliesHeaders });
}

// Translate unified BOMEntry[] back into parts.csv and subparts.csv records
// Normalize make_buy to FSG portal format: 'make'→'m', 'buy'→'b'
function normalizeMakeBuy(val: string | undefined): string {
  if (!val) return 'b';
  const v = val.trim().toLowerCase();
  if (v === 'make' || v === 'm') return 'm';
  if (v === 'buy' || v === 'b') return 'b';
  return 'b';
}

export function exportEntriesToCSV(
  entries: BOMEntry[],
  assemblies: AssemblyRow[],
  mapping: ColumnMapping,
  partsHeaders: string[],
  subpartsHeaders: string[],
  assembliesHeaders: string[] = ['assembly_uid', 'system', 'assembly', 'sub_assembly', 'assembly_no', 'comments']
): { parts: any[]; subparts: any[]; assemblies: any[] } {
  const parts: any[] = [];
  const subparts: any[] = [];

  // 1. Detect all unique (system, assembly) pairs from entries
  const uniqueAssembliesMap = new Map<string, { system: string; assembly: string }>();
  entries.forEach((e) => {
    if (e.system && e.assembly) {
      const key = `${e.system}:${e.assembly}`.toLowerCase();
      if (!uniqueAssembliesMap.has(key)) {
        uniqueAssembliesMap.set(key, { system: e.system, assembly: e.assembly });
      }
    }
  });

  // 2. Build the final assemblies list and resolve UIDs
  const exportedAssemblies: any[] = [];
  const assemblyUidLookup = new Map<string, string>();
  let tempAssemblyIdCounter = 1;

  uniqueAssembliesMap.forEach((val, key) => {
    const sysCode = getSystemCode(val.system);
    const catalogKey = `${sysCode}:${val.assembly.trim()}`.toLowerCase();

    // Check if it exists in the imported assemblies snapshot (real portal data)
    const existing = assemblies.find((a) => {
      const sysVal = a[mapping.assemblies.system];
      const nameVal = a[mapping.assemblies.name];
      return (
        sysVal && nameVal &&
        getSystemCode(String(sysVal)) === sysCode &&
        String(nameVal).trim().toLowerCase() === val.assembly.trim().toLowerCase()
      );
    });

    if (existing && existing[mapping.assemblies.uid] && !String(existing[mapping.assemblies.uid]).startsWith('AREF-')) {
      exportedAssemblies.push(existing);
      assemblyUidLookup.set(key, String(existing[mapping.assemblies.uid]));
      return;
    }

    // Assembly is not in the team's imported snapshot (e.g. blank BOM or new assembly).
    // Assign a temporary reference key (AREF-x) in BOTH assemblies.csv and parts.csv.
    // When uploaded together, the portal uses AREF-x to create the assembly and link all parts in the same batch.
    const tempRefKey = `AREF-${tempAssemblyIdCounter++}`;

    const newAssembly: Record<string, any> = {};
    const asmHeaders = assembliesHeaders.length > 0
      ? assembliesHeaders
      : ['assembly_uid', 'system', 'assembly', 'sub_assembly', 'assembly_no', 'comments'];

    asmHeaders.forEach((h) => { newAssembly[h] = ''; });

    newAssembly[mapping.assemblies.uid] = tempRefKey;
    newAssembly[mapping.assemblies.system] = expandSystemCode(val.system);
    newAssembly[mapping.assemblies.name] = val.assembly;
    newAssembly['sub_assembly'] = 'none';
    newAssembly['assembly_no'] = '';
    newAssembly['comments'] = '';

    exportedAssemblies.push(newAssembly);
    assemblyUidLookup.set(key, tempRefKey);
  });

  // Track parent Parts created for sub-assemblies
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
    let assemblyUid = e._assembly_uid || '';
    if (!assemblyUid || assemblyUid.startsWith('AREF-')) {
      assemblyUid = assemblyUidLookup.get(aKey) || '';
    }

    // Truncate fields per FSG limits
    const rawPartName = e.part || '';
    const partName = rawPartName.length > 25 ? rawPartName.substring(0, 25).trim() : rawPartName;
    const rawComments = e.comments || '';
    const commentsText = rawComments.length > 40 ? rawComments.substring(0, 40).trim() : rawComments;

    const partRecord: Record<string, any> = { ...e };
    
    // Set official keys
    partRecord[mapping.parts.uid] = partUid;
    partRecord[mapping.parts.assemblyUid] = assemblyUid;
    partRecord[mapping.parts.name] = partName;
    partRecord[mapping.parts.makeBuy] = normalizeMakeBuy(e.make_buy);
    partRecord[mapping.parts.quantity] = e.quantity;
    partRecord[mapping.parts.comments] = commentsText;
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
      name: partName,
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
      let assemblyUid = e._assembly_uid || '';
      if (!assemblyUid || assemblyUid.startsWith('AREF-')) {
        assemblyUid = assemblyUidLookup.get(aKey) || '';
      }
      
      const tempId = `NEW-${tempPartIdCounter++}`;
      
      // Create a default Part container
      const newPartRecord: Record<string, any> = {};
      partsHeaders.forEach((h) => {
        newPartRecord[h] = '';
      });

      const rawParentName = parentName || '';
      const truncatedParentName = rawParentName.length > 25 ? rawParentName.substring(0, 25).trim() : rawParentName;

      newPartRecord[mapping.parts.uid] = tempId;
      newPartRecord[mapping.parts.assemblyUid] = assemblyUid;
      newPartRecord[mapping.parts.name] = truncatedParentName;
      newPartRecord[mapping.parts.makeBuy] = 'm'; // Default make
      newPartRecord[mapping.parts.quantity] = '1';
      newPartRecord[mapping.parts.comments] = 'Auto-generated sub-assembly container';
      newPartRecord[mapping.parts.delete] = e.delete; 

      parts.push(newPartRecord);
      
      parentInfo = {
        uid: tempId,
        assembly_uid: assemblyUid,
        name: truncatedParentName,
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

    const rawSubpartName = e.part || '';
    const subpartName = rawSubpartName.length > 25 ? rawSubpartName.substring(0, 25).trim() : rawSubpartName;
    const rawComments = e.comments || '';
    const commentsText = rawComments.length > 40 ? rawComments.substring(0, 40).trim() : rawComments;

    // Now write the subpart row
    const subRecord: Record<string, any> = { ...e };

    subRecord[mapping.subparts.uid] = e._subpart_uid || '';
    subRecord[mapping.subparts.partUid] = parentInfo.uid;
    subRecord[mapping.subparts.name] = subpartName;
    subRecord[mapping.subparts.makeBuy] = normalizeMakeBuy(e.make_buy);
    subRecord[mapping.subparts.quantity] = e.quantity;
    subRecord[mapping.subparts.comments] = commentsText;
    subRecord[mapping.subparts.delete] = e.delete;

    // Clean up internal _ keys
    Object.keys(subRecord).forEach((k) => {
      if (k.startsWith('_')) delete subRecord[k];
    });

    subparts.push(subRecord);
  });

  return { parts, subparts, assemblies: exportedAssemblies };
}
