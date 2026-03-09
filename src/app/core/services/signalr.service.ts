import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';

export interface LocationUpdate {
    latitude: number;
    longitude: number;
    timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class SignalRService {
    private connection: signalR.HubConnection | null = null;
    private connectionPromise: Promise<void> | null = null;

    locationUpdate$ = new Subject<{ driverToken?: string; latitude: number; longitude: number }>();
    deliveryUpdate$ = new Subject<any>();
    routeUpdated$ = new Subject<void>();
    messageReceived$ = new Subject<{ group: string; data: any }>();

    // Compatibility subjects (keep for now to avoid breaking existing code)
    adminChatUpdate$ = new Subject<any>();
    clientChatUpdate$ = new Subject<any>();

    async connect(): Promise<void> {
        if (this.connection?.state === signalR.HubConnectionState.Connected) return;
        if (this.connectionPromise) return this.connectionPromise;

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(environment.hubUrl)
            .withAutomaticReconnect()
            .build();

        // New Unified Events
        this.connection.on('ReceiveLocation', (driverToken: string, lat: number, lng: number) => {
            this.locationUpdate$.next({ driverToken, latitude: lat, longitude: lng });
        });

        this.connection.on('LocationUpdate', (data: any) => {
            this.locationUpdate$.next(data);
        });

        this.connection.on('ReceiveMessage', (data: any) => {
            this.messageReceived$.next({ group: '', data }); // group logic if needed
            // Map to old subjects for compatibility
            if (data.type === 'admin') this.adminChatUpdate$.next(data);
            else if (data.type === 'client') this.clientChatUpdate$.next(data);
        });

        this.connection.on('DeliveryUpdate', (data: any) => this.deliveryUpdate$.next(data));
        this.connection.on('OrderConfirmed', (data: any) => this.deliveryUpdate$.next({ ...data, type: 'Confirmed' }));
        this.connection.on('RouteUpdated', () => this.routeUpdated$.next());

        this.connectionPromise = this.connection.start()
            .then(() => { this.connectionPromise = null; })
            .catch(err => { this.connectionPromise = null; throw err; });

        return this.connectionPromise;
    }

    async joinRoute(driverToken: string): Promise<void> {
        await this.ensureConnected();
        await this.connection?.invoke('JoinRoute', driverToken);
    }

    async joinOrder(accessToken: string): Promise<void> {
        await this.ensureConnected();
        await this.connection?.invoke('JoinOrder', accessToken);
    }

    async joinAdminGroup(): Promise<void> {
        await this.ensureConnected();
        await this.connection?.invoke('JoinAdminGroup');
    }

    async reportLocation(driverToken: string, lat: number, lng: number): Promise<void> {
        await this.ensureConnected();
        await this.connection?.invoke('ReportLocation', driverToken, lat, lng);
    }

    private async ensureConnected(): Promise<void> {
        if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
            await this.connect();
        }
    }

    async disconnect(): Promise<void> {
        await this.connection?.stop();
        this.connection = null;
    }
}
