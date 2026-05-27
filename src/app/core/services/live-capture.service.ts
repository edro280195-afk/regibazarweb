import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    ConfirmLiveCandidateRequest,
    ImportLiveRequest,
    LiveSessionDto,
    LiveReviewDto
} from '../models';

@Injectable({ providedIn: 'root' })
export class LiveCaptureService {
    private http = inject(HttpClient);
    private readonly base = `${environment.apiUrl}/live`;

    importLive(request: ImportLiveRequest): Observable<LiveSessionDto> {
        return this.http.post<LiveSessionDto>(`${this.base}/import`, request);
    }

    getSession(id: number): Observable<LiveSessionDto> {
        return this.http.get<LiveSessionDto>(`${this.base}/${id}`);
    }

    getReview(id: number): Observable<LiveReviewDto> {
        return this.http.get<LiveReviewDto>(`${this.base}/${id}/review`);
    }

    confirmCandidate(id: number, request: ConfirmLiveCandidateRequest): Observable<void> {
        return this.http.post<void>(`${this.base}/candidates/${id}/confirm`, request);
    }

    ignoreCandidate(id: number): Observable<void> {
        return this.http.post<void>(`${this.base}/candidates/${id}/ignore`, {});
    }

    getCandidateClip(candidateId: number): Observable<Blob> {
        return this.http.get(`${this.base}/candidates/${candidateId}/clip`, { responseType: 'blob' });
    }
}
