import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { RefaccionesModule } from './refacciones/refacciones.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { EtlModule } from './etl/etl.module';
import { KitsReparacionModule } from './kits-reparacion/kits-reparacion.module';

import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('DB_HOST');
        const port = config.get<string>('DB_PORT');
        const username = config.get<string>('DB_USER');
        const password = config.get<string>('DB_PASS');
        const database = config.get<string>('DB_NAME');
        const schema = config.get<string>('DB_SCHEMA');
        const isProd = config.get<string>('NODE_ENV') === 'production';

        if (!host || !port || !username || !password || !database) {
          throw new Error(
            'Faltan variables de entorno de base de datos (DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME)',
          );
        }

        return {
          type: 'mssql' as const,
          host,
          port: Number(port),
          username,
          password,
          database,
          schema,

          autoLoadEntities: true,
          synchronize: false,
          logging: !isProd,
          logger: 'advanced-console' as const,
          retryAttempts: 5,
          retryDelay: 3000,

          options: {
            encrypt: isProd,
            trustServerCertificate: !isProd,
          },
        };
      },
    }),

    RefaccionesModule,
    UsersModule,
    AuthModule,
    EtlModule,
    KitsReparacionModule,
  ],

  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  onModuleInit() {
    this.logger.log('Conexión a Base de Datos Establecida');
  }
}