import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/services/users.service';
import { JwtService } from '@nestjs/jwt';
import { scrypt as _scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(_scrypt);

/** Salt/hash señuelo fijos, usados solo para igualar tiempos de cómputo
 *  cuando el usuario no existe, evitando fugas de timing (enumeración). */
const DUMMY_SALT = 'AAAAAAAAAAAAAAAAAAAAAA==';

export type AuthRole = 'admin' | 'user';

type LoginUser = {
  idUsuario: number;
  sCorreo: string;
  idRol: number | string | null;
  idArea?: number | null;
};

export type SafeUser = {
  idUsuario: number;
  sCorreo: string;
  idRol: number | string | null;
  idArea?: number | null;
  bActivo: number;
  [key: string]: unknown;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<SafeUser | null> {
    const isDev = process.env.NODE_ENV !== 'production';
    const user = await this.usersService.findOneByEmailWithPassword(email);
    if (isDev) this.logger.debug(`Auth validateUser: encontrado=${!!user}`);

   if (!user || !user.sPassword || Number(user.bActivo) === 0) {
      // Ejecuta un scrypt "señuelo" para que el tiempo de respuesta sea
      // similar al de un intento con usuario válido pero password incorrecta,
      // evitando que la diferencia de tiempo revele si el correo existe o no.
      await scrypt(pass, DUMMY_SALT, 32).catch(() => undefined);
      await this.delayFail();
      return null;
    }

    try {
      const { salt, storedKey } = this.parseStoredPassword(user.sPassword);
      const derivedKey = (await scrypt(pass, salt, 32)) as Buffer;

      const matches = timingSafeEqual(storedKey, derivedKey);

      if (matches) {
        const { sPassword, ...safeUser } = user;
        void sPassword;
        return safeUser as SafeUser;
      }

      await this.delayFail();
      return null;
    } catch (e) {
      if (isDev) this.logger.error('Auth validateUser: error interno', e);
      await scrypt(pass, DUMMY_SALT, 32).catch(() => undefined);
      await this.delayFail();
      return null;
    }
  }

  login(user: LoginUser) {
    const role = this.mapRole(user.idRol);
    const payload = {
      username: user.sCorreo,
      sub: user.idUsuario,
      role,
      area: user.idArea ?? undefined,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.idUsuario,
        email: user.sCorreo,
        role,
        area: user.idArea ?? null,
      },
    };
  }

  async getUserById(id: number) {
    const u = await this.usersService.findOneById(id);

    if (!u || Number(u.bActivo) === 0) return null;

    return {
      ...u,
      role: this.mapRole(u.idRol),
    };
  }

  private async delayFail(): Promise<void> {
    const ms = 100 + Math.floor(Math.random() * 200);
    return new Promise((r) => setTimeout(r, ms));
  }

  private mapRole(idRol: unknown): AuthRole {
    if (idRol === 'admin' || idRol === 'user') return idRol;

    const n = typeof idRol === 'number' ? idRol : Number(idRol);

    // TODO: ajustar a los IDs reales de roles del sistema.
    if (Number.isFinite(n) && n === 1) return 'admin';
    if (Number.isFinite(n) && n === 2) return 'user';

    if (idRol !== null && idRol !== undefined) {
      this.logger.warn(`idRol no reconocido: ${String(idRol)}, se asigna 'user' por defecto`);
    }
    return 'user';
  }

  private parseStoredPassword(stored: string): { salt: string; storedKey: Buffer } {
    const parts = stored.split(':');
    if (parts.length !== 2) {
      throw new Error('Formato de password inválido');
    }
    const salt = parts[0]?.trim();
    const storedKeyBase64 = parts[1]?.trim();
    if (!salt || !storedKeyBase64) {
      throw new Error('Formato de password inválido');
    }
    if (!this.isBase64(storedKeyBase64)) {
      throw new Error('Hash inválido');
    }
    const storedKey = Buffer.from(storedKeyBase64, 'base64');
    if (storedKey.length !== 32) {
      throw new Error('Hash inválido');
    }
    return { salt, storedKey };
  }

  private isBase64(value: string): boolean {
    if (value.length % 4 !== 0) return false;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
  }
}