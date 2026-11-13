import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { Refacciones } from '../entities/refacciones.entity';
import { RefaccionAlternativa } from '../entities/refaccion-alternativa.entity';
import { CreateRefaccionDto, UpdateRefaccionDto } from '../dto';

const SQL_SERVER_UNIQUE_VIOLATION = 2627;

@Injectable()
export class RefaccionesService {
  private readonly logger = new Logger(RefaccionesService.name);

  constructor(
    @InjectRepository(Refacciones)
    private refaccionesRepository: Repository<Refacciones>,
    @InjectRepository(RefaccionAlternativa)
    private alternativasRepository: Repository<RefaccionAlternativa>,
  ) {}

  // ============ LECTURA ============

  async getAllRefacciones(numPiezaOem?: string): Promise<Refacciones[]> {
    const raw = String(numPiezaOem ?? '')
      .replace(/\u00A0/g, ' ')
      .trim();

    if (!raw) {
      return this.refaccionesRepository.find({ relations: ['alternativas'] });
    }

    const compact = raw.replace(/\s+/g, '').toUpperCase();

    const compactR =
      "UPPER(REPLACE(REPLACE(r.numPiezaOem, ' ', ''), CHAR(160), ''))";
    const compactA =
      "UPPER(REPLACE(REPLACE(a.nombre, ' ', ''), CHAR(160), ''))";
    const compactAltTokens =
      "UPPER(REPLACE(REPLACE(REPLACE(REPLACE(a.nombre, ' ', ''), CHAR(160), ''), ';', ','), '|', ','))";
    const compactVP =
      "UPPER(REPLACE(REPLACE(r.valueParts, ' ', ''), CHAR(160), ''))";
    const compactRem =
      "UPPER(REPLACE(REPLACE(r.reman, ' ', ''), CHAR(160), ''))";
    const compactDde = "UPPER(REPLACE(REPLACE(r.dde, ' ', ''), CHAR(160), ''))";
    const compactMbf = "UPPER(REPLACE(REPLACE(r.mbf, ' ', ''), CHAR(160), ''))";

    const loadByIds = async (ids: number[]) => {
      const entities = await this.refaccionesRepository.find({
        where: { id: In(ids) },
        relations: ['alternativas'],
      });
      const orderMap = new Map<number, number>(ids.map((id, idx) => [id, idx]));
      return entities.sort(
        (a, b) =>
          (orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    };

    const oemRows = await this.refaccionesRepository
      .createQueryBuilder('r')
      .select('r.id', 'id')
      .where(`${compactR} = :compact`, { compact })
      .orderBy('r.id', 'ASC')
      .getRawMany<{ id: string }>();

    const oemIds = oemRows
      .map((x) => Number(x.id))
      .filter((x) => Number.isFinite(x));
    if (oemIds.length) {
      return loadByIds(oemIds);
    }

    const altExactExpr = `(
      ${compactA} = :compact
      OR (',' + ${compactAltTokens} + ',') LIKE ('%,' + :compact + ',%')
    )`;

    const altRows = await this.refaccionesRepository
      .createQueryBuilder('r')
      .innerJoin('r.alternativas', 'a')
      .select('r.id', 'id')
      .where(altExactExpr, { compact })
      .groupBy('r.id')
      .orderBy('r.id', 'ASC')
      .getRawMany<{ id: string }>();

    const altIds = altRows
      .map((x) => Number(x.id))
      .filter((x) => Number.isFinite(x));
    if (altIds.length) {
      return loadByIds(altIds);
    }

    const q = `%${raw}%`;
    const qCompact = compact ? `%${compact}%` : q;

    const fallbackRows = await this.refaccionesRepository
      .createQueryBuilder('r')
      .leftJoin('r.alternativas', 'a')
      .select('r.id', 'id')
      .where(
        new Brackets((qb) => {
          qb.where('r.numPiezaOem LIKE :q', { q })
            .orWhere('r.valueParts LIKE :q', { q })
            .orWhere('r.reman LIKE :q', { q })
            .orWhere('r.dde LIKE :q', { q })
            .orWhere('r.mbf LIKE :q', { q })
            .orWhere('a.nombre LIKE :q', { q })
            .orWhere(`${compactR} LIKE :qCompact`, { qCompact })
            .orWhere(`${compactVP} LIKE :qCompact`, { qCompact })
            .orWhere(`${compactRem} LIKE :qCompact`, { qCompact })
            .orWhere(`${compactDde} LIKE :qCompact`, { qCompact })
            .orWhere(`${compactMbf} LIKE :qCompact`, { qCompact })
            .orWhere(`${compactAltTokens} LIKE :qCompact`, { qCompact })
            .orWhere(`${compactA} LIKE :qCompact`, { qCompact });
        }),
      )
      .groupBy('r.id')
      .orderBy('r.id', 'ASC')
      .getRawMany<{ id: string }>();

    const fallbackIds = fallbackRows
      .map((x) => Number(x.id))
      .filter((x) => Number.isFinite(x));
    if (!fallbackIds.length) return [];

    return loadByIds(fallbackIds);
  }

  async getStats() {
    const [total, valueParts, reman] = await Promise.all([
      this.refaccionesRepository.count(),
      this.refaccionesRepository
        .createQueryBuilder('r')
        .where("r.valueParts IS NOT NULL AND r.valueParts <> ''")
        .getCount(),
      this.refaccionesRepository
        .createQueryBuilder('r')
        .where("r.reman IS NOT NULL AND r.reman <> ''")
        .getCount(),
    ]);
    return { total, valueParts, reman };
  }

  // ============ ESCRITURA ============

  async createRefaccionWithFile(
    body: CreateRefaccionDto,
    file?: Express.Multer.File,
  ): Promise<Refacciones> {
    const imagen = file
      ? await this.guardarImagen(file)
      : (body.imagen ?? null);

    const entity = this.refaccionesRepository.create({
      numPiezaOem: body.numPiezaOem,
      valueParts: body.valueParts ?? null,
      reman: body.reman ?? null,
      dde: body.dde ?? null,
      mbf: body.mbf ?? null,
      descripcion: this.toTitleCase(body.descripcion ?? null),
      imagen,
    });

    entity.alternativas = this.mapearAlternativas(body.alternativas);

    try {
      return await this.refaccionesRepository.save(entity);
    } catch (error) {
      // Si falló el guardado en BD, no dejamos un archivo huérfano en disco
      if (file) await this.eliminarImagenSiExiste(imagen);
      throw this.traducirErrorDeBaseDeDatos(error);
    }
  }

  async updateRefaccionWithFile(
    id: number,
    body: UpdateRefaccionDto,
    file?: Express.Multer.File,
  ): Promise<Refacciones> {
    const entity = await this.refaccionesRepository.findOne({
      where: { id },
      relations: ['alternativas'],
    });

    if (!entity) {
      throw new NotFoundException('Refacción no encontrada');
    }

    if (body.numPiezaOem !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      entity.numPiezaOem = body.numPiezaOem;
    }
    if (body.descripcion !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      entity.descripcion = this.toTitleCase(body.descripcion ?? null);
    }
    if (body.valueParts !== undefined) {
      entity.valueParts = this.normalizarOpcional(body.valueParts);
    }
    if (body.reman !== undefined) {
      entity.reman = this.normalizarOpcional(body.reman);
    }
    if (body.dde !== undefined) {
      entity.dde = this.normalizarOpcional(body.dde);
    }
    if (body.mbf !== undefined) {
      entity.mbf = this.normalizarOpcional(body.mbf);
    }

    const imagenAnterior = entity.imagen;
    let imagenNueva: string | null | undefined;

    if (file) {
      imagenNueva = await this.guardarImagen(file);
    } else if (body.imagen !== undefined) {
      imagenNueva = this.normalizarOpcional(body.imagen);
    }

    if (imagenNueva !== undefined) {
      entity.imagen = imagenNueva;
    }

    // Reemplaza por completo las alternativas si vienen en el body
    if (body.alternativas !== undefined) {
      await this.alternativasRepository
        .createQueryBuilder()
        .delete()
        .where('refaccionId = :id', { id })
        .execute();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      entity.alternativas = this.mapearAlternativas(body.alternativas);
    }

    try {
      await this.refaccionesRepository.save(entity);
    } catch (error) {
      if (file && imagenNueva) await this.eliminarImagenSiExiste(imagenNueva);
      throw this.traducirErrorDeBaseDeDatos(error);
    }

    // Borra la imagen anterior solo después de confirmar que todo se guardó bien
    if (file && imagenAnterior && imagenAnterior !== imagenNueva) {
      await this.eliminarImagenSiExiste(imagenAnterior);
    }

    const refreshed = await this.refaccionesRepository.findOne({
      where: { id },
      relations: ['alternativas'],
    });

    return refreshed ?? entity;
  }

  async deleteRefaccion(id: number): Promise<{ deleted: true }> {
    const entity = await this.refaccionesRepository.findOne({ where: { id } });

    if (!entity) {
      throw new NotFoundException('Refacción no encontrada');
    }

    await this.refaccionesRepository.remove(entity);

    if (entity.imagen) {
      await this.eliminarImagenSiExiste(entity.imagen);
    }

    return { deleted: true };
  }

  // ============ HELPERS PRIVADOS ============

  private toTitleCase(str: string | null | undefined): string | null {
    if (!str) return null;
    return str
      .toLowerCase()
      .split(' ')
      .map((word) =>
        word ? word.charAt(0).toUpperCase() + word.slice(1) : word,
      )
      .join(' ');
  }

  private normalizarOpcional(valor: unknown): string | null {
    if (valor === null || valor === undefined) return null;
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const texto = String(valor).trim();
    return texto ? texto : null;
  }

  private mapearAlternativas(
    alternativas: CreateRefaccionDto['alternativas'],
  ): RefaccionAlternativa[] {
    if (!alternativas || !Array.isArray(alternativas)) return [];

    return alternativas
      .map((item) => {
        const nombre = this.normalizarOpcional(item?.nombre);
        if (!nombre) return null;

        const alt = new RefaccionAlternativa();
        alt.nombre = nombre;
        alt.nota = this.normalizarOpcional(item?.nota);
        return alt;
      })
      .filter((alt): alt is RefaccionAlternativa => alt !== null);
  }

  /**
   * Verifica los "magic bytes" reales del archivo (no confía en mimetype
   * ni en la extensión, ambos falsificables por el cliente).
   */
  private detectarTipoImagenReal(buffer: Buffer): string | null {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return 'image/jpeg';
    }
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }
    if (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }
    return null;
  }

  private async guardarImagen(file: Express.Multer.File): Promise<string> {
    const tipoReal = this.detectarTipoImagenReal(file.buffer);

    if (!tipoReal) {
      throw new BadRequestException(
        'El archivo no es una imagen válida (JPG, PNG o WEBP)',
      );
    }

    const extensionesPorTipo: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };

    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    if (!existsSync(uploadsDir)) {
      await fs.mkdir(uploadsDir, { recursive: true });
    }

    // Nombre 100% generado por el servidor: elimina cualquier riesgo
    // de path traversal o nombres maliciosos del archivo original.
    const nombreUnico = `${randomUUID()}${extensionesPorTipo[tipoReal]}`;
    const destino = path.join(uploadsDir, nombreUnico);
    await fs.writeFile(destino, file.buffer);

    return `/uploads/${nombreUnico}`;
  }

  private async eliminarImagenSiExiste(
    rutaRelativa: string | null,
  ): Promise<void> {
    if (!rutaRelativa) return;

    const rutaAbsoluta = path.join(process.cwd(), rutaRelativa);
    if (existsSync(rutaAbsoluta)) {
      try {
        await fs.unlink(rutaAbsoluta);
      } catch (error) {
        this.logger.warn(
          `No se pudo eliminar la imagen: ${rutaAbsoluta}`,
          error as Error,
        );
      }
    }
  }

  private traducirErrorDeBaseDeDatos(error: unknown): Error {
    const err = error as { number?: number; code?: string | number };
    if (
      err?.number === SQL_SERVER_UNIQUE_VIOLATION ||
      err?.code === SQL_SERVER_UNIQUE_VIOLATION
    ) {
      return new ConflictException('Ya existe una refacción con ese número de pieza OEM');
    }
    this.logger.error('Error inesperado en operación de refacciones', error as Error);
    return error as Error;
  }
}