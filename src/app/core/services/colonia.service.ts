import { Injectable, inject } from '@angular/core';
import { Observable, of, catchError, map } from 'rxjs';
import { ApiService } from './api.service';
import { ClientDto, ColoniaReportDto, ColoniaStatsDto } from '../models';
import html2canvas from 'html2canvas';

export interface NldColoniaInfo {
  name: string;
  lat: number;
  lng: number;
  keywords: string[];
}

export const REGIBY_DEPOT = {
  name: 'Pickup (Matriz Regi Bazar)',
  lat: 27.4861,
  lng: -99.5069,
  address: 'Nuevo Laredo, Tamaulipas (Punto de Entrega Oficial)'
};

export const NLD_COLONIAS_CATALOG: NldColoniaInfo[] = [
  { name: 'Col. Madero', lat: 27.4880, lng: -99.5100, keywords: ['madero', 'fracc madero'] },
  { name: 'Col. Viveros', lat: 27.4940, lng: -99.4990, keywords: ['viveros'] },
  { name: 'Col. Jardín', lat: 27.4785, lng: -99.5130, keywords: ['jardin', 'jardín'] },
  { name: 'Col. Campestre', lat: 27.4690, lng: -99.5240, keywords: ['campestre', 'fracc campestre'] },
  { name: 'Sector Centro', lat: 27.4950, lng: -99.5075, keywords: ['centro', 'sector centro', 'primer cuadro'] },
  { name: 'Col. Juárez', lat: 27.4840, lng: -99.5290, keywords: ['juarez', 'juárez', 'benito juarez', 'benito juárez'] },
  { name: 'Col. Guerrero', lat: 27.4770, lng: -99.5030, keywords: ['guerrero'] },
  { name: 'Col. Mirador', lat: 27.4610, lng: -99.5170, keywords: ['mirador', 'el mirador'] },
  { name: 'Col. San Rafael', lat: 27.4635, lng: -99.5060, keywords: ['san rafael'] },
  { name: 'Infonavit Fundadores', lat: 27.4520, lng: -99.5310, keywords: ['fundadores', 'infonavit fundadores'] },
  { name: 'Fracc. Los Fresnos', lat: 27.4420, lng: -99.5430, keywords: ['fresnos', 'los fresnos'] },
  { name: 'Col. Las Torres', lat: 27.4730, lng: -99.5480, keywords: ['torres', 'las torres'] },
  { name: 'Col. Buena Vista', lat: 27.4850, lng: -99.5440, keywords: ['buena vista', 'buenavista'] },
  { name: 'Col. La Fe', lat: 27.4790, lng: -99.5620, keywords: ['la fe', 'fracc la fe'] },
  { name: 'Col. Nueva Era', lat: 27.4860, lng: -99.5760, keywords: ['nueva era'] },
  { name: 'Col. Solidaridad', lat: 27.4920, lng: -99.5870, keywords: ['solidaridad'] },
  { name: 'Villas de San Miguel', lat: 27.4740, lng: -99.6050, keywords: ['villas de san miguel', 'san miguel'] },
  { name: 'Fracc. El Campanario', lat: 27.4580, lng: -99.5910, keywords: ['campanario', 'el campanario'] },
  { name: 'Col. Concordia', lat: 27.4370, lng: -99.5260, keywords: ['concordia', 'la concordia', 'haciendas de la concordia'] },
  { name: 'Col. Santa Fe', lat: 27.4470, lng: -99.5110, keywords: ['santa fe'] },
  { name: 'Col. Los Presidentes', lat: 27.4290, lng: -99.5360, keywords: ['presidentes', 'los presidentes'] },
  { name: 'Col. Palacios', lat: 27.4990, lng: -99.5330, keywords: ['palacios'] },
  { name: 'Col. Victoria', lat: 27.4910, lng: -99.5220, keywords: ['victoria'] },
  { name: 'Col. Hidalgo', lat: 27.4995, lng: -99.5220, keywords: ['hidalgo'] },
  { name: 'Col. Militar', lat: 27.4705, lng: -99.5090, keywords: ['militar', 'cuartel militar'] },
  { name: 'Col. Roma', lat: 27.4570, lng: -99.5390, keywords: ['roma', 'fracc roma'] },
  { name: 'Col. Los Encinos', lat: 27.4310, lng: -99.5530, keywords: ['encinos', 'los encinos'] },
  { name: 'Col. Las Alamedas', lat: 27.4600, lng: -99.5560, keywords: ['alamedas', 'las alamedas'] },
  { name: 'Col. 150 Aniversario', lat: 27.4790, lng: -99.6220, keywords: ['150 aniversario', 'aniversario'] },
  { name: 'Reservas Territoriales', lat: 27.4640, lng: -99.5760, keywords: ['reservas', 'reservas territoriales'] },
  { name: 'Colinas del Sur', lat: 27.4140, lng: -99.5340, keywords: ['colinas del sur', 'colinas'] },
  { name: 'Fracc. Los Aztecas', lat: 27.4800, lng: -99.5360, keywords: ['aztecas', 'los aztecas'] },
  { name: 'Col. Francisco Villa', lat: 27.4730, lng: -99.5350, keywords: ['francisco villa', 'pancho villa'] },
  { name: 'Col. Voluntad y Trabajo', lat: 27.4880, lng: -99.5650, keywords: ['voluntad y trabajo', 'borreguera', 'la borreguera'] },
  { name: 'Fracc. El Progreso', lat: 27.4700, lng: -99.6150, keywords: ['progreso', 'el progreso'] },
  { name: 'Km 10 a Km 18', lat: 27.3800, lng: -99.5300, keywords: ['km 10', 'km 12', 'km 13', 'km 14', 'km 15', 'km 18', 'kilometro'] },
  { name: 'Fracc. Los Cántaros', lat: 27.4180, lng: -99.5390, keywords: ['cantaros', 'los cantaros', 'cántaros'] },
  { name: 'Col. Longoria', lat: 27.4850, lng: -99.5050, keywords: ['longoria'] },
  { name: 'Col. ISSSTE', lat: 27.4700, lng: -99.5180, keywords: ['issste', 'fovissste'] },
  { name: 'Col. Hipódromo', lat: 27.4950, lng: -99.5400, keywords: ['hipodromo', 'hipódromo'] },
  { name: 'Fracc. San José', lat: 27.4550, lng: -99.5150, keywords: ['san jose', 'san josé'] },
  { name: 'Col. La Rosita', lat: 27.4890, lng: -99.5350, keywords: ['rosita', 'la rosita'] },
  { name: 'Fracc. Las Américas', lat: 27.4680, lng: -99.5380, keywords: ['americas', 'las americas', 'las américas'] },
  { name: 'Col. Alianza', lat: 27.4860, lng: -99.5530, keywords: ['alianza', 'alianza para la produccion'] },
  { name: 'Valles de San Agustín', lat: 27.4560, lng: -99.6120, keywords: ['valles de san agustin', 'san agustin', 'san agustín'] }
];

export const PINK_COQUETTE_MAP_STYLES: google.maps.MapTypeStyle[] = [
  // Fondo de tierra / paisaje en rosa suave pastel
  { elementType: 'geometry', stylers: [{ color: '#fff1f4' }] },
  // Ocultar íconos comerciales para un mapa súper limpio y aesthetic
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  // Texto de nombres de calles y colonias en magenta/vino profundo
  { elementType: 'labels.text.fill', stylers: [{ color: '#831843' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  // Zonas administrativas y límites
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#fbcfe8' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#f43f5e' }, { weight: 1.5 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#fb7185' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9d174d' }, { weight: 'bold' }] },
  // Parques y naturaleza en verde menta-rosado súper sutil
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#ffe4e6' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#9d174d' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#fff5f7' }] },
  // Calles locales en rosa claro
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#fce7f3' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9d174d' }] },
  // Arterias y avenidas principales en rosa coral
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fed7aa' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#fecdd3' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#831843' }] },
  // Carreteras y autopistas (e.g. Carretera Nacional / Blvd Colosio) en rosa fucsia
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fda4af' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#fb7185' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#701a75' }] },
  // Tránsito
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#f5d0fe' }] },
  // Agua (Río Bravo, presas y lagos) en rosa algodón de azúcar pastel
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#fbcfe8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#db2777' }] }
];

@Injectable({
  providedIn: 'root'
})
export class ColoniaService {
  private api = inject(ApiService);

  /**
   * Obtiene el reporte de colonias.
   * Llama al backend; si el endpoint en Render aún no está disponible (404/500),
   * calcula el reporte instantáneamente usando la lista de clientes locales.
   */
  getColoniaReport(start?: string, end?: string, salesPeriodId?: number): Observable<ColoniaReportDto> {
    return this.api.getColoniaReport(start, end, salesPeriodId).pipe(
      catchError(() => {
        // Fallback resiliente usando clientes capturados
        return this.computeFromClientsFallback();
      })
    );
  }

  /**
   * Clasifica una clienta o dirección en una colonia de Nuevo Laredo o Pickup
   */
  classifyAddress(address?: string | null, lat?: number | null, lng?: number | null, type?: string): {
    name: string;
    lat: number;
    lng: number;
    isPickup: boolean;
  } {
    // Si no tiene dirección capturada, o el texto indica pickup/recoge -> Pickup en Regi Bazar
    if (!address || !address.trim() || type === 'PickUp') {
      return {
        name: REGIBY_DEPOT.name,
        lat: REGIBY_DEPOT.lat,
        lng: REGIBY_DEPOT.lng,
        isPickup: true
      };
    }

    const norm = this.normalize(address);

    if (this.isPickupKeyword(norm)) {
      return {
        name: REGIBY_DEPOT.name,
        lat: REGIBY_DEPOT.lat,
        lng: REGIBY_DEPOT.lng,
        isPickup: true
      };
    }

    // Buscar coincidencia por palabras clave de colonia
    for (const c of NLD_COLONIAS_CATALOG) {
      for (const kw of c.keywords) {
        const normKw = this.normalize(kw);
        const regex = new RegExp(`\\b${normKw}\\b`, 'i');
        if (regex.test(norm)) {
          return { name: c.name, lat: c.lat, lng: c.lng, isPickup: false };
        }
      }
    }

    // Coincidencia por proximidad de coordenadas dentro de NLD
    if (lat && lng && lat >= 27.20 && lat <= 27.70 && lng >= -99.75 && lng <= -99.40) {
      let closest: NldColoniaInfo | null = null;
      let minDistance = Infinity;

      for (const c of NLD_COLONIAS_CATALOG) {
        const d = this.haversineKm(lat, lng, c.lat, c.lng);
        if (d < minDistance) {
          minDistance = d;
          closest = c;
        }
      }

      if (closest && minDistance <= 2.8) {
        return { name: closest.name, lat: closest.lat, lng: closest.lng, isPickup: false };
      }
    }

    return {
      name: 'Otras Colonias (NLD)',
      lat: 27.4861,
      lng: -99.5150,
      isPickup: false
    };
  }

  /**
   * Calcula el reporte a partir de las clientas cuando el backend no está disponible
   */
  private computeFromClientsFallback(): Observable<ColoniaReportDto> {
    return this.api.getClients().pipe(
      map(clients => {
        if (!clients || clients.length === 0) {
          return {
            totalOrders: 0,
            totalColoniaOrders: 0,
            totalPickupOrders: 0,
            topColoniaName: 'Sin datos',
            topColoniaPercentage: 0,
            colonias: []
          };
        }

        // Usamos el número de pedidos de cada clienta (o 1 si tiene 0 para representatividad)
        const groups = new Map<string, {
          name: string;
          ordersCount: number;
          clientsCount: number;
          lat: number;
          lng: number;
          isPickup: boolean;
        }>();

        let totalPurchases = 0;

        for (const c of clients) {
          const match = this.classifyAddress(c.address, c.latitude, c.longitude, c.type);
          const weight = Math.max(c.ordersCount || 1, 1);
          totalPurchases += weight;

          const current = groups.get(match.name) || {
            name: match.name,
            ordersCount: 0,
            clientsCount: 0,
            lat: match.lat,
            lng: match.lng,
            isPickup: match.isPickup
          };

          current.ordersCount += weight;
          current.clientsCount += 1;
          groups.set(match.name, current);
        }

        const sorted = Array.from(groups.values()).sort((a, b) => b.ordersCount - a.ordersCount);
        const totalOrders = totalPurchases || 1;

        let rank = 1;
        const coloniasStats: ColoniaStatsDto[] = sorted.map(g => ({
          coloniaName: g.name,
          ordersCount: g.ordersCount,
          percentage: Number(((g.ordersCount / totalOrders) * 100).toFixed(1)),
          latitude: g.lat,
          longitude: g.lng,
          rank: g.isPickup ? 0 : rank++,
          isPickup: g.isPickup,
          clientsCount: g.clientsCount
        }));

        const totalPickupOrders = sorted.filter(s => s.isPickup).reduce((sum, s) => sum + s.ordersCount, 0);
        const topColonia = coloniasStats.find(c => !c.isPickup) || coloniasStats[0];

        return {
          totalOrders,
          totalColoniaOrders: totalOrders - totalPickupOrders,
          totalPickupOrders,
          topColoniaName: topColonia?.coloniaName || 'Sin datos',
          topColoniaPercentage: topColonia?.percentage || 0,
          colonias: coloniasStats
        };
      })
    );
  }

  /**
   * Exporta un elemento HTML a imagen HD y permite compartir en redes sociales o descargar
   */
  async exportSocialImage(
    elementId: string,
    fileName: string,
    shareTitle: string,
    shareText: string
  ): Promise<{ success: boolean; shared: boolean }> {
    const el = document.getElementById(elementId);
    if (!el) {
      throw new Error(`Elemento #${elementId} no encontrado`);
    }

    // Renderizar con html2canvas en alta definición (escala 2.5)
    const canvas = await html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });

    const dataUrl = canvas.toDataURL('image/png');

    // Intentar compartir de forma nativa en móviles (iOS Safari / Android)
    if (navigator.share) {
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `${fileName}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: shareTitle,
            text: shareText
          });
          return { success: true, shared: true };
        }
      } catch (err) {
        console.log('Compartir nativo cancelado o no disponible:', err);
      }
    }

    // Descarga directa en Desktop o si se canceló el share
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${fileName}.png`;
    link.click();
    return { success: true, shared: false };
  }

  private isPickupKeyword(text: string): boolean {
    return text.includes('pickup') ||
      text.includes('pick up') ||
      text.includes('recoge') ||
      text.includes('pasa por') ||
      text.includes('pasan por') ||
      text.includes('pasa a') ||
      text.includes('en tienda') ||
      text.includes('en matriz') ||
      text.includes('sin direccion') ||
      text.includes('pasar a regibazar') ||
      text.includes('domicilio regibazar') ||
      text.includes('regibazar matriz');
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180.0;
    const dLon = (lon2 - lon1) * Math.PI / 180.0;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180.0) * Math.cos(lat2 * Math.PI / 180.0) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private normalize(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
