import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Menu } from '../../shared/menu/menu';

type KitItemPayload = {
  numeroParte: string;
  sucesor: string | null;
  descripcion: string | null;
  cantidad: number;
};

type KitPayload = {
  descripcion: string | null;
  numeroEnsamble: string;
  imagen: string | null;
  items: KitItemPayload[];
};

@Component({
  selector: 'app-kits-reparacion-insert',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Menu],
  templateUrl: './kit.html',
})
export class KitsReparacionInsert implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);

  @ViewChild('imagenFile')
  imagenFile?: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    this.openModal();
  }

  open = signal(false);
  busy = signal(false);
  uploading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  form: FormGroup = this.fb.group({
    descripcion: [''],
    numeroEnsamble: ['', [Validators.required]],
    imagen: [''],
    items: this.fb.array([]),
  });

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  openModal() {
    this.error.set(null);
    this.success.set(null);
    if (this.items.length === 0) this.addItem();
    this.open.set(true);
  }

  closeModal() {
    this.open.set(false);
  }

  openImagenPicker() {
    this.imagenFile?.nativeElement.click();
  }

  async onImagenSelected(event: Event) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    this.error.set(null);
    this.success.set(null);
    this.uploading.set(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const resp = await firstValueFrom(
        this.http.post<{ imagen: string }>('/api/kits-reparacion/upload-imagen', fd),
      );
      if (resp?.imagen) this.form.patchValue({ imagen: resp.imagen });
    } catch {
      this.error.set('No se pudo subir la imagen. Verifica el archivo e intenta nuevamente.');
    } finally {
      this.uploading.set(false);
      if (input) input.value = '';
    }
  }

  addItem(prefill?: Partial<KitItemPayload>) {
    const g = this.fb.group({
      numeroParte: [prefill?.numeroParte ?? '', [Validators.required]],
      sucesor: [prefill?.sucesor ?? ''],
      descripcion: [prefill?.descripcion ?? ''],
      cantidad: [prefill?.cantidad ?? 1, [Validators.required, Validators.min(1)]],
    });
    this.items.push(g);
  }

  removeItem(i: number) {
    this.items.removeAt(i);
    if (this.items.length === 0) this.addItem();
  }

  private asOptional(v: unknown): string | null {
    if (v === null || v === undefined) return null;
    const s = String(v);
    const has = s.replace(/\u00A0/g, '').trim().length > 0;
    return has ? s : null;
  }

  private buildPayload(): KitPayload {
    const v = this.form.value as any;
    const rawItems = Array.isArray(v.items) ? v.items : [];

    const items: KitItemPayload[] = rawItems
      .map((x: any) => {
        const numeroParte = String(x?.numeroParte ?? '');
        const cantidad = Number(x?.cantidad ?? 1);

        const hasParte = numeroParte.replace(/\u00A0/g, '').trim().length > 0;
        if (!hasParte) return null;

        const qty = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1;

        return {
          numeroParte,
          sucesor: this.asOptional(x?.sucesor),
          descripcion: this.asOptional(x?.descripcion),
          cantidad: qty,
        } satisfies KitItemPayload;
      })
      .filter((x: any) => !!x);

    return {
      descripcion: this.asOptional(v.descripcion),
      numeroEnsamble: String(v.numeroEnsamble ?? ''),
      imagen: this.asOptional(v.imagen),
      items,
    };
  }

  async submit() {
    this.error.set(null);
    this.success.set(null);

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Completa los campos obligatorios.');
      return;
    }

    const payload = this.buildPayload();
    const hasEnsamble = payload.numeroEnsamble.replace(/\u00A0/g, '').trim().length > 0;
    if (!hasEnsamble) {
      this.error.set('El número de ensamble es requerido.');
      return;
    }

    if (!payload.items.length) {
      this.error.set('Agrega al menos un renglón en “Número de parte”.');
      return;
    }

    this.busy.set(true);
    try {
      await firstValueFrom(this.http.post('/api/kits-reparacion', payload));
      this.success.set('Kit guardado correctamente.');
      this.form.reset({ descripcion: '', numeroEnsamble: '', imagen: '' });
      while (this.items.length) this.items.removeAt(0);
      this.addItem();
    } catch {
      this.error.set('No se pudo guardar. Verifica la información e intenta nuevamente.');
    } finally {
      this.busy.set(false);
    }
  }
}
