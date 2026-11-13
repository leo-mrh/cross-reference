import { ComponentFixture, TestBed } from '@angular/core/testing';
import { List } from './list';
import { HttpHeaders } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let lastJsPDFInstance: any = null;

class JsPDFMock {
  setFontSize: any;
  text: any;
  save: any;
  addImage: any;
  internal: any;

  constructor() {
    this.setFontSize = vi.fn();
    this.text = vi.fn();
    this.save = vi.fn();
    this.addImage = vi.fn();
    this.internal = {
      pageSize: {
        getWidth: vi.fn(() => 210),
        getHeight: vi.fn(() => 297),
      },
    };
    lastJsPDFInstance = this;
  }
}

const mockAutoTable = vi.fn();

vi.mock('jspdf', () => ({
  default: JsPDFMock
}));

vi.mock('jspdf-autotable', () => ({
  default: mockAutoTable
}));

describe('List Component', () => {
  let component: List;
  let fixture: ComponentFixture<List>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [List],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(List);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock = TestBed.inject(HttpTestingController);
    
    vi.clearAllMocks();
    lastJsPDFInstance = null;

    (globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('fetch not mocked'));
    (globalThis as any).alert = vi.fn();

    try {
      const initReq = httpMock.expectOne('/api/refacciones');
      initReq.flush([]);
    } catch {}
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should generate excel with correct columns for mixed alternatives', async () => {
    const mockData = [
      { id: 1, numPiezaOem: 'A1', alternativas: [{ id: 11, nombre: 'Alt1-1' }], descripcion: 'Desc1', imagen: null },
      { id: 2, numPiezaOem: 'A2', alternativas: [], descripcion: 'Desc2', imagen: null },
      {
        id: 3,
        numPiezaOem: 'A3',
        alternativas: [
          { id: 31, nombre: 'Alt3-1' },
          { id: 32, nombre: 'Alt3-2' },
        ],
        descripcion: 'Desc3',
        imagen: null,
      }
    ];

    component.refacciones.set(mockData);
    fixture.detectChanges();

    const OriginalBlob = (globalThis as any).Blob;
    (globalThis as any).Blob = class {
      parts: any[];
      type: string;
      constructor(parts: any[], opts?: any) {
        this.parts = parts;
        this.type = opts?.type;
      }
    };

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: any) => {
      if (tagName === 'a') {
        const a = originalCreateElement('a');
        vi.spyOn(a, 'click').mockImplementation(() => {});
        return a;
      }
      return originalCreateElement(tagName);
    }) as any);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    try {
      await component.downloadExcel();

      const blob = createObjectURLSpy.mock.calls[0][0] as any;
      const content = String(blob.parts?.[0] ?? '');

      expect(content).toContain('Alternativa 1');
      expect(content).toContain('Alternativa 2');
      expect(content).not.toContain('Alternativa 3');

      expect(content).toContain('Alt1-1');
      expect(content).toContain('Alt3-1');
      expect(content).toContain('Alt3-2');
    } finally {
      createElementSpy.mockRestore();
      appendSpy.mockRestore();
      removeSpy.mockRestore();
      revokeSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      (globalThis as any).Blob = OriginalBlob;
    }
  });

  it('should generate PDF with correct columns for mixed alternatives', async () => {
    const mockData = [
      { id: 1, numPiezaOem: 'A1', alternativas: [{ id: 11, nombre: 'Alt1-1' }], descripcion: 'Desc1', imagen: null },
      { id: 2, numPiezaOem: 'A2', alternativas: [], descripcion: 'Desc2', imagen: null },
      {
        id: 3,
        numPiezaOem: 'A3',
        alternativas: [
          { id: 31, nombre: 'Alt3-1' },
          { id: 32, nombre: 'Alt3-2' },
        ],
        descripcion: 'Desc3',
        imagen: null,
      }
    ];

    component.refacciones.set(mockData);
    fixture.detectChanges();

    await component.downloadPDF();

    expect(mockAutoTable).toHaveBeenCalled();
    expect(lastJsPDFInstance).toBeTruthy();

    // Obtener los argumentos de la llamada a autoTable
    const calls = mockAutoTable.mock.calls;
    const options = calls[0][1]; // El segundo argumento son las opciones

    // Verificar encabezados
    const headers = options.head[0];
    expect(headers).toContain('Alternativa 1');
    expect(headers).toContain('Alternativa 2');
    expect(headers).not.toContain('Alternativa 3');
    expect(headers[0]).toBe('ID');
    expect(headers[headers.length - 1]).toBe('Descripción');

    // Verificar datos
    const data = options.body;
    // Registro 1: A1, 1 alternativa
    const row1 = data[0];
    expect(row1).toContain('Alt1-1');
    expect(row1).toContain(''); // Espacio para alternativa 2 vacío

    // Registro 3: A3, 2 alternativas
    const row3 = data[2];
    expect(row3).toContain('Alt3-1');
    expect(row3).toContain('Alt3-2');
  });

  it('should add logo image on top-right when fetch succeeds', async () => {
    const mockData = [{ id: 1, numPiezaOem: 'A1', alternativas: [], descripcion: 'Desc1', imagen: null }];
    component.refacciones.set(mockData);
    fixture.detectChanges();

    const logoBlob = {
      type: 'image/png',
      arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    };
    
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(logoBlob),
    });
    (globalThis as any).fetch = fetchMock;

    const OriginalImage = (globalThis as any).Image;
    (globalThis as any).Image = class {
      naturalWidth = 100;
      naturalHeight = 50;
      src = '';
      decode() {
        return Promise.resolve();
      }
    };

    try {
      await component.downloadPDF();
    } finally {
      (globalThis as any).Image = OriginalImage;
    }

    expect(fetchMock).toHaveBeenCalledWith('/images.png');
    
    // Si falla aquí, verificar si la promesa se completó.
    // Como downloadPDF tiene awaits, deberíamos estar bien.
    expect(lastJsPDFInstance.addImage).toHaveBeenCalledTimes(1);

    const call = lastJsPDFInstance.addImage.mock.calls[0];
    const dataUrl = call[0];
    const format = call[1];
    const x = call[2];
    const y = call[3];
    const w = call[4];
    const h = call[5];

    expect(dataUrl).toContain('data:image/png;base64,');
    expect(format).toBe('PNG');
    // Page width 210. Margin 10. MaxW 60. MaxH 15.
    // Img 100x50 (ratio 2).
    // Target H=15 => W=30.
    // X = 210 - 10 - 30 = 170.
    // Y = 17 - 7.5 = 9.5.
    expect(x).toBeCloseTo(170, 1);
    expect(y).toBeCloseTo(9.5, 1);
    expect(w).toBeCloseTo(30, 1);
    expect(h).toBeCloseTo(15, 1);
  });

  it('should generate PDF without image when fetch fails', async () => {
    const mockData = [{ id: 1, numPiezaOem: 'A1', alternativas: [], descripcion: 'Desc1', imagen: null }];
    component.refacciones.set(mockData);
    fixture.detectChanges();

    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    (globalThis as any).fetch = fetchMock;

    await component.downloadPDF();

    expect(fetchMock).toHaveBeenCalledWith('/images.png');
    expect(lastJsPDFInstance.addImage).not.toHaveBeenCalled();
    expect(mockAutoTable).toHaveBeenCalled();
  });

  it('should export PDF with limit n from filtered data', async () => {
    const mockData = [
      { id: 1, numPiezaOem: 'A1', alternativas: [], descripcion: 'Desc1', imagen: null },
      { id: 2, numPiezaOem: 'A2', alternativas: [], descripcion: 'Desc2', imagen: null },
      { id: 3, numPiezaOem: 'A3', alternativas: [], descripcion: 'Desc3', imagen: null },
    ];
    component.refacciones.set(mockData);
    component.searchTerm.set('A');
    fixture.detectChanges();

    await component.downloadPDF({ limit: 2, offset: 0 });

    const options = mockAutoTable.mock.calls[0][1];
    expect(options.body.length).toBe(2);
    expect(options.body[0]).toContain('A1');
    expect(options.body[1]).toContain('A2');
  });

  it('should export Excel with limit n from filtered data', async () => {
    const mockData = [
      { id: 1, numPiezaOem: 'A1', alternativas: [], descripcion: 'Desc1', imagen: null },
      { id: 2, numPiezaOem: 'A2', alternativas: [], descripcion: 'Desc2', imagen: null },
      { id: 3, numPiezaOem: 'A3', alternativas: [], descripcion: 'Desc3', imagen: null },
    ];
    component.refacciones.set(mockData);
    fixture.detectChanges();

    const OriginalBlob = (globalThis as any).Blob;
    (globalThis as any).Blob = class {
      parts: any[];
      type: string;
      constructor(parts: any[], opts?: any) {
        this.parts = parts;
        this.type = opts?.type;
      }
    };

    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url');
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((tagName: any) => {
      if (tagName === 'a') {
        const a = originalCreateElement('a');
        vi.spyOn(a, 'click').mockImplementation(() => {});
        return a;
      }
      return originalCreateElement(tagName);
    }) as any);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    try {
      await component.downloadExcel({ limit: 2, offset: 0 });
      const blob = createObjectURLSpy.mock.calls[0][0] as any;
      const content = String(blob.parts?.[0] ?? '');
      expect(content).toContain('A1');
      expect(content).toContain('A2');
      expect(content).not.toContain('A3');
    } finally {
      createElementSpy.mockRestore();
      appendSpy.mockRestore();
      removeSpy.mockRestore();
      revokeSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      (globalThis as any).Blob = OriginalBlob;
    }
  });

  it('should call server-side endpoint when exporting all to PDF', async () => {
    component.exportClientMaxRows = 1;
    component.refacciones.set([
      { id: 1, numPiezaOem: 'A1', alternativas: [], descripcion: 'Desc1', imagen: null },
      { id: 2, numPiezaOem: 'A2', alternativas: [], descripcion: 'Desc2', imagen: null },
    ]);
    fixture.detectChanges();

    const downloadBlobSpy = vi.spyOn(component as any, 'downloadBlob').mockImplementation(() => {});
    const promise = component.downloadPDF({ fetchAll: true });

    const req = httpMock.expectOne('/api/refacciones/export/pdf');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.fetchAll).toBe(true);
    req.flush(new Blob(['pdf'], { type: 'application/pdf' }), {
      headers: new HttpHeaders({ 'content-disposition': 'attachment; filename="reporte.pdf"' }),
    });

    await promise;
    expect(downloadBlobSpy).toHaveBeenCalled();
  });

  it('should not include alternativa columns when none exist', async () => {
    component.refacciones.set([
      { id: 1, numPiezaOem: 'A1', alternativas: [], descripcion: 'Desc1', imagen: null },
      { id: 2, numPiezaOem: 'A2', alternativas: [], descripcion: 'Desc2', imagen: null },
    ]);
    fixture.detectChanges();

    await component.downloadPDF({ limit: 2, offset: 0 });

    const options = mockAutoTable.mock.calls[0][1];
    const headers = options.head[0];
    expect(headers).not.toContain('Alternativa 1');
    expect(headers).toEqual(['ID', 'Numero de Parte', 'Descripción']);
  });

  it('should fallback to client generation when server export fails', async () => {
    component.exportClientMaxRows = 1;
    component.exportRetryCount = 1;
    component.exportRetryDelayMs = 0;
    component.refacciones.set([
      { id: 1, numPiezaOem: 'A1', alternativas: [], descripcion: 'Desc1', imagen: null },
      { id: 2, numPiezaOem: 'A2', alternativas: [], descripcion: 'Desc2', imagen: null },
    ]);
    fixture.detectChanges();

    const promise = component.downloadPDF({ fetchAll: true });
    const req = httpMock.expectOne('/api/refacciones/export/pdf');
    req.flush(new Blob(['error'], { type: 'application/pdf' }), { status: 500, statusText: 'Server Error' });

    await promise;
    expect(mockAutoTable).toHaveBeenCalled();
    expect((globalThis as any).alert).toHaveBeenCalled();
  });
});
