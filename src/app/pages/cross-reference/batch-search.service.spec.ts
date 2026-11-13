import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { BatchSearchService } from './batch-search.service';

describe('BatchSearchService', () => {
  let svc: BatchSearchService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    svc = TestBed.inject(BatchSearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('normalizes input by lines and commas', () => {
    const list = svc.normalizeInput('ABC, XYZ\n555-AAA');
    expect(list).toEqual(['ABC', 'XYZ', '555-AAA']);
  });

  it('transforms multiple alternatives into rows', async () => {
    const nums = ['A1'];
    const promise = svc.batchSearch(nums, { concurrency: 2 });
    const req1 = httpMock.expectOne('/api/refacciones?numPiezaOem=A1');
    req1.flush([{ id: 1, numPiezaOem: 'A1', descripcion: 'Desc', alternativas: ['ALT-A', 'ALT-B'] }]);
    const res = await promise;
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].numParteOem).toBe('A1');
    expect(res.rows[0].alternativa).toBe('ALT-A, ALT-B');
    expect(res.summary.ok).toBe(1);
    expect(res.summary.failed).toBe(0);
  });

  it('emits a single row with empty alternativa when none', async () => {
    const nums = ['B2'];
    const promise = svc.batchSearch(nums, { concurrency: 1 });
    const req1 = httpMock.expectOne('/api/refacciones?numPiezaOem=B2');
    req1.flush([{ id: 2, numPiezaOem: 'B2', descripcion: 'D', alternativas: [] }]);
    const res = await promise;
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].alternativa).toBe('');
    expect(res.summary.ok).toBe(1);
  });

  it('handles error partial and keeps order', async () => {
    const nums = ['X', 'Y'];
    const promise = svc.batchSearch(nums, { concurrency: 2, retry: 0 });
    const r1 = httpMock.expectOne('/api/refacciones?numPiezaOem=X');
    r1.flush('error', { status: 500, statusText: 'Server Error' });
    const r2 = httpMock.expectOne('/api/refacciones?numPiezaOem=Y');
    r2.flush([{ id: 7, numPiezaOem: 'Y', alternativas: ['ALT-1'] }]);
    const res = await promise;
    expect(res.summary.total).toBe(2);
    expect(res.summary.ok).toBe(1);
    expect(res.summary.failed).toBe(1);
    expect(res.rows[0].numParteOem).toBe('X');
    expect(res.rows[1].numParteOem).toBe('Y');
  });
});

