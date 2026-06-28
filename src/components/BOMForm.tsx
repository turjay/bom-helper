import React, { useState, useEffect } from 'react';
import { PlusCircle, Check, RotateCcw, AlertCircle } from 'lucide-react';
import { BOMEntry, AssemblyRow } from '../types';
import { OFFICIAL_SYSTEMS, OFFICIAL_ASSEMBLIES } from '../fixtures/assemblyCatalog';

interface BOMFormProps {
  onAddEntry: (entry: Omit<BOMEntry, 'id' | 'delete'>) => void;
  onUpdateEntry: (entry: BOMEntry) => void;
  editingEntry: BOMEntry | null;
  onCancelEdit: () => void;
  
  // Existing entries to populate Sub-Assembly dropdown and check custom columns
  existingEntries: BOMEntry[];
  assemblies: AssemblyRow[];
  hasMapping: boolean;
}

export const BOMForm: React.FC<BOMFormProps> = ({
  onAddEntry,
  onUpdateEntry,
  editingEntry,
  onCancelEdit,
  existingEntries,
  assemblies,
  hasMapping,
}) => {
  // Form Fields State
  const [system, setSystem] = useState<string>('');
  const [assembly, setAssembly] = useState<string>('');
  const [subAssemblyMode, setSubAssemblyMode] = useState<'select' | 'type'>('select');
  const [subAssemblySelect, setSubAssemblySelect] = useState<string>('none');
  const [subAssemblyText, setSubAssemblyText] = useState<string>('');
  
  const [part, setPart] = useState<string>('');
  const [makeBuy, setMakeBuy] = useState<'make' | 'buy'>('make');
  const [comments, setComments] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [customId, setCustomId] = useState<string>('');

  // Track dynamic extra fields (custom CSV columns like cost, material, etc.)
  const [extraFields, setExtraFields] = useState<Record<string, string>>({});

  // Detect custom extra columns present in the workspace
  const getCustomFieldKeys = (): string[] => {
    const keys = new Set<string>();
    existingEntries.forEach((entry) => {
      Object.keys(entry).forEach((k) => {
        if (
          !k.startsWith('_') &&
          k !== 'id' &&
          k !== 'system' &&
          k !== 'assembly' &&
          k !== 'subAssembly' &&
          k !== 'part' &&
          k !== 'make_buy' &&
          k !== 'quantity' &&
          k !== 'comments' &&
          k !== 'custom_id' &&
          k !== 'delete'
        ) {
          keys.add(k);
        }
      });
    });
    return Array.from(keys);
  };

  const customFieldsKeys = getCustomFieldKeys();

  // Populate fields when editingEntry changes
  useEffect(() => {
    if (editingEntry) {
      setSystem(editingEntry.system);
      setAssembly(editingEntry.assembly);
      
      if (editingEntry.subAssembly === 'none') {
        setSubAssemblySelect('none');
        setSubAssemblyMode('select');
      } else {
        // Check if the sub-assembly exists in the selection catalog
        const exists = existingEntries.some(
          (e) =>
            e.system === editingEntry.system &&
            e.assembly === editingEntry.assembly &&
            e.subAssembly === 'none' &&
            e.part.toLowerCase() === editingEntry.subAssembly.toLowerCase()
        );
        
        if (exists) {
          setSubAssemblySelect(editingEntry.subAssembly);
          setSubAssemblyMode('select');
        } else {
          setSubAssemblyText(editingEntry.subAssembly);
          setSubAssemblyMode('type');
        }
      }

      setPart(editingEntry.part);
      setMakeBuy(editingEntry.make_buy === 'buy' ? 'buy' : 'make');
      setComments(editingEntry.comments || '');
      setQuantity(editingEntry.quantity || '1');
      setCustomId(editingEntry.custom_id || '');

      // Load extra custom fields
      const extras: Record<string, string> = {};
      customFieldsKeys.forEach((key) => {
        extras[key] = editingEntry[key] || '';
      });
      setExtraFields(extras);
    } else {
      clearForm();
    }
  }, [editingEntry]);

  const clearForm = () => {
    // Keep system and assembly selected to allow bulk entries under the same hierarchy
    setPart('');
    setMakeBuy('make');
    setComments('');
    setQuantity('1');
    setCustomId('');
    
    const clearedExtras: Record<string, string> = {};
    customFieldsKeys.forEach((k) => {
      clearedExtras[k] = '';
    });
    setExtraFields(clearedExtras);
  };

  const handleSystemChange = (sys: string) => {
    setSystem(sys);
    setAssembly('');
    setSubAssemblySelect('none');
    setSubAssemblyText('');
    setSubAssemblyMode('select');
  };

  const handleAssemblyChange = (assy: string) => {
    setAssembly(assy);
    setSubAssemblySelect('none');
    setSubAssemblyText('');
    setSubAssemblyMode('select');
  };

  // Find all parts in the current selected assembly that can act as sub-assemblies
  const availableSubAssemblies = existingEntries
    .filter(
      (e) =>
        e.system === system &&
        e.assembly === assembly &&
        e.subAssembly === 'none' &&
        e.delete !== '1'
    )
    .map((e) => e.part);

  // Remove duplicates
  const uniqueSubAssemblies = Array.from(new Set(availableSubAssemblies));

  const handleExtraFieldChange = (key: string, val: string) => {
    setExtraFields((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!system || !assembly || !part || !quantity) return;

    const resolvedSubAssembly =
      subAssemblyMode === 'select' ? subAssemblySelect : subAssemblyText.trim() || 'none';

    const entryData = {
      system,
      assembly,
      subAssembly: resolvedSubAssembly,
      part: part.trim(),
      make_buy: makeBuy,
      quantity: quantity.trim(),
      comments: comments.trim(),
      custom_id: customId.trim(),
      ...extraFields,
    };

    if (editingEntry) {
      onUpdateEntry({
        ...editingEntry,
        ...entryData,
      });
    } else {
      onAddEntry(entryData);
    }

    clearForm();
  };

  const isImported = !!(editingEntry && (editingEntry._part_uid || editingEntry._subpart_uid));

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-bright)' }}>
          {editingEntry ? 'Edit Entry Details' : 'Create New BOM Entry'}
        </h3>
        {editingEntry && (
          <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>
            Editing Local Mode
          </span>
        )}
      </div>

      <div className="form-grid">
        {/* System Selection */}
        <div className="form-group">
          <label className="form-label">System *</label>
          <select
            className="form-select"
            value={system}
            onChange={(e) => handleSystemChange(e.target.value)}
            disabled={isImported}
            required
          >
            <option value="">-- Select System --</option>
            {OFFICIAL_SYSTEMS.map((sys) => (
              <option key={sys.code} value={sys.code}>
                {sys.code} - {sys.name}
              </option>
            ))}
          </select>
        </div>

        {/* Assembly Selection */}
        <div className="form-group">
          <label className="form-label">Assembly *</label>
          <select
            className="form-select"
            value={assembly}
            onChange={(e) => handleAssemblyChange(e.target.value)}
            disabled={!system || isImported}
            required
          >
            <option value="">-- Select Assembly --</option>
            {(OFFICIAL_ASSEMBLIES[system] || []).map((assy) => (
              <option key={assy} value={assy}>
                {assy}
              </option>
            ))}
          </select>
        </div>

        {/* Sub Assembly Selector */}
        <div className="form-group">
          <label className="form-label">Sub Assembly</label>
          {subAssemblyMode === 'select' ? (
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <select
                className="form-select"
                style={{ flex: 1 }}
                value={subAssemblySelect}
                onChange={(e) => {
                  if (e.target.value === '__create_new__') {
                    setSubAssemblyMode('type');
                    setSubAssemblyText('');
                  } else {
                    setSubAssemblySelect(e.target.value);
                  }
                }}
                disabled={!assembly || isImported}
              >
                <option value="none">- none -</option>
                {uniqueSubAssemblies.map((sa) => (
                  <option key={sa} value={sa}>
                    {sa}
                  </option>
                ))}
                {assembly && (
                  <option value="__create_new__" style={{ color: 'var(--color-success-border)' }}>
                    + Type Custom Sub-Assembly...
                  </option>
                )}
              </select>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <input
                type="text"
                className="form-input"
                style={{ flex: 1 }}
                value={subAssemblyText}
                onChange={(e) => setSubAssemblyText(e.target.value)}
                placeholder="Type sub-assembly name"
                disabled={isImported}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSubAssemblyMode('select');
                  setSubAssemblySelect('none');
                }}
              >
                Back
              </button>
            </div>
          )}
        </div>

        {/* Part Name */}
        <div className="form-group">
          <label className="form-label">Part Name *</label>
          <input
            type="text"
            className="form-input"
            value={part}
            onChange={(e) => setPart(e.target.value)}
            placeholder="e.g. Left Hub Adapter"
            required
          />
        </div>
      </div>

      <div className="form-grid">
        {/* Make / Buy */}
        <div className="form-group">
          <label className="form-label">Make / Buy *</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                className="radio-input"
                name="make_buy"
                value="make"
                checked={makeBuy === 'make'}
                onChange={() => setMakeBuy('make')}
              />
              <span>make</span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                className="radio-input"
                name="make_buy"
                value="buy"
                checked={makeBuy === 'buy'}
                onChange={() => setMakeBuy('buy')}
              />
              <span>buy</span>
            </label>
          </div>
        </div>

        {/* Quantity */}
        <div className="form-group">
          <label className="form-label">Quantity *</label>
          <input
            type="text"
            className="form-input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Positive number"
            required
          />
        </div>

        {/* Custom ID */}
        <div className="form-group">
          <label className="form-label">Custom ID</label>
          <input
            type="text"
            className="form-input"
            value={customId}
            onChange={(e) => setCustomId(e.target.value)}
            placeholder="e.g. C-HUB-01"
            disabled={isImported}
          />
        </div>

        {/* Comments */}
        <div className="form-group">
          <label className="form-label">Comments</label>
          <input
            type="text"
            className="form-input"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Notes or annotations"
          />
        </div>
      </div>

      {/* Render Dynamic Extra Fields from snapshot schema (e.g. cost, material, mass) */}
      {customFieldsKeys.length > 0 && (
        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.75rem' }}>
          <div className="form-label" style={{ marginBottom: '0.5rem' }}>Custom CSV Schema Fields</div>
          <div className="form-grid">
            {customFieldsKeys.map((key) => (
              <div className="form-group" key={key}>
                <label className="form-label">{key.replace(/_/g, ' ')}</label>
                <input
                  type="text"
                  className="form-input"
                  value={extraFields[key] || ''}
                  onChange={(e) => handleExtraFieldChange(key, e.target.value)}
                  placeholder={`Value for ${key}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Form Submission Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
        {editingEntry && (
          <button type="button" className="btn btn-secondary" onClick={onCancelEdit}>
            <RotateCcw size={14} /> Cancel Edit
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!system || !assembly || !part || !quantity}
        >
          {editingEntry ? <Check size={14} /> : <PlusCircle size={14} />}
          {editingEntry ? 'Save Changes' : 'Add Entry'}
        </button>
      </div>
    </form>
  );
};
