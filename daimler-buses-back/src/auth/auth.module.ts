import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import type { StringValue } from 'ms';

const JWT_SECRET_PLACEHOLDER = 'CHANGE_ME__GENERATE_A_LONG_RANDOM_SECRET';
const JWT_SECRET_MIN_LENGTH = 32;

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');

        if (!secret) {
          throw new Error('JWT_SECRET es requerido');
        }
        if (secret === JWT_SECRET_PLACEHOLDER) {
          throw new Error(
            'JWT_SECRET no puede usar el valor de ejemplo del .env.example. ' +
              'Genera un secret único con: openssl rand -base64 48',
          );
        }
        if (secret.length < JWT_SECRET_MIN_LENGTH) {
          throw new Error(
            `JWT_SECRET debe tener al menos ${JWT_SECRET_MIN_LENGTH} caracteres para ser seguro.`,
          );
        }

        const expiresInRaw = config.get<string>('JWT_EXPIRES_IN');
        if (!expiresInRaw) {
          console.warn(
            'JWT_EXPIRES_IN no definido en .env, usando fallback de 60m',
          );
        }
        const expiresIn = (expiresInRaw ?? '60m') as StringValue;

        return {
          secret,
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
