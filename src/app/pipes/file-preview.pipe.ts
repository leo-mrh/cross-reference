import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filePreview',
  standalone: true
})
export class FilePreviewPipe implements PipeTransform {

  transform(file: File | null): string | null {
    if (!file) return null;

    const reader = new FileReader();

    // ⚠ OJO: retornamos un objeto URL temporal para que Angular lo renderice
    return URL.createObjectURL(file);
  }
}