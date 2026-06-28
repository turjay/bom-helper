import React from 'react';
import { Edit2, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { BOMEntry } from '../types';

interface BOMTableProps {
  entries: BOMEntry[];
  onEntryChange: (updatedEntry: BOMEntry) => void;
  onEntryDelete: (id: string, deleteFlag: boolean) => void;
  onEditClick: (entry: BOMEntry) => void;
  customHeaders: string[];
}

export const BOMTable: React.FC<BOMTableProps> = ({
  entries,
  onEntryChange,
  onEntryDelete,
  onEditClick,
  customHeaders,
}) => {
  const handleInputChange = (rowIndex: number, field: keyof BOMEntry, value: string) => {
    const updated = { ...entries[rowIndex], [field]: value };
    onEntryChange(updated);
  };

  const handleCustomFieldChange = (rowIndex: number, fieldName: string, value: string) => {
    const updated = { ...entries[rowIndex], [fieldName]: value };
    onEntryChange(updated);
  };

  if (entries.length === 0) {
    return (
      <div className="empty-state" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
        <AlertTriangle size={24} />
        <p style={{ fontSize: '0.875rem' }}>No entries found. Create a new BOM entry above to start populate your vehicle parts list.</p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      <table className="bom-table">
        <thead>
          <tr>
            <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
            <th>System</th>
            <th>Assembly</th>
            <th>Sub Assembly</th>
            <th>Part Name</th>
            <th>Make/Buy</th>
            <th style={{ width: '80px' }}>Quantity</th>
            <th style={{ width: '120px' }}>Custom ID</th>
            <th>Comments</th>
            <th>Created By</th>
            
            {/* Dynamic Headers */}
            {customHeaders.map((header) => (
              <th key={header}>{header.replace(/_/g, ' ').toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, rowIndex) => {
            const isImported = !!entry._part_uid || !!entry._subpart_uid;
            const isNew = !isImported;
            const isDeleted = entry.delete === '1';

            let rowClass = '';
            if (isDeleted) rowClass = 'row-deleted';
            else if (isNew) rowClass = 'row-new';

            return (
              <tr key={entry.id} className={rowClass}>
                {/* Actions */}
                <td style={{ textAlign: 'center' }}>
                  <div className="flex-row-center" style={{ justifyContent: 'center', gap: '0.25rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px' }}
                      onClick={() => onEditClick(entry)}
                      title="Edit details in form"
                      disabled={isDeleted}
                    >
                      <Edit2 size={12} />
                    </button>
                    
                    {isImported ? (
                      <button
                        className={`btn btn-sm ${isDeleted ? 'btn-secondary' : 'btn-danger'}`}
                        style={{ padding: '4px' }}
                        onClick={() => onEntryDelete(entry.id, !isDeleted)}
                        title={isDeleted ? 'Restore entry' : 'Mark entry for deletion'}
                      >
                        {isDeleted ? <RotateCcw size={12} /> : <Trash2 size={12} />}
                      </button>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '4px' }}
                        onClick={() => onEntryDelete(entry.id, true)}
                        title="Remove local draft entry"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </td>

                {/* System Badge */}
                <td>
                  <span className="badge" style={{ background: '#334155', color: '#f8fafc', fontWeight: 'bold' }}>
                    {entry.system}
                  </span>
                </td>

                {/* Assembly Name */}
                <td style={{ color: isDeleted ? 'var(--text-muted)' : 'var(--text-bright)', fontWeight: 500 }}>
                  {entry.assembly}
                </td>

                {/* Sub Assembly */}
                <td style={{ color: entry.subAssembly === 'none' ? 'var(--text-muted)' : 'var(--color-success-border)' }}>
                  {entry.subAssembly === 'none' ? '-' : entry.subAssembly}
                </td>

                {/* Part Name */}
                <td>
                  <input
                    type="text"
                    className="inline-edit-input"
                    value={entry.part}
                    onChange={(e) => handleInputChange(rowIndex, 'part', e.target.value)}
                    disabled={isDeleted}
                  />
                </td>

                {/* Make/Buy */}
                <td>
                  <select
                    className="inline-edit-input"
                    style={{ width: '80px' }}
                    value={entry.make_buy}
                    onChange={(e) => handleInputChange(rowIndex, 'make_buy', e.target.value)}
                    disabled={isDeleted}
                  >
                    <option value="make">make</option>
                    <option value="buy">buy</option>
                  </select>
                </td>

                {/* Quantity */}
                <td>
                  <input
                    type="text"
                    className="inline-edit-input"
                    value={entry.quantity}
                    onChange={(e) => handleInputChange(rowIndex, 'quantity', e.target.value)}
                    disabled={isDeleted}
                  />
                </td>

                {/* Custom ID */}
                <td>
                  <input
                    type="text"
                    className="inline-edit-input"
                    value={entry.custom_id}
                    onChange={(e) => handleInputChange(rowIndex, 'custom_id', e.target.value)}
                    disabled={isDeleted || isImported}
                  />
                </td>

                {/* Comments */}
                <td>
                  <input
                    type="text"
                    className="inline-edit-input"
                    value={entry.comments}
                    onChange={(e) => handleInputChange(rowIndex, 'comments', e.target.value)}
                    disabled={isDeleted}
                  />
                </td>

                {/* Created By Metadata */}
                <td>
                  {entry.createdBy_name ? (
                    <span
                      className="badge"
                      style={{ background: '#334155', color: '#cbd5e1' }}
                      title={entry.createdBy_email}
                    >
                      {entry.createdBy_name}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>-</span>
                  )}
                </td>

                {/* Render Dynamic Custom Fields */}
                {customHeaders.map((header) => {
                  const val = entry[header] !== undefined ? String(entry[header]) : '';
                  return (
                    <td key={header}>
                      <input
                        type="text"
                        className="inline-edit-input"
                        value={val}
                        onChange={(e) => handleCustomFieldChange(rowIndex, header, e.target.value)}
                        disabled={isDeleted}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
