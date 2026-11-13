import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { KitReparacionItem } from './kit-reparacion-item.entity';

@Entity({
  name: 'kits_reparacion',
  schema: process.env.DB_SCHEMA ?? 'aftersales',
})
export class KitReparacion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  numeroEnsamble: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  imagen: string | null;

  @OneToMany(() => KitReparacionItem, (i) => i.kit, { cascade: true })
  items: KitReparacionItem[];
}
