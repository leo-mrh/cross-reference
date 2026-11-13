import { Test, TestingModule } from '@nestjs/testing';
import { RefaccionesController } from './refacciones.controller';
import { RefaccionesService } from '../services/refacciones.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

describe('RefaccionesController', () => {
  let controller: RefaccionesController;
  let service: RefaccionesService;

  const mockRefaccionesService = {
    getAllRefacciones: jest.fn(),
    getStats: jest.fn(),
    createRefaccionWithFile: jest.fn(),
    updateRefaccionWithFile: jest.fn(),
    deleteRefaccion: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefaccionesController],
      providers: [{ provide: RefaccionesService, useValue: mockRefaccionesService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RefaccionesController>(RefaccionesController);
    service = module.get<RefaccionesService>(RefaccionesService);

    jest.clearAllMocks();
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('getAllRefacciones debería delegar en el service con el query param', async () => {
    const mockResult = [{ id: 1, numPiezaOem: 'ABC123' }];
    mockRefaccionesService.getAllRefacciones.mockResolvedValue(mockResult);

    const result = await controller.getAllRefacciones('ABC123');

    expect(service.getAllRefacciones).toHaveBeenCalledWith('ABC123');
    expect(result).toEqual(mockResult);
  });

  it('createRefaccion debería delegar en createRefaccionWithFile con body y archivo', async () => {
    const body = { numPiezaOem: 'XYZ789' } as any;
    const mockFile = { buffer: Buffer.from(''), originalname: 'test.jpg' } as Express.Multer.File;
    mockRefaccionesService.createRefaccionWithFile.mockResolvedValue({ id: 2, ...body });

    const result = await controller.createRefaccion(body, mockFile);

    expect(service.createRefaccionWithFile).toHaveBeenCalledWith(body, mockFile);
    expect(result).toEqual({ id: 2, ...body });
  });

  it('deleteRefaccion debería delegar en el service con el id parseado', async () => {
    mockRefaccionesService.deleteRefaccion.mockResolvedValue({ deleted: true });

    const result = await controller.deleteRefaccion(5);

    expect(service.deleteRefaccion).toHaveBeenCalledWith(5);
    expect(result).toEqual({ deleted: true });
  });
});