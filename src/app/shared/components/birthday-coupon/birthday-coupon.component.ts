import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-birthday-coupon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './birthday-coupon.component.html',
  styleUrls: ['./birthday-coupon.component.css']
})
export class BirthdayCouponComponent {
  @Input() clientName: string = 'Clienta';
  @Input() couponValue: number = 200;
  
  get today(): string {
    const date = new Date();
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  get expirationDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
