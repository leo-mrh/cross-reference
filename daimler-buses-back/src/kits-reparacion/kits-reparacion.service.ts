import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Brackets, EntityManager, In, Repository } from 'typeorm';
import { KitReparacion } from './entities/kit-reparacion.entity';
import { KitReparacionItem } from './entities/kit-reparacion-item.entity';

type KitItemPayload = {
  numeroParte: string;
  sucesor?: string | null;
  descripcion?: string | null;
  cantidad?: number;
};

type KitPayload = {
  descripcion?: string | null;
  numeroEnsamble: string;
  imagen?: string | null;
  items: KitItemPayload[];
};

@Injectable()
export class KitsReparacionService {
  constructor(
    @InjectRepository(KitReparacion)
    private readonly kitRepo: Repository<KitReparacion>,
    @InjectRepository(KitReparacionItem)
    private readonly itemRepo: Repository<KitReparacionItem>,
  ) {}

  private kitImagenColumnSupported: boolean | null = null;

  private asOptional(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v);
    const has = s.replace(/\u00A0/g, '').trim().length > 0;
    return has ? s : null;
  }

  private normalizeSchema(): string {
    const raw = String(process.env.DB_SCHEMA ?? 'aftersales').trim();
    return /^[A-Za-z0-9_]+$/.test(raw) ? raw : 'aftersales';
  }

  private qn(id: string): string {
    return `[${String(id).replace(/]/g, ']]')}]`;
  }

  private async ensureTablesExist(em: EntityManager, schema: string): Promise<void> {
    const objKit = `${schema}.kits_reparacion`;
    const objItems = `${schema}.kits_reparacion_items`;

    const kitRows = await em.query(`SELECT OBJECT_ID(@0, 'U') AS id`, [objKit]);
    const kitId = Array.isArray(kitRows) && kitRows.length ? kitRows[0]?.id : null;
    if (!kitId) throw new Error(`No existe la tabla ${objKit}.`);

    const itemRows = await em.query(`SELECT OBJECT_ID(@0, 'U') AS id`, [objItems]);
    const itemId = Array.isArray(itemRows) && itemRows.length ? itemRows[0]?.id : null;
    if (!itemId) throw new Error(`No existe la tabla ${objItems}.`);
  }

  private async supportsKitImagenColumn(em: EntityManager, schema: string): Promise<boolean> {
    if (this.kitImagenColumnSupported !== null) return this.kitImagenColumnSupported;

    const objName = `${schema}.kits_reparacion`;
    const rows = await em.query(`SELECT COL_LENGTH(@0, @1) AS len`, [objName, 'imagen']);
    const len = Array.isArray(rows) && rows.length ? Number(rows[0]?.len) : NaN;
    this.kitImagenColumnSupported = Number.isFinite(len) && len > 0;
    return this.kitImagenColumnSupported;
  }

  async uploadImagen(file?: Express.Multer.File) {
    if (!file || !file.buffer || !file.originalname) {
      throw new Error('Archivo requerido');
    }

    const mimetype = String((file as any).mimetype ?? '');
    if (!mimetype.startsWith('image/')) {
      throw new Error('El archivo debe ser una imagen');
    }

    const size = Number((file as any).size ?? 0);
    if (Number.isFinite(size) && size > 8 * 1024 * 1024) {
      throw new Error('El archivo excede el tamaño permitido');
    }

    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const safeName = `${Date.now()}_${String(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '')}`;
    const dest = path.join(uploadsDir, safeName);
    fs.writeFileSync(dest, file.buffer);

    return { imagen: `/uploads/${safeName}` };
  }

  async createOrReplace(payload: KitPayload) {
    const numeroEnsamble = this.asOptional(payload?.numeroEnsamble);
    if (!numeroEnsamble) {
      throw new Error('numeroEnsamble es requerido');
    }

    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const cleanedItems = rawItems
      .map((it) => {
        const numeroParte = this.asOptional(it?.numeroParte);
        if (!numeroParte) return null;

        const cantidadRaw = Number((it as any)?.cantidad ?? 1);
        const cantidad =
          Number.isFinite(cantidadRaw) && cantidadRaw > 0 ? Math.floor(cantidadRaw) : 1;

        return {
          numeroParte,
          sucesor: this.asOptional(it?.sucesor),
          descripcion: this.asOptional(it?.descripcion),
          cantidad,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    if (!cleanedItems.length) {
      throw new Error('items es requerido y debe contener al menos un renglón válido');
    }

    const descripcion = this.asOptional(payload?.descripcion);
    const imagen = this.asOptional((payload as any)?.imagen);

    const schema = this.normalizeSchema();
    await this.ensureTablesExist(this.kitRepo.manager, schema);

    const supportsKitImagen = await this.supportsKitImagenColumn(this.kitRepo.manager, schema);

    return this.kitRepo.manager.transaction(async (em) => {
      const kitTable = `${this.qn(schema)}.${this.qn('kits_reparacion')}`;
      const itemTable = `${this.qn(schema)}.${this.qn('kits_reparacion_items')}`;

      const kitRows = await em.query(
        `SELECT TOP 1 ${this.qn('id')} AS id FROM ${kitTable} WHERE ${this.qn('numeroEnsamble')} = @0`,
        [numeroEnsamble],
      );
      let kitId = Array.isArray(kitRows) && kitRows.length ? Number(kitRows[0]?.id) : NaN;

      if (!Number.isFinite(kitId)) {
        const insertCols = [this.qn('numeroEnsamble'), this.qn('descripcion')];
        const insertVals = ['@0', '@1'];
        const params: any[] = [numeroEnsamble, descripcion ?? null];

        if (supportsKitImagen) {
          insertCols.push(this.qn('imagen'));
          insertVals.push(`@${params.length}`);
          params.push(imagen ?? null);
        }

        const inserted = await em.query(
          `INSERT INTO ${kitTable} (${insertCols.join(', ')}) OUTPUT INSERTED.${this.qn('id')} AS id VALUES (${insertVals.join(', ')})`,
          params,
        );
        kitId = Array.isArray(inserted) && inserted.length ? Number(inserted[0]?.id) : NaN;
        if (!Number.isFinite(kitId)) throw new Error('No se pudo insertar el encabezado del kit');
      } else {
        if (supportsKitImagen) {
          await em.query(
            `UPDATE ${kitTable} SET ${this.qn('descripcion')} = @0, ${this.qn('imagen')} = @1 WHERE ${this.qn('id')} = @2`,
            [descripcion ?? null, imagen ?? null, kitId],
          );
        } else {
          await em.query(
            `UPDATE ${kitTable} SET ${this.qn('descripcion')} = @0 WHERE ${this.qn('id')} = @1`,
            [descripcion ?? null, kitId],
          );
        }
      }

      await em.query(`DELETE FROM ${itemTable} WHERE ${this.qn('kitId')} = @0`, [kitId]);

      const cols = [
        this.qn('numeroParte'),
        this.qn('sucesor'),
        this.qn('descripcion'),
        this.qn('cantidad'),
        this.qn('kitId'),
      ];

      const params: any[] = [];
      const rowsSql: string[] = [];

      for (const it of cleanedItems) {
        const base = [it.numeroParte, it.sucesor ?? null, it.descripcion ?? null, it.cantidad];
        const row: any[] = [...base, kitId];

        const placeholders = row.map((_, i) => `@${params.length + i}`);
        rowsSql.push(`(${placeholders.join(', ')})`);
        params.push(...row);
      }

      await em.query(`INSERT INTO ${itemTable} (${cols.join(', ')}) VALUES ${rowsSql.join(', ')}`, params);

      return { id: kitId };
    });
  }

  async search(q?: string): Promise<KitReparacion[]> {
    const raw = String(q ?? '').replace(/\u00A0/g, ' ').trim();
    if (!raw) return [];

    const compact = raw.replace(/\s+/g, '').toUpperCase();
    const like = `%${raw}%`;
    const likeCompact = `%${compact}%`;

    const compactKit = "UPPER(REPLACE(REPLACE(k.numeroEnsamble, ' ', ''), CHAR(160), ''))";
    const compactParte = "UPPER(REPLACE(REPLACE(i.numeroParte, ' ', ''), CHAR(160), ''))";
    const compactSuc = "UPPER(REPLACE(REPLACE(i.sucesor, ' ', ''), CHAR(160), ''))";

    const idRows = await this.kitRepo
      .createQueryBuilder('k')
      .leftJoin('k.items', 'i')
      .select('k.id', 'id')
      .where(
        new Brackets((qb) => {
          qb.where('k.numeroEnsamble LIKE :like', { like })
            .orWhere('k.descripcion LIKE :like', { like })
            .orWhere('i.numeroParte LIKE :like', { like })
            .orWhere('i.sucesor LIKE :like', { like })
            .orWhere('i.descripcion LIKE :like', { like })
            .orWhere(`${compactKit} LIKE :likeCompact`, { likeCompact })
            .orWhere(`${compactParte} LIKE :likeCompact`, { likeCompact })
            .orWhere(`${compactSuc} LIKE :likeCompact`, { likeCompact });
        }),
      )
      .groupBy('k.id')
      .orderBy('k.id', 'ASC')
      .getRawMany<{ id: string }>();

    const ids = idRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n));
    if (!ids.length) return [];

    const kits = await this.kitRepo.find({ where: { id: In(ids) }, relations: ['items'] });

    const order = new Map<number, number>(ids.map((id, idx) => [id, idx]));
    kits.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
    for (const k of kits) {
      if (Array.isArray(k.items)) k.items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
    }
    return kits;
  }
}
