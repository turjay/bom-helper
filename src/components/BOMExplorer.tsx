import React, { useState } from 'react';
import { Filter, Search, SlidersHorizontal, Eye, EyeOff, Sparkles } from 'lucide-react';
import { BOMEntry, AssemblyRow, ColumnMapping } from '../types';
import { BOMTable } from './BOMTable';
import { OFFICIAL_SYSTEMS, OFFICIAL_ASSEMBLIES } from '../fixtures/assemblyCatalog';

interface BOMExplorerViewProps {
  entries: BOMEntry[];
  assemblies: AssemblyRow[];
  originalEntries: BOMEntry[];
  columnMapping: ColumnMapping | null;
  customHeaders: string[];
  onUpdateEntry: (entry: BOMEntry) => void;
  onEntryDelete: (id: string, deleteFlag: boolean) => void;
  onEditClick: (entry: BOMEntry) => void;
}

export const BOMExplorerView: React.FC<BOMExplorerViewProps> = ({
  entries,
  assemblies,
  originalEntries,
  columnMapping,
  customHeaders,
  onUpdateEntry,
  onEntryDelete,
  onEditClick,
}) => {
  // Explorer Specific Filter States
  const [searchText, setSearchText] = useState<string>('');
  const [filterSystem, setFilterSystem] = useState<string>('');
  const [filterAssembly, setFilterAssembly] = useState<string>('');
  const [filterMakeBuy, setFilterMakeBuy] = useState<string>('all');
  const [filterCreator, setFilterCreator] = useState<string>('all');
  const [showDeleted, setShowDeleted] = useState<boolean>(true);

  // Column Visibility State
  const [visibleCustomHeaders, setVisibleCustomHeaders] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    customHeaders.forEach(header => {
      initial[header] = true;
    });
    return initial;
  });

  // Calculate unique list of creators
  const uniqueCreators = Array.from(
    new Set(entries.map((e) => e.createdBy_name || 'Guest User'))
  ).filter(Boolean);

  // Filter assemblies matching selected filterSystem
  const filteredAssembliesList = filterSystem
    ? OFFICIAL_ASSEMBLIES[filterSystem] || []
    : [];

  // Filter entries
  const explorerFilteredEntries = entries.filter((entry) => {
    // 1. System Filter
    if (filterSystem && entry.system !== filterSystem) return false;
    
    // 2. Assembly Filter
    if (filterAssembly && entry.assembly !== filterAssembly) return false;

    // 3. Make/Buy Filter
    if (filterMakeBuy !== 'all' && entry.make_buy !== filterMakeBuy) return false;

    // 4. Creator Filter
    if (filterCreator !== 'all') {
      const creatorName = entry.createdBy_name || 'Guest User';
      if (creatorName !== filterCreator) return false;
    }

    // 5. Deleted Row Filter
    const isDeleted = entry.delete === '1';
    if (!showDeleted && isDeleted) return false;

    // 6. Text Search Filter
    if (searchText.trim() !== '') {
      const q = searchText.toLowerCase();
      return (
        (entry.part || '').toLowerCase().includes(q) ||
        (entry.subAssembly || '').toLowerCase().includes(q) ||
        (entry.custom_id || '').toLowerCase().includes(q) ||
        (entry.comments || '').toLowerCase().includes(q) ||
        (entry.system || '').toLowerCase().includes(q) ||
        (entry.assembly || '').toLowerCase().includes(q)
      );
    }

    return true;
  });

  // Reset Filters
  const handleResetFilters = () => {
    setSearchText('');
    setFilterSystem('');
    setFilterAssembly('');
    setFilterMakeBuy('all');
    setFilterCreator('all');
    setShowDeleted(true);
  };

  // Toggle Custom Column Visibility
  const toggleColumnVisibility = (header: string) => {
    setVisibleCustomHeaders((prev) => ({
      ...prev,
      [header]: !prev[header],
    }));
  };

  // Render headers list based on visibility state
  const renderedCustomHeaders = customHeaders.filter(
    (h) => visibleCustomHeaders[h] !== false
  );

  return (
    <div style={{ display: 'flex', gap: '1rem', flex: 1, overflow: 'hidden', height: '100%', width: '100%', marginTop: '0.25rem' }}>
      
      {/* LEFT SIDEBAR: FILTERS */}
      <aside
        style={{
          width: '280px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ fontSize: '0.95rem', fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>Filter Dashboard</h3>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '2px 6px', fontSize: '0.7rem' }}
            onClick={handleResetFilters}
            title="Reset all filter fields"
          >
            Reset
          </button>
        </div>

        {/* Search */}
        <div className="form-group">
          <label className="form-label">Search Query</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', paddingLeft: '1.75rem', fontSize: '0.8rem' }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search parts, comments..."
            />
            <Search size={13} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {/* System Select */}
        <div className="form-group">
          <label className="form-label">System</label>
          <select
            className="form-select"
            value={filterSystem}
            onChange={(e) => {
              setFilterSystem(e.target.value);
              setFilterAssembly('');
            }}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
          >
            <option value="">All Systems</option>
            {OFFICIAL_SYSTEMS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Assembly Select */}
        <div className="form-group">
          <label className="form-label">Assembly</label>
          <select
            className="form-select"
            value={filterAssembly}
            onChange={(e) => setFilterAssembly(e.target.value)}
            disabled={!filterSystem}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
          >
            <option value="">All Assemblies</option>
            {filteredAssembliesList.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Make / Buy */}
        <div className="form-group">
          <label className="form-label">Make / Buy</label>
          <select
            className="form-select"
            value={filterMakeBuy}
            onChange={(e) => setFilterMakeBuy(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
          >
            <option value="all">All Statuses</option>
            <option value="make">Make</option>
            <option value="buy">Buy</option>
          </select>
        </div>

        {/* Created By */}
        <div className="form-group">
          <label className="form-label">Created By</label>
          <select
            className="form-select"
            value={filterCreator}
            onChange={(e) => setFilterCreator(e.target.value)}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.5rem' }}
          >
            <option value="all">All Collaborators</option>
            {uniqueCreators.map((creator) => (
              <option key={creator} value={creator}>
                {creator}
              </option>
            ))}
          </select>
        </div>

        {/* Deleted Checkbox */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
          <input
            type="checkbox"
            id="show-deleted-explorer"
            checked={showDeleted}
            onChange={(e) => setShowDeleted(e.target.checked)}
            style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
          />
          <label
            htmlFor="show-deleted-explorer"
            style={{ fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none' }}
          >
            Show Deleted Entries
          </label>
        </div>

        {/* CUSTOM COLUMN VISIBILITY CONTROLS */}
        {customHeaders.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}>
              <SlidersHorizontal size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Custom Columns</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {customHeaders.map((header) => {
                const isVisible = visibleCustomHeaders[header] !== false;
                return (
                  <button
                    key={header}
                    onClick={() => toggleColumnVisibility(header)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: isVisible ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                      border: '1px solid ' + (isVisible ? 'rgba(79, 70, 229, 0.3)' : 'var(--border-color)'),
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.35rem 0.5rem',
                      color: isVisible ? 'var(--text-bright)' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize' }}>
                      {header.replace(/_/g, ' ')}
                    </span>
                    {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </aside>

      {/* RIGHT PANEL: MAIN BOM TABLE */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-panel)',
            padding: '0.5rem 1rem',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing <strong style={{ color: 'var(--text-bright)' }}>{explorerFilteredEntries.length}</strong> of{' '}
            <strong style={{ color: 'var(--text-bright)' }}>{entries.length}</strong> entries
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span
              className="badge badge-new"
              style={{
                fontSize: '0.7rem',
                padding: '0.2rem 0.5rem',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.25)',
              }}
            >
              Full Height Explorer Active
            </span>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <BOMTable
            entries={explorerFilteredEntries}
            onEntryChange={onUpdateEntry}
            onEntryDelete={onEntryDelete}
            onEditClick={onEditClick}
            customHeaders={renderedCustomHeaders}
          />
        </div>
      </main>
    </div>
  );
};
