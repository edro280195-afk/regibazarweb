import { Component, EventEmitter, Input, Output, OnInit, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GoogleMap } from '@angular/google-maps';

@Component({
  selector: 'app-address-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleMap],
  template: `
    <div class="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in" (click)="onCancel()">
      <div class="bg-white w-full max-w-2xl rounded-t-[2.5rem] sm:rounded-[2.5rem] h-[92vh] sm:h-[85vh] flex flex-col overflow-hidden animate-slide-up shadow-2xl" (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="px-6 pt-7 pb-4 shrink-0 relative">
          <div class="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full sm:hidden"></div>
          
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-2xl font-black text-pink-900 leading-tight">Magic Address Picker</h2>
              <p class="text-xs text-pink-400 font-bold uppercase tracking-widest mt-0.5">Ubica el punto exacto ✨</p>
            </div>
            <button class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-all" (click)="onCancel()">✕</button>
          </div>

          <!-- Search Bar -->
          <div class="relative group">
            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl group-focus-within:scale-110 transition-transform">🔍</span>
            <input #searchInput type="text" 
                   [(ngModel)]="searchText"
                   placeholder="Escribe la dirección o lugar..."
                   class="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-2 border-transparent focus:border-pink-300 focus:bg-white outline-none text-sm font-medium shadow-inner transition-all" />
          </div>
        </div>

        <!-- Map Area -->
        <div class="flex-1 relative bg-gray-100 min-h-0">
          <google-map height="100%" width="100%" 
                      [center]="center" 
                      [zoom]="17" 
                      [options]="mapOptions"
                      (centerChanged)="onCenterChanged()"
                      (mapInitialized)="onMapInit($event)">
          </google-map>

          <!-- Fixed Center Pin (The "Magic" part) -->
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center">
            <!-- Floating Label -->
            <div class="bg-pink-600 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg mb-2 animate-bounce uppercase tracking-tighter border-2 border-white">
              Suelte aquí
            </div>
            <!-- The Pin -->
            <div class="relative">
              <div class="w-8 h-8 bg-pink-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center">
                <div class="w-2 h-2 bg-white rounded-full"></div>
              </div>
              <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-4 bg-pink-500 shadow-lg"></div>
            </div>
            <div class="w-2 h-2 bg-black/20 rounded-full blur-[2px] mt-2 scale-x-150"></div>
          </div>

          <!-- Current Address Feedback -->
          <div class="absolute bottom-6 left-6 right-6 z-20 pointer-events-none">
            <div class="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-white flex items-center gap-4 animate-fade-in-up pointer-events-auto">
              <div class="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center text-2xl shrink-0 border border-pink-100 shadow-inner">
                📍
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-0.5">Ubicación Actual</p>
                @if (isGeocoding) {
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 border-2 border-pink-200 border-t-pink-500 rounded-full animate-spin"></div>
                    <p class="text-sm font-bold text-pink-900/40 italic">Buscando dirección...</p>
                  </div>
                } @else {
                  <p class="text-sm font-bold text-pink-900 truncate">{{ currentAddress || 'Mueve el mapa para buscar...' }}</p>
                }
              </div>
            </div>
          </div>

          <!-- My Location Button -->
          <button class="absolute top-4 right-4 z-20 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-2xl border border-gray-100 active:scale-95 transition-all"
                  (click)="useMyLocation()" title="Mi ubicación">
            🎯
          </button>
        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-6 bg-white border-t border-gray-100 shrink-0 flex gap-4">
          <button class="flex-1 py-4 rounded-2xl border-2 border-gray-100 text-gray-400 font-bold text-base hover:bg-gray-50 transition-all"
                  (click)="onCancel()">
            Cancelar
          </button>
          <button class="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-black text-base shadow-xl shadow-pink-200 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-30 disabled:shadow-none"
                  [disabled]="!currentAddress || isGeocoding"
                  (click)="onConfirm()">
            Confirmar Lugar ✨
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
    .animate-fade-in-up { animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }

    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class AddressPickerComponent implements OnInit, AfterViewInit {
  @Input() initialAddress: string = '';
  @Output() confirm = new EventEmitter<{ address: string, lat: number, lng: number }>();
  @Output() cancel = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  
  center: google.maps.LatLngLiteral = { lat: 27.4861, lng: -99.5069 }; // Default: NVO LAREDO
  searchText: string = '';
  currentAddress: string = '';
  isGeocoding: boolean = false;
  map!: google.maps.Map;

  mapOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    zoomControl: false,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    gestureHandling: 'greedy',
    styles: [
      { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
      { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
      { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
      { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] }
    ]
  };

  private geocoder = new google.maps.Geocoder();
  private debounceTimer: any;

  ngOnInit() {
    if (this.initialAddress) {
      this.searchText = this.initialAddress;
      this.geocodeInitial();
    }
  }

  ngAfterViewInit() {
    this.initAutocomplete();
  }

  onMapInit(map: google.maps.Map) {
    this.map = map;
  }

  private initAutocomplete() {
    if (typeof google === 'undefined') return;
    const autocomplete = new google.maps.places.Autocomplete(this.searchInput.nativeElement, {
      componentRestrictions: { country: 'mx' },
      fields: ['formatted_address', 'geometry'],
      types: ['address']
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        this.center = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        };
        this.currentAddress = place.formatted_address || '';
        this.searchText = this.currentAddress;
      }
    });
  }

  onCenterChanged() {
    if (!this.map) return;
    const newCenter = this.map.getCenter();
    if (!newCenter) return;

    this.isGeocoding = true;
    
    // Debounce geocoding
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.geocoder.geocode({ location: newCenter }, (results, status) => {
        this.isGeocoding = false;
        if (status === 'OK' && results && results[0]) {
          this.currentAddress = results[0].formatted_address;
          this.searchText = this.currentAddress;
        }
      });
    }, 600);
  }

  private geocodeInitial() {
    this.geocoder.geocode({ address: this.initialAddress + ', Nuevo Laredo, Tamaulipas' }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        this.center = {
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng()
        };
        this.currentAddress = results[0].formatted_address;
      }
    });
  }

  useMyLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        this.center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      });
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  onConfirm() {
    if (!this.map) return;
    const center = this.map.getCenter();
    if (center && this.currentAddress) {
      this.confirm.emit({
        address: this.currentAddress,
        lat: center.lat(),
        lng: center.lng()
      });
    }
  }
}
