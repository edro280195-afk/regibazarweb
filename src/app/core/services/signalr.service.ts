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
  orderConfirmed$ = new Subject<{ orderId: number, clientName: string, newStatus: string }>();
  clientChatUpdate$ = new Subject<any>();
  adminChatUpdate$ = new Subject<any>();

  constructor(private auth: AuthService) { }

  async connect(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected) return;

    const token = this.auth.getToken();

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        accessTokenFactory: () => token || ''
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on('ReceiveLocation', (routeId: number, lat: number, lng: number) => {
      const locationData: LocationUpdate = {
        latitude: lat,
        longitude: lng,
        timestamp: new Date().toISOString()
      };

      this.locationUpdate$.next(locationData);
    });

    this.connection.on('ReceiveChatMessage', (msg: any) => {
      this.adminChatUpdate$.next(msg);
    });

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

    this.connection.on('OrderConfirmed', (data: any) => {
      this.orderConfirmed$.next(data);
    });

    this.connection.on('ReceiveClientChatMessage', (msg: any) => {
      this.clientChatUpdate$.next(msg);
    });

    await this.connection.start();
    this.joinAdminGroup();
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

    this.connection.on('ReceiveClientChatMessage', (msg: any) => {
      this.clientChatUpdate$.next(msg);
    });

    await this.connection.start();
  }

  async joinOrder(accessToken: string): Promise<void> {
    await this.connection?.invoke('JoinOrder', accessToken);
  }


  async joinAdminGroup(): Promise<void> {
    console.log('Joining Admin Group...');
    await this.connection?.invoke('JoinAdminGroup');
  }

  async joinRoute(driverToken: string): Promise<void> {
    await this.connection?.invoke('JoinRoute', driverToken);
  }

  async disconnect(): Promise<void> {
    await this.connection?.stop();
    this.connection = null;
  }
}

