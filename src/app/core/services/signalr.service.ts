import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private connection: signalR.HubConnection | null = null;

  locationUpdate$ = new Subject<LocationUpdate>();
  deliveryUpdate$ = new Subject<any>();
  routeCompleted$ = new Subject<any>();

  constructor(private auth: AuthService) {}

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) return;

    const token = this.auth.getToken();

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        accessTokenFactory: () => token || ''
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on('LocationUpdate', (data: LocationUpdate) => {
      this.locationUpdate$.next(data);
    });

    this.connection.on('DriverLocation', (data: any) => {
      this.locationUpdate$.next(data);
    });

    this.connection.on('DeliveryUpdate', (data: any) => {
      this.deliveryUpdate$.next(data);
    });

    this.connection.on('DeliveryCompleted', (data: any) => {
      this.deliveryUpdate$.next(data);
    });

    this.connection.on('DeliveryFailed', (data: any) => {
      this.deliveryUpdate$.next(data);
    });

    this.connection.on('RouteCompleted', (data: any) => {
      this.routeCompleted$.next(data);
    });

    await this.connection.start();
  }

  async connectPublic(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) return;

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl)
      .withAutomaticReconnect()
      .build();

    this.connection.on('LocationUpdate', (data: LocationUpdate) => {
      this.locationUpdate$.next(data);
    });

    this.connection.on('DeliveryUpdate', (data: any) => {
      this.deliveryUpdate$.next(data);
    });

    await this.connection.start();
  }

  async joinOrder(accessToken: string): Promise<void> {
    await this.connection?.invoke('JoinOrder', accessToken);
  }

  async joinAdmin(): Promise<void> {
    await this.connection?.invoke('JoinAdmin');
  }

  async joinRoute(driverToken: string): Promise<void> {
    await this.connection?.invoke('JoinRoute', driverToken);
  }

  async disconnect(): Promise<void> {
    await this.connection?.stop();
    this.connection = null;
  }
}
