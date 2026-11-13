import { Body, Controller, Get, HttpException, HttpStatus, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { KitsReparacionService } from './kits-reparacion.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kits-reparacion')
export class KitsReparacionController {
  constructor(private readonly svc: KitsReparacionService) {}

  @Roles('admin', 'user')
  @Get()
  async search(@Query('q') q?: string) {
    return this.svc.search(q);
  }

  @Roles('admin')
  @Post()
  async create(@Body() body: any) {
    try {
      return await this.svc.createOrReplace(body);
    } catch (e: any) {
      throw new HttpException(e?.message ?? 'No se pudo guardar el kit', HttpStatus.BAD_REQUEST);
    }
  }

  @Roles('admin')
  @Post('upload-imagen')
  @UseInterceptors(FileInterceptor('imagen', { storage: multer.memoryStorage() }))
  async uploadImagen(@UploadedFile() file?: Express.Multer.File) {
    try {
      return await this.svc.uploadImagen(file);
    } catch (e: any) {
      throw new HttpException(e?.message ?? 'No se pudo subir la imagen', HttpStatus.BAD_REQUEST);
    }
  }
}
