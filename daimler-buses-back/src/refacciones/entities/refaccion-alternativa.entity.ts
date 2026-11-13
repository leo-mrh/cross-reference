import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Refacciones } from './refacciones.entity';

@Entity({
  name: 'refacciones_alternativas',
  schema: process.env.DB_SCHEMA ?? 'aftersales',
})
export class RefaccionAlternativa {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * La columna real en SQL Server se llama "numPiezaAlt", no "nombre".
   * Se mantiene la propiedad como "nombre" en TypeScript para no romper
   * el frontend (Angular ya usa alt.nombre en varias vistas).
   */
  @Column({ name: 'numPiezaAlt', type: 'varchar', length: 50 })
  nombre!: string;

  @Column({ name: 'Nota', type: 'varchar', length: 200, nullable: true })
  nota!: string | null;

  @ManyToOne(() => Refacciones, (refaccion) => refaccion.alternativas, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'RefaccionId' })
  refaccion!: Refacciones;
}