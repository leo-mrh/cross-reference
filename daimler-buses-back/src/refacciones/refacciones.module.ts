import { Module } from '@nestjs/common';
import { RefaccionesController } from './controllers/refacciones.controller';
import { RefaccionesService } from './services/refacciones.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Refacciones } from './entities/refacciones.entity';
import { RefaccionAlternativa } from './entities/refaccion-alternativa.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Refacciones, RefaccionAlternativa])],
  controllers: [RefaccionesController],
  providers: [RefaccionesService],
})
export class RefaccionesModule {}
