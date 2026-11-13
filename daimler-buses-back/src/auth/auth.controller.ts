import {
  Controller,
  Request,
  Post,
  UseGuards,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedRequestUser } from './strategies/jwt.strategy';
import { Public } from '../common/decorators/public.decorator';

type LoginRequest = ExpressRequest & {
  user: {
    idUsuario: number;
    sCorreo: string;
    idRol: number | string | null;
    idArea?: number | null;
  };
};

type MeRequest = ExpressRequest & { user: AuthenticatedRequestUser };

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  login(@Request() req: LoginRequest) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: MeRequest) {
    const user = await this.authService.getUserById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }
    return user;
  }
}