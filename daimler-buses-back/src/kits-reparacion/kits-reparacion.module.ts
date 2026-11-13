import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KitsReparacionController } from './kits-reparacion.controller';
import { KitsReparacionService } from './kits-reparacion.service';
import { KitReparacion } from './entities/kit-reparacion.entity';
import { KitReparacionItem } from './entities/kit-reparacion-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([KitReparacion, KitReparacionItem])],
  controllers: [KitsReparacionController],
  providers: [KitsReparacionService],
})
export class KitsReparacionModule {}

