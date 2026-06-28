export interface AssemblyRow {
  assembly_uid: string;
  assembly: string;
  system: string;
  [key: string]: string;
}

export interface BOMEntry {
  id: string; // Generated client-side UUID (or Firestore Document ID)
  system: string; // e.g. 'BR'
  assembly: string; // e.g. 'Brake Discs'
  subAssembly: string; // 'none' or custom sub-assembly name
  part: string; // Part name (or subpart name)
  make_buy: string; // 'make' or 'buy'
  quantity: string;
  comments: string;
  custom_id: string;
  delete: string; // '0' or '1'
  
  // Collaborator Metadata
  createdBy_email?: string;
  createdBy_name?: string;
  createdAt?: string; // ISO date timestamp for ordering

  // Official references preserved from imported snapshots
  _part_uid?: string; // If this entry represents a part/sub-assembly in parts.csv
  _subpart_uid?: string; // If this entry represents a subpart in subparts.csv
  _parent_part_uid?: string; // Parent part_uid for subparts
  _assembly_uid?: string; // Assembly UID associated with the part

  // Custom columns preserved from CSV import
  [key: string]: string | undefined;
}

export interface ColumnMapping {
  assemblies: {
    uid: string;
    name: string;
    system: string;
  };
  parts: {
    uid: string;
    assemblyUid: string;
    partNo: string;
    name: string;
    makeBuy: string;
    quantity: string;
    comments: string;
    customId: string;
    delete: string;
  };
  subparts: {
    uid: string;
    partUid: string;
    partNo: string;
    name: string;
    makeBuy: string;
    quantity: string;
    comments: string;
    delete: string;
  };
}

export interface ValidationError {
  id: string; // Unique identifier
  type: 'error' | 'warning';
  entryId: string; // Links validation error to the local entry id
  field: string; // Key of the field failing validation
  message: string;
}

export interface BOMDraft {
  filePrefix: string;
  entries: BOMEntry[];
  assemblies: AssemblyRow[];
  assembliesHeaders: string[];
  partsHeaders: string[];
  subpartsHeaders: string[];
  columnMapping: ColumnMapping | null;
  lastSaved: string;
}
