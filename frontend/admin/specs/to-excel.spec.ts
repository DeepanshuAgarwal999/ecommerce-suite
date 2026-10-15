import * as XLSX from 'xlsx';
import { downloadExcel, type ExcelSheet } from '../src/lib/export/to-excel';

// jsdom has no real file-save capability, and `import * as XLSX` gets a fresh
// interop-wrapped namespace per call site, so a plain jest.spyOn on one of
// those wrappers never touches the function the implementation actually
// calls. Mocking the module itself guarantees both sides share one instance.
jest.mock('xlsx', () => {
  const actual = jest.requireActual('xlsx');
  return { ...actual, writeFile: jest.fn() };
});

const writeFile = XLSX.writeFile as jest.Mock;

interface Row {
  name: string;
  amount: number;
}

describe('downloadExcel', () => {
  afterEach(() => {
    writeFile.mockClear();
  });

  it('builds a workbook with the given sheet names, headers and rows', () => {
    const sheets: ExcelSheet<Row>[] = [
      {
        name: 'Orders',
        rows: [
          { name: 'Order A', amount: 100 },
          { name: 'Order B', amount: 250 },
        ],
        columns: [
          { header: 'Name', accessor: (r) => r.name },
          { header: 'Amount', accessor: (r) => r.amount },
        ],
      },
    ];

    downloadExcel('orders-report', sheets as ExcelSheet<unknown>[]);

    expect(writeFile).toHaveBeenCalledTimes(1);
    const [workbook, filename] = writeFile.mock.calls[0];
    expect(filename).toMatch(/^orders-report-\d{4}-\d{2}-\d{2}\.xlsx$/);

    const sheetName = workbook.SheetNames[0];
    expect(sheetName).toBe('Orders');

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
    expect(rows[0]).toEqual(['Name', 'Amount']);
    expect(rows[1]).toEqual(['Order A', 100]);
    expect(rows[2]).toEqual(['Order B', 250]);
  });

  it('truncates a sheet name to the 31-character Excel limit', () => {
    const longName = 'A'.repeat(40);
    const sheets: ExcelSheet<Row>[] = [
      { name: longName, rows: [], columns: [{ header: 'Name', accessor: (r) => r.name }] },
    ];

    downloadExcel('report', sheets as ExcelSheet<unknown>[]);

    const [workbook] = writeFile.mock.calls[0];
    expect(workbook.SheetNames[0]).toBe(longName.slice(0, 31));
    expect(workbook.SheetNames[0].length).toBe(31);
  });
});
