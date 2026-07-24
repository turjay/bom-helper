import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Download, AlertTriangle, AlertCircle, FileJson, FileSpreadsheet } from 'lucide-react';
import { AssemblyRow, BOMEntry, ValidationError, ColumnMapping } from '../types';
import { generateCSV, exportEntriesToCSV } from '../utils/csvParser';
import { exportToExcel } from '../utils/excelExporter';

interface PreviewReportProps {
  entries: BOMEntry[];
  assemblies: AssemblyRow[];
  originalEntries: BOMEntry[];
  validationErrors: ValidationError[];
  mapping: ColumnMapping | null;
  filePrefix: string;
  
  partsHeaders: string[];
  subpartsHeaders: string[];
  assembliesHeaders: string[];
}

export const PreviewReport: React.FC<PreviewReportProps> = ({
  entries,
  assemblies,
  originalEntries,
  validationErrors,
  mapping,
  filePrefix,
  partsHeaders,
  subpartsHeaders,
  assembliesHeaders,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const hasMapping = !!mapping;

  const handleExportExcelClick = async () => {
    try {
      const prefix = filePrefix || 'BOM_Report';
      await exportToExcel(entries, assemblies, prefix);
    } catch (error) {
      console.error('Failed to export to Excel', error);
      alert('An error occurred during Excel export.');
    }
  };

  // Stats calculation
  const newEntries = entries.filter((e) => !e._part_uid && !e._subpart_uid).length;
  const deletedEntries = entries.filter((e) => e.delete === '1').length;
  
  const updatedEntries = entries.filter((e) => {
    const isImported = !!e._part_uid || !!e._subpart_uid;
    if (!isImported) return false;
    const orig = originalEntries.find((o) => o.id === e.id);
    if (!orig) return false;
    return Object.keys(e).some((k) => e[k] !== orig[k]);
  }).length;

  const errors = validationErrors.filter((v) => v.type === 'error');
  const hasErrors = errors.length > 0;

  const triggerExport = () => {
    // Generate exports
    const resolvedMapping = mapping || {
      assemblies: { uid: 'assembly_uid', name: 'assembly', system: 'system' },
      parts: {
        uid: 'part_uid',
        assemblyUid: 'assembly_uid',
        partNo: 'part_no',
        name: 'part',
        makeBuy: 'make_buy',
        quantity: 'quantity',
        comments: 'comments',
        customId: 'custom_id',
        delete: 'delete',
      },
      subparts: {
        uid: 'subpart_uid',
        partUid: 'part_uid',
        partNo: 'part_no',
        name: 'part',
        makeBuy: 'make_buy',
        quantity: 'quantity',
        comments: 'comments',
        delete: 'delete',
      },
    };

    const resolvedPartsHeaders = partsHeaders.length > 0 ? partsHeaders : [
      'part_uid', 'assembly_uid', 'part_no', 'part', 'make_buy', 'quantity', 'comments', 'custom_id', 'delete'
    ];
    const resolvedSubpartsHeaders = subpartsHeaders.length > 0 ? subpartsHeaders : [
      'subpart_uid', 'part_uid', 'part_no', 'part', 'make_buy', 'quantity', 'comments', 'delete'
    ];
    const resolvedAssembliesHeaders = assembliesHeaders.length > 0 ? assembliesHeaders : [
      'assembly_uid', 'assembly', 'system'
    ];

    const { parts, subparts } = exportEntriesToCSV(
      entries,
      assemblies,
      resolvedMapping,
      resolvedPartsHeaders,
      resolvedSubpartsHeaders
    );

    const prefix = filePrefix || 'DRAFT_BOM';

    const assembliesCSV = generateCSV(assemblies, resolvedAssembliesHeaders);
    const partsCSV = generateCSV(parts, resolvedPartsHeaders);
    const subpartsCSV = generateCSV(subparts, resolvedSubpartsHeaders);

    downloadFile(`${prefix}_assemblies.csv`, assembliesCSV);
    downloadFile(`${prefix}_parts.csv`, partsCSV);
    downloadFile(`${prefix}_subparts.csv`, subpartsCSV);

    setShowDeleteConfirm(false);
  };

  const downloadFile = (filename: string, text: string) => {
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportClick = () => {
    if (deletedEntries > 0) {
      setShowDeleteConfirm(true);
    } else {
      triggerExport();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', flex: 1 }}>
      
      {/* 1. MAPPING REQUIRED NOTIFICATION */}
      {!hasMapping && (
        <div className="alert alert-error" style={{ alignItems: 'flex-start' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ fontWeight: 600 }}>Official assembly_uid mapping is missing.</h4>
            <p style={{ color: 'inherit', fontSize: '0.8125rem' }}>
              Import the official FSG snapshot in the "FSG Snapshot / Mapping" settings tab before performing your final CSV export. Without a snapshot, generated CSV files will use placeholder IDs and cannot be imported directly into the FSG portal.
            </p>
          </div>
        </div>
      )}

      {/* 2. VALIDATION ALERTS */}
      {hasErrors ? (
        <div className="alert alert-error" style={{ alignItems: 'center' }}>
          <ShieldAlert size={20} style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontWeight: 600 }}>Validation Blocked</h4>
            <p style={{ color: 'inherit', fontSize: '0.8125rem' }}>
              We found {errors.length} validation error{errors.length > 1 ? 's' : ''} in your entries. Correct these inline in the list below before exporting.
            </p>
          </div>
        </div>
      ) : (
        <div className="alert alert-success" style={{ alignItems: 'center' }}>
          <ShieldCheck size={20} style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ fontWeight: 600 }}>Validation Succeeded</h4>
            <p style={{ color: 'inherit', fontSize: '0.8125rem' }}>
              All entered parts and subparts comply with FSG logic. Ready for download.
            </p>
          </div>
        </div>
      )}

      {/* 3. WORKING SUMMARY STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        <div className="panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-success-border)' }}>{newEntries}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>NEW ENTRIES</div>
        </div>
        <div className="panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-warning-border)' }}>{updatedEntries}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MODIFIED ENTRIES</div>
        </div>
        <div className="panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-error)' }}>{deletedEntries}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>DELETED ITEMS</div>
        </div>
        <div className="panel" style={{ textAlign: 'center', padding: '1rem' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: hasErrors ? 'var(--color-error)' : 'var(--text-bright)' }}>
            {errors.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CRITICAL ERRORS</div>
        </div>
      </div>

      {/* 4. AUDIT FINDINGS */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h4 style={{ fontSize: '0.875rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          Verification Log ({validationErrors.length} findings)
        </h4>
        
        {validationErrors.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
            No validation errors detected. All entries follow correct formats.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
            {validationErrors.map((err) => (
              <div
                key={err.id}
                className={`alert ${err.type === 'error' ? 'alert-error' : 'alert-warning'}`}
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem' }}
              >
                <AlertCircle size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong>{err.field.toUpperCase()}</strong>: {err.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. EXPORT BAR */}
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Export Package</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {hasMapping
              ? `Generates production CSV bundle prefixed with: ${filePrefix}_`
              : 'Generates draft CSV files for internal revision only.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportExcelClick}
            disabled={hasErrors}
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <FileSpreadsheet size={16} />
            Export Excel
          </button>

          <button
            className="btn btn-primary"
            onClick={handleExportClick}
            disabled={hasErrors}
            style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={16} />
            {hasMapping ? 'Export FSG CSV' : 'Export Draft CSV'}
          </button>
        </div>
      </div>

      {/* 6. DELETION DIALOG */}
      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header" style={{ color: 'var(--color-error)' }}>
              <AlertTriangle size={20} />
              <h3>Confirm Permanent Deletions</h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="alert alert-error">
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Deletions are permanent in the official FSG system!</strong>
                  <br />
                  Deleted items will be marked with <code>delete = 1</code>. Uploading this to the official FSG portal will permanently delete these parts and all associated subparts.
                </span>
              </div>
              <p style={{ fontSize: '0.875rem' }}>
                Your CSV bundle contains <strong>{deletedEntries}</strong> marked deletions. Are you sure you want to proceed with downloading the files?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={triggerExport}>
                Proceed with Export
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
