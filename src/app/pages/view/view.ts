import { Component, AfterViewInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-view',
  standalone: true,
  imports: [],
  templateUrl: './view.html',
})
export class View implements AfterViewInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  id = 0;

  async ngAfterViewInit() {
    const idParam = this.route.snapshot.queryParamMap.get('id');
    if (!idParam) return;
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) return;
    this.id = id;

    let data: any = null;
    try {
      data = await firstValueFrom(this.http.get<any>(`/api/refacciones/${id}`));
    } catch {}

    if (!data) {
      try {
        const arr = await firstValueFrom(this.http.get<any[]>('/api/refacciones'));
        data = Array.isArray(arr) ? arr.find((x: any) => Number(x?.id) === id) : null;
      } catch {}
    }

    if (!data) return;

    const setVal = (selector: string, val: any) => {
      const el = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | null;
      if (el) (el as any).value = val ?? '';
    };

    setVal('input[name="numPiezaOem"]', data.numPiezaOem);
    setVal('input[name="valueParts"]', data.valueParts);

    // Render alternatives if present
    const altContainer = document.getElementById('alternativas-container');
    if (altContainer && Array.isArray(data.alternativas) && data.alternativas.length > 0) {
      altContainer.innerHTML = '';
      data.alternativas.forEach((alt: any, index: number) => {
        const wrap = document.createElement('div');
        wrap.className = 'mt-4'; // spacing
        
        const label = document.createElement('label');
        label.className = 'block mb-2.5 text-sm font-medium text-heading';
        label.textContent = `Alternativa ${index + 1}`;
        
        const input = document.createElement('input');
        input.type = 'text';
        input.disabled = true;
        input.value = alt.nombre || alt; // Handle object or string
        input.className = 'bg-neutral-secondary-medium border border-default-medium text-heading text-sm rounded-base block w-full px-3 py-2.5 shadow-xs';
        
        wrap.appendChild(label);
        wrap.appendChild(input);
        altContainer.appendChild(wrap);
      });
    }

    setVal('input[name="reman"]', data.reman);
    setVal('input[name="dde"]', data.dde);
    setVal('input[name="mbf"]', data.mbf);
    const desc = document.querySelector('textarea[name="descripcion"]') as HTMLTextAreaElement | null;
    if (desc) desc.value = data.descripcion ?? '';
    const img = document.getElementById('img_preview') as HTMLImageElement | null;
    if (img && data.imagen) img.src = data.imagen;

    const modal = document.getElementById('view-image-modal') as HTMLDivElement | null;
    const modalImg = document.getElementById('view_image_large') as HTMLImageElement | null;
    if (img && modal && modalImg) {
      img.addEventListener('click', () => {
        modalImg.src = img.src;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      });
      modal.addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      });
    }
  }
}
