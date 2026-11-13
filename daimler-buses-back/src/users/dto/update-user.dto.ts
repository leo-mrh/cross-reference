import { IsEmail, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(250)
  sNombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  sApellidoPaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  sApellidoMaterno?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  sUsuario?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  sCorreo?: string;

  @IsOptional()
  @IsInt()
  idRol?: number;

  @IsOptional()
  @IsInt()
  idArea?: number;
}