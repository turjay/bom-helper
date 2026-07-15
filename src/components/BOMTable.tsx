import React, { useState } from 'react';
import { Edit2, Trash2, RotateCcw, AlertTriangle, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleInputChange = (entry: BOMEntry, field: keyof BOMEntry, value: string) => {
    const updated = { ...entry, [field]: value };
    onEntryChange(updated);
  };

  const handleCustomFieldChange = (entry: BOMEntry, fieldName: string, value: string) => {
    const updated = { ...entry, [fieldName]: value };
    onEntryChange(updated);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortedEntries = () => {
    if (!sortField) return entries;

    return [...entries].sort((a, b) => {
      const valA = a[sortField] !== undefined ? String(a[sortField]).toLowerCase() : '';
      const valB = b[sortField] !== undefined ? String(b[sortField]).toLowerCase() : '';

      // Numeric comparison
      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB) && valA.trim() !== '' && valB.trim() !== '') {
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const sortedEntries = getSortedEntries();

  const renderHeader = (label: string, field: string, width?: string) => {
    const isSorted = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        style={{ cursor: 'pointer', userSelect: 'none', width }}
        title={`Sort by ${label}`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
          <span>{label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? <ChevronUp size={13} style={{ color: '#818cf8' }} /> : <ChevronDown size={13} style={{ color: '#818cf8' }} />
          ) : (
            <ArrowUpDown size={11} style={{ opacity: 0.3 }} />
          )}
        </div>
      </th>
    );
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
            {renderHeader('System', 'system')}
            {renderHeader('Assembly', 'assembly')}
            {renderHeader('Sub Assembly', 'subAssembly')}
            {renderHeader('Part Name', 'part')}
            {renderHeader('Make/Buy', 'make_buy')}
            {renderHeader('Quantity', 'quantity', '80px')}
            {renderHeader('Custom ID', 'custom_id', '120px')}
            {renderHeader('Comments', 'comments')}
            {renderHeader('Created By', 'createdBy_name')}
            
            {/* Dynamic Headers */}
            {customHeaders.map((header) => (
              <React.Fragment key={header}>
                {renderHeader(header.replace(/_/g, ' ').toUpperCase(), header)}
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedEntries.map((entry) => {
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
                    onChange={(e) => handleInputChange(entry, 'part', e.target.value)}
                    disabled={isDeleted}
                  />
                </td>

                {/* Make/Buy */}
                <td>
                  <select
                    className="inline-edit-input"
                    style={{ width: '80px' }}
                    value={entry.make_buy}
                    onChange={(e) => handleInputChange(entry, 'make_buy', e.target.value)}
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
                    onChange={(e) => handleInputChange(entry, 'quantity', e.target.value)}
                    disabled={isDeleted}
                  />
                </td>

                {/* Custom ID */}
                <td>
                  <input
                    type="text"
                    className="inline-edit-input"
                    value={entry.custom_id}
                    onChange={(e) => handleInputChange(entry, 'custom_id', e.target.value)}
                    disabled={isDeleted || isImported}
                  />
                </td>

                {/* Comments */}
                <td>
                  <input
                    type="text"
                    className="inline-edit-input"
                    value={entry.comments}
                    onChange={(e) => handleInputChange(entry, 'comments', e.target.value)}
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
                        onChange={(e) => handleCustomFieldChange(entry, header, e.target.value)}
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
