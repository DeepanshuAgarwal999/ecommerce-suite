import * as XLSX from 'xlsx';

export interface ExcelColumn<T> {
  header: string;
  /** Pulls the cell value from one row. Return a primitive, not a formatted string,
   *  where possible — dates and numbers travel better as real Excel types. */
  accessor: (row: T) => string | number | Date | null | undefined;
  /** Character width hint; Excel treats this as roughly one digit per unit. */
  width?: number;
}

export interface ExcelSheet<T> {
  /** Max 31 chars — Excel truncates and errors on duplicates beyond that. */
  name: string;
  rows: T[];
  columns: ExcelColumn<T>[];
}

/**
 * Builds a .xlsx workbook from one or more typed sheets and triggers a
 * browser download. Runs entirely client-side — nothing is uploaded, the
 * file is generated from data already in memory.
 */
export function downloadExcel(filenameBase: string, sheets: ExcelSheet<unknown>[]): void {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const headers = sheet.columns.map((column) => column.header);
    const body = sheet.rows.map((row) =>
      sheet.columns.map((column) => column.accessor(row) ?? ''),
    );
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...body]);
    worksheet['!cols'] = sheet.columns.map((column) => ({ wch: column.width ?? 18 }));
    // Excel's hard 31-character sheet-name limit.
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenameBase}-${stamp}.xlsx`);
}
