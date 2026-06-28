import React from 'react';
import { Download, Upload, RefreshCw, Layers } from 'lucide-react';

interface HeaderProps {
  filePrefix: string;
  hasSnapshot: boolean;
  onImportDraft: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportDraft: () => void;
  onReset: () => void;
  lastSaved: string;
  
  // Auth Props
  user: any;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  filePrefix,
  hasSnapshot,
  onImportDraft,
  onExportDraft,
  onReset,
  lastSaved,
  user,
  onSignOut,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const triggerImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <header
      className="panel"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        borderRadius: '0',
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        zIndex: 50,
      }}
    >
      <div className="flex-row-center" style={{ gap: '0.75rem' }}>
        <div
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-sm)',
            display: 'grid',
            placeContent: 'center',
          }}
        >
          <Layers size={18} />
        </div>
        <div>
          <h1 style={{ fontSize: '1rem', lineHeight: 1.1 }}>BOM Helper</h1>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Formula Student Entry Tool
          </p>
        </div>

        {/* Snapshot badge status */}
        {hasSnapshot ? (
          <span className="badge badge-new" style={{ fontSize: '0.65rem' }}>
            Mapped: {filePrefix || 'Active'}
          </span>
        ) : (
          <span className="badge badge-deleted" style={{ fontSize: '0.65rem' }}>
            No Mapping
          </span>
        )}
      </div>

      <div className="flex-row-center" style={{ gap: '0.75rem' }}>
        {/* User Auth Profile Display */}
        {user && (
          <div
            className="flex-row-center"
            style={{
              gap: '0.5rem',
              background: '#0f172a',
              border: '1px solid var(--border-color)',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              marginRight: '0.5rem',
            }}
          >
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt="Profile"
                style={{ width: '18px', height: '18px', borderRadius: '50%' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            )}
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-bright)' }}>
              {user.displayName || user.email}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: '2px 6px', fontSize: '0.65rem' }}
              onClick={onSignOut}
            >
              Sign Out
            </button>
          </div>
        )}

        {lastSaved && (
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Saved: {lastSaved}
          </span>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={onImportDraft}
          accept=".json"
          style={{ display: 'none' }}
        />

        <button
          className="btn btn-secondary btn-sm"
          onClick={triggerImportClick}
          title="Import draft progress from a JSON file"
        >
          <Upload size={12} />
          Import JSON
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={onExportDraft}
          disabled={!hasSnapshot}
          title="Export draft progress as a JSON file"
        >
          <Download size={12} />
          Export JSON
        </button>

        {hasSnapshot && (
          <button
            className="btn btn-danger btn-sm"
            style={{ padding: '0.25rem 0.5rem' }}
            onClick={onReset}
            title="Reset helper and clear active snapshot"
          >
            Reset
          </button>
        )}
      </div>
    </header>
  );
};
