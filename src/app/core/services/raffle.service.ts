import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
    CreateRaffleDto,
    UpdateRaffleDto,
    RaffleDto,
    RaffleDetailDto,
    RaffleSummaryDto,
    SelectWinnerDto,
    RaffleEvaluationResultDto,
    RaffleDrawDto,
    TandaShuffleResultDto
} from '../models';

@Injectable({ providedIn: 'root' })
export class RaffleService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = environment.apiUrl;

    getRaffles(status?: string): Observable<RaffleSummaryDto[]> {
        const params: any = {};
        if (status) params.status = status;
        return this.http.get<RaffleSummaryDto[]>(`${this.apiUrl}/raffles`, { params });
    }

    getActiveRaffles(): Observable<RaffleSummaryDto[]> {
        return this.http.get<RaffleSummaryDto[]>(`${this.apiUrl}/raffles/active`);
    }

    getRaffleHistory(): Observable<RaffleSummaryDto[]> {
        return this.http.get<RaffleSummaryDto[]>(`${this.apiUrl}/raffles/history`);
    }

    getRaffleById(id: string): Observable<RaffleDetailDto> {
        return this.http.get<RaffleDetailDto>(`${this.apiUrl}/raffles/${id}`);
    }

    createRaffle(dto: CreateRaffleDto): Observable<RaffleDetailDto> {
        return this.http.post<RaffleDetailDto>(`${this.apiUrl}/raffles`, dto);
    }

    updateRaffle(id: string, dto: UpdateRaffleDto): Observable<RaffleDetailDto> {
        return this.http.put<RaffleDetailDto>(`${this.apiUrl}/raffles/${id}`, dto);
    }

    deleteRaffle(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/raffles/${id}`);
    }

    evaluateRaffle(id: string): Observable<RaffleEvaluationResultDto> {
        return this.http.post<RaffleEvaluationResultDto>(`${this.apiUrl}/raffles/${id}/evaluate`, {});
    }

    selectWinner(id: string, dto: SelectWinnerDto): Observable<RaffleDrawDto[]> {
        return this.http.post<RaffleDrawDto[]>(`${this.apiUrl}/raffles/${id}/select-winner`, dto);
    }

    announceWinner(id: string): Observable<RaffleDto> {
        return this.http.post<RaffleDto>(`${this.apiUrl}/raffles/${id}/announce`, {});
    }

    shuffleTandaTurns(id: string, dto: SelectWinnerDto): Observable<TandaShuffleResultDto> {
        return this.http.post<TandaShuffleResultDto>(`${this.apiUrl}/raffles/${id}/shuffle-tanda-turns`, dto);
    }
}
