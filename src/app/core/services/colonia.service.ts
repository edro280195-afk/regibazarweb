import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map } from 'rxjs';
import { ApiService } from './api.service';
import { ColoniaReportDto, ColoniaStatsDto } from '../models';
import html2canvas from 'html2canvas';

export interface NldColoniaInfo {
  name: string;
  lat: number;
  lng: number;
  keywords: string[];
}

// ── Matriz oficial de Regi Bazar en Nuevo Laredo ──
// C. Rio Indo 1601, Voluntad y Trabajo 3, 88177 Nuevo Laredo, Tamps.
export const REGIBY_DEPOT = {
  name: 'Pickup (Matriz Regi Bazar)',
  lat: 27.50884,
  lng: -99.56885,
  address: 'C. Rio Indo 1601, Voluntad y Trabajo 3, 88177 Nuevo Laredo, Tamps.'
};

export const NLD_COLONIAS_CATALOG: NldColoniaInfo[] = [
  // Matriz / Voluntad y Trabajo
  { name: 'Col. Voluntad y Trabajo', lat: 27.5120, lng: -99.5690, keywords: ['voluntad y trabajo', 'borreguera', 'la borreguera', 'voluntad', 'vyt'] },
  
  // Poniente
  { name: 'Col. Francisco Villa', lat: 27.4366, lng: -99.6078, keywords: ['francisco villa', 'pancho villa', 'fco villa'] },
  { name: 'Col. Buena Vista', lat: 27.5015, lng: -99.5550, keywords: ['buena vista', 'buenavista'] },
  { name: 'Col. Nueva Era', lat: 27.4808, lng: -99.5625, keywords: ['nueva era'] },
  { name: 'Villas de San Miguel', lat: 27.4740, lng: -99.6050, keywords: ['villas de san miguel', 'san miguel', 'villas de sn miguel', 'v. san miguel'] },
  { name: 'Fracc. El Campanario', lat: 27.4580, lng: -99.5910, keywords: ['campanario', 'el campanario'] },
  { name: 'Col. Solidaridad', lat: 27.4920, lng: -99.5870, keywords: ['solidaridad'] },
  { name: 'Col. La Fe', lat: 27.4790, lng: -99.5620, keywords: ['la fe', 'fracc la fe'] },
  { name: 'Col. Las Torres', lat: 27.4730, lng: -99.5480, keywords: ['torres', 'las torres'] },
  { name: 'Reservas Territoriales', lat: 27.4640, lng: -99.5760, keywords: ['reservas', 'reservas territoriales'] },
  { name: 'Col. 150 Aniversario', lat: 27.4790, lng: -99.6220, keywords: ['150 aniversario', 'aniversario'] },
  { name: 'Fracc. El Progreso', lat: 27.4700, lng: -99.6150, keywords: ['progreso', 'el progreso'] },
  { name: 'Col. Cavazos Lerma', lat: 27.4390, lng: -99.6050, keywords: ['cavazos lerma', 'cavazos', 'manuel cavazos'] },

  // Centro / Oriente
  { name: 'Sector Centro', lat: 27.4950, lng: -99.5075, keywords: ['centro', 'sector centro', 'primer cuadro'] },
  { name: 'Col. Madero', lat: 27.4880, lng: -99.5100, keywords: ['madero', 'fracc madero'] },
  { name: 'Col. Viveros', lat: 27.4940, lng: -99.4990, keywords: ['viveros'] },
  { name: 'Col. Jardín', lat: 27.4785, lng: -99.5130, keywords: ['jardin', 'jardín'] },
  { name: 'Col. Campestre', lat: 27.4690, lng: -99.5240, keywords: ['campestre', 'fracc campestre'] },
  { name: 'Col. Juárez', lat: 27.4840, lng: -99.5290, keywords: ['juarez', 'juárez', 'benito juarez', 'benito juárez'] },
  { name: 'Col. Guerrero', lat: 27.4770, lng: -99.5030, keywords: ['guerrero'] },
  { name: 'Col. Mirador', lat: 27.4610, lng: -99.5170, keywords: ['mirador', 'el mirador'] },
  { name: 'Col. San Rafael', lat: 27.4635, lng: -99.5060, keywords: ['san rafael'] },
  { name: 'Col. Palacios', lat: 27.4990, lng: -99.5330, keywords: ['palacios'] },
  { name: 'Col. Victoria', lat: 27.4910, lng: -99.5220, keywords: ['victoria'] },
  { name: 'Col. Hidalgo', lat: 27.4995, lng: -99.5220, keywords: ['hidalgo'] },
  { name: 'Col. Militar', lat: 27.4705, lng: -99.5090, keywords: ['militar', 'cuartel militar'] },
  { name: 'Col. Longoria', lat: 27.4850, lng: -99.5050, keywords: ['longoria'] },
  { name: 'Col. Hipódromo', lat: 27.4950, lng: -99.5400, keywords: ['hipodromo', 'hipódromo'] },
  { name: 'Col. 20 de Noviembre', lat: 27.4920, lng: -99.5140, keywords: ['20 de noviembre', 'veinte de noviembre'] },
  { name: 'Col. La Rosita', lat: 27.4890, lng: -99.5350, keywords: ['rosita', 'la rosita'] },

  // Sur
  { name: 'Infonavit Fundadores', lat: 27.4482, lng: -99.5114, keywords: ['fundadores', 'infonavit fundadores', 'infonavit'] },
  { name: 'Fracc. Los Fresnos', lat: 27.4465, lng: -99.5525, keywords: ['fresnos', 'los fresnos'] },
  { name: 'Col. Concordia', lat: 27.4370, lng: -99.5260, keywords: ['concordia', 'la concordia', 'haciendas de la concordia'] },
  { name: 'Col. Santa Fe', lat: 27.4470, lng: -99.5110, keywords: ['santa fe'] },
  { name: 'Col. Los Presidentes', lat: 27.4290, lng: -99.5360, keywords: ['presidentes', 'los presidentes'] },
  { name: 'Col. Roma', lat: 27.4570, lng: -99.5390, keywords: ['roma', 'fracc roma'] },
  { name: 'Col. Los Encinos', lat: 27.4310, lng: -99.5530, keywords: ['encinos', 'los encinos'] },
  { name: 'Col. Las Alamedas', lat: 27.4600, lng: -99.5560, keywords: ['alamedas', 'las alamedas'] },
  { name: 'Colinas del Sur', lat: 27.4140, lng: -99.5340, keywords: ['colinas del sur', 'colinas'] },
  { name: 'Fracc. Los Aztecas', lat: 27.4800, lng: -99.5360, keywords: ['aztecas', 'los aztecas'] },
  { name: 'Km 10 a Km 18', lat: 27.3800, lng: -99.5300, keywords: ['km 10', 'km 12', 'km 13', 'km 14', 'km 15', 'km 18', 'kilometro'] },
  { name: 'Fracc. Los Cántaros', lat: 27.4180, lng: -99.5390, keywords: ['cantaros', 'los cantaros', 'cántaros'] },
  { name: 'Col. ISSSTE', lat: 27.4700, lng: -99.5180, keywords: ['issste', 'fovissste'] },
  { name: 'Fracc. San José', lat: 27.4550, lng: -99.5150, keywords: ['san jose', 'san josé'] },
  { name: 'Fracc. Las Américas', lat: 27.4680, lng: -99.5380, keywords: ['americas', 'las americas', 'las américas'] },
  { name: 'Col. Alianza', lat: 27.4860, lng: -99.5530, keywords: ['alianza', 'alianza para la produccion'] },
  { name: 'Valles de San Agustín', lat: 27.4560, lng: -99.6120, keywords: ['valles de san agustin', 'san agustin', 'san agustín'] },
  { name: 'Valles de Anáhuac', lat: 27.4950, lng: -99.6200, keywords: ['valles de anahuac', 'anahuac', 'anáhuac'] }
];

export const ALL_CATALOG_KEYWORDS = NLD_COLONIAS_CATALOG
  .flatMap(c => c.keywords.map(kw => ({ colonia: c, keyword: kw, len: kw.length })))
  .sort((a, b) => b.len - a.len);

export const PINK_COQUETTE_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#fff1f4' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#831843' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#fbcfe8' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9d174d' }, { weight: 'bold' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#ffe4e6' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#fff5f7' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#fce7f3' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9d174d' }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: '#fecdd3' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#831843' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#fda4af' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#fb7185' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#701a75' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#f5d0fe' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#fbcfe8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#db2777' }] }
];

@Injectable({
  providedIn: 'root'
})
export class ColoniaService {
  private api = inject(ApiService);

  getColoniaReport(start?: string, end?: string, salesPeriodId?: number): Observable<ColoniaReportDto> {
    return this.api.getColoniaReport(start, end, salesPeriodId).pipe(
      catchError(() => this.computeFromClientsFallback())
    );
  }

  classifyAddress(address?: string | null, lat?: number | null, lng?: number | null, type?: string): {
    name: string;
    lat: number;
    lng: number;
    isPickup: boolean;
  } {
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

    for (const entry of ALL_CATALOG_KEYWORDS) {
      const normKw = this.normalize(entry.keyword);
      const regex = new RegExp(`\\b${normKw}\\b`, 'i');
      if (regex.test(norm)) {
        return { name: entry.colonia.name, lat: entry.colonia.lat, lng: entry.colonia.lng, isPickup: false };
      }
    }

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

        const groups = new Map<string, {
          name: string;
          ordersCount: number;
          clientsCount: number;
          lat: number;
          lng: number;
          isPickup: boolean;
          clientCoords: { lat: number; lng: number }[];
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
            isPickup: match.isPickup,
            clientCoords: []
          };

          current.ordersCount += weight;
          current.clientsCount += 1;
          if (c.latitude && c.longitude && c.latitude >= 27.20 && c.latitude <= 27.70 && c.longitude >= -99.75 && c.longitude <= -99.40) {
            current.clientCoords.push({ lat: c.latitude, lng: c.longitude });
          }
          groups.set(match.name, current);
        }

        // Las coordenadas de cada colonia provienen de su centroide geográfico catalogado exacto
        const totalOrders = totalPurchases || 1;

        // Separamos colonias nombradas válidas, otras colonias, y pickup
        const namedList = Array.from(groups.values())
          .filter(g => !g.isPickup && g.name !== 'Otras Colonias (NLD)')
          .sort((a, b) => b.ordersCount - a.ordersCount);

        const othersGroup = groups.get('Otras Colonias (NLD)');
        const pickupGroup = groups.get(REGIBY_DEPOT.name);

        let rankCounter = 1;
        const resultStats: ColoniaStatsDto[] = [];

        // 1. Colonias nombradas (Rank 1..N)
        for (const g of namedList) {
          resultStats.push({
            coloniaName: g.name,
            ordersCount: g.ordersCount,
            percentage: Number(((g.ordersCount / totalOrders) * 100).toFixed(1)),
            latitude: g.lat,
            longitude: g.lng,
            rank: rankCounter++,
            isPickup: false,
            clientsCount: g.clientsCount
          });
        }

        // 2. Otras Colonias (al final de las colonias, sin corona de reina)
        if (othersGroup) {
          resultStats.push({
            coloniaName: othersGroup.name,
            ordersCount: othersGroup.ordersCount,
            percentage: Number(((othersGroup.ordersCount / totalOrders) * 100).toFixed(1)),
            latitude: othersGroup.lat,
            longitude: othersGroup.lng,
            rank: rankCounter++,
            isPickup: false,
            clientsCount: othersGroup.clientsCount
          });
        }

        // 3. Pickup (Matriz Regi Bazar)
        if (pickupGroup) {
          resultStats.push({
            coloniaName: pickupGroup.name,
            ordersCount: pickupGroup.ordersCount,
            percentage: Number(((pickupGroup.ordersCount / totalOrders) * 100).toFixed(1)),
            latitude: REGIBY_DEPOT.lat,
            longitude: REGIBY_DEPOT.lng,
            rank: 0,
            isPickup: true,
            clientsCount: pickupGroup.clientsCount
          });
        }

        const totalPickupOrders = pickupGroup ? pickupGroup.ordersCount : 0;
        // La reina es la colonia nombrada #1
        const topColonia = resultStats.find(c => !c.isPickup && c.coloniaName !== 'Otras Colonias (NLD)') || resultStats[0];

        return {
          totalOrders,
          totalColoniaOrders: totalOrders - totalPickupOrders,
          totalPickupOrders,
          topColoniaName: topColonia?.coloniaName || 'Sin datos',
          topColoniaPercentage: topColonia?.percentage || 0,
          colonias: resultStats
        };
      })
    );
  }

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

    const canvas = await html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      backgroundColor: null,
      logging: false
    });

    const dataUrl = canvas.toDataURL('image/png');

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
      text.includes('regibazar matriz') ||
      text.includes('rio indo') ||
      text.includes('río indo') ||
      text.includes('indo 1601');
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
