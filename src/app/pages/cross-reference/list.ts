import { Component, OnInit, signal, computed, HostListener, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { Menu } from '../../shared/menu/menu';
import { Modal } from '../../shared/modal/modal';
import { SidebarService } from '../../services/sidebar.service';

interface RefaccionAlternativaModel {
  id?: number;
  nombre: string;
  nota?: string | null;
}

interface RefaccionModel {
  id: number;
  numPiezaOem: string;
  descripcion: string | null;
  imagen: string | null;
  alternativas: RefaccionAlternativaModel[];
  valueParts?: string | null;
  reman?: string | null;
  dde?: string | null;
  mbf?: string | null;
}

type EditAlternativa = { nombre: string; nota?: string | null };

/**
 * ✅ Elimina el prefijo de autor en las notas del backend,
 * sin depender de nombres hardcodeados.
 * Formato esperado: "Apellido, Nombre (ID): mensaje"
 * TODO: mover a src/app/utils/nota.utils.ts y compartir con show.ts
 */
const stripUserPrefixFromNota = (value: string): string =>
  String(value ?? '')
    .replace(/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+,\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s*\(\s*\d+\s*\)\s*:\s*/i, '')
    .trim();

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [Menu, Modal],
  templateUrl: './list.html',
})
export class List implements OnInit {
  private http = inject(HttpClient);
  private sidebarService = inject(SidebarService);

  // ✅ Sidebar desacoplado de <app-menu>
  isSidebarOpen = this.sidebarService.isOpen;
  toggleSidebar(): void { this.sidebarService.toggle(); }

  refacciones = signal<RefaccionModel[]>([]);
  searchTerm = signal('');
  pageSize = 10;
  page = signal(1);
  selectedImage = signal<string | null>(null);
  showOptions = signal(false);

  editOpen = signal(false);
  editBusy = signal(false);
  editError = signal<string | null>(null);
  editingId = signal<number | null>(null);
  editNumPiezaOem = signal('');
  editDescripcion = signal('');
  editValueParts = signal('');
  editReman = signal('');
  editDde = signal('');
  editMbf = signal('');
  editImagenUrl = signal('');
  editImagenFile = signal<File | null>(null);
  editAlternativas = signal<EditAlternativa[]>([]);
  editAltDraft = signal('');
  editAltNotaDraft = signal('');
  editingAltIndex = signal<number | null>(null);

  // ✅ Control de pasos del wizard de edición (1: Datos, 2: Alternativas, 3: Referencias/Imagen)
  editStep = signal<1 | 2 | 3>(1);

  draggingAltIndex = signal<number | null>(null);
  dragOverAltIndex = signal<number | null>(null);

  deleteAltConfirmOpen = signal(false);
  deleteAltConfirmIndex = signal<number | null>(null);
  deleteAltConfirmLabel = signal('');

  editSavedModalOpen = signal(false);

  viewOpen = signal(false);
  viewingItem = signal<RefaccionModel | null>(null);

  exportScope = signal<'page' | 'n' | 'all'>('page');
  exportN = signal<number | null>(null);
  exportBusy = signal(false);
  exportError = signal<string | null>(null);
  exportClientMaxRows = 2000;
  exportTimeoutMs = 30000;
  exportRetryCount = 2;
  exportRetryDelayMs = 500;

  filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.refacciones();
    return this.refacciones().filter((r) => {
      const values = [
        r.numPiezaOem,
        r.valueParts,
        r.reman,
        r.dde,
        r.mbf,
        r.descripcion,
      ];
      return values
        .filter((v) => v !== null && v !== undefined)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  });
  pageCount = computed(() => {
    const total = this.filtered().length;
    return Math.max(1, Math.ceil(total / this.pageSize));
  });
  paginated = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });
  range = computed(() => {
    const total = this.filtered().length;
    const start = total ? (this.page() - 1) * this.pageSize + 1 : 0;
    const end = Math.min(this.page() * this.pageSize, total);
    return { start, end, total };
  });
  exportTotalAvailable = computed(() => this.filtered().length);
  exportSelectedCount = computed(() => {
    const total = this.exportTotalAvailable();
    const scope = this.exportScope();
    if (scope === 'page') return Math.min(this.paginated().length, total);
    if (scope === 'all') return total;
    const n = this.exportN();
    if (!n || Number.isNaN(n) || n <= 0) return 0;
    return Math.min(n, total);
  });

  async ngOnInit() {
    try {
      const data = await firstValueFrom(this.http.get<any[]>('/api/refacciones'));
      const sorted = Array.isArray(data) ? data.sort((a: any, b: any) => a.id - b.id) : [];
      this.refacciones.set(sorted);
      this.page.set(1);
    } catch (err) {
      console.error('Error al cargar refacciones:', err);
    }
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
    this.page.set(1);
  }

  firstPage() {
    this.page.set(1);
  }
  prevPage() {
    if (this.page() > 1) this.page.update((p) => p - 1);
  }
  nextPage() {
    if (this.page() < this.pageCount()) this.page.update((p) => p + 1);
  }
  lastPage() {
    this.page.set(this.pageCount());
  }

  openImage(url: string) {
    if (url) this.selectedImage.set(url);
  }

  closeImage() {
    this.selectedImage.set(null);
  }

  // ✅ Sin nombres hardcodeados — regex genérico
  formatNota(nota?: string | null): string {
    return stripUserPrefixFromNota(nota ?? '');
  }

  hasNota(nota?: string | null): boolean {
    return !!this.formatNota(nota);
  }

  openViewModal(r: RefaccionModel) {
    this.viewingItem.set(r);
    this.viewOpen.set(true);
  }

  closeViewModal() {
    this.viewOpen.set(false);
    this.viewingItem.set(null);
  }

  openEditModal(r: RefaccionModel) {
    this.editError.set(null);
    this.editStep.set(1);
    this.editingId.set(r.id);
    this.editNumPiezaOem.set(r.numPiezaOem ?? '');
    this.editDescripcion.set(r.descripcion ?? '');
    this.editValueParts.set(r.valueParts ?? '');
    this.editReman.set(r.reman ?? '');
    this.editDde.set(r.dde ?? '');
    this.editMbf.set(r.mbf ?? '');
    this.editImagenUrl.set(r.imagen ?? '');
    this.editImagenFile.set(null);
    const alts = Array.isArray(r.alternativas)
      ? r.alternativas
          .map((a) => ({
            nombre: a && a.nombre ? String(a.nombre).trim() : '',
            nota: a && (a as any).nota ? String((a as any).nota).trim() : null,
          }))
          .filter((x) => x.nombre)
      : [];
    this.editAlternativas.set(alts);
    this.editAltDraft.set('');
    this.editAltNotaDraft.set('');
    this.editingAltIndex.set(null);
    this.editOpen.set(true);
  }

  closeEditModal() {
    this.editOpen.set(false);
    this.editBusy.set(false);
    this.editError.set(null);
    this.editingId.set(null);
    this.editImagenFile.set(null);
    this.editStep.set(1);
    this.closeDeleteAltConfirm();
  }

  closeEditSavedModal() {
    this.editSavedModalOpen.set(false);
  }

  goToStep(step: 1 | 2 | 3): void {
    this.editStep.set(step);
  }

  nextStep(): void {
    if (this.editStep() === 1) {
      if (!this.editNumPiezaOem().trim() || !this.editDescripcion().trim()) {
        this.editError.set('Completa los campos requeridos antes de continuar.');
        return;
      }
      this.editError.set(null);
    }
    if (this.editStep() < 3) {
      this.editStep.update((s) => (s + 1) as 1 | 2 | 3);
    }
  }

  prevStep(): void {
    this.editError.set(null);
    if (this.editStep() > 1) {
      this.editStep.update((s) => (s - 1) as 1 | 2 | 3);
    }
  }

  startEditAlternativa(index: number) {
    const alt = this.editAlternativas()[index];
    if (!alt) return;
    this.editAltDraft.set(String(alt.nombre ?? '').trim());
    this.editAltNotaDraft.set(String(alt.nota ?? '').trim());
    this.editingAltIndex.set(index);
  }

  cancelEditAlternativa() {
    this.editAltDraft.set('');
    this.editAltNotaDraft.set('');
    this.editingAltIndex.set(null);
  }

  addEditAlternativa() {
    const nombre = this.editAltDraft().trim();
    const notaRaw = this.editAltNotaDraft().trim();
    const nota = notaRaw ? notaRaw : null;

    if (!nombre) return;

    const idx = this.editingAltIndex();
    if (idx === null) {
      this.editAlternativas.update((arr) => [...arr, { nombre, nota }]);
    } else {
      this.editAlternativas.update((arr) =>
        arr.map((a, i) => (i === idx ? { ...a, nombre, nota } : a)),
      );
    }

    this.cancelEditAlternativa();
  }

  confirmRemoveEditAlternativa(index: number) {
    const alt = this.editAlternativas()[index];
    const label = String(alt?.nombre ?? '').trim();

    this.deleteAltConfirmIndex.set(index);
    this.deleteAltConfirmLabel.set(label);
    this.deleteAltConfirmOpen.set(true);
  }

  closeDeleteAltConfirm() {
    this.deleteAltConfirmOpen.set(false);
    this.deleteAltConfirmIndex.set(null);
    this.deleteAltConfirmLabel.set('');
  }

  confirmDeleteAlt() {
    const idx = this.deleteAltConfirmIndex();
    if (idx === null) {
      this.closeDeleteAltConfirm();
      return;
    }

    if (idx < 0 || idx >= this.editAlternativas().length) {
      this.closeDeleteAltConfirm();
      return;
    }

    this.removeEditAlternativa(idx);
    this.closeDeleteAltConfirm();
  }

  private removeEditAlternativa(index: number) {
    this.editAlternativas.update((arr) => arr.filter((_, i) => i !== index));
    const current = this.editingAltIndex();
    if (current === index) {
      this.cancelEditAlternativa();
    } else if (current !== null && current > index) {
      this.editingAltIndex.set(current - 1);
    }
  }

  private reorderEditAlternativas(fromIndex: number, toIndex: number) {
    this.editAlternativas.update((arr) => {
      if (fromIndex < 0 || fromIndex >= arr.length) return arr;
      if (toIndex < 0 || toIndex >= arr.length) return arr;
      if (fromIndex === toIndex) return arr;

      const next = arr.slice();
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    const current = this.editingAltIndex();
    if (current === null) return;

    if (current === fromIndex) {
      this.editingAltIndex.set(toIndex);
      return;
    }

    if (fromIndex < toIndex) {
      if (current > fromIndex && current <= toIndex) {
        this.editingAltIndex.set(current - 1);
      }
      return;
    }

    if (toIndex <= current && current < fromIndex) {
      this.editingAltIndex.set(current + 1);
    }
  }

  onAltDragStart(index: number) {
    this.draggingAltIndex.set(index);
  }

  onAltDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    this.dragOverAltIndex.set(index);
  }

  onAltDrop(event: DragEvent, index: number) {
    event.preventDefault();

    const from = this.draggingAltIndex();
    if (from === null) {
      this.onAltDragEnd();
      return;
    }

    this.reorderEditAlternativas(from, index);
    this.onAltDragEnd();
  }

  onAltDragEnd() {
    this.draggingAltIndex.set(null);
    this.dragOverAltIndex.set(null);
  }

  moveAltUp(index: number): void {
    if (index <= 0) return;
    this.reorderEditAlternativas(index, index - 1);
  }

  moveAltDown(index: number): void {
    if (index >= this.editAlternativas().length - 1) return;
    this.reorderEditAlternativas(index, index + 1);
  }

  onEditFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;
    this.editImagenFile.set(file);
  }

  // ✅ NUEVO — Permite deshacer la selección de un archivo nuevo,
  // volviendo a mostrar la imagen actual (si existía) o el estado vacío.
  clearEditImagenFile(): void {
    this.editImagenFile.set(null);
  }

  async updateRegistro() {
    const id = this.editingId();
    const numPiezaOem = this.editNumPiezaOem().trim();
    const descripcion = this.editDescripcion().trim();
    const valueParts = this.editValueParts().trim();
    const reman = this.editReman().trim();
    const dde = this.editDde().trim();
    const mbf = this.editMbf().trim();

    if (!id) {
      this.editError.set('No se encontró el registro a editar.');
      return;
    }
    if (!numPiezaOem) {
      this.editStep.set(1);
      this.editError.set('El número de parte (OEM) es requerido.');
      return;
    }
    if (!descripcion) {
      this.editStep.set(1);
      this.editError.set('La descripción es requerida.');
      return;
    }

    if (this.editBusy()) return;
    this.editBusy.set(true);
    this.editError.set(null);

    try {
      const form = new FormData();
      form.append('numPiezaOem', numPiezaOem);
      form.append('descripcion', descripcion);
      form.append('valueParts', valueParts);
      form.append('reman', reman);
      form.append('dde', dde);
      form.append('mbf', mbf);

      const alts = this.editAlternativas()
        .map((a) => {
          const nombre = String(a?.nombre ?? '').trim();
          const notaRaw = String(a?.nota ?? '').trim();
          return nombre ? { nombre, nota: notaRaw ? notaRaw : null } : null;
        })
        .filter((x) => !!x);
      form.append('alternativas', JSON.stringify(alts));

      const file = this.editImagenFile();
      const url = this.editImagenUrl().trim();
      if (file) {
        form.append('imagen', file, file.name);
      } else if (url) {
        form.append('imagen', url);
      }

      const updated = await firstValueFrom(
        this.http.put<RefaccionModel>(`/api/refacciones/${id}`, form),
      );

      this.refacciones.update((arr) =>
        arr.map((x) => {
          if (x.id !== id) return x;
          const alternativas = (updated as any)?.alternativas ?? x.alternativas;
          return { ...x, ...updated, alternativas };
        }),
      );

      this.closeEditModal();
      this.editSavedModalOpen.set(true);
    } catch (err) {
      console.error('Error al actualizar registro:', err);
      this.editError.set('No se pudieron guardar los cambios. Intenta nuevamente.');
    } finally {
      this.editBusy.set(false);
    }
  }

  toggleOptions() {
    this.showOptions.update((v) => !v);
  }

  closeOptions() {
    this.showOptions.set(false);
  }

  setExportScope(scope: 'page' | 'n' | 'all') {
    this.exportScope.set(scope);
    this.exportError.set(null);
  }

  onExportNInput(value: string) {
    const n = Number(value);
    if (!value || Number.isNaN(n)) {
      this.exportN.set(null);
      return;
    }
    this.exportN.set(Math.floor(n));
  }

  async exportPDF() {
    await this.runExport('pdf', this.getExportParamsForSelection());
  }

  async exportExcel() {
    await this.runExport('excel', this.getExportParamsForSelection());
  }

  private getExportParamsForSelection(): { limit?: number; offset?: number; fetchAll?: boolean } {
    const scope = this.exportScope();
    if (scope === 'all') return { fetchAll: true };
    if (scope === 'n') return { limit: this.exportN() ?? 0, offset: 0 };
    const offset = (this.page() - 1) * this.pageSize;
    return { limit: this.pageSize, offset };
  }

  private validateExportParams(params: { limit?: number; offset?: number; fetchAll?: boolean }): string | null {
    const total = this.exportTotalAvailable();
    if (params.fetchAll) {
      if (total === 0) return 'No hay registros para exportar con los filtros actuales.';
      return null;
    }
    const limit = params.limit ?? 0;
    const offset = params.offset ?? 0;
    if (!Number.isFinite(limit) || limit <= 0) return 'Ingresa un número de registros válido.';
    if (!Number.isFinite(offset) || offset < 0) return 'Offset inválido.';
    if (total === 0) return 'No hay registros para exportar con los filtros actuales.';
    if (offset >= total) return 'Offset fuera de rango para los filtros actuales.';
    return null;
  }

  private getClientRows(params: { limit?: number; offset?: number; fetchAll?: boolean }) {
    const data = this.filtered();
    if (params.fetchAll) return data;
    const offset = Math.max(0, Math.floor(params.offset ?? 0));
    const limit = Math.max(0, Math.floor(params.limit ?? 0));
    return data.slice(offset, offset + limit);
  }

  private downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private async delay(ms: number) {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async exportServerSide(
    format: 'pdf' | 'excel',
    params: { limit?: number; offset?: number; fetchAll?: boolean },
  ) {
    const url = format === 'pdf' ? '/api/refacciones/export/pdf' : '/api/refacciones/export/excel';
    const payload = {
      searchTerm: this.searchTerm().trim(),
      limit: params.limit ?? null,
      offset: params.offset ?? null,
      fetchAll: !!params.fetchAll,
    };

    let lastError: any = null;
    for (let attempt = 0; attempt < this.exportRetryCount; attempt++) {
      try {
        const resp = await firstValueFrom(
          this.http
            .post(url, payload, { responseType: 'blob', observe: 'response' })
            .pipe(timeout(this.exportTimeoutMs)),
        );

        const blob = resp.body as Blob | null;
        if (!blob) throw new Error('Respuesta vacía del servidor.');

        const defaultName =
          format === 'pdf'
            ? `NP_daimler_buses_${Date.now()}.pdf`
            : `NP_daimler_buses_${Date.now()}.xls`;
        const contentDisposition = resp.headers.get('content-disposition') ?? '';
        const match = /filename\*?=(?:UTF-8''|")?([^\";]+)"?/i.exec(contentDisposition);
        const fileName = match?.[1] ? decodeURIComponent(match[1]) : defaultName;

        this.downloadBlob(blob, fileName);
        return;
      } catch (err) {
        lastError = err;
        console.error(`Error exportando ${format} (intento ${attempt + 1}):`, err);
        if (attempt < this.exportRetryCount - 1) await this.delay(this.exportRetryDelayMs);
      }
    }

    throw lastError;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const menu = document.getElementById('dropdown-options');
    const button = document.getElementById('dropdownOptions');
    const target = event.target as Node;
    if (!menu || !button) return;
    if (!menu.contains(target) && !button.contains(target)) this.closeOptions();
  }

  private async runExport(
    format: 'pdf' | 'excel',
    params: { limit?: number; offset?: number; fetchAll?: boolean } = {},
    customFileName?: string,
  ) {
    const normalized =
      params.fetchAll || params.limit !== undefined || params.offset !== undefined
        ? params
        : { limit: this.pageSize, offset: (this.page() - 1) * this.pageSize };

    const validationError = this.validateExportParams(normalized);
    if (validationError) {
      this.exportError.set(validationError);
      return;
    }

    if (this.exportBusy()) return;
    this.exportBusy.set(true);
    this.exportError.set(null);

    const requestedCount = normalized.fetchAll ? this.exportTotalAvailable() : (normalized.limit ?? 0);
    const shouldServerSide = normalized.fetchAll || requestedCount > this.exportClientMaxRows;

    const runClientExport = async (rows: any[], fileName: string) => {
      if (format === 'pdf') {
        await this.downloadPDFClient(rows, { fileName: `${fileName}.pdf` });
      } else {
        await this.downloadExcelClient(rows, fileName);
      }
    };

    if (shouldServerSide) {
      try {
        await this.exportServerSide(format, normalized);
        this.closeOptions();
      } catch (err) {
        console.error(`Fallback a exportación parcial (${format}):`, err);
        this.exportError.set('No se pudo exportar en servidor. Se descargó una versión parcial.');

        const partial = this.getClientRows({
          limit: Math.min(this.exportClientMaxRows, this.exportTotalAvailable()),
          offset: 0,
          fetchAll: false,
        });
        await runClientExport(partial, `NP_daimler_buses_parcial_${Date.now()}`);
        this.closeOptions();
      } finally {
        this.exportBusy.set(false);
      }
      return;
    }

    try {
      const rows = this.getClientRows(normalized);
      const fileName = customFileName || `NP_daimler_buses_${Date.now()}`;
      await runClientExport(rows, fileName);
      this.closeOptions();
    } catch (err) {
      console.error(`Error al generar ${format}:`, err);
      this.exportError.set(`Error al generar el ${format === 'pdf' ? 'PDF' : 'Excel'}.`);
    } finally {
      this.exportBusy.set(false);
    }
  }

  async downloadPDF(params: { limit?: number; offset?: number; fetchAll?: boolean } = {}) {
    await this.runExport('pdf', params);
  }

  async downloadExcel(
    params: { limit?: number; offset?: number; fetchAll?: boolean } = {},
    customFileName?: string,
  ) {
    await this.runExport('excel', params, customFileName);
  }

  private async downloadPDFClient(dataToExport: any[], opts: { fileName: string }) {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();

    const margin = 10;
    const maxLogoWidth = 60;
    const maxLogoHeight = 15;

    const blobToDataUrl = async (blob: Blob) => {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const mime = blob.type || 'image/png';
      return `data:${mime};base64,${base64}`;
    };

    try {
      const response = await fetch('/images.png');
      if (response.ok) {
        const blob = await response.blob();
        const dataUrl = await blobToDataUrl(blob);
        const img = new Image();
        img.src = dataUrl;
        await img.decode();

        const ratio =
          img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1;
        let width = maxLogoWidth;
        let height = ratio ? width / ratio : maxLogoHeight;

        if (height > maxLogoHeight) {
          height = maxLogoHeight;
          width = ratio ? height * ratio : maxLogoWidth;
        } else if (width > maxLogoWidth) {
          width = maxLogoWidth;
          height = ratio ? width / ratio : maxLogoHeight;
        }

        const pageWidth = doc.internal.pageSize.getWidth();
        const x = pageWidth - margin - width;
        const titleCenterY = 17;
        const y = titleCenterY - height / 2;

        doc.addImage(dataUrl, 'PNG', x, y, width, height);
      }
    } catch (err) {
      console.error('Error al cargar el logo del PDF:', err);
    }

    doc.setFontSize(16);
    doc.text('Reporte NP Daimler Buses México', 14, 20);
    doc.setFontSize(10);

    let maxAlternatives = 0;
    for (const r of dataToExport) {
      if (r.alternativas && Array.isArray(r.alternativas)) {
        maxAlternatives = Math.max(maxAlternatives, r.alternativas.length);
      }
    }

    const headerRow = ['ID', 'Numero de Parte'];
    for (let i = 1; i <= maxAlternatives; i++) headerRow.push(`Alternativa ${i}`);
    headerRow.push('Descripción');

    const data = dataToExport.map((r) => {
      const row = [r.id, r.numPiezaOem];
      const alts = r.alternativas && Array.isArray(r.alternativas) ? r.alternativas : [];
      for (let i = 0; i < maxAlternatives; i++) row.push(i < alts.length ? (alts[i].nombre ?? '') : '');
      row.push(r.descripcion);
      return row;
    });

    autoTable(doc, {
      head: [headerRow],
      body: data,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(opts.fileName);
  }

  private async downloadExcelClient(dataToExport: any[], fileName: string) {
    let maxAlternatives = 0;
    for (const r of dataToExport) {
      if (r.alternativas && Array.isArray(r.alternativas)) {
        maxAlternatives = Math.max(maxAlternatives, r.alternativas.length);
      }
    }

    const headers = ['Número de Parte (OEM)'];
    for (let i = 1; i <= maxAlternatives; i++) {
      headers.push(`Alternativa ${i}`);
    }
    headers.push('Value Parts', 'Reman', 'DDE', 'MBF', 'Descripción', 'Imagen');

    const esc = (s: any) => String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const cellHeight = 100;
    const imgSize = Math.floor(cellHeight * 0.5);

    const rowsHtml = dataToExport.map((r) => {
      const img = r?.imagen ? String(r.imagen) : '';
      const absUrl = img ? (img.startsWith('http') ? img : new URL(img, location.origin).href) : '';

      const cells = [esc(r.numPiezaOem ?? '')];

      const alts = (r.alternativas && Array.isArray(r.alternativas)) ? r.alternativas : [];
      for (let i = 0; i < maxAlternatives; i++) {
        cells.push(i < alts.length ? esc(alts[i].nombre ?? '') : '');
      }

      cells.push(
        esc(r.valueParts ?? ''),
        esc(r.reman ?? ''),
        esc(r.dde ?? ''),
        esc(r.mbf ?? ''),
        esc(r.descripcion ?? ''),
      );

      const imgCell = absUrl
        ? `<td align="center" valign="middle" style="height:${cellHeight}px;width:${cellHeight}px;padding:4px;box-sizing:border-box;">
             <table width="100%" height="100%" cellpadding="0" cellspacing="0">
               <tr>
                 <td align="center" valign="middle" style="text-align:center;vertical-align:middle;">
                   <img src="${absUrl}" alt="imagen" height="${imgSize}" style="display:block;margin-top:20px;margin-right:20px;width:auto;max-width:${imgSize}px;max-height:${imgSize}px;" />
                 </td>
               </tr>
             </table>
           </td>`
        : `<td align="center" valign="middle" style="height:${cellHeight}px;width:${cellHeight}px;"></td>`;

      return `<tr height="${cellHeight}" style="height:${cellHeight}px;mso-height-source:userset">
        ${cells.map((c) => `<td valign="middle" style="vertical-align:middle">${c}</td>`).join('')}
        ${imgCell}
      </tr>`;
    }).join('');

    const headerRow = `
      <tr>
        <td colspan="${headers.length}" style="font-size: 20px; font-weight: bold; text-align: center; height: 40px; vertical-align: middle; background-color: #f0f0f0;">
          Reporte NP Daimler Buses México
        </td>
      </tr>
    `;

    const thead = `<thead>${headerRow}<tr>${headers.map((h, i) => i === headers.length - 1 ? `<th align="center" style="background-color:#d9d9d9;text-align:center;width:${cellHeight}px;">${esc(h)}</th>` : `<th align="center" style="background-color:#d9d9d9;text-align:center;">${esc(h)}</th>`).join('')}</tr></thead>`;
    const colgroup = `<colgroup>${headers.map((_, i) => i === headers.length - 1 ? `<col style="width:${cellHeight}px" />` : `<col />`).join('')}</colgroup>`;
    const tbody = `<tbody>${rowsHtml}</tbody>`;

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { text-align: center; }
          thead th, tbody td { text-align: center; vertical-align: middle; }
        </style>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Refacciones</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body>
        <table border="1" style="text-align:center;table-layout:fixed;">
          ${colgroup}
          ${thead}
          ${tbody}
        </table>
      </body>
      </html>`;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    this.downloadBlob(blob, `${fileName}.xls`);
  }
}