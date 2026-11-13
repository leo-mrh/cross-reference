import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Refacciones } from '../refacciones/entities/refacciones.entity';
import { RefaccionAlternativa } from '../refacciones/entities/refaccion-alternativa.entity';
import { EtlController } from './etl.controller';
import { EtlService } from './etl.service';

@Module({
  imports: [TypeOrmModule.forFeature([Refacciones, RefaccionAlternativa])],
  controllers: [EtlController],
  providers: [EtlService],
})
export class EtlModule {}
