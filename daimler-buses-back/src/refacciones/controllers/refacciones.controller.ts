import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Param,
  ParseIntPipe,
  UploadedFile,
  UseInterceptors,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { RefaccionesService } from '../services/refacciones.service';
import { CreateRefaccionDto, UpdateRefaccionDto } from '../dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

const TIPOS_MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

const multerOptions: multer.Options = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
  fileFilter: (_req, file, callback) => {
    if (!TIPOS_MIME_PERMITIDOS.includes(file.mimetype)) {
      return callback(
        new BadRequestException('Solo se permiten imágenes JPG, PNG o WEBP'),
      );
    }
    callback(null, true);
  },
};

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('refacciones')
export class RefaccionesController {
  constructor(private refaccionesService: RefaccionesService) {}

  @Roles('admin', 'user')
  @Get()
  async getAllRefacciones(@Query('numPiezaOem') numPiezaOem?: string) {
    return this.refaccionesService.getAllRefacciones(numPiezaOem);
  }

  @Roles('admin', 'user')
  @Get('stats')
  async getStats() {
    return this.refaccionesService.getStats();
  }

  @Roles('admin')
  @Post()
  @UseInterceptors(FileInterceptor('imagen', multerOptions))
  async createRefaccion(
    @Body() body: CreateRefaccionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.refaccionesService.createRefaccionWithFile(body, file);
  }

  @Roles('admin')
  @Put(':id')
  @UseInterceptors(FileInterceptor('imagen', multerOptions))
  async updateRefaccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRefaccionDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.refaccionesService.updateRefaccionWithFile(id, body, file);
  }

  @Roles('admin')
  @Delete(':id')
  async deleteRefaccion(@Param('id', ParseIntPipe) id: number) {
    return this.refaccionesService.deleteRefaccion(id);
  }
}
