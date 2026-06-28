import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { parseCSV, extractFilePrefix } from '../utils/csvParser';

interface FileImportProps {
  onImportComplete: (data: {
    assemblies: any[];
    parts: any[];
    subparts: any[];
    assembliesHeaders: string[];
    partsHeaders: string[];
    subpartsHeaders: string[];
    filePrefix: string;
  }) => void;
  onClearMapping: () => void;
  hasMapping: boolean;
  filePrefix: string;
  mappingStats: {
    assembliesCount: number;
    partsCount: number;
    subpartsCount: number;
  };
}

export const FileImport: React.FC<FileImportProps> = ({
  onImportComplete,
  onClearMapping,
  hasMapping,
  filePrefix,
  mappingStats,
}) => {
  const [assemblies, setAssemblies] = useState<{ data: any[]; headers: string[]; name: string } | null>(null);
  const [parts, setParts] = useState<{ data: any[]; headers: string[]; name: string } | null>(null);
  const [subparts, setSubparts] = useState<{ data: any[]; headers: string[]; name: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileUpload = (
    type: 'assemblies' | 'parts' | 'subparts',
    file: File
  ) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const { data, headers } = parseCSV(text);

        if (type === 'assemblies') {
          setAssemblies({ data, headers, name: file.name });
        } else if (type === 'parts') {
          setParts({ data, headers, name: file.name });
        } else if (type === 'subparts') {
          setSubparts({ data, headers, name: file.name });
        }
      } catch (err) {
        setErrorMsg(`Failed to parse ${file.name}. Ensure it is a valid CSV file.`);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyImport = () => {
    if (!assemblies || !parts || !subparts) {
      setErrorMsg('Please upload all three CSV files.');
      return;
    }

    let prefix = extractFilePrefix(parts.name) || extractFilePrefix(subparts.name) || extractFilePrefix(assemblies.name);
    if (!prefix) {
      const now = new Date();
      prefix = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/-/g, '').replace(/:/g, '');
    }

    onImportComplete({
      assemblies: assemblies.data,
      parts: parts.data,
      subparts: subparts.data,
      assembliesHeaders: assemblies.headers,
      partsHeaders: parts.headers,
      subpartsHeaders: subparts.headers,
      filePrefix: prefix,
    });

    // Clear local state
    setAssemblies(null);
    setParts(null);
    setSubparts(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* MAPPING STATUS */}
      {hasMapping ? (
        <div className="alert alert-success" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex-row-center">
            <CheckCircle2 size={18} />
            <div>
              <h4 style={{ fontWeight: 600 }}>Official Snapshot Mapping Active</h4>
              <p style={{ color: 'inherit', fontSize: '0.8125rem' }}>
                Prefix: <strong>{filePrefix}</strong> | {mappingStats.assembliesCount} assemblies, {mappingStats.partsCount} parts, {mappingStats.subpartsCount} subparts mapped.
              </p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClearMapping}>
            <RefreshCw size={12} /> Clear Mapping
          </button>
        </div>
      ) : (
        <div className="alert alert-warning" style={{ alignItems: 'flex-start' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontWeight: 600 }}>Running in Offline Draft Mode (No Mapping)</h4>
            <p style={{ color: 'inherit', fontSize: '0.8125rem' }}>
              No official snapshot has been uploaded. You can enter entries, edit, and export drafts. 
              However, you should upload official FSG snapshots to map official <code>assembly_uid</code> values and preserve CSV columns prior to uploading to the official system.
            </p>
          </div>
        </div>
      )}

      {/* UPLOADER */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h3>Upload Official FSG BOM Snapshot</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Upload the three exported CSV files from the official FSG site to automatically synchronize IDs and schema fields.
          </p>
        </div>

        {errorMsg && (
          <div className="alert alert-error">
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {/* Assemblies.csv Dropzone */}
          <label className={`dropzone ${assemblies ? 'loaded' : ''}`}>
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFileUpload('assemblies', e.target.files[0])}
            />
            <div className="dropzone-icon">
              {assemblies ? <CheckCircle2 size={20} /> : <UploadCloud size={20} />}
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>assemblies.csv</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {assemblies ? `${assemblies.data.length} items parsed` : 'Click to select'}
            </div>
          </label>

          {/* Parts.csv Dropzone */}
          <label className={`dropzone ${parts ? 'loaded' : ''}`}>
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFileUpload('parts', e.target.files[0])}
            />
            <div className="dropzone-icon">
              {parts ? <CheckCircle2 size={20} /> : <UploadCloud size={20} />}
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>parts.csv</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {parts ? `${parts.data.length} items parsed` : 'Click to select'}
            </div>
          </label>

          {/* Subparts.csv Dropzone */}
          <label className={`dropzone ${subparts ? 'loaded' : ''}`}>
            <input
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={(e) => e.target.files?.[0] && handleFileUpload('subparts', e.target.files[0])}
            />
            <div className="dropzone-icon">
              {subparts ? <CheckCircle2 size={20} /> : <UploadCloud size={20} />}
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>subparts.csv</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {subparts ? `${subparts.data.length} items parsed` : 'Click to select'}
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleApplyImport}
            disabled={!assemblies || !parts || !subparts}
          >
            Apply Official Snapshot Mapping
          </button>
        </div>
      </div>

    </div>
  );
};
