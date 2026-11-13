import {
  Component,
  OnInit,
  inject,
  signal
} from '@angular/core';

import { NgClass } from '@angular/common';
import { Menu } from '../../shared/menu/menu';
import { Modal } from '../../shared/modal/modal';
import { SidebarService } from '../../services/sidebar.service';

import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';

/* ----------------------------------------------------------
   REGEX PARA NÚMEROS DE PARTE (NO ACEPTA PALABRAS NI ORACIONES)
---------------------------------------------------------- */
const NUM_PARTE_REGEX =
  /^[a-zA-Z0-9][a-zA-Z0-9 \u00A0\.\/_-]*$/;

/* ----------------------------------------------------------
   VALIDATOR: Al menos dos campos llenos
---------------------------------------------------------- */
function atLeastTwoFieldsValidator(group: AbstractControl): ValidationErrors | null {
  if (!group || typeof group !== 'object') return null;

  const controls: any = group.value;
  const textFields = ['numPiezaOem', 'valueParts', 'reman', 'dde', 'mbf', 'descripcion'];

  let count = 0;

  for (const key of textFields) {
    const v = controls[key];
    if (typeof v === 'string' && v.trim().length > 0) {
      count++;
    }
  }

  const alts = controls.alternativas;
  if (Array.isArray(alts)) {
    const has = alts.some((a: any) => {
      if (typeof a === 'string') return !!a.trim();
      if (a && typeof a === 'object') return !!String(a.nombre ?? '').trim();
      return false;
    });
    if (has) count++;
  }

  if (controls.imagen) count++;

  return count >= 2 ? null : { atLeastTwo: true };
}

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [Menu, Modal, ReactiveFormsModule, NgClass],
  templateUrl: './create.html',
})
export class Create implements OnInit {

  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private sidebarService = inject(SidebarService);

  // ✅ Sidebar desacoplado de <app-menu>
  isSidebarOpen = this.sidebarService.isOpen;
  toggleSidebar(): void { this.sidebarService.toggle(); }

  showCreateModal = signal(false);
  showSuccessModal = signal(false);
  showErrorModal = signal(false);

  successMessage = signal('');
  errorMessage = signal('');
  createdId = signal<number | null>(null);

  isSubmitting = signal(false);
  altInputError = signal<string | null>(null);

  // ✅ Estado del Wizard (Opción B)
  currentStep = signal(1);
  readonly totalSteps = 3;

  createForm!: FormGroup;
  selectedFile: File | null = null;

  ngOnInit(): void {

    /* ----------------------------------------------------------
       VALIDACIÓN ESTRICTA PARA TODOS LOS CAMPOS
    ---------------------------------------------------------- */
    this.createForm = this.fb.group(
      {
        numPiezaOem: [
          '',
          [
            Validators.required,
            Validators.pattern(NUM_PARTE_REGEX)
          ]
        ],

        valueParts: [
          '',
          Validators.pattern(NUM_PARTE_REGEX)
        ],

        reman: [
          '',
          Validators.pattern(NUM_PARTE_REGEX)
        ],

        dde: [
          '',
          Validators.pattern(NUM_PARTE_REGEX)
        ],

        mbf: [
          '',
          Validators.pattern(NUM_PARTE_REGEX)
        ],

        descripcion: [''],

        alternativas: this.fb.array([]),

        imagen: [null]
      },
      { validators: atLeastTwoFieldsValidator }
    );

    this.prefillFromQueryId();
  }

  get alternativas(): FormArray {
    return this.createForm.get('alternativas') as FormArray;
  }

  /* ----------------------------------------------------------
         WIZARD — NAVEGACIÓN ENTRE PASOS
  ---------------------------------------------------------- */

  goToStep(step: number): void {
    // Retroceder siempre está permitido
    if (step < this.currentStep()) {
      this.currentStep.set(step);
      return;
    }
    // Avanzar solo si el paso actual es válido
    if (step === this.currentStep() + 1 && this.isCurrentStepValid()) {
      this.currentStep.set(step);
    }
  }

  nextStep(): void {
    if (!this.isCurrentStepValid()) {
      this.markCurrentStepAsTouched();
      return;
    }
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(s => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
    }
  }

  private isCurrentStepValid(): boolean {
    if (this.currentStep() === 1) {
      const control = this.createForm.get('numPiezaOem');
      return !!control && control.valid;
    }
    // Pasos 2 y 3 no tienen campos obligatorios individuales
    return true;
  }

  private markCurrentStepAsTouched(): void {
    if (this.currentStep() === 1) {
      this.createForm.get('numPiezaOem')?.markAsTouched();
    }
  }

  /* ----------------------------------------------------------
         MODALES
  ---------------------------------------------------------- */

  openCreateModal(): void {
    this.createForm.reset();
    this.alternativas.clear();
    this.selectedFile = null;
    this.altInputError.set(null);
    this.currentStep.set(1); // ✅ reinicia el wizard

    this.createForm.markAsPristine();
    this.createForm.markAsUntouched();

    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.createForm.reset();
    this.alternativas.clear();
    this.selectedFile = null;
    this.altInputError.set(null);
    this.currentStep.set(1); // ✅ reinicia el wizard

    this.createForm.markAsPristine();
    this.createForm.markAsUntouched();

    this.showCreateModal.set(false);
  }

  /* ----------------------------------------------------------
         ALTERNATIVAS - GARANTÍA: NO se modifica la estructura
         Solo se recorta espacios al inicio/final (trim).
         Nunca se altera mayúsculas, espacios internos ni caracteres.
  ---------------------------------------------------------- */
  addAlternativa(value: string = '', nota: string = ''): boolean {
    const normalized = String(value || '').trim();
    const normalizedNota = String(nota || '').trim();

    if (!normalized) {
      this.altInputError.set('Ingresa un número de parte antes de agregarlo como alternativa.');
      return false;
    }

    this.altInputError.set(null);

    this.alternativas.push(
      this.fb.group({
        nombre: [normalized],
        nota: [normalizedNota],
      }),
    );

    return true;
  }

  onAddAlternativa(altInput: HTMLInputElement, altNota: HTMLInputElement): void {
    const ok = this.addAlternativa(altInput.value, altNota.value);
    if (!ok) return;
    altInput.value = '';
    altNota.value = '';
  }

  removeAlternativa(index: number): void {
    this.alternativas.removeAt(index);
  }

  /* ----------------------------------------------------------
         IMAGEN
  ---------------------------------------------------------- */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (input.files?.length) {
      this.selectedFile = input.files[0];
      this.createForm.patchValue({ imagen: this.selectedFile });

    } else {
      this.selectedFile = null;
      this.createForm.patchValue({ imagen: null });
    }
  }

  async onSubmit(): Promise<void> {

    if (this.createForm.invalid || this.createForm.pending) {

      this.createForm.markAllAsTouched();

      if (this.createForm.errors?.['atLeastTwo']) {
        this.errorMessage.set('Debes completar al menos dos campos para guardar el registro.');

      } else {
        this.errorMessage.set('Por favor revisa los campos obligatorios.');
      }

      this.showErrorModal.set(true);
      return;
    }

    this.isSubmitting.set(true);

    const v = this.createForm.value;
    const numPiezaOem = v.numPiezaOem;

    try {
      const form = new FormData();
      form.append('numPiezaOem', numPiezaOem);

      form.append('valueParts', v.valueParts || '');
      form.append('reman', v.reman || '');
      form.append('dde', v.dde || '');
      form.append('mbf', v.mbf || '');
      form.append('descripcion', v.descripcion || '');

      const alts = (v.alternativas || [])
        .map((x: any) => {
          if (typeof x === 'string') {
            const nombre = String(x || '').trim();
            return nombre ? { nombre, nota: null } : null;
          }
          const nombre = String(x?.nombre ?? '').trim();
          const nota = String(x?.nota ?? '').trim();
          return nombre ? { nombre, nota: nota ? nota : null } : null;
        })
        .filter((x: any) => !!x);

      if (alts.length) {
        form.append('alternativas', JSON.stringify(alts));
      }

      if (this.selectedFile) {
        form.append('imagen', this.selectedFile, this.selectedFile.name);
      }

      const created = await firstValueFrom(
        this.http.post<any>('/api/refacciones', form)
      );

      this.createdId.set(created?.id ?? null);
      this.successMessage.set(
        `El material ${numPiezaOem} ha sido guardado exitosamente.`
      );

      this.showSuccessModal.set(true);
      this.closeCreateModal();

      this.createForm.reset();
      this.alternativas.clear();
      this.selectedFile = null;
      this.createForm.markAsPristine();
      this.createForm.markAsUntouched();

    } catch (err) {
      console.error('Error al guardar el material:', err);

      this.errorMessage.set(
        'Error al guardar el material. Intenta nuevamente.'
      );

      this.showErrorModal.set(true);

    } finally {
      this.isSubmitting.set(false);
    }
  }

  closeSuccessModal(): void {
    this.showSuccessModal.set(false);
    this.successMessage.set('');
    this.createdId.set(null);
  }

  closeErrorModal(): void {
    this.showErrorModal.set(false);
    this.errorMessage.set('');
  }

  private async prefillFromQueryId(): Promise<void> {

    const idParam = this.route.snapshot.queryParamMap.get('id');
    if (!idParam) return;

    const id = Number(idParam);
    if (Number.isNaN(id)) return;

    let data: any = null;

    try {
      data = await firstValueFrom(this.http.get<any>(`/api/refacciones/${id}`));
    } catch (err) {
      console.warn(`No se encontró el material con id=${id} vía endpoint directo, usando fallback:`, err);
    }

    if (!data) {
      try {
        const all = await firstValueFrom(
          this.http.get<any[]>('/api/refacciones')
        );
        data = all.find(x => Number(x.id) === id) || null;

      } catch (err) {
        console.error('Error al obtener el listado completo de refacciones:', err);
      }
    }

    if (!data || !data.numPiezaOem) return;

    this.createForm.patchValue({
      numPiezaOem: data.numPiezaOem,
      valueParts: data.valueParts,
      reman: data.reman,
      dde: data.dde,
      mbf: data.mbf,
      descripcion: data.descripcion,
    });

    if (Array.isArray(data.alternativas)) {
      this.alternativas.clear();

      for (const alt of data.alternativas) {
        const nombre = typeof alt === 'object' ? alt.nombre : String(alt || '');
        const nota = typeof alt === 'object' ? alt.nota : '';
        this.addAlternativa(nombre, String(nota || ''));
      }
    }

    this.currentStep.set(1); // 
  }
}