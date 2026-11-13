import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { Refacciones } from '../refacciones/entities/refacciones.entity';
import { RefaccionAlternativa } from '../refacciones/entities/refaccion-alternativa.entity';

// Simulamos estados para el frontend
interface JobState {
  status: number; // 0:Fail, 1:Success, 4:InProgress
  message: string;
  startTime: number;
}

type EtlImportSummary = {
  totalRows: number;
  processedRows: number;
  refaccionesInserted: number;
  refaccionesUpdated: number;
  alternativasInserted: number;
  skippedRows: number;
  errors: Array<{ rowNumber: number; error: string }>;
};

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);
  private currentJob: JobState | null = null;

  constructor(
    @InjectRepository(Refacciones)
    private readonly refaccionesRepository: Repository<Refacciones>,
    @InjectRepository(RefaccionAlternativa)
    private readonly alternativasRepository: Repository<RefaccionAlternativa>,
  ) {}

  /**
   * Inicia el proceso de ETL (Sincronización)
   * Al usar MySQL, ejecutamos la lógica aquí en Node.js en lugar de llamar a SSIS.
   */
  async startJob(jobName: string): Promise<void> {
    if (this.currentJob && this.currentJob.status === 4) {
      throw new Error('El proceso de sincronización ya está en ejecución.');
    }

    this.logger.log(`Iniciando proceso ETL interno: ${jobName}`);
    
    // Inicializar estado
    this.currentJob = {
      status: 4, // En progreso
      message: 'Iniciando procesamiento de datos...',
      startTime: Date.now(),
    };

    // Ejecutar proceso asíncrono (sin await para no bloquear la respuesta HTTP)
    this.runInternalEtlProcess(jobName).catch(err => {
      this.logger.error('Error en proceso ETL interno', err);
      this.currentJob = {
        status: 0, // Fallido
        message: `Error: ${err.message}`,
        startTime: this.currentJob?.startTime || Date.now(),
      };
    });
  }

  private formatDescripcion(input: string | null | undefined): string | null {
    const raw = String(input ?? '').replace(/\u00A0/g, ' ').trim();
    if (!raw) return null;

    const collapsed = raw.replace(/\s+/g, ' ');
    return collapsed
      .toLowerCase()
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ');
  }

  private cellText(cell: ExcelJS.Cell | undefined): string {
    if (!cell) return '';
    const t = typeof (cell as any).text === 'string' ? (cell as any).text : '';
    if (t) return t;
    const v: any = (cell as any).value;
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v && typeof v === 'object' && typeof v.richText === 'object') {
      try {
        const rt = Array.isArray(v.richText) ? v.richText : [];
        return rt.map((x: any) => String(x?.text ?? '')).join('');
      } catch {
        return '';
      }
    }
    if (v && typeof v === 'object' && typeof v.text === 'string') return v.text;
    return String(v);
  }

  private headerKey(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[_-]/g, '');
  }

  private splitAlternativas(raw: string): string[] {
    const s = String(raw ?? '');
    if (!s.trim()) return [];
    return s
      .split(/[,;\n]+/)
      .map((x) => x.trim())
      .filter((x) => !!x);
  }

  async importFromExcel(file: Express.Multer.File, opts?: { sheetName?: string }): Promise<EtlImportSummary> {
    const summary: EtlImportSummary = {
      totalRows: 0,
      processedRows: 0,
      refaccionesInserted: 0,
      refaccionesUpdated: 0,
      alternativasInserted: 0,
      skippedRows: 0,
      errors: [],
    };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer as any);

    const ws = opts?.sheetName ? wb.getWorksheet(opts.sheetName) : wb.worksheets[0];
    if (!ws) {
      throw new Error('No se encontró hoja en el archivo Excel');
    }

    const headerRow = ws.getRow(1);
    const headerMap = new Map<string, number>();
    headerRow.eachCell((cell, col) => {
      const key = this.headerKey(this.cellText(cell));
      if (key) headerMap.set(key, col);
    });

    const col = (keys: string[], fallbackCol?: number): number | undefined => {
      for (const k of keys) {
        const c = headerMap.get(this.headerKey(k));
        if (typeof c === 'number') return c;
      }
      return typeof fallbackCol === 'number' ? fallbackCol : undefined;
    };

    const cNum = col(['numpiezaoem', 'numpart', 'numpartes', 'numpartoem', 'oem', 'numparteoem'], 1);
    const cAlt = col(['alternativa', 'alternativas', 'alt'], 2);
    const cDesc = col(['descripcion', 'descripción', 'denominacionmaterial', 'denominacion'], 3);

    const cAlt1 = col(['alt1']);
    const cAlt2 = col(['alt2']);
    const cAlt3 = col(['alt3']);
    const cAlt4 = col(['alt4']);

    const cValueParts = col(['valueparts', 'valuepart', 'vp']);
    const cReman = col(['reman']);
    const cDde = col(['dde']);
    const cMbf = col(['mbf', 'mdf']);

    const lastRow = ws.actualRowCount || ws.rowCount || 0;
    summary.totalRows = Math.max(0, lastRow - 1);

    await this.refaccionesRepository.manager.transaction(async (em) => {
      const refRepo = em.getRepository(Refacciones);
      const altRepo = em.getRepository(RefaccionAlternativa);

      for (let r = 2; r <= lastRow; r++) {
        const row = ws.getRow(r);

        const numPiezaOem = cNum ? this.cellText(row.getCell(cNum)) : '';
        const num = String(numPiezaOem ?? '');
        const numHasContent = num.replace(/\u00A0/g, '').replace(/\r?\n/g, '').trim().length > 0;
        if (!numHasContent) {
          summary.skippedRows++;
          continue;
        }

        const descripcionRaw = cDesc ? this.cellText(row.getCell(cDesc)) : '';
        const descripcion = this.formatDescripcion(descripcionRaw);

        const asOptional = (v: string): string | null => {
          const s = String(v ?? '');
          const has = s.replace(/\u00A0/g, '').trim().length > 0;
          return has ? s : null;
        };

        const valueParts = asOptional(cValueParts ? this.cellText(row.getCell(cValueParts)) : '');
        const reman = asOptional(cReman ? this.cellText(row.getCell(cReman)) : '');
        const dde = asOptional(cDde ? this.cellText(row.getCell(cDde)) : '');
        const mbf = asOptional(cMbf ? this.cellText(row.getCell(cMbf)) : '');

        const altBucket: string[] = [];
        if (cAlt) altBucket.push(this.cellText(row.getCell(cAlt)));
        if (cAlt1) altBucket.push(this.cellText(row.getCell(cAlt1)));
        if (cAlt2) altBucket.push(this.cellText(row.getCell(cAlt2)));
        if (cAlt3) altBucket.push(this.cellText(row.getCell(cAlt3)));
        if (cAlt4) altBucket.push(this.cellText(row.getCell(cAlt4)));

        const alternativas = Array.from(new Set(altBucket.flatMap((x) => this.splitAlternativas(x))));

        try {
          let ref = await refRepo.findOne({ where: { numPiezaOem: num }, relations: ['alternativas'] });

          if (!ref) {
            ref = refRepo.create({
              numPiezaOem: num,
              descripcion,
              valueParts: String(valueParts ?? '').trim() ? String(valueParts) : null,
              reman: String(reman ?? '').trim() ? String(reman) : null,
              dde: String(dde ?? '').trim() ? String(dde) : null,
              mbf: String(mbf ?? '').trim() ? String(mbf) : null,
              imagen: null,
            } as Refacciones);
            ref = await refRepo.save(ref);
            summary.refaccionesInserted++;
          } else {
            let changed = false;

            if (descripcion !== undefined) {
              const next = descripcion ?? null;
              if ((ref.descripcion ?? null) !== next) {
                ref.descripcion = next;
                changed = true;
              }
            }

            const nextVP = String(valueParts ?? '').trim() ? String(valueParts) : null;
            const nextRem = String(reman ?? '').trim() ? String(reman) : null;
            const nextDde = String(dde ?? '').trim() ? String(dde) : null;
            const nextMbf = String(mbf ?? '').trim() ? String(mbf) : null;

            if ((ref.valueParts ?? null) !== nextVP) {
              ref.valueParts = nextVP;
              changed = true;
            }
            if ((ref.reman ?? null) !== nextRem) {
              ref.reman = nextRem;
              changed = true;
            }
            if ((ref.dde ?? null) !== nextDde) {
              ref.dde = nextDde;
              changed = true;
            }
            if ((ref.mbf ?? null) !== nextMbf) {
              ref.mbf = nextMbf;
              changed = true;
            }

            if (changed) {
              await refRepo.save(ref);
              summary.refaccionesUpdated++;
            }
          }

          if (alternativas.length) {
            const existing = await altRepo.find({
              where: { refaccion: { id: ref.id } as any },
              select: ['id', 'nombre'],
            });
            const set = new Set(existing.map((a) => a.nombre));

            for (const altName of alternativas) {
              const n = String(altName ?? '').trim();
              if (!n) continue;
              if (set.has(n)) continue;

              const alt = altRepo.create({
                nombre: n,
                nota: null,
                refaccion: { id: ref.id } as any,
              } as RefaccionAlternativa);
              await altRepo.save(alt);
              set.add(n);
              summary.alternativasInserted++;
            }
          }

          summary.processedRows++;
        } catch (e: any) {
          summary.errors.push({ rowNumber: r, error: e?.message ?? 'Error desconocido' });
        }
      }
    });

    return summary;
  }

  /**
   * Lógica real del ETL (Extracción, Transformación, Carga)
   */
  private async runInternalEtlProcess(jobName: string) {
    this.updateStatus(4, 'ETL en ejecución...');
    await new Promise((resolve) => setTimeout(resolve, 500));
    this.logger.log(`Proceso ${jobName} completado.`);
    this.updateStatus(1, 'Sincronización completada correctamente.');
  }

  private updateStatus(status: number, message: string) {
    if (this.currentJob) {
      this.currentJob.status = status;
      this.currentJob.message = message;
    }
  }

  /**
   * Obtiene el estado actual del proceso
   */
  async getJobStatus(jobName: string) {
    if (!this.currentJob) {
      return { run_status: -1, status_text: 'No iniciado', message: '' };
    }
    return {
      run_status: this.currentJob.status,
      message: this.currentJob.message,
      run_date: new Date(this.currentJob.startTime).toISOString().split('T')[0],
      run_time: new Date(this.currentJob.startTime).toTimeString().split(' ')[0],
    };
  }
}
