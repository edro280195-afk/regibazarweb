import { Injectable } from '@angular/core';
import html2canvas from 'html2canvas';

@Injectable({
  providedIn: 'root'
})
export class CouponService {

  constructor() { }

  async downloadCoupon(elementId: string, clientName: string): Promise<void> {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error('Elemento del cupón no encontrado');
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false
      });

      const image = canvas.toDataURL('image/png');
      
      // Intentar compartir si es móvil
      if (navigator.share) {
        const blob = await (await fetch(image)).blob();
        const file = new File([blob], `cupon_${clientName}.png`, { type: 'image/png' });
        
        try {
          await navigator.share({
            files: [file],
            title: 'Cupón de Cumpleaños Regi Bazar',
            text: `¡Felicidades ${clientName}! Aquí tienes tu regalo.`
          });
          return;
        } catch (err) {
          console.log('Compartir cancelado o no disponible', err);
        }
      }

      // Descarga normal como fallback o en desktop
      const link = document.createElement('a');
      link.href = image;
      link.download = `cupon_cumple_${clientName.replace(/\s+/g, '_')}.png`;
      link.click();
      
    } catch (error) {
      console.error('Error al generar la imagen del cupón:', error);
    }
  }
}
