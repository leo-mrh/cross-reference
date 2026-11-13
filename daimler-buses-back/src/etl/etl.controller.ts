import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { EtlService } from './etl.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('etl')
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Roles('admin')
  @Post('job/start')
  async startJob(@Body('jobName') jobName: string) {
    if (!jobName) {
      throw new HttpException('El nombre del trabajo (jobName) es requerido', HttpStatus.BAD_REQUEST);
    }
    try {
      await this.etlService.startJob(jobName);
      return { ok: true, message: 'Proceso de sincronización iniciado.' };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Roles('admin')
  @Get('job/status')
  async getJobStatus(@Query('jobName') jobName: string) {
    if (!jobName) {
      throw new HttpException('El nombre del trabajo (jobName) es requerido', HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.etlService.getJobStatus(jobName);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Roles('admin')
  @Post('import/excel')
  @UseInterceptors(FileInterceptor('file', { storage: multer.memoryStorage() }))
  async importExcel(
    @UploadedFile() file?: Express.Multer.File,
    @Query('sheet') sheetName?: string,
  ) {
    if (!file || !file.buffer?.length) {
      throw new HttpException('El archivo (file) es requerido', HttpStatus.BAD_REQUEST);
    }

    try {
      return await this.etlService.importFromExcel(file, { sheetName });
    } catch (error: any) {
      throw new HttpException(error?.message ?? 'Error en importación', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}