import {
  Component,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal
} from '@angular/core';

import { NgClass } from '@angular/common';
import { Menu } from '../../shared/menu/menu';
import { Modal } from '../../shared/modal/modal';
import { SidebarService } from '../../services/sidebar.service';
import { BatchSearchService, BatchRow } from './batch-search.service';

interface Nota {
  tipo: 'ok' | 'warning' | 'error' | 'invalid' | 'empty';
  mensaje: string;
  color: string;
  icono?: string;
}

const MATERIAL_KEY_STRUCTURE_REGEX = /^(?=.{3,30}$)(?=.*\d)[A-Z0-9][A-Z0-9 /._-]*$/;

/**
 * ✅ Elimina el prefijo de autor en las notas del backend,
 * sin depender de nombres hardcodeados.
 * Formato esperado: "Apellido, Nombre (ID): mensaje"
 */
const stripUserPrefixFromNota = (value: string): string =>
  String(value ?? '')
    .replace(/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+,\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s*\(\s*\d+\s*\)\s*:\s*/i, '')
    .trim();

@Component({
  selector: 'app-show',
  standalone: true,
  imports: [NgClass, Menu, Modal],   // ✅ NgClass en lugar de CommonModule
  templateUrl: './show.html',
})
export class Show implements OnDestroy {

  private batchSvc       = inject(BatchSearchService);
  private sidebarService = inject(SidebarService);    // ✅ SidebarService inyectado

  @ViewChild('batchInput', { static: false })
  batchInput!: ElementRef<HTMLTextAreaElement>;

  // ✅ Sidebar desacoplado de <app-menu>
  isSidebarOpen = this.sidebarService.isOpen;
  toggleSidebar(): void { this.sidebarService.toggle(); }

  // ✅ Signals — template reactivo sin ChangeDetectorRef
  batchBusy         = signal(false);
  batchProgress     = signal({ processed: 0, total: 0 });
  batchRows         = signal<BatchRow[]>([]);
  batchSummary      = signal<{ total: number; ok: number; failed: number } | null>(null);
  showModal         = signal(false);
  cancelConfirmOpen = signal(false);
  batchError        = signal<string | null>(null);

  batchAbort: AbortController | null = null;

  /* ----------------------------------------------------------
     Aborta cualquier búsqueda en curso si el usuario navega
     fuera del componente.
  ---------------------------------------------------------- */
  ngOnDestroy(): void {
    if (this.batchAbort) {
      this.batchAbort.abort();
      this.batchAbort = null;
    }
  }

  // -------------------------------
  // EVENTOS
  // -------------------------------
  onBatchKeydown(ev: KeyboardEvent, value: string): void {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.startBatchSearch(value);
    }
  }

  // -------------------------------
  // INPUT BATCH (auto-resize)
  // -------------------------------
  onBatchInput(textarea: HTMLTextAreaElement): void {
    const maxHeightPx = 260;
    textarea.style.height = 'auto';
    const next = Math.min(textarea.scrollHeight, maxHeightPx);
    textarea.style.height = `${next}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeightPx ? 'auto' : 'hidden';
  }

  // -------------------------------
  // Helpers
  // -------------------------------
  getNotaForAlternative(alt: string, notaOriginal: string | null): Nota {
    const nota = stripUserPrefixFromNota((notaOriginal || '').trim());
    const t = nota.toLowerCase();

    if (!alt || !alt.trim()) {
      return { tipo: 'empty', mensaje: '—', color: 'text-gray-400' };
    }

    if (alt === '[object Object]') {
      return {
        tipo: 'error',
        mensaje: 'Error de formato',
        color: 'text-amber-700 bg-amber-50 border border-amber-300',
      };
    }

    if (t.includes('no válido') || t.includes('novalido') || t.includes('invalid')) {
      return {
        tipo: 'invalid',
        mensaje: nota || 'Material no válido',
        color: 'text-red-700 bg-red-100 border border-red-200',
      };
    }

    if (nota) {
      return {
        tipo: 'warning',
        mensaje: nota,
        color: 'text-gray-800 bg-white border border-gray-300',
      };
    }

    return { tipo: 'ok', mensaje: '', color: '' };
  }

  getNotaForRow(row: BatchRow): Nota {
    if (!row?.id) {
      return {
        tipo: 'invalid',
        mensaje: 'Material no válido',
        color: 'text-red-700 bg-red-100 border border-red-200',
      };
    }

    const hasAlts =
      typeof row?.alternativa === 'string' &&
      row.alternativa.split('|||').some(a => a && a.trim());

    if (!hasAlts) {
      return {
        tipo: 'empty',
        mensaje: '—',
        color: 'text-gray-300 italic',
      };
    }

    return { tipo: 'ok', mensaje: '', color: '' };
  }

  preprocessAlternatives(row: BatchRow) {
    if (!row?.alternativa) return [];
    const alts = row.alternativa.split('|||').map(a => a.trim());
    const notas = row.notasAlternativa?.split('|||') ?? [];

    return alts.map((alt, idx) => ({
      alt,
      altLabel: alt === '[object Object]' ? '—' : alt,
      nota: this.getNotaForAlternative(alt, notas[idx] ?? null),
    }));
  }

  // -------------------------------
  // Buscador principal
  // -------------------------------
  async startBatchSearch(inputText: string): Promise<void> {
    if (this.batchBusy()) return;   // ✅ signal

    this.batchError.set(null);

    const nums = this.batchSvc.normalizeInput(inputText);
    if (!nums.length) {
      this.batchError.set('Inserte material válido');
      return;
    }

    const hasInvalid = nums.some((n) => {
      const raw = String(n ?? '').replace(/\u00A0/g, ' ').trim();
      return !raw || !MATERIAL_KEY_STRUCTURE_REGEX.test(raw);
    });

    if (hasInvalid) {
      this.batchError.set('Inserte material válido');
      return;
    }

    this.batchAbort = new AbortController();
    this.batchBusy.set(true);
    this.batchRows.set([]);
    this.batchSummary.set(null);
    this.batchProgress.set({ processed: 0, total: nums.length });

    try {
      const res = await this.batchSvc.batchSearch(nums, {
        concurrency: 5,
        timeoutMs: 30000,
        signal: this.batchAbort.signal,
        retry: 1,
        onProgress: (p, t) => {
          this.batchProgress.set({ processed: p, total: t });
        },
      });

      const sorted = [...res.rows].sort((a, b) => {
        if (a.id && !b.id) return -1;
        if (!a.id && b.id) return 1;
        return 0;
      });

      this.batchRows.set(sorted);
      this.batchSummary.set(res.summary);

      if (sorted.length > 0) this.showModal.set(true);

    } catch (e) {
      console.error('Error en búsqueda por lote:', e);

      this.batchSummary.set({
        total: nums.length,
        ok: 0,
        failed: nums.length,
      });

      this.batchError.set(
        'Ocurrió un error al procesar la búsqueda. Verifica tu conexión e intenta nuevamente.'
      );

    } finally {
      this.batchBusy.set(false);   // ✅ sin cdr.detectChanges()
    }
  }

  openCancelConfirm(): void {
    this.cancelConfirmOpen.set(true);
  }

  closeCancelConfirm(): void {
    this.cancelConfirmOpen.set(false);
  }

  /* ----------------------------------------------------------
     Reset manual del estado, sin recargar la página
  ---------------------------------------------------------- */
  confirmCancelBatch(): void {
    this.cancelBatch();

    this.batchRows.set([]);
    this.batchSummary.set(null);
    this.batchError.set(null);
    this.batchProgress.set({ processed: 0, total: 0 });

    if (this.batchInput?.nativeElement) {
      this.batchInput.nativeElement.value = '';
      this.batchInput.nativeElement.style.height = 'auto';
    }

    this.closeCancelConfirm();
  }

  cancelBatch(): void {
    if (this.batchAbort) this.batchAbort.abort();
    this.batchAbort = null;
    this.batchBusy.set(false);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  // ✅ Método privado reutilizable — sacado de downloadBatchExcel
  private getAltLabels(row: BatchRow): string[] {
    if (!row?.id) return ['MATERIAL NO VÁLIDO'];
    const raw = String(row?.alternativa ?? '').trim();
    if (!raw) return [];
    return raw
      .split('|||')
      .map((x) => String(x ?? '').trim())
      .filter((x) => x && x !== '[object Object]');
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async downloadBatchExcel(): Promise<void> {
    if (!this.batchRows().length) return;   // ✅ signal

    try {
      const ExcelJS = await import('exceljs');

      const altMatrix = this.batchRows().map((r) => this.getAltLabels(r));  // ✅ método privado
      const maxAlt    = Math.max(0, ...altMatrix.map((a) => a.length));

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Daimler Buses Cross Reference';
      wb.created = new Date();

      const ws = wb.addWorksheet('Resultados');

      ws.columns = [
        { header: '#',               key: 'idx', width: 6  },
        { header: 'Número de Parte', key: 'num', width: 26 },
        ...Array.from({ length: maxAlt }, (_, i) => ({
          header: `Alternativa ${i + 1}`,
          key:    `alt${i + 1}`,
          width:  22,
        })),
        { header: 'Descripción', key: 'desc', width: 60 },
      ];

      ws.getRow(1).font      = { bold: true };
      ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

      this.batchRows().forEach((row, i) => {    // ✅ signal
        const alts = altMatrix[i] ?? [];
        const rowData: any = {
          idx:  i + 1,
          num:  String(row?.numParteOem  ?? ''),
          desc: String(row?.descripcion  ?? ''),
        };
        for (let j = 0; j < maxAlt; j++) {
          rowData[`alt${j + 1}`] = alts[j] ?? '';
        }
        ws.addRow(rowData);
      });

      ws.eachRow((r, rowNumber) => {
        r.eachCell((cell) => {
          cell.border = {
            top:    { style: 'thin', color: { argb: 'FFBFBFBF' } },
            left:   { style: 'thin', color: { argb: 'FFBFBFBF' } },
            bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            right:  { style: 'thin', color: { argb: 'FFBFBFBF' } },
          };
          if (rowNumber !== 1) {
            cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
          }
        });
      });

      const buf  = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      this.downloadBlob(blob, `Resultados_Busqueda_${Date.now()}.xlsx`);

    } catch (err) {
      console.error('Error al generar el archivo Excel:', err);
      this.batchError.set('No se pudo generar el archivo Excel. Intenta nuevamente.');
    }
  }
}