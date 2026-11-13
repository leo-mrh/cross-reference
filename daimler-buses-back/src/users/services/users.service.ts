import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Users } from '../entities/user.entity';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { randomBytes, scrypt as _scrypt } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(_scrypt);
const SQL_SERVER_UNIQUE_VIOLATION = 2627;
const ID_ROL_ADMIN = 1;

export type SafeUserEntity = Omit<Users, 'sPassword'>;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(Users) private readonly repo: Repository<Users>,
  ) {}

  onModuleInit(): void {
    const schema = this.repo.metadata.schema ?? 'dbo';
    const table = this.repo.metadata.tableName;
    this.logger.log(`Tabla objetivo: ${schema}.${table}`);
  }

  async create(dto: CreateUserDto): Promise<SafeUserEntity> {
    const salt = randomBytes(16).toString('base64');
    const key = (await scrypt(dto.sPassword, salt, 32)) as Buffer;
    const hashed = `${salt}:${key.toString('base64')}`;

    const entity = this.repo.create({
      sNombre: dto.sNombre,
      sApellidoPaterno: dto.sApellidoPaterno,
      sApellidoMaterno: dto.sApellidoMaterno,
      sUsuario: dto.sUsuario,
      sCorreo: dto.sCorreo,
      sPassword: hashed,
      idRol: dto.idRol ?? null,
      idArea: dto.idArea ?? null,
      bActivo: 1,
    });

    try {
      const saved = await this.repo.save(entity);
      const { sPassword, ...safeUser } = saved;
      void sPassword;
      return safeUser;
    } catch (error) {
      throw this.traducirErrorDeBaseDeDatos(error);
    }
  }

  async findAll(): Promise<SafeUserEntity[]> {
    return this.repo.find({
      select: [
        'idUsuario',
        'idRol',
        'idArea',
        'sNombre',
        'sApellidoPaterno',
        'sApellidoMaterno',
        'sUsuario',
        'sCorreo',
        'bActivo',
      ],
      order: { idUsuario: 'ASC' },
    });
  }

  async findOneByEmail(email: string): Promise<SafeUserEntity | null> {
    return this.repo.findOne({ where: { sCorreo: email } });
  }

  async findOneById(id: number): Promise<SafeUserEntity | null> {
    return this.repo.findOne({ where: { idUsuario: id } });
  }

  async findOneByEmailWithPassword(email: string): Promise<Users | null> {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.sPassword')
      .where('user.sCorreo = :email', { email })
      .getOne();
  }

  async update(id: number, dto: UpdateUserDto): Promise<SafeUserEntity> {
    const usuario = await this.repo.findOne({ where: { idUsuario: id } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    Object.assign(usuario, dto);

    try {
      const saved = await this.repo.save(usuario);
      const { sPassword, ...safeUser } = saved;
      void sPassword;
      return safeUser;
    } catch (error) {
      throw this.traducirErrorDeBaseDeDatos(error);
    }
  }

  async setActivo(
    id: number,
    activo: boolean,
    idUsuarioQueEjecuta: number,
  ): Promise<SafeUserEntity> {
    const usuario = await this.repo.findOne({ where: { idUsuario: id } });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Candado 1: nadie puede desactivarse a sí mismo
    if (!activo && id === idUsuarioQueEjecuta) {
      throw new ForbiddenException('No puedes desactivar tu propia cuenta.');
    }

    // Candado 2: no dejar el sistema sin ningún administrador activo
    if (!activo && usuario.idRol === ID_ROL_ADMIN) {
      const adminsActivos = await this.repo.count({
        where: { idRol: ID_ROL_ADMIN, bActivo: 1 },
      });
      if (adminsActivos <= 1) {
        throw new ForbiddenException(
          'No puedes desactivar al único administrador activo del sistema.',
        );
      }
    }

    usuario.bActivo = activo ? 1 : 0;
    const saved = await this.repo.save(usuario);
    const { sPassword, ...safeUser } = saved;
    void sPassword;
    return safeUser;
  }

  private traducirErrorDeBaseDeDatos(error: unknown): Error {
    const err = error as { number?: number; code?: string | number };
    if (
      err?.number === SQL_SERVER_UNIQUE_VIOLATION ||
      err?.code === SQL_SERVER_UNIQUE_VIOLATION
    ) {
      return new ConflictException('El usuario o correo ya está registrado');
    }
    this.logger.error(
      'Error inesperado en operación de usuarios',
      error as Error,
    );
    return error as Error;
  }
}