import { Injectable, inject } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { PosStateService } from './pos-state.service';
import { Order } from '../models/pos.models';

@Injectable({
  providedIn: 'root'
})
export class PosSignalRService {
  private posState = inject(PosStateService);
  private hubConnection: signalR.HubConnection | null = null;

  constructor() {}

  startConnection(): Promise<void> {
    const hubUrl = environment.hubUrl.replace('/delivery', '/pos');
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => localStorage.getItem('token') || ''
      })
      .withAutomaticReconnect()
      .build();

    this.registerListeners();

    return this.hubConnection
      .start()
      .then(() => console.log('✅ Conectado al PosHub'))
      .catch(err => {
        console.error('❌ Error al conectar al PosHub: ' + err);
        throw err;
      });
  }

  private registerListeners() {
    if (!this.hubConnection) return;

    // Cuando un empleado escanea algo (Satelite -> Hub -> Nodriza)
    this.hubConnection.on('OrderCreated', (order: Order) => {
      console.log('Hub: OrderCreated', order);
      this.posState.updateOrder(order);
    });

    this.hubConnection.on('OrderPaid', (data: any) => {
      console.log('Hub: OrderPaid', data);
      this.posState.removeOrder(data.orderId);
    });
  }

  joinOrderGroup(orderId: number) {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('JoinOrderGroup', orderId);
    }
  }

  joinNodrizaGroup() {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      this.hubConnection.invoke('JoinNodrizaGroup');
    }
  }

  stopConnection() {
    this.hubConnection?.stop();
  }
}
