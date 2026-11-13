import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

export interface BatchRow {
  numParteOem: string;
  consulta?: string;
  id?: any;
  alternativa?: string;
  notasAlternativa?: string;
  descripcion?: string;
}

export interface BatchResult {
  rows: BatchRow[];
  summary: { total: number; ok: number; failed: number; errors: Array<{ num: string; error: string }> };
}

@Injectable({ providedIn: 'root' })
export class BatchSearchService {
  private http = inject(HttpClient);

  normalizeInput(input: string): string[] {
    return String(input || '')
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => !!s);
  }

  private async fetchOne(num: string, opts?: { signal?: AbortSignal; timeoutMs?: number }): Promise<any | null> {
    const sig = opts?.signal;
    const to = opts?.timeoutMs ?? 30000;
    if (sig?.aborted) throw new Error('Abortado');

    const cand = String(num ?? '').replace(/\u00A0/g, ' ').trim();
    if (!cand) return null;

    if (sig?.aborted) throw new Error('Abortado');

    const q = encodeURIComponent(cand);
    const resp = await firstValueFrom(
      this.http.get<any>(`/api/refacciones?numPiezaOem=${q}`).pipe(timeout(to)),
    );

    const arr = Array.isArray(resp) ? resp : resp ? [resp] : [];

    const exact = arr.find(
      (x: any) => String(x?.numPiezaOem ?? '').trim().toLowerCase() === cand.toLowerCase(),
    );
    if (exact) return exact;

    const altExact = arr.find((x: any) => {
      const alts = Array.isArray(x?.alternativas) ? x.alternativas : [];
      return alts.some((a: any) => String(a?.nombre ?? '').trim().toLowerCase() === cand.toLowerCase());
    });
    if (altExact) return altExact;

    const partial = arr.find((x: any) =>
      String(x?.numPiezaOem ?? '').toLowerCase().includes(cand.toLowerCase()),
    );
    if (partial) return partial;

    if (arr.length) return arr[0];

    return null;
  }

  private toTitleCase(str: string | null): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async batchSearch(
    nums: string[],
    options?: {
      concurrency?: number;
      timeoutMs?: number;
      signal?: AbortSignal;
      retry?: number;
      onProgress?: (processed: number, total: number) => void;
    },
  ): Promise<BatchResult> {
    const total = nums.length;
    const conc = Math.max(1, Math.min(options?.concurrency ?? 5, total || 1));
    const to = options?.timeoutMs ?? 30000;
    const sig = options?.signal;
    const retry = Math.max(0, options?.retry ?? 1);
    const progress = options?.onProgress ?? (() => {});

    const results: Array<{ rows: BatchRow[]; ok: boolean; err?: string }> = new Array(total);
    let index = 0;
    let processed = 0;

    const worker = async () => {
      while (true) {
        const i = index;
        index++;
        if (i >= total) break;
        const num = nums[i];
        let attempt = 0;
        let lastError: any = null;
        while (attempt <= retry) {
          try {
            if (sig?.aborted) throw new Error('Abortado');
            const data = await this.fetchOne(num, { signal: sig, timeoutMs: to });
            const rows: BatchRow[] = [];
            if (data) {
              // console.log('Batch found:', num, data);
              let alts: any[] = [];
              if (Array.isArray(data.alternativas)) {
                alts = data.alternativas;
              } else if (typeof data.alternativas === 'string') {
                try {
                  const parsed = JSON.parse(data.alternativas);
                  alts = Array.isArray(parsed) ? parsed : [];
                } catch {
                  alts = [data.alternativas];
                }
              }

              if (alts.length) {
                const altData = alts.flatMap((alt: any) => {
                  let rawName = '';
                  let rawNote = '';

                  if (typeof alt === 'object' && alt !== null) {
                    rawName = alt.nombre || alt.name || '';
                    rawNote = alt.nota || '';
                  } else {
                    rawName = String(alt);
                  }

                  const splitNames = rawName.split(/[,;]+/).map((s: string) => s.trim()).filter((s: string) => !!s);
                  return splitNames.map((name) => ({ name, note: rawNote }));
                });

                const altNames = altData.map((x) => x.name).join('|||');
                const altNotes = altData.map((x) => x.note).join('|||');

                rows.push({
                  numParteOem: String(data?.numPiezaOem ?? num),
                  consulta: num,
                  id: data.id ?? null,
                  alternativa: altNames,
                  notasAlternativa: altNotes,
                  descripcion: this.toTitleCase(data.descripcion),
                });
              } else {
                rows.push({
                  numParteOem: String(data?.numPiezaOem ?? num),
                  consulta: num,
                  id: data.id ?? null,
                  alternativa: '',
                  descripcion: this.toTitleCase(data.descripcion),
                });
              }
              results[i] = { rows, ok: true };
            } else {
              results[i] = { rows: [{ numParteOem: num, consulta: num, id: null, alternativa: '', descripcion: '' }], ok: false, err: 'Material no válido' };
            }
            break;
          } catch (e: any) {
            lastError = e;
            if (attempt < retry) {
              attempt++;
              continue;
            }
            results[i] = { rows: [{ numParteOem: num, consulta: num, id: null, alternativa: '', descripcion: '' }], ok: false, err: this.getErrorText(e) };
            break;
          }
        }
        if (sig?.aborted) break;
        processed++;
        progress(processed, total);
      }
    };

    const workers = Array.from({ length: conc }, () => worker());
    await Promise.all(workers);

    const rows: BatchRow[] = [];
    let ok = 0;
    const errors: Array<{ num: string; error: string }> = [];
    for (let i = 0; i < total; i++) {
      const r = results[i];
      if (!r) continue;
      rows.push(...r.rows);
      if (r.ok) ok++;
      else errors.push({ num: nums[i], error: r.err ?? 'Material no válido' });
    }
    return { rows, summary: { total, ok, failed: errors.length, errors } };
  }

  private getErrorText(e: any): string {
    if (e?.status === 0) return 'Error de red: No se pudo conectar al servidor';
    const fromApi = e?.error?.message;
    if (typeof fromApi === 'string' && fromApi.trim()) return fromApi.trim();
    const fromMsg = e?.message;
    if (typeof fromMsg === 'string' && /http failure/i.test(fromMsg)) return 'Error de red: No se pudo conectar al servidor';
    if (typeof fromMsg === 'string' && fromMsg.trim()) return fromMsg.trim();
    const fromStatus = e?.statusText;
    if (typeof fromStatus === 'string' && fromStatus.trim()) return fromStatus.trim();
    return 'Material no válido';
  }
}
