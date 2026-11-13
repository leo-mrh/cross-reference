import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { UsersService } from '../services/users.service';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AuthenticatedRequestUser } from '../../auth/strategies/jwt.strategy';

type UserRequest = ExpressRequest & { user: AuthenticatedRequestUser };

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Roles('admin')
  @Get()
  async list() {
    return this.usersService.findAll();
  }

  @Roles('admin')
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Roles('admin')
  @Patch(':id/activo')
  async toggleActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body('activo') activo: boolean,
    @Request() req: UserRequest,
  ) {
    return this.usersService.setActivo(id, activo, req.user.userId);
  }
}