import React, { useState, useEffect } from 'react';
import { List, Settings, ShieldAlert, Sparkles, Filter, Search, Lock, Users, AlertTriangle, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Header } from './components/Header';
import { BOMForm } from './components/BOMForm';
import { BOMTable } from './components/BOMTable';
import { FileImport } from './components/FileImport';
import { PreviewReport } from './components/PreviewReport';
import { TestDashboard } from './components/TestDashboard';
import { BOMExplorerView } from './components/BOMExplorer';
import { importSnapshotToEntries, generateCSV } from './utils/csvParser';
import { validateBOM } from './utils/validator';
import { BOMEntry, AssemblyRow, ValidationError, ColumnMapping, BOMDraft } from './types';
import { OFFICIAL_SYSTEMS, OFFICIAL_ASSEMBLIES } from './fixtures/assemblyCatalog';

// Firebase Services
import {
  isFirebaseConfigured,
  logInWithGoogle,
  logOut,
  auth,
  db
} from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';

export default function App() {
  // Auth State
  const [user, setUser] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Database States
  const [filePrefix, setFilePrefix] = useState<string>('');
  const [entries, setEntries] = useState<BOMEntry[]>([]);
  const [originalEntries, setOriginalEntries] = useState<BOMEntry[]>([]);
  const [assemblies, setAssemblies] = useState<AssemblyRow[]>([]);
  
  // original headers
  const [assembliesHeaders, setAssembliesHeaders] = useState<string[]>([]);
  const [partsHeaders, setPartsHeaders] = useState<string[]>([]);
  const [subpartsHeaders, setSubpartsHeaders] = useState<string[]>([]);

  // Mapping Schema
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);

  // UI State
  const [activeTab, setActiveTab] = useState<'working_list' | 'mapping' | 'preview' | 'tests' | 'bom_explorer'>('working_list');
  const [editingEntry, setEditingEntry] = useState<BOMEntry | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [isTableMaximized, setIsTableMaximized] = useState<boolean>(false);

  // Quick Filters
  const [filterSystem, setFilterSystem] = useState<string>('');
  const [filterAssembly, setFilterAssembly] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

  // Listen to Auth State
  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
          });
        } else {
          setUser(null);
        }
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Offline fallback: load guest user from session if previously logged in
      const guestSession = localStorage.getItem('bom_helper_guest_user');
      if (guestSession) {
        setUser(JSON.parse(guestSession));
      }
      setAuthLoading(false);
    }
  }, []);

  // Listen to entries from Firestore (Collaborative Real-time) OR LocalStorage
  useEffect(() => {
    if (authLoading) return;
    if (!user) return; // Only listen/load when logged in

    if (isFirebaseConfigured && db) {
      // Real-time Firestore Sync
      const q = query(collection(db, 'fsg_bom_entries'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const firestoreEntries: BOMEntry[] = [];
        snapshot.forEach((doc) => {
          firestoreEntries.push({ id: doc.id, ...doc.data() } as BOMEntry);
        });
        
        // Sort entries by createdAt timestamp to keep insertion order
        firestoreEntries.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateA - dateB;
        });

        setEntries(firestoreEntries);
      }, (error) => {
        console.error("Firestore onSnapshot error:", error);
      });

      return () => unsubscribe();
    } else {
      // Offline fallback: Load working list from localstorage
      const draft = localStorage.getItem('bom_entry_helper_draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft) as BOMDraft;
          setEntries(parsed.entries);
          setAssemblies(parsed.assemblies || []);
          setAssembliesHeaders(parsed.assembliesHeaders || []);
          setPartsHeaders(parsed.partsHeaders || []);
          setSubpartsHeaders(parsed.subpartsHeaders || []);
          setColumnMapping(parsed.columnMapping);
          setFilePrefix(parsed.filePrefix || '');
          
          const origStr = localStorage.getItem('bom_entry_helper_orig_entries');
          if (origStr) setOriginalEntries(JSON.parse(origStr));
        } catch (e) {
          console.error('Failed to parse local draft', e);
        }
      }
    }
  }, [user, authLoading]);

  // Load other metadata (configurations/headers/original snapshot references) from localStorage
  useEffect(() => {
    const draft = localStorage.getItem('bom_entry_helper_draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft) as BOMDraft;
        setFilePrefix(parsed.filePrefix);
        setAssemblies(parsed.assemblies || []);
        setAssembliesHeaders(parsed.assembliesHeaders || []);
        setPartsHeaders(parsed.partsHeaders || []);
        setSubpartsHeaders(parsed.subpartsHeaders || []);
        setColumnMapping(parsed.columnMapping);
        setLastSavedTime(parsed.lastSaved);
        
        const origStr = localStorage.getItem('bom_entry_helper_orig_entries');
        if (origStr) {
          setOriginalEntries(JSON.parse(origStr));
        }
      } catch (e) {
        console.error('Failed to load metadata draft', e);
      }
    }
  }, []);

  // Autosave configuration/metadata (excludes entries if synced in firestore)
  useEffect(() => {
    if (authLoading || !user) return;
    
    const saveTimer = setTimeout(() => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      const draft: BOMDraft = {
        filePrefix,
        entries: isFirebaseConfigured ? [] : entries, // If firestore is active, entries are already saved in DB!
        assemblies,
        assembliesHeaders,
        partsHeaders,
        subpartsHeaders,
        columnMapping,
        lastSaved: timeStr,
      };

      localStorage.setItem('bom_entry_helper_draft', JSON.stringify(draft));
      setLastSavedTime(timeStr);
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [entries, assemblies, filePrefix, columnMapping, assembliesHeaders, partsHeaders, subpartsHeaders, user, authLoading]);

  // Validation Hook
  useEffect(() => {
    const errors = validateBOM(entries, assemblies, originalEntries, columnMapping);
    setValidationErrors(errors);
  }, [entries, assemblies, originalEntries, columnMapping]);

  // Login/Logout Triggers
  const handleLogin = async () => {
    try {
      const loggedUser = await logInWithGoogle();
      setUser(loggedUser);
      if (!isFirebaseConfigured) {
        localStorage.setItem('bom_helper_guest_user', JSON.stringify(loggedUser));
      }
    } catch (e) {
      alert('Login failed. Please verify credentials or retry.');
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await logOut();
      setUser(null);
      localStorage.removeItem('bom_helper_guest_user');
    }
  };

  // Clear / Reset Session
  const handleResetSession = async () => {
    if (window.confirm('Are you sure you want to reset the session? All working database documents and snapshot references will be deleted.')) {
      
      if (isFirebaseConfigured && db && entries.length > 0) {
        // Clear Firestore collection
        try {
          const batch = writeBatch(db);
          entries.forEach((e) => {
            const ref = doc(db, 'fsg_bom_entries', e.id);
            batch.delete(ref);
          });
          await batch.commit();
        } catch (e) {
          console.error("Failed to delete firestore docs:", e);
        }
      }

      localStorage.removeItem('bom_entry_helper_draft');
      localStorage.removeItem('bom_entry_helper_orig_entries');
      setFilePrefix('');
      setEntries([]);
      setOriginalEntries([]);
      setAssemblies([]);
      setAssembliesHeaders([]);
      setPartsHeaders([]);
      setSubpartsHeaders([]);
      setColumnMapping(null);
      setEditingEntry(null);
      setFilterSystem('');
      setFilterAssembly('');
      setSearchText('');
      setLastSavedTime('');
      setActiveTab('working_list');
    }
  };

  const handleClearMapping = () => {
    if (window.confirm('Clear official snapshot mapping? This will revert the app to offline draft mode.')) {
      setAssemblies([]);
      setAssembliesHeaders([]);
      setPartsHeaders([]);
      setSubpartsHeaders([]);
      setColumnMapping(null);
      setOriginalEntries([]);
      localStorage.removeItem('bom_entry_helper_orig_entries');
      
      // Clear references
      setEntries((prev) =>
        prev.map((e) => {
          const cleared = { ...e };
          delete cleared._part_uid;
          delete cleared._subpart_uid;
          delete cleared._parent_part_uid;
          delete cleared._assembly_uid;
          return cleared;
        })
      );
    }
  };

  const handleExportDraft = () => {
    const draft: BOMDraft = {
      filePrefix,
      entries,
      assemblies,
      assembliesHeaders,
      partsHeaders,
      subpartsHeaders,
      columnMapping,
      lastSaved: lastSavedTime,
    };

    const element = document.createElement('a');
    const file = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    element.href = URL.createObjectURL(file);
    element.download = `${filePrefix || 'bom'}_draft.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleImportDraft = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as BOMDraft;
        
        setFilePrefix(parsed.filePrefix);
        setEntries(parsed.entries);
        setAssemblies(parsed.assemblies || []);
        setAssembliesHeaders(parsed.assembliesHeaders || []);
        setPartsHeaders(parsed.partsHeaders || []);
        setSubpartsHeaders(parsed.subpartsHeaders || []);
        setColumnMapping(parsed.columnMapping);

        setOriginalEntries(parsed.entries);
        localStorage.setItem('bom_entry_helper_orig_entries', JSON.stringify(parsed.entries));
        alert('Draft JSON imported successfully!');
      } catch (err) {
        alert('Failed to parse draft JSON. Make sure it is a valid BOM draft file.');
      }
    };
    reader.readAsText(file);
  };

  // Create or Sync BOM entries in DB
  const syncEntryToFirestore = async (entry: BOMEntry) => {
    if (isFirebaseConfigured && db) {
      try {
        await setDoc(doc(db, 'fsg_bom_entries', entry.id), { ...entry });
      } catch (e) {
        console.error("Firestore sync write failed:", e);
      }
    }
  };

  const generateAutoCustomId = (systemName: string | undefined): string => {
    const systemPrefix = systemName || 'GEN';
    const pattern = new RegExp(`^${systemPrefix}-(\\d{4})$`);
    let maxSeq = 0;
    entries.forEach((e) => {
      const match = (e.custom_id || '').match(pattern);
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    });
    const nextSeq = maxSeq + 1;
    return `${systemPrefix}-${String(nextSeq).padStart(4, '0')}`;
  };

  const handleAddEntry = async (newFields: Omit<BOMEntry, 'id' | 'delete'>) => {
    const uniqueId = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let customId = newFields.custom_id;
    if (!customId || customId.trim() === '') {
      customId = generateAutoCustomId(newFields.system);
    }

    const newEntry: BOMEntry = {
      id: uniqueId,
      delete: '0',
      createdBy_name: user?.displayName || 'Guest User',
      createdBy_email: user?.email || 'guest@fs-team.com',
      createdAt: new Date().toISOString(),
      ...newFields,
      custom_id: customId,
    } as BOMEntry;

    if (isFirebaseConfigured) {
      await syncEntryToFirestore(newEntry);
    } else {
      setEntries((prev) => [...prev, newEntry]);
    }
  };

  const handleUpdateEntry = async (updatedEntry: BOMEntry) => {
    let customId = updatedEntry.custom_id;
    if (!customId || customId.trim() === '') {
      customId = generateAutoCustomId(updatedEntry.system);
    }

    // Keep original created tags, update editor tags if needed
    const entryToSave = {
      ...updatedEntry,
      custom_id: customId,
      createdBy_name: updatedEntry.createdBy_name || user?.displayName || 'Guest User',
      createdBy_email: updatedEntry.createdBy_email || user?.email || 'guest@fs-team.com',
    };

    if (isFirebaseConfigured) {
      await syncEntryToFirestore(entryToSave);
    } else {
      setEntries((prev) => prev.map((e) => (e.id === updatedEntry.id ? entryToSave : e)));
    }
    setEditingEntry(null);
  };

  const handleEntryDelete = async (id: string, deleteFlag: boolean) => {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;

    const isImported = !!entry._part_uid || !!entry._subpart_uid;

    if (isImported) {
      // Mark delete = 1
      const updated = { ...entry, delete: deleteFlag ? '1' : '0' };
      if (isFirebaseConfigured) {
        await syncEntryToFirestore(updated);
      } else {
        setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      }
    } else {
      // Direct hard removal for local drafts
      if (isFirebaseConfigured && db) {
        try {
          await deleteDoc(doc(db, 'fsg_bom_entries', id));
        } catch (e) {
          console.error("Firestore document delete failed:", e);
        }
      } else {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }

      if (editingEntry?.id === id) {
        setEditingEntry(null);
      }
    }
  };

  // Snapshot import completer
  const handleMappingComplete = async (data: {
    assemblies: any[];
    parts: any[];
    subparts: any[];
    assembliesHeaders: string[];
    partsHeaders: string[];
    subpartsHeaders: string[];
    filePrefix: string;
  }) => {
    const detectedMapping = {
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

    const importedEntries = importSnapshotToEntries(
      data.parts,
      data.subparts,
      data.assemblies,
      detectedMapping
    );

    // Save mapping headers and reference lists
    setAssemblies(data.assemblies);
    setAssembliesHeaders(data.assembliesHeaders);
    setPartsHeaders(data.partsHeaders);
    setSubpartsHeaders(data.subpartsHeaders);
    setColumnMapping(detectedMapping);
    setFilePrefix(data.filePrefix);

    setOriginalEntries(importedEntries);
    localStorage.setItem('bom_entry_helper_orig_entries', JSON.stringify(importedEntries));

    // Upload snapshot entries to Firestore collaboratively if active
    if (isFirebaseConfigured && db) {
      try {
        const batch = writeBatch(db);
        importedEntries.forEach((entry) => {
          const docRef = doc(db, 'fsg_bom_entries', entry.id);
          // Set creator metadata to imported snap
          entry.createdBy_name = 'Official System';
          entry.createdBy_email = 'imported@snapshot.com';
          entry.createdAt = new Date().toISOString();
          batch.set(docRef, entry);
        });
        await batch.commit();
      } catch (e) {
        console.error("Failed to commit batch snapshot docs:", e);
      }
    } else {
      setEntries((prevLocal) => {
        const filteredLocal = prevLocal.filter(
          (local) =>
            !importedEntries.some(
              (imp) =>
                imp.system === local.system &&
                imp.assembly === local.assembly &&
                imp.subAssembly.toLowerCase() === local.subAssembly.toLowerCase() &&
                imp.part.toLowerCase() === local.part.toLowerCase()
            )
        );
        return [...importedEntries, ...filteredLocal];
      });
    }

    alert('Official CSV snapshot loaded and synchronized!');
  };

  const handleClearMappingLocal = () => {
    handleClearMapping();
  };

  // Filter assemblies matching selected filterSystem
  const filteredAssembliesList = filterSystem
    ? OFFICIAL_ASSEMBLIES[filterSystem] || []
    : [];

  // Filter entries to render
  const filteredEntries = entries.filter((entry) => {
    if (filterSystem && entry.system !== filterSystem) return false;
    if (filterAssembly && entry.assembly !== filterAssembly) return false;

    if (searchText.trim() !== '') {
      const q = searchText.toLowerCase();
      return (
        (entry.part || '').toLowerCase().includes(q) ||
        (entry.subAssembly || '').toLowerCase().includes(q) ||
        (entry.custom_id || '').toLowerCase().includes(q) ||
        (entry.comments || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCustomFieldKeys = (): string[] => {
    const keys = new Set<string>();
    entries.forEach((entry) => {
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
          k !== 'delete' &&
          k !== 'createdBy_name' &&
          k !== 'createdBy_email' &&
          k !== 'createdAt' &&
          (!columnMapping || (
            k !== columnMapping.parts.name &&
            k !== columnMapping.subparts.name &&
            k !== columnMapping.parts.makeBuy &&
            k !== columnMapping.subparts.makeBuy &&
            k !== columnMapping.parts.quantity &&
            k !== columnMapping.subparts.quantity &&
            k !== columnMapping.parts.comments &&
            k !== columnMapping.subparts.comments &&
            k !== columnMapping.parts.customId &&
            k !== columnMapping.parts.partNo &&
            k !== columnMapping.subparts.partNo &&
            k !== columnMapping.parts.uid &&
            k !== columnMapping.subparts.uid &&
            k !== columnMapping.parts.assemblyUid &&
            k !== columnMapping.subparts.partUid
          ))
        ) {
          keys.add(k);
        }
      });
    });
    return Array.from(keys);
  };

  const customHeaders = getCustomFieldKeys();

  if (authLoading) {
    return (
      <div style={{ display: 'grid', placeContent: 'center', height: '100vh', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', fontSize: '0.9rem', transition: 'background-color 0.5s ease-in-out, color 0.5s ease-in-out' }}>
        Loading Authentication Session...
      </div>
    );
  }

  // RENDER LOGIN SCREEN IF NOT AUTHENTICATED
  if (!user) {
    return (
      <div style={{ display: 'grid', placeContent: 'center', height: '100vh', backgroundColor: 'var(--bg-app)', padding: '1.5rem', position: 'relative', transition: 'background-color 0.5s ease-in-out, color 0.5s ease-in-out' }}>
        {/* Absolute Theme Switcher for Login Screen */}
        <button
          className="btn btn-secondary btn-sm"
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.4rem 0.75rem',
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
          onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? '🌙 Koyu Tema' : '☀️ Açık Tema'}
        </button>

        <div className="panel" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '2.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)', transition: 'background-color 0.5s ease-in-out, border-color 0.5s ease-in-out, color 0.5s ease-in-out' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ position: 'relative', height: '45px', width: '240px', marginBottom: '0.5rem', flexShrink: 0 }}>
              <img
                src="https://cdn.brandfetch.io/idyER5Z4WA/theme/light/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B"
                alt="Formula Student Logo Light"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  opacity: theme === 'dark' ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  filter: 'drop-shadow(0 2px 8px rgba(0, 102, 94, 0.3))'
                }}
              />
              <img
                src="https://cdn.brandfetch.io/idyER5Z4WA/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B"
                alt="Formula Student Logo Dark"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  opacity: theme === 'light' ? 1 : 0,
                  transition: 'opacity 0.3s ease',
                  filter: 'drop-shadow(0 2px 8px rgba(0, 102, 94, 0.15))'
                }}
              />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: 'var(--text-bright)', letterSpacing: '0.01em' }}>
              BOM ENTRY HELPER
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Sign in with your Google account to collaborate in real-time with teammates on vehicle entries.
            </p>
          </div>

          {!isFirebaseConfigured && (
            <div className="alert alert-warning" style={{ textAlign: 'left', fontSize: '0.78rem', lineHeight: 1.35 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>
                <strong>Running in Offline Mock Mode.</strong> No Firebase API credentials loaded in <code>.env.local</code>. Click login below to launch a local guest developer session.
              </span>
            </div>
          )}

          <button
            className="btn btn-primary"
            style={{ padding: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', height: '42px' }}
            onClick={handleLogin}
          >
            <Lock size={16} /> Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header
        filePrefix={filePrefix}
        hasSnapshot={!!columnMapping}
        onImportDraft={handleImportDraft}
        onExportDraft={handleExportDraft}
        onReset={handleResetSession}
        lastSaved={lastSavedTime}
        user={user}
        onSignOut={handleLogout}
        theme={theme}
        toggleTheme={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
      />

      <div className="workspace-layout">
        <main className="main-content">
          
          {/* Static Entry Form at top of screen */}
          {!isTableMaximized && activeTab !== 'bom_explorer' && (
            <BOMForm
              onAddEntry={handleAddEntry}
              onUpdateEntry={handleUpdateEntry}
              editingEntry={editingEntry}
              onCancelEdit={() => setEditingEntry(null)}
              existingEntries={entries}
              assemblies={assemblies}
              hasMapping={!!columnMapping}
              columnMapping={columnMapping}
            />
          )}

          {/* Navigation Tabs */}
          <div className="tabs-header">
            <button
              className={`tab-btn ${activeTab === 'working_list' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('working_list');
                setIsTableMaximized(false);
              }}
            >
              <List size={14} /> Working BOM List ({filteredEntries.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'bom_explorer' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('bom_explorer');
                setIsTableMaximized(false);
              }}
            >
              <Sparkles size={14} style={{ color: activeTab === 'bom_explorer' ? 'var(--color-primary)' : 'var(--text-muted)' }} /> BOM Explorer ({filteredEntries.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'mapping' ? 'active' : ''}`}
              onClick={() => setActiveTab('mapping')}
            >
              <Settings size={14} /> FSG Snapshot / Mapping
            </button>
            <button
              className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
              style={{ position: 'relative' }}
            >
              <ShieldAlert size={14} /> Export Report
              {validationErrors.filter((e) => e.type === 'error').length > 0 && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--color-error)',
                    position: 'absolute',
                    right: '2px',
                    top: '6px',
                  }}
                />
              )}
            </button>
            <button
              className={`tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => setActiveTab('tests')}
            >
              <Check size={14} /> Verification Suite
            </button>
          </div>

          {/* TAB CONTENT AREAS */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            {activeTab === 'working_list' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, overflow: 'hidden' }}>
                
                {/* Search & Filter Toolbar */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'var(--bg-panel)', padding: '0.5rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  <div className="flex-row-center" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <Filter size={14} /> <span>Filter List:</span>
                  </div>
                  
                  <select
                    className="form-select"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                    value={filterSystem}
                    onChange={(e) => {
                      setFilterSystem(e.target.value);
                      setFilterAssembly('');
                    }}
                  >
                    <option value="">All Systems</option>
                    {OFFICIAL_SYSTEMS.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code}
                      </option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8125rem', maxWidth: '200px' }}
                    value={filterAssembly}
                    onChange={(e) => setFilterAssembly(e.target.value)}
                    disabled={!filterSystem}
                  >
                    <option value="">All Assemblies</option>
                    {filteredAssembliesList.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>

                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '1.75rem', paddingRight: '0.5rem', paddingTop: '0.25rem', paddingBottom: '0.25rem', fontSize: '0.8125rem', width: '100%' }}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Search parts..."
                    />
                    <Search size={12} style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>

                  {isFirebaseConfigured && (
                    <div className="flex-row-center" style={{ fontSize: '0.75rem', color: 'var(--color-success-border)' }}>
                      <Users size={14} />
                      <span>Live Synced</span>
                    </div>
                  )}

                  <button
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.35rem 0.6rem',
                      background: isTableMaximized ? 'rgba(0, 102, 94, 0.15)' : 'var(--color-secondary)',
                      borderColor: isTableMaximized ? 'rgba(0, 102, 94, 0.35)' : 'var(--border-color)',
                      color: isTableMaximized ? 'var(--text-bright)' : 'var(--text-main)',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => setIsTableMaximized(!isTableMaximized)}
                    title={isTableMaximized ? "Minimize (Show Entry Form)" : "Maximize (Wide Table)"}
                  >
                    {isTableMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    <span>{isTableMaximized ? "Minimize" : "Maximize"}</span>
                  </button>
                </div>

                {/* Main BOM List Table */}
                <BOMTable
                  entries={filteredEntries}
                  onEntryChange={handleUpdateEntry}
                  onEntryDelete={handleEntryDelete}
                  onEditClick={(entry) => setEditingEntry(entry)}
                  customHeaders={customHeaders}
                />
              </div>
            )}

            {activeTab === 'bom_explorer' && (
              <BOMExplorerView
                entries={entries}
                assemblies={assemblies}
                originalEntries={originalEntries}
                columnMapping={columnMapping}
                customHeaders={customHeaders}
                onUpdateEntry={handleUpdateEntry}
                onEntryDelete={handleEntryDelete}
                onEditClick={(entry) => {
                  setEditingEntry(entry);
                  setActiveTab('working_list');
                }}
              />
            )}

            {activeTab === 'mapping' && (
              <FileImport
                onImportComplete={handleMappingComplete}
                onClearMapping={handleClearMappingLocal}
                hasMapping={!!columnMapping}
                filePrefix={filePrefix}
                mappingStats={{
                  assembliesCount: assemblies.length,
                  partsCount: entries.filter((e) => !!e._part_uid).length,
                  subpartsCount: entries.filter((e) => !!e._subpart_uid).length,
                }}
              />
            )}

            {activeTab === 'preview' && (
              <PreviewReport
                entries={entries}
                assemblies={assemblies}
                originalEntries={originalEntries}
                validationErrors={validationErrors}
                mapping={columnMapping}
                filePrefix={filePrefix}
                partsHeaders={partsHeaders}
                subpartsHeaders={subpartsHeaders}
                assembliesHeaders={assembliesHeaders}
              />
            )}

            {activeTab === 'tests' && <TestDashboard />}

          </div>
        </main>
      </div>
    </div>
  );
}
