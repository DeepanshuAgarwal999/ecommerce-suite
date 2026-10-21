'use client';

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { inventoryApi } from '@/features/inventory/api/inventory-api';
import { vendorsApi } from '@/features/vendors/api/vendors-api';
import { api, endpoints, isApiError, queryKeys } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { catalogOptionsApi } from '../api/catalog-options-api';
import { downloadErrorReport, downloadTemplate, parseSheet, type ImportProduct, type ParsedSheet, type RowError } from './sheet';

const BATCH = 25;
const NO_WAREHOUSE = '__none__';

interface ImportResult {
  handle: string;
  vendorCode: string;
  rows: number[];
  outcome: 'created' | 'skipped' | 'failed';
  productId?: string;
  message?: string;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

/**
 * Bulk product import: template -> upload -> validated preview -> batched import with
 * progress -> summary + error report. Re-uploading the same file is safe: products
 * already imported (same vendor + handle) are skipped, never duplicated.
 */
export function ImportProductsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedSheet | null>(null);
  const [publish, setPublish] = useState(false);
  const [warehouseId, setWarehouseId] = useState<string>(NO_WAREHOUSE);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const warehouses = useQuery({ queryKey: queryKeys.inventory.warehouses(), queryFn: inventoryApi.warehouses, enabled: open });

  const hasStock = parsed?.products.some((product) => product.variants.some((variant) => (variant.stock ?? 0) > 0)) ?? false;

  function reset() {
    setStep('upload');
    setFileName('');
    setParsed(null);
    setResults([]);
    setProgress({ done: 0, total: 0 });
    if (fileInput.current) fileInput.current.value = '';
  }

  async function getTemplate() {
    try {
      const [vendors, categories] = await Promise.all([
        vendorsApi.list({ status: 'APPROVED', limit: 100 }),
        catalogOptionsApi.categories(),
      ]);
      downloadTemplate({ vendors: vendors.items, categories });
    } catch {
      downloadTemplate({ vendors: [], categories: [] });
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Please upload an .xlsx, .xls or .csv file');
      return;
    }
    setParsing(true);
    try {
      const result = await parseSheet(file);
      setFileName(file.name);
      setParsed(result);
      setStep('preview');
      if (warehouseId === NO_WAREHOUSE && warehouses.data?.length === 1) setWarehouseId(warehouses.data[0].id);
    } catch {
      toast.error('Could not read that file - is it a valid Excel sheet?');
    } finally {
      setParsing(false);
    }
  }

  async function runImport() {
    if (!parsed?.products.length) return;
    const batches: ImportProduct[][] = [];
    for (let i = 0; i < parsed.products.length; i += BATCH) batches.push(parsed.products.slice(i, i + BATCH));

    setStep('importing');
    setProgress({ done: 0, total: parsed.products.length });
    const collected: ImportResult[] = [];

    for (const batch of batches) {
      try {
        const response = await api.post<{ results: ImportResult[] }>(endpoints.admin.importProducts, {
          options: { publish, warehouseId: warehouseId === NO_WAREHOUSE ? undefined : warehouseId },
          products: batch,
        });
        collected.push(...response.results);
      } catch (error) {
        // A whole batch rejected (e.g. validation) - record it against each product and carry on.
        const message = isApiError(error) ? error.message : 'Request failed';
        collected.push(
          ...batch.map((product) => ({
            handle: product.handle,
            vendorCode: product.vendorCode,
            rows: product.variants.map((variant) => variant.row),
            outcome: 'failed' as const,
            message,
          })),
        );
      }
      setResults([...collected]);
      setProgress((current) => ({ ...current, done: Math.min(current.total, current.done + batch.length) }));
    }

    setStep('done');
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  }

  const created = results.filter((row) => row.outcome === 'created').length;
  const skipped = results.filter((row) => row.outcome === 'skipped').length;
  const failedResults = results.filter((row) => row.outcome === 'failed');
  const withWarnings = results.filter((row) => row.outcome === 'created' && row.message);
  const allErrors: RowError[] = [
    ...(parsed?.errors ?? []),
    ...failedResults.flatMap((row) => row.rows.map((line) => ({ row: line, handle: row.handle, message: row.message ?? 'Failed' }))),
    ...withWarnings.flatMap((row) => row.rows.slice(0, 1).map((line) => ({ row: line, handle: row.handle, message: row.message ?? '' }))),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (step === 'importing') return; // don't abandon a running import
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" aria-hidden />
            Import products from Excel
          </DialogTitle>
          <DialogDescription>
            One row per variant; rows sharing a Handle become one product. Re-uploading a file skips products that were already
            imported.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex flex-col gap-4">
            <Button type="button" variant="outline" className="self-start" onClick={getTemplate}>
              <Download className="size-4" aria-hidden />
              Download template
            </Button>
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void onFile(event.dataTransfer.files[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
            >
              {parsing ? <Loader2 className="size-8 animate-spin text-primary" aria-hidden /> : <Upload className="size-8 text-muted-foreground" aria-hidden />}
              <span className="text-sm font-medium">{parsing ? 'Reading file…' : 'Drop your .xlsx file here, or click to choose'}</span>
              <span className="text-xs text-muted-foreground">Max 5,000 rows per file works comfortably.</span>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
            </label>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Products ready" value={parsed.products.length} tone="ok" />
              <Stat label="Variants" value={parsed.products.reduce((sum, product) => sum + product.variants.length, 0)} />
              <Stat label="Rows with problems" value={parsed.errors.length} tone={parsed.errors.length ? 'warn' : undefined} />
            </div>
            <p className="text-xs text-muted-foreground">
              {fileName} · {parsed.rowCount} rows read
            </p>

            {parsed.errors.length > 0 && (
              <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
                <p className="mb-1.5 flex items-center gap-2 font-medium">
                  <AlertTriangle className="size-4 text-status-warning" aria-hidden />
                  These rows will be skipped - fix them and re-upload later (already-imported products are skipped automatically):
                </p>
                <ul className="max-h-36 overflow-y-auto text-xs">
                  {parsed.errors.slice(0, 50).map((error, index) => (
                    <li key={index}>
                      Row {error.row}
                      {error.handle && <span className="font-mono"> ({error.handle})</span>}: {error.message}
                    </li>
                  ))}
                  {parsed.errors.length > 50 && <li>…and {parsed.errors.length - 50} more (in the error report)</li>}
                </ul>
              </div>
            )}

            {parsed.products.length > 0 && (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Product</th>
                      <th className="px-3 py-2 font-medium">Vendor</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 font-medium">Variants</th>
                      <th className="px-3 py-2 font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.products.slice(0, 8).map((product) => (
                      <tr key={`${product.vendorCode}:${product.handle}`} className="border-t">
                        <td className="max-w-[220px] truncate px-3 py-2 font-medium">{product.title}</td>
                        <td className="px-3 py-2 font-mono text-xs">{product.vendorCode}</td>
                        <td className="px-3 py-2 text-xs">{product.categorySlug}</td>
                        <td className="px-3 py-2 tabular-nums">{product.variants.length}</td>
                        <td className="px-3 py-2 tabular-nums">{formatMoney(Math.min(...product.variants.map((variant) => variant.price)))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.products.length > 8 && (
                  <p className="border-t px-3 py-2 text-xs text-muted-foreground">…and {parsed.products.length - 8} more</p>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
                <span>
                  <span className="block text-sm font-medium">Publish immediately</span>
                  <span className="block text-xs text-muted-foreground">Off = products wait in the review queue</span>
                </span>
                <Switch checked={publish} onCheckedChange={setPublish} />
              </label>
              <div className="flex flex-col gap-1.5">
                <Label>Warehouse for opening stock{hasStock && ' *'}</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_WAREHOUSE}>Don&apos;t set stock</SelectItem>
                    {warehouses.data?.map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasStock && warehouseId === NO_WAREHOUSE && (
              <p className="-mt-2 text-xs text-status-warning">The file has stock quantities - pick a warehouse for the opening stock.</p>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col gap-3 py-6">
            <p className="text-sm font-medium">
              Importing {progress.done} of {progress.total} products…
            </p>
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">Keep this window open until it finishes.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 className="size-5 text-status-success" aria-hidden />
              Import finished
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Created" value={created} tone="ok" />
              <Stat label="Already existed (skipped)" value={skipped} />
              <Stat label="Failed" value={failedResults.length + (parsed?.errors.length ? new Set(parsed.errors.map((e) => e.row)).size : 0)} tone={allErrors.length ? 'warn' : undefined} />
            </div>
            {withWarnings.length > 0 && (
              <p className="text-xs text-status-warning">{withWarnings.length} product(s) were created with warnings (e.g. stock not set) - see the report.</p>
            )}
            {!publish && created > 0 && (
              <p className="text-xs text-muted-foreground">New products are in the review queue (status: Pending review).</p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={reset}>
                Choose another file
              </Button>
              <Button disabled={!parsed?.products.length || (hasStock && warehouseId === NO_WAREHOUSE)} onClick={runImport}>
                Import {parsed?.products.length ?? 0} product{parsed?.products.length === 1 ? '' : 's'}
              </Button>
            </>
          )}
          {step === 'done' && (
            <>
              {allErrors.length > 0 && (
                <Button variant="outline" onClick={() => downloadErrorReport(allErrors)}>
                  <Download className="size-4" aria-hidden />
                  Download error report
                </Button>
              )}
              <Button
                onClick={() => {
                  onOpenChange(false);
                  reset();
                }}
              >
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
        {value.toLocaleString()}
        {tone === 'warn' && value > 0 && (
          <Badge variant="outline" className="border-status-warning/40 text-[10px] text-status-warning">
            check
          </Badge>
        )}
      </p>
    </div>
  );
}
