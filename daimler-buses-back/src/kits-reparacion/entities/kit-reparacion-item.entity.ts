import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { KitReparacion } from './kit-reparacion.entity';

@Entity({
  name: 'kits_reparacion_items',
  schema: process.env.DB_SCHEMA ?? 'aftersales',
})
export class KitReparacionItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  numeroParte: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sucesor: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ type: 'int', default: 1 })
  cantidad: number;

  @ManyToOne(() => KitReparacion, (k) => k.items, { onDelete: 'CASCADE' })
  kit: KitReparacion;
}
