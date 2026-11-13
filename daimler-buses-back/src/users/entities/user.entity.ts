import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({
  name: process.env.DB_USERS_TABLE ?? 'users',
  schema: process.env.DB_SCHEMA ?? 'aftersales',
})
export class Users {
  @PrimaryGeneratedColumn()
  idUsuario!: number;

  @Column({ type: 'int', nullable: true })
  idRol!: number | null;

  @Column({ type: 'int', nullable: true })
  idArea!: number | null;

  @Column({ type: 'nvarchar', length: 250 })
  sNombre!: string;

  @Column({ type: 'nvarchar', length: 250 })
  sApellidoPaterno!: string;

  @Column({ type: 'nvarchar', length: 250 })
  sApellidoMaterno!: string;

  @Column({ type: 'varchar', length: 250, unique: true })
  sUsuario!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  sCorreo!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  sPassword!: string;

  @Column({ type: 'tinyint', nullable: true, default: 1 })
  bActivo!: number;
}
