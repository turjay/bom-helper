import ExcelJS from 'exceljs';
import { BOMEntry, AssemblyRow } from '../types';
import { OFFICIAL_SYSTEMS } from '../fixtures/assemblyCatalog';

// Helper to extract values from multiple possible keys (case-insensitive)
const getValueByPossibleKeys = (entry: any, possibleKeys: string[], defaultValue = '') => {
  for (const k of possibleKeys) {
    if (entry[k] !== undefined && entry[k] !== null) return String(entry[k]).trim();
    const lowerKey = k.toLowerCase();
    const foundKey = Object.keys(entry).find(key => key.toLowerCase() === lowerKey);
    if (foundKey && entry[foundKey] !== undefined && entry[foundKey] !== null) {
      return String(entry[foundKey]).trim();
    }
  }
  return defaultValue;
};

export async function exportToExcel(
  entries: BOMEntry[],
  assemblies: AssemblyRow[],
  filePrefix: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BOM Helper';
  workbook.created = new Date();

  // Filter out deleted entries
  const activeEntries = entries.filter(e => e.delete !== '1');

  // Create a sheet for each system in the official systems list
  for (const system of OFFICIAL_SYSTEMS) {
    const systemEntries = activeEntries.filter(e => e.system === system.code);

    const sheetName = `${system.code} - ${system.name.substring(0, 20)}`;
    // Clean sheet name of invalid characters (\ / ? * : [ ])
    const cleanSheetName = sheetName.replace(/[\\/?*:[\]]/g, ' ').substring(0, 31);
    const worksheet = workbook.addWorksheet(cleanSheetName, {
      views: [{ showGridLines: true }]
    });

    // Theme primary: deep slate/navy
    const primaryColor = '1E293B'; // slate-800
    const primaryTextColor = 'FFFFFF';
    
    // Assembly header color: light slate/blue
    const assemblyBgColor = 'F1F5F9'; // slate-100
    const assemblyTextColor = '0F172A'; // slate-900

    // Table Header color: medium slate
    const tableHeaderBgColor = '475569'; // slate-600
    const tableHeaderTextColor = 'FFFFFF';

    // Sub-assembly header color: light gray-blue
    const subassemblyBgColor = 'E2E8F0'; // slate-200
    const subassemblyTextColor = '1E293B';

    // Set Column properties
    worksheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'comment', key: 'comment', width: 30 },
      { header: 'buy/make', key: 'buymake', width: 12 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Weight(kg)', key: 'weight', width: 12 },
      { header: 'Start Location', key: 'location', width: 18 },
      { header: 'Amount of electricity consumed in kWh.', key: 'electricity', width: 35 },
      { header: 'Cost', key: 'cost', width: 12 },
    ];

    // Clear auto-generated header row
    worksheet.spliceRows(1, 1);

    // 1. SYSTEM TITLE BLOCK
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${system.code} - ${system.name.toUpperCase()}`;
    titleCell.font = {
      name: 'Outfit',
      size: 14,
      bold: true,
      color: { argb: primaryTextColor },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: primaryColor },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    
    worksheet.mergeCells('A1:H2');
    worksheet.getRow(1).height = 20;
    worksheet.getRow(2).height = 20;

    let currentRow = 4; // Start placing content at row 4

    if (systemEntries.length === 0) {
      // Empty sheet placeholder
      worksheet.getCell(`A${currentRow}`).value = 'No parts recorded in this system.';
      worksheet.getCell(`A${currentRow}`).font = { name: 'Inter', italic: true, color: { argb: '64748B' } };
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
      continue;
    }

    // Group entries in this system by assembly name
    const systemAssemblyNames = Array.from(new Set(systemEntries.map(e => e.assembly).filter(Boolean)));
    systemAssemblyNames.sort();

    for (const assemblyName of systemAssemblyNames) {
      const assemblyEntries = systemEntries.filter(e => e.assembly === assemblyName);

      // --- ASSEMBLY SECTION HEADER ---
      const assRow = worksheet.getRow(currentRow);
      assRow.height = 24;
      const assCell = worksheet.getCell(`A${currentRow}`);
      assCell.value = `ASSEMBLY: ${assemblyName.toUpperCase()}`;
      assCell.font = {
        name: 'Outfit',
        size: 11,
        bold: true,
        color: { argb: assemblyTextColor },
      };
      
      for (let col = 1; col <= 8; col++) {
        const cell = worksheet.getCell(currentRow, col);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: assemblyBgColor },
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'CBD5E1' } },
          bottom: { style: 'medium', color: { argb: 'CBD5E1' } },
        };
      }
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
      currentRow += 2; // Leave one blank row

      // Split into Direct Parts (subAssembly === 'none') and Sub-Assemblies
      const directParts = assemblyEntries.filter(e => e.subAssembly === 'none' || !e.subAssembly);
      const subassemblies = Array.from(new Set(
        assemblyEntries.filter(e => e.subAssembly && e.subAssembly !== 'none').map(e => e.subAssembly)
      ));

      // Define table drawing helper
      const drawTable = (partList: BOMEntry[], subassemblyTitle?: string) => {
        if (partList.length === 0) return;

        // If it's a subassembly, draw subassembly header
        if (subassemblyTitle) {
          const subRow = worksheet.getRow(currentRow);
          subRow.height = 20;
          const subCell = worksheet.getCell(`A${currentRow}`);
          subCell.value = `SUB-ASSEMBLY: ${subassemblyTitle}`;
          subCell.font = {
            name: 'Outfit',
            size: 10,
            bold: true,
            italic: true,
            color: { argb: subassemblyTextColor },
          };
          
          for (let col = 1; col <= 8; col++) {
            const cell = worksheet.getCell(currentRow, col);
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: subassemblyBgColor },
            };
            cell.border = {
              bottom: { style: 'thin', color: { argb: '94A3B8' } },
            };
          }
          worksheet.mergeCells(`A${currentRow}:H${currentRow}`);
          currentRow++;
        }

        // Draw Table Headers
        const headerRow = worksheet.getRow(currentRow);
        headerRow.height = 20;
        const headers = [
          'Name',
          'comment',
          'buy/make',
          'Quantity',
          'Weight(kg)',
          'Start Location',
          'Amount of electricity consumed in kWh.',
          'Cost',
        ];

        headers.forEach((h, colIdx) => {
          const cell = worksheet.getCell(currentRow, colIdx + 1);
          cell.value = h;
          cell.font = {
            name: 'Inter',
            size: 9,
            bold: true,
            color: { argb: tableHeaderTextColor },
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: tableHeaderBgColor },
          };
          cell.alignment = { vertical: 'middle', horizontal: colIdx >= 3 && colIdx !== 5 ? 'right' : 'left' };
          if (colIdx === 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          }
          cell.border = {
            top: { style: 'thin', color: { argb: '475569' } },
            bottom: { style: 'medium', color: { argb: '1E293B' } },
          };
        });
        currentRow++;

        // Draw Rows
        partList.forEach((entry, rowIdx) => {
          const dataRow = worksheet.getRow(currentRow);
          dataRow.height = 18;

          const name = entry.part || '';
          const comment = getValueByPossibleKeys(entry, ['comments', 'comment', 'description']);
          const buyMake = entry.make_buy || 'make';
          
          const rawQty = getValueByPossibleKeys(entry, ['quantity', 'qty'], '1');
          const qty = parseInt(rawQty) || 1;

          const rawWeight = getValueByPossibleKeys(entry, ['weight(kg)', 'weight', 'mass', 'weight_kg']);
          const weight = rawWeight ? parseFloat(rawWeight.replace(',', '.')) : null;

          const startLocation = getValueByPossibleKeys(entry, ['start location', 'start_location', 'location']);
          
          const rawElectricity = getValueByPossibleKeys(entry, ['amount of electricity consumed in kwh.', 'electricity', 'energy', 'kwh', 'electricity_kwh', 'amount of electricity consumed in kwh']);
          const electricity = rawElectricity ? parseFloat(rawElectricity.replace(',', '.')) : null;

          const rawCost = getValueByPossibleKeys(entry, ['cost', 'costs', 'price']);
          const cost = rawCost ? parseFloat(rawCost.replace(',', '.')) : null;

          // Column 1: Name
          const c1 = worksheet.getCell(currentRow, 1);
          c1.value = name;

          // Column 2: comment
          const c2 = worksheet.getCell(currentRow, 2);
          c2.value = comment;

          // Column 3: buy/make
          const c3 = worksheet.getCell(currentRow, 3);
          c3.value = buyMake.toLowerCase() === 'buy' ? 'buy' : 'make';
          c3.alignment = { horizontal: 'center' };

          // Column 4: Quantity
          const c4 = worksheet.getCell(currentRow, 4);
          c4.value = qty;
          c4.numFmt = '#,##0';
          c4.alignment = { horizontal: 'right' };

          // Column 5: Weight(kg)
          const c5 = worksheet.getCell(currentRow, 5);
          if (weight !== null && !isNaN(weight)) {
            c5.value = weight;
            c5.numFmt = '0.00';
          } else {
            c5.value = rawWeight || '';
          }
          c5.alignment = { horizontal: 'right' };

          // Column 6: Start Location
          const c6 = worksheet.getCell(currentRow, 6);
          c6.value = startLocation;

          // Column 7: Amount of electricity consumed in kWh.
          const c7 = worksheet.getCell(currentRow, 7);
          if (electricity !== null && !isNaN(electricity)) {
            c7.value = electricity;
            c7.numFmt = '0.00';
          } else {
            c7.value = rawElectricity || '';
          }
          c7.alignment = { horizontal: 'right' };

          // Column 8: Cost
          const c8 = worksheet.getCell(currentRow, 8);
          if (cost !== null && !isNaN(cost)) {
            c8.value = cost;
            c8.numFmt = '$#,##0.00';
          } else {
            c8.value = rawCost || '';
          }
          c8.alignment = { horizontal: 'right' };

          // Zebra striping style & borders
          const isEven = rowIdx % 2 === 0;
          const rowBgColor = isEven ? 'FFFFFF' : 'F8FAFC'; // slate-50

          for (let col = 1; col <= 8; col++) {
            const cell = worksheet.getCell(currentRow, col);
            cell.font = { name: 'Inter', size: 9 };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: rowBgColor },
            };
            cell.border = {
              bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
              left: { style: 'thin', color: { argb: 'F1F5F9' } },
              right: { style: 'thin', color: { argb: 'F1F5F9' } },
            };
          }

          currentRow++;
        });

        currentRow += 2; // Blank spacing after table
      };

      // 1. Draw Direct Parts Table
      if (directParts.length > 0) {
        drawTable(directParts);
      }

      // 2. Draw Sub-Assemblies Tables
      for (const subassemblyName of subassemblies) {
        const subpartList = assemblyEntries.filter(e => e.subAssembly === subassemblyName);
        if (subpartList.length > 0) {
          drawTable(subpartList, subassemblyName);
        }
      }
    }

    // Auto-adjust column widths based on content lengths
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        if (cell.value) {
          const valStr = cell.value.toString();
          if (valStr.length > maxLength) {
            maxLength = valStr.length;
          }
        }
      });
      column.width = Math.min(Math.max(maxLength + 4, 12), 45);
    });
  }

  // Write and save the workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filePrefix || 'BOM_Report'}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
