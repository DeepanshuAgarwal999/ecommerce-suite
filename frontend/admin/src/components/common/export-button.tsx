'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { isApiError } from '@/lib/api';
import { downloadExcel, type ExcelSheet } from '@/lib/export/to-excel';

interface ExportButtonProps {
  label?: string;
  /** Builds the sheets at click time, so a list page can fetch every filtered
   *  row (not just the current page) only when the admin actually asks for it. */
  onBuild: () => Promise<{ sheets: ExcelSheet<unknown>[]; truncated?: boolean }>;
  filenameBase: string;
}

/** "Export" button used on every report-able list and the dashboard. */
export function ExportButton({ label = 'Export', onBuild, filenameBase }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleClick() {
    setIsExporting(true);
    try {
      const { sheets, truncated } = await onBuild();
      if (sheets.every((sheet) => sheet.rows.length === 0)) {
        toast.info('Nothing to export for the current filters.');
        return;
      }
      downloadExcel(filenameBase, sheets);
      toast.success(
        truncated
          ? 'Downloaded the first 5,000 matching rows — narrow the filters for the rest.'
          : 'Report downloaded.',
      );
    } catch (error) {
      toast.error(isApiError(error) ? error.message : 'Could not build the report. Try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={isExporting}>
      {isExporting ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Download className="size-4" aria-hidden />
      )}
      {isExporting ? 'Preparing…' : label}
    </Button>
  );
}
