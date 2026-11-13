import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type JwtRole = 'admin' | 'user';

export interface JwtPayload {
  sub: number;
  username: string;
  role: JwtRole;
  area?: number;
}

export interface AuthenticatedRequestUser {
  userId: number;
  username: string;
  role: JwtRole;
  area?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET es requerido');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedRequestUser {
    if (
      typeof payload?.sub !== 'number' ||
      typeof payload?.username !== 'string'
    ) {
      throw new UnauthorizedException('Token con formato inválido');
    }

    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role === 'admin' ? 'admin' : 'user',
      area: payload.area,
    };
  }
}
