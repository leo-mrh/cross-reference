import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { plainToInstance, Transform } from 'class-transformer';
import { CreateRefaccionAlternativaDto } from './create-refaccion-alternativa.dto';

/**
 * Como el formulario se envía como multipart/form-data (por la imagen),
 * el array "alternativas" puede llegar serializado como string JSON.
 * Esta transformación lo normaliza a un array de INSTANCIAS reales de
 * CreateRefaccionAlternativaDto (no objetos planos), para que el
 * whitelist de ValidationPipe reconozca correctamente sus propiedades.
 */
function parseAlternativas({ value }: { value: unknown }) {
  let parsed: unknown = value;

  if (typeof value === 'string') {
    if (value.trim() === '') return [];
    try {
      parsed = JSON.parse(value);
    } catch {
      // Se deja pasar el valor original: @IsArray lo rechazará
      // con un mensaje claro en vez de fallar silenciosamente.
      return value;
    }
  }

  if (!Array.isArray(parsed)) return parsed;

  // Conversión explícita a instancias reales de la clase,
  // necesaria porque @Transform sobrescribe la conversión automática de @Type.
  return plainToInstance(CreateRefaccionAlternativaDto, parsed);
}

export class CreateRefaccionDto {
  @IsString()
  @IsNotEmpty({ message: 'El número de pieza OEM es obligatorio' })
  @MaxLength(255)
  numPiezaOem!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  valueParts?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reman?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  dde?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mbf?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string | null;

  @IsOptional()
  @IsString()
  imagen?: string | null;

  @IsOptional()
  @Transform(parseAlternativas)
  @IsArray({ message: 'El formato de alternativas no es válido (se esperaba un arreglo)' })
  @ValidateNested({ each: true })
  alternativas?: CreateRefaccionAlternativaDto[];
}
