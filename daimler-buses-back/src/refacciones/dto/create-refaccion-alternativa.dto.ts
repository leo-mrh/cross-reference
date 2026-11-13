import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRefaccionAlternativaDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre de la alternativa es obligatorio' })
  @MaxLength(255)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  nota?: string | null;
}