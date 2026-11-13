import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  Matches,
} from 'class-validator';

/**
 * TODO: ajustar estos valores a los IDs reales de roles en el sistema.
 * Se documentan aquí como única fuente de verdad para validación.
 */
export const ROLES_VALIDOS = [1, 2] as const; // 1 = Admin, 2 = User

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  sNombre!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  sApellidoPaterno!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  sApellidoMaterno!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(250)
  sUsuario!: string;

  @IsEmail()
  @MaxLength(255)
  sCorreo!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  sPassword!: string;

  @IsOptional()
  @IsIn(ROLES_VALIDOS, {
    message: `idRol debe ser uno de: ${ROLES_VALIDOS.join(', ')}`,
  })
  idRol?: number;

  @IsOptional()
  idArea?: number;
}
