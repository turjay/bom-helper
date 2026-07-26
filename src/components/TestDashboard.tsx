import React, { useState, useEffect } from 'react';
import { PlayCircle, CheckCircle2, XCircle, Terminal } from 'lucide-react';
import { AssemblyRow, BOMEntry, ColumnMapping } from '../types';
import { parseCSV, generateCSV, exportEntriesToCSV, detectColumnMapping } from '../utils/csvParser';
import { validateBOM } from '../utils/validator';

interface TestResult {
  name: string;
  desc: string;
  passed: boolean;
  errorLog?: string;
}

export const TestDashboard: React.FC = () => {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = () => {
    setIsRunning(true);
    const results: TestResult[] = [];

    // Helper mapping
    const mapping: ColumnMapping = {
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

    const assemblies: AssemblyRow[] = [
      { assembly_uid: '1001', assembly: 'Brake Discs', system: 'BR' },
      { assembly_uid: '1002', assembly: 'Calipers', system: 'BR' },
    ];

    const partsHeaders = ['part_uid', 'assembly_uid', 'part_no', 'part', 'make_buy', 'quantity', 'comments', 'custom_id', 'delete'];
    const subpartsHeaders = ['subpart_uid', 'part_uid', 'part_no', 'part', 'make_buy', 'quantity', 'comments', 'delete'];

    // 1. Test: new part without subparts (empty part_uid on export)
    try {
      const entries: BOMEntry[] = [
        {
          id: 'local-1',
          system: 'BR',
          assembly: 'Brake Discs',
          subAssembly: 'none',
          part: 'Front Rotor Left',
          make_buy: 'make',
          quantity: '1',
          comments: 'No subparts testing',
          custom_id: 'C-FL-01',
          delete: '0',
        },
      ];

      const { parts } = exportEntriesToCSV(entries, assemblies, mapping, partsHeaders, subpartsHeaders);

      if (parts.length !== 1) {
        throw new Error(`Expected exactly 1 exported part, but got ${parts.length}`);
      }

      const uid = parts[0][mapping.parts.uid];
      if (uid !== '') {
        throw new Error(`Expected empty part_uid for new part without subparts, but got "${uid}"`);
      }

      results.push({
        name: 'New Part Without Subparts',
        desc: 'Verifies that new standalone parts (subAssembly = "none") are exported with an empty part_uid.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'New Part Without Subparts',
        desc: 'Verifies that new standalone parts (subAssembly = "none") are exported with an empty part_uid.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }

    // 2. Test: new part with subparts (generates temp ID)
    try {
      const entries: BOMEntry[] = [
        {
          id: 'local-sub-1',
          system: 'BR',
          assembly: 'Brake Discs',
          subAssembly: 'Custom Disk Assembly Container',
          part: 'Rotor Hub Plate',
          make_buy: 'make',
          quantity: '1',
          comments: 'Inner rotor subpart',
          custom_id: '',
          delete: '0',
        },
      ];

      const { parts, subparts } = exportEntriesToCSV(entries, assemblies, mapping, partsHeaders, subpartsHeaders);

      // Should automatically generate a parent Part "Custom Disk Assembly Container" in parts
      const parentPart = parts.find((p) => p[mapping.parts.name] === 'Custom Disk Assembly Container');
      if (!parentPart) {
        throw new Error('Exporter failed to generate the parent Sub-Assembly Part in parts.csv');
      }

      const parentUid = parentPart[mapping.parts.uid];
      if (!parentUid.startsWith('NEW-')) {
        throw new Error(`Expected parent Part to receive a temporary ID (e.g. NEW-1), but got "${parentUid}"`);
      }

      // Check subpart references it
      if (subparts.length !== 1) {
        throw new Error(`Expected exactly 1 exported subpart, but got ${subparts.length}`);
      }
      
      const subpartParentUid = subparts[0][mapping.subparts.partUid];
      if (subpartParentUid !== parentUid) {
        throw new Error(`Expected subpart parent link "${subpartParentUid}" to match parent Part ID "${parentUid}"`);
      }

      results.push({
        name: 'New Part With Subparts (Temp IDs)',
        desc: 'Verifies that custom sub-assembly groupings generate a parent Part and subparts successfully map to its temporary ID.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'New Part With Subparts (Temp IDs)',
        desc: 'Verifies that custom sub-assembly groupings generate a parent Part and subparts successfully map to its temporary ID.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }

    // 3. Test: existing part update
    try {
      const original: BOMEntry = {
        id: 'part-2001',
        system: 'BR',
        assembly: 'Brake Discs',
        subAssembly: 'none',
        part: 'Original Front Rotor',
        make_buy: 'make',
        quantity: '1',
        comments: 'Original comment',
        custom_id: 'C-FL-01',
        delete: '0',
        _part_uid: '2001',
        _assembly_uid: '1001',
      };

      const updated: BOMEntry = {
        ...original,
        comments: 'Comment was updated',
        quantity: '2',
      };

      const errors = validateBOM([updated], assemblies, [original], mapping);
      const criticalErrors = errors.filter((err) => err.type === 'error');

      if (criticalErrors.length > 0) {
        throw new Error(`Expected no critical validation errors on update, but got: ${criticalErrors[0].message}`);
      }

      const { parts } = exportEntriesToCSV([updated], assemblies, mapping, partsHeaders, subpartsHeaders);
      if (parts[0][mapping.parts.uid] !== '2001') {
        throw new Error(`Expected exported part_uid to preserve "2001", but got "${parts[0][mapping.parts.uid]}"`);
      }

      results.push({
        name: 'Existing Part Update',
        desc: 'Verifies that updates to editable columns preserve official IDs and validate successfully.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'Existing Part Update',
        desc: 'Verifies that updates to editable columns preserve official IDs and validate successfully.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }

    // 4. Test: invalid assembly_uid
    try {
      const entry: BOMEntry = {
        id: 'local-1',
        system: 'BR',
        assembly: 'Non-Existent Assembly Name',
        subAssembly: 'none',
        part: 'Brake Part',
        make_buy: 'make',
        quantity: '1',
        comments: 'Testing assembly lookup',
        custom_id: '',
        delete: '0',
      };

      const errors = validateBOM([entry], assemblies, [], mapping);
      const assemblyError = errors.find((e) => e.field === 'assembly' && e.message.includes('does not exist'));

      if (!assemblyError) {
        throw new Error('Expected validation error for non-existent assembly map lookup, but none was flagged.');
      }

      results.push({
        name: 'Invalid Assembly UID Lookup',
        desc: 'Verifies that the validator checks that the selected assembly name matches the imported database.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'Invalid Assembly UID Lookup',
        desc: 'Verifies that the validator checks that the selected assembly name matches the imported database.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }

    // 5. Test: decimal comma rejection
    try {
      const entry: BOMEntry = {
        id: 'local-1',
        system: 'BR',
        assembly: 'Brake Discs',
        subAssembly: 'none',
        part: 'Rotor Disc',
        make_buy: 'make',
        quantity: '1',
        comments: 'Testing commas',
        custom_id: '',
        delete: '0',
        cost: '45,50', // Commas forbidden
      };

      const errors = validateBOM([entry], assemblies, [], mapping);
      const hasCommaError = errors.some((e) => e.field === 'cost' && e.message.includes('must use decimal point'));

      if (!hasCommaError) {
        throw new Error('Expected validation error for decimal comma in cost field, but none was flagged.');
      }

      results.push({
        name: 'Decimal Comma Rejection',
        desc: 'Verifies that numeric attributes like costs or emissions reject commas in favor of dot decimal points.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'Decimal Comma Rejection',
        desc: 'Verifies that numeric attributes like costs or emissions reject commas in favor of dot decimal points.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }

    // 6. Test: preserving unknown columns
    try {
      const entry: BOMEntry = {
        id: 'local-1',
        system: 'BR',
        assembly: 'Brake Discs',
        subAssembly: 'none',
        part: 'Rotor Plate',
        make_buy: 'make',
        quantity: '1',
        comments: 'Preserving weight',
        custom_id: '',
        delete: '0',
        custom_weight_column: '1.25',
        team_lead: 'Max Mustermann',
      };

      const extendedHeaders = [...partsHeaders, 'custom_weight_column', 'team_lead'];

      const { parts } = exportEntriesToCSV([entry], assemblies, mapping, extendedHeaders, subpartsHeaders);

      if (parts[0].custom_weight_column !== '1.25' || parts[0].team_lead !== 'Max Mustermann') {
        throw new Error('Exporter failed to preserve custom columns.');
      }

      results.push({
        name: 'Preserves Unknown Columns',
        desc: 'Verifies that parsing and exporting keeps non-standard custom attributes intact in the outputs.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'Preserves Unknown Columns',
        desc: 'Verifies that parsing and exporting keeps non-standard custom attributes intact in the outputs.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }

    // 7. Test: New Part and Subpart Co-existence
    try {
      const entries: BOMEntry[] = [
        {
          id: 'local-parent-1',
          system: 'BR',
          assembly: 'Brake Discs',
          subAssembly: 'none',
          part: 'Custom Disk Assembly Container',
          make_buy: 'make',
          quantity: '1',
          comments: 'Brand new parent part',
          custom_id: '',
          delete: '0',
        },
        {
          id: 'local-sub-1',
          system: 'BR',
          assembly: 'Brake Discs',
          subAssembly: 'Custom Disk Assembly Container',
          part: 'Rotor Hub Plate',
          make_buy: 'make',
          quantity: '1',
          comments: 'Inner rotor subpart under brand new parent',
          custom_id: '',
          delete: '0',
        },
      ];

      const { parts, subparts } = exportEntriesToCSV(entries, assemblies, mapping, partsHeaders, subpartsHeaders);

      // Verify that there is exactly ONE part named 'Custom Disk Assembly Container' in parts.csv
      const containerParts = parts.filter((p) => p[mapping.parts.name] === 'Custom Disk Assembly Container');
      if (containerParts.length !== 1) {
        throw new Error(`Expected exactly 1 exported Part for "Custom Disk Assembly Container", but got ${containerParts.length} (indicates duplicate creation bug)`);
      }

      const parentUid = containerParts[0][mapping.parts.uid];
      if (!parentUid.startsWith('NEW-')) {
        throw new Error(`Expected new parent Part to get a temporary ID starting with "NEW-", but got "${parentUid}"`);
      }

      // Verify that the subpart correctly references the generated temp ID
      if (subparts.length !== 1) {
        throw new Error(`Expected exactly 1 exported subpart, but got ${subparts.length}`);
      }

      const subpartParentUid = subparts[0][mapping.subparts.partUid];
      if (subpartParentUid !== parentUid) {
        throw new Error(`Expected subpart parent link "${subpartParentUid}" to match parent Part ID "${parentUid}"`);
      }

      results.push({
        name: 'New Part and Subpart Co-existence',
        desc: 'Verifies that exporting both a new parent Part and a new Subpart under it results in a single parent Part in parts.csv with a temporary ID, and the Subpart correctly references it.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'New Part and Subpart Co-existence',
        desc: 'Verifies that exporting both a new parent Part and a new Subpart under it results in a single parent Part in parts.csv with a temporary ID, and the Subpart correctly references it.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }
    // 8. Test: Column Mapping Detection for FSG 2026 Headers
    try {
      const assembliesHeaders = ['assembly_uid', 'system', 'assembly', 'sub_assembly', 'assembly_no', 'comments'];
      const partsHeaders = ['part_uid', 'assembly_uid', 'system', 'assembly', 'sub_assembly', 'part_no', 'part', 'part_no_custom', 'makebuy', 'quantity', 'comments', 'delete'];
      const subpartsHeaders = ['subpart_uid', 'part_uid', 'part_no', 'type', 'subtype', 'quantity', 'costs', 'comments', 'comments_costs', 'emissions', 'comments_emissions', 'sorting', 'delete'];

      const detected = detectColumnMapping(assembliesHeaders, partsHeaders, subpartsHeaders);

      if (detected.parts.makeBuy !== 'makebuy') {
        throw new Error(`Expected parts makeBuy column to match "makebuy", but got "${detected.parts.makeBuy}"`);
      }
      if (detected.parts.customId !== 'part_no_custom') {
        throw new Error(`Expected parts customId column to match "part_no_custom", but got "${detected.parts.customId}"`);
      }
      if (detected.subparts.name !== 'subtype') {
        throw new Error(`Expected subparts name column to match "subtype", but got "${detected.subparts.name}"`);
      }

      results.push({
        name: 'Column Mapping Detection for FSG 2026 Headers',
        desc: 'Verifies that makebuy, part_no_custom, and subtype column mappings are correctly resolved for the official FSG 2026 CCBOM file headers.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'Column Mapping Detection for FSG 2026 Headers',
        desc: 'Verifies that makebuy, part_no_custom, and subtype column mappings are correctly resolved for the official FSG 2026 CCBOM file headers.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }

    // 9. Test: Name and Comment Length Validations
    try {
      const longNameEntry: BOMEntry = {
        id: 'local-long-name',
        system: 'BR',
        assembly: 'Brake Discs',
        subAssembly: 'none',
        part: 'This part name is way too long and exceeds twenty five characters limit',
        make_buy: 'make',
        quantity: '1',
        comments: 'Short comment',
        custom_id: '',
        delete: '0',
      };

      const longCommentEntry: BOMEntry = {
        id: 'local-long-comment',
        system: 'BR',
        assembly: 'Brake Discs',
        subAssembly: 'none',
        part: 'Valid Part',
        make_buy: 'make',
        quantity: '1',
        comments: 'This comments field is way too long and exceeds forty characters limit',
        custom_id: '',
        delete: '0',
      };

      const errors1 = validateBOM([longNameEntry], assemblies, [], mapping);
      const nameError = errors1.find((e) => e.field === 'part' && e.message.includes('exceeds the 25-character limit'));
      if (!nameError) {
        throw new Error('Expected validation error for part name exceeding 25-character limit, but none was flagged.');
      }

      const errors2 = validateBOM([longCommentEntry], assemblies, [], mapping);
      const commentError = errors2.find((e) => e.field === 'comments' && e.message.includes('exceeds the 40-character limit'));
      if (!commentError) {
        throw new Error('Expected validation error for comments exceeding 40-character limit, but none was flagged.');
      }

      results.push({
        name: 'Part Name and Comment Length Limits',
        desc: 'Verifies that part names exceeding 25 chars and comments exceeding 40 chars are flagged as errors.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'Part Name and Comment Length Limits',
        desc: 'Verifies that part names exceeding 25 chars and comments exceeding 40 chars are flagged as errors.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }

    // 10. Test: Dynamic Assembly Generation with Temp UIDs
    try {
      const entries: BOMEntry[] = [
        {
          id: 'local-new-asm-1',
          system: 'SU',
          assembly: 'Bell Cranks',
          subAssembly: 'none',
          part: 'Front Bellcrank Left',
          make_buy: 'make',
          quantity: '1',
          comments: 'New assembly test',
          custom_id: '',
          delete: '0',
        },
      ];

      // pass empty assemblies list to simulate brand new/empty snapshot
      const assembliesHeaders = ['assembly_uid', 'system', 'assembly', 'sub_assembly', 'assembly_no', 'comments'];
      const { parts, assemblies: exportedAssemblies } = exportEntriesToCSV(entries, [], mapping, partsHeaders, subpartsHeaders, assembliesHeaders);

      if (exportedAssemblies.length !== 1) {
        throw new Error(`Expected exactly 1 exported assembly, but got ${exportedAssemblies.length}`);
      }

      const asmUid = exportedAssemblies[0].assembly_uid;
      if (!asmUid || !asmUid.startsWith('NEW-A')) {
        throw new Error(`Expected generated assembly to have a temporary ID starting with "NEW-A", but got "${asmUid}"`);
      }

      if (parts.length !== 1) {
        throw new Error(`Expected 1 exported part, but got ${parts.length}`);
      }

      const partAsmUid = parts[0].assembly_uid;
      if (partAsmUid !== asmUid) {
        throw new Error(`Expected exported part assembly_uid "${partAsmUid}" to match exported assembly UID "${asmUid}"`);
      }

      results.push({
        name: 'Dynamic Assembly Generation (Temp UIDs)',
        desc: 'Verifies that new assemblies not in snapshot are dynamically generated in assemblies.csv with a temporary ID and parts reference it.',
        passed: true,
      });
    } catch (e: any) {
      results.push({
        name: 'Dynamic Assembly Generation (Temp UIDs)',
        desc: 'Verifies that new assemblies not in snapshot are dynamically generated in assemblies.csv with a temporary ID and parts reference it.',
        passed: false,
        errorLog: e.message || String(e),
      });
    }

    setTests(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runTests();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, overflow: 'hidden' }}>
      <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Browser Test Verification Suite</h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Validates edge cases and unified entry logic inside the sandbox.
          </p>
        </div>
        <button className="btn btn-primary" onClick={runTests} disabled={isRunning}>
          Run Test Suite
        </button>
      </div>

      <div className="test-suite">
        {tests.map((test, index) => (
          <div key={index} className={`test-item ${test.passed ? 'passed' : 'failed'}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.875rem', color: test.passed ? 'var(--color-success-border)' : 'var(--color-error)' }}>
                {test.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{test.desc}</div>
              {test.errorLog && (
                <div className="test-error-log">
                  <Terminal size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  {test.errorLog}
                </div>
              )}
            </div>
            <div>
              {test.passed ? (
                <span className="badge badge-new">PASS</span>
              ) : (
                <span className="badge badge-deleted">FAIL</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
