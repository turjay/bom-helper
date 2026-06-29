# Formula Student CCBOM Helper

A modern collaborative tool for editing and validating Formula Student Germany (FSG) **Costed Carbonized Bill of Material (CCBOM)** entries. The tool helps teams clean up and prepare their assemblies, parts, and subparts CSV snapshots before uploading them to the official FSG system.

It is fully customized to comply with the official FSG 2026 CCBOM schema rules and requirements.

---

## Key Features

- **Live Collaboration**: Local Firestore synchronization allows multiple team members to edit the BOM simultaneously (reverts to Guest Developer Session/Offline Mode if Firebase configuration is not present).
- **Official FSG 2026 CSV Schema Integration**:
  - Directly maps the official `makebuy` and `part_no_custom` headers.
  - Dynamically matches subpart `subtype` (like material types, tooling, or fasteners) to the display name, and preserves custom `type` schemas.
- **Round-Trip Mass Import & Export**:
  - Auto-extracts and preserves the official date prefix (e.g. `20260629_205933_`) on all three CSV exports (`assemblies.csv`, `parts.csv`, `subparts.csv`).
  - Automatically manages temporary IDs (`NEW-X`) for parent parts and references subparts accordingly to satisfy FSG's single-upload constraints.
  - Marks deleted items with the `delete = 1` flag on export rather than dropping them, satisfying permanent deletion rules.
- **Embedded Validator**:
  - Rejects decimal commas (`,`) in favor of dot decimal separators (`.`) for cost, emission, quantity, and mass fields.
  - Flags assembly name mismatches against the official assemblies catalog.
  - Restricts edits to read-only database references (`*_uid`, `part_no`, etc.).
- **Client Verification Suite**:
  - Includes a browser-based and Node-based verification dashboard verifying 8 edge-case unit tests.

---

## Get Started

### Prerequisites

- Node.js (version 20+ recommended)
- npm or yarn

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   cd bom-helper
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

- **Development Server**: Start the local Vite server:
  ```bash
  npm run dev
  ```
- **Production Build**: Compile and minify the application:
  ```bash
  npm run build
  ```
- **Preview Production Build**:
  ```bash
  npm run preview
  ```

---

## FSG CCBOM Format Compliance

| Feature | FSG Portal Rule | Helper Implementation |
|---|---|---|
| **Temporary IDs** | New parent parts having subparts must use temporary keys containing letters (e.g., `NEW-1`). | Done. Exporter automatically tracks new parts and links their subparts using `NEW-X`. |
| **Mark Deletes** | Row deletes must set the `delete` column to `1` (permanent deletions are confirmed in step 2). | Done. Deleting imported entries marks them with `delete = 1` in the export files. |
| **Decimal Formats** | Numeric entries (cost, emissions, mass) must use standard decimal dots (`1.23`). | Done. Input fields and dynamic cell editors auto-convert/warn about commas. |
| **Unified Prefix** | Exported CSV files must share the exact prefix of the downloaded snapshot. | Done. The prefix is parsed on import and attached to all exported CSV filenames. |
