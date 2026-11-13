import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RefaccionAlternativa } from './refaccion-alternativa.entity';

@Entity({
  name: 'refacciones',
  schema: process.env.DB_SCHEMA ?? 'aftersales',
})
export class Refacciones {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * Número de pieza OEM (Original Equipment Manufacturer).
   * Identificador único del catálogo del fabricante.
   */
  @Index('idx_refacciones_num_pieza_oem', { unique: true })
  @Column({ type: 'nvarchar', length: 255 })
  numPiezaOem!: string;

  @Column({ type: 'nvarchar', length: 255, nullable: true })
  valueParts!: string | null;

  /** Número de parte remanufacturada (Reman) */
  @Column({ type: 'nvarchar', length: 255, nullable: true })
  reman!: string | null;

  @Column({ type: 'nvarchar', length: 255, nullable: true })
  dde!: string | null;

  @Column({ type: 'nvarchar', length: 255, nullable: true })
  mbf!: string | null;

  @Column({ type: 'nvarchar', length: 1000, nullable: true })
  descripcion!: string | null;

  /** Ruta relativa de la imagen (ej. /uploads/uuid.jpg) */
  @Column({ type: 'nvarchar', length: 255, nullable: true })
  imagen!: string | null;

  @OneToMany(() => RefaccionAlternativa, (alt) => alt.refaccion, {
    cascade: true,
  })
  alternativas!: RefaccionAlternativa[];
}
