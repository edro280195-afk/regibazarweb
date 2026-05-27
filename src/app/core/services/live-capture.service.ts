import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LiveSessionDto, LiveReviewDto, ConfirmCandidateRequest, ImportLiveRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class LiveCaptureService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/live`;

  import(req: ImportLiveRequest): Observable<LiveSessionDto> {
    return this.http.post<LiveSessionDto>(`${this.base}/import`, req);
  }

  getAll(): Observable<LiveSessionDto[]> {
    return this.http.get<LiveSessionDto[]>(this.base);
  }

  getById(id: number): Observable<LiveSessionDto> {
    return this.http.get<LiveSessionDto>(`${this.base}/${id}`);
  }

  getReview(id: number): Observable<LiveReviewDto> {
    return this.http.get<LiveReviewDto>(`${this.base}/${id}/review`);
  }

  confirm(candidateId: number, req: ConfirmCandidateRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/candidates/${candidateId}/confirm`, req);
  }

  ignore(candidateId: number): Observable<void> {
    return this.http.post<void>(`${this.base}/candidates/${candidateId}/ignore`, {});
  }

  fetchClip(candidateId: number): Observable<Blob> {
    return this.http.get(`${this.base}/candidates/${candidateId}/clip`, { responseType: 'blob' });
  }
}
