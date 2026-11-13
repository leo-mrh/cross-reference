import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface JobStatus {
  run_status: number; // 0:Fail, 1:Success, 2:Retry, 3:Cancel, 4:InProgress
  message?: string;
  run_date?: string;
  run_time?: string;
  status_text?: string;
}

@Injectable({ providedIn: 'root' })
export class EtlApi {
  private http = inject(HttpClient);

  // Nombre del Job en SQL Agent (configurable)
  private readonly defaultJobName = 'DAIMLER_BUSES_ETL_SYNC'; 

  /**
   * Inicia el proceso ETL
   * @param jobName Opcional, si se tiene múltiples jobs
   */
  async startJob(jobName: string = this.defaultJobName) {
    return firstValueFrom(this.http.post<{ ok: boolean; message: string }>('/api/etl/job/start', { jobName }));
  }

  /**
   * Consulta el estado
   */
  async getStatus(jobName: string = this.defaultJobName) {
    return firstValueFrom(this.http.get<JobStatus>('/api/etl/job/status', { params: { jobName } }));
  }
}
