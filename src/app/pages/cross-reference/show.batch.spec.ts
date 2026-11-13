import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach } from 'vitest';
import { Show } from './show';

@Component({ selector: 'app-menu', standalone: true, template: '' })
class MenuStub {}

describe('Show batch', () => {
  let fixture: ComponentFixture<Show>;
  let component: Show;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Show],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(Show, { set: { imports: [MenuStub] } })
      .compileComponents();

    fixture = TestBed.createComponent(Show);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    httpMock = TestBed.inject(HttpTestingController);
  });

  it('parses batch input and shows progress and summary', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const batchInput = el.querySelector<HTMLTextAreaElement>('#batch-input')!;
    const startBtn = el.querySelector<HTMLButtonElement>('#batch-start')!;
    batchInput.value = 'ABC123\nXYZ-987, 555-AAA';
    batchInput.dispatchEvent(new Event('input'));

    startBtn.click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(component.batchBusy).toBe(true);

    const r1 = httpMock.expectOne('/api/refacciones?numPiezaOem=ABC123');
    const r2 = httpMock.expectOne('/api/refacciones?numPiezaOem=XYZ-987');
    const r3 = httpMock.expectOne('/api/refacciones?numPiezaOem=555-AAA');
    r1.flush([{ id: 1, numPiezaOem: 'ABC123', descripcion: '...', alternativas: ['ALT-A', 'ALT-B'] }]);
    r2.flush([{ id: 2, numPiezaOem: 'XYZ-987', descripcion: '...', alternativas: [] }]);
    r3.flush([{ id: 7, numPiezaOem: '555-AAA', descripcion: '...', alternativas: ['ALT-1'] }]);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.batchBusy).toBe(false);
    expect(component.batchRows.length).toBe(3);
    expect(component.batchSummary?.ok).toBe(3);
    // expect(component.searchMessage).toBe('Búsqueda por lote completada');
  });

  it('allows canceling batch operation', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const batchInput = el.querySelector<HTMLTextAreaElement>('#batch-input')!;
    const startBtn = el.querySelector<HTMLButtonElement>('#batch-start')!;
    const cancelBtn = el.querySelector<HTMLButtonElement>('#batch-cancel')!;
    batchInput.value = 'CANCEL-1\nCANCEL-2';
    startBtn.click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(component.batchBusy).toBe(true);
    cancelBtn.click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(component.batchBusy).toBe(false);
  });
});

