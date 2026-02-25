import { Component, OnInit, signal, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ApiService } from '../../../../core/services/api.service';
import { OrderSummary, Client } from '../../../../shared/models/models';

interface SearchResult {
  type: 'order' | 'client';
  id: number;
  clientId?: number;
  clientName?: string;
  title: string;
  subtitle: string;
  icon: string;
}

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-wrapper" #searchWrapper>
      <div class="search-input-container">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          [(ngModel)]="searchTerm"
          (ngModelChange)="onSearchChange($event)"
          (focus)="onFocus()"
          (keydown.escape)="closeDropdown()"
          (keydown.arrowdown)="navigateResults(1, $event)"
          (keydown.arrowup)="navigateResults(-1, $event)"
          (keydown.enter)="selectHighlighted()"
          placeholder="Buscar pedidos, clientas..."
          class="search-input"
        >
        @if (searchTerm) {
          <button class="clear-btn" (click)="clearSearch()">✕</button>
        }
      </div>

      @if (showDropdown()) {
        <div class="search-dropdown">
          @if (loading()) {
            <div class="dropdown-loading">
              <span class="mini-spinner"></span> Buscando...
            </div>
          } @else if (orderResults().length === 0 && clientResults().length === 0) {
            <div class="dropdown-empty">
              <span>😿</span> No se encontraron resultados
            </div>
          } @else {
            @if (orderResults().length > 0) {
              <div class="result-group">
                <span class="group-label">📦 Pedidos</span>
                @for (r of orderResults(); track r.id; let i = $index) {
                  <div class="result-item"
                       [class.highlighted]="highlightedIndex() === i"
                       (click)="goToResult(r)"
                       (mouseenter)="highlightedIndex.set(i)">
                    <span class="result-icon">{{ r.icon }}</span>
                    <div class="result-info">
                      <span class="result-title">{{ r.title }}</span>
                      <span class="result-subtitle">{{ r.subtitle }}</span>
                    </div>
                  </div>
                }
              </div>
            }
            @if (clientResults().length > 0) {
              <div class="result-group">
                <span class="group-label">👤 Clientas</span>
                @for (r of clientResults(); track r.id; let i = $index) {
                  <div class="result-item"
                       [class.highlighted]="highlightedIndex() === (orderResults().length + i)"
                       (click)="goToResult(r)"
                       (mouseenter)="highlightedIndex.set(orderResults().length + i)">
                    <span class="result-icon">{{ r.icon }}</span>
                    <div class="result-info">
                      <span class="result-title">{{ r.title }}</span>
                      <span class="result-subtitle">{{ r.subtitle }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .search-wrapper { position: relative; flex: 1; max-width: 400px; z-index: 1050; }

    .search-input-container {
      display: flex; align-items: center; gap: 8px;
      background: var(--bg-card, rgba(255,255,255,0.6));
      border: 1px solid var(--border-soft, #f3e8ee);
      border-radius: 24px; padding: 0 14px; height: 38px;
      transition: all 0.25s;
      &:focus-within {
        border-color: var(--pink-300, #f9a8d4);
        box-shadow: var(--shadow-sm, 0 2px 8px rgba(236,72,153,0.1));
        background: white;
      }
    }

    .search-icon { font-size: 0.9rem; opacity: 0.5; }

    .search-input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 0.85rem; font-family: inherit; color: var(--text-dark, #333);
      &::placeholder { color: var(--text-muted, #bbb); }
    }

    .clear-btn {
      background: none; border: none; color: var(--text-muted, #bbb);
      cursor: pointer; font-size: 0.8rem; padding: 2px;
      &:hover { color: var(--pink-500, #ec4899); }
    }

    .search-dropdown {
      position: absolute; top: calc(100% + 8px); left: 0; right: 0;
      background: white; border-radius: 16px;
      border: 1px solid var(--border-soft, #f3e8ee);
      box-shadow: var(--shadow-md, 0 8px 30px rgba(0,0,0,0.12));
      max-height: 400px; overflow-y: auto; z-index: 200;
      animation: dropIn 0.2s ease;
      z-index: 9999;
    }
    @keyframes dropIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

    .dropdown-loading, .dropdown-empty {
      padding: 1.5rem; text-align: center; color: var(--text-muted, #bbb);
      font-size: 0.85rem; font-weight: 600;
    }
    .mini-spinner {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid var(--pink-200, #fbcfe8); border-top-color: var(--pink-500, #ec4899);
      border-radius: 50%; animation: spin 0.6s linear infinite; vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .result-group { padding: 8px 0; }
    .result-group + .result-group { border-top: 1px solid var(--border-soft, #f3e8ee); }

    .group-label {
      display: block; padding: 4px 16px 6px;
      font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
      color: var(--text-muted, #bbb); letter-spacing: 0.5px;
    }

    .result-item {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 16px; cursor: pointer; transition: background 0.15s;
      &:hover, &.highlighted { background: var(--bg-main, #fff5f7); }
    }

    .result-icon {
      width: 32px; height: 32px; border-radius: 10px;
      background: var(--bg-main, #fff5f7);
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem; flex-shrink: 0;
    }

    .result-info { display: flex; flex-direction: column; min-width: 0; }

    .result-title {
      font-size: 0.85rem; font-weight: 700; color: var(--text-dark, #333);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .result-subtitle {
      font-size: 0.75rem; color: var(--text-muted, #bbb); font-weight: 500;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    @media (max-width: 600px) {
      .search-wrapper { max-width: 100%; }
    }
  `]
})
export class GlobalSearchComponent implements OnInit {
  @ViewChild('searchWrapper') wrapperEl!: ElementRef;

  searchTerm = '';
  showDropdown = signal(false);
  loading = signal(false);
  highlightedIndex = signal(-1);
  orderResults = signal<SearchResult[]>([]);
  clientResults = signal<SearchResult[]>([]);

  private allOrders: OrderSummary[] = [];
  private allClients: Client[] = [];
  private search$ = new Subject<string>();
  private dataLoaded = false;

  constructor(private api: ApiService, private router: Router) { }

  ngOnInit() {
    // Load data cache
    this.api.getOrders().subscribe(o => { this.allOrders = o; this.dataLoaded = true; });
    this.api.getClients().subscribe(c => { this.allClients = c; this.dataLoaded = true; });

    // Debounce search
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(term => this.performSearch(term));
  }

  onSearchChange(term: string) {
    if (!term.trim()) {
      this.clearResults();
      return;
    }
    this.loading.set(true);
    this.showDropdown.set(true);
    this.search$.next(term.trim().toLowerCase());
  }

  onFocus() {
    if (this.searchTerm.trim()) {
      this.showDropdown.set(true);
    }
  }

  private performSearch(term: string) {
    const t = term.toLowerCase();

    // Search orders by clientName or id
    const matchedOrders = this.allOrders
      .filter(o =>
        o.clientName.toLowerCase().includes(t) ||
        o.id.toString().includes(t)
      )
      .slice(0, 5)
      .map(o => ({
        type: 'order' as const,
        id: o.id,
        clientId: o.clientId,
        clientName: o.clientName,
        title: `#${o.id} — ${o.clientName}`,
        subtitle: `$${o.total.toLocaleString()} · ${o.status}`,
        icon: o.status === 'Delivered' ? '✅' : o.status === 'Pending' ? '⏳' : '🚗'
      }));

    // Search clients by name or phone
    const matchedClients = this.allClients
      .filter(c =>
        c.name.toLowerCase().includes(t) ||
        (c.phone && c.phone.includes(t))
      )
      .slice(0, 5)
      .map(c => ({
        type: 'client' as const,
        id: c.id,
        title: c.name,
        subtitle: `${c.phone || 'Sin tel.'} · ${c.orderCount} pedidos`,
        icon: c.type === 'Frecuente' ? '💎' : '🌱'
      }));

    this.orderResults.set(matchedOrders);
    this.clientResults.set(matchedClients);
    this.highlightedIndex.set(-1);
    this.loading.set(false);
  }

  goToResult(result: SearchResult) {
    this.closeDropdown();
    this.searchTerm = '';
    if (result.type === 'order') {
      if (result.clientId) {
        this.router.navigate(['/admin/clients', result.clientId], { queryParams: { orderId: result.id } });
      } else {
        const match = this.allClients.find(c => c.name.trim().toLowerCase() === (result.clientName || '').trim().toLowerCase());
        if (match) {
          this.router.navigate(['/admin/clients', match.id], { queryParams: { orderId: result.id } });
        } else {
          this.router.navigate(['/admin/clients', 0], { queryParams: { orderId: result.id } });
        }
      }
    } else {
      this.router.navigate(['/admin/clients', result.id]);
    }
  }

  navigateResults(delta: number, event: Event) {
    event.preventDefault();
    const total = this.orderResults().length + this.clientResults().length;
    if (total === 0) return;
    let idx = this.highlightedIndex() + delta;
    if (idx < 0) idx = total - 1;
    if (idx >= total) idx = 0;
    this.highlightedIndex.set(idx);
  }

  selectHighlighted() {
    const idx = this.highlightedIndex();
    const orders = this.orderResults();
    const clients = this.clientResults();
    if (idx < 0) return;
    if (idx < orders.length) {
      this.goToResult(orders[idx]);
    } else {
      const clientIdx = idx - orders.length;
      if (clientIdx < clients.length) {
        this.goToResult(clients[clientIdx]);
      }
    }
  }

  closeDropdown() {
    this.showDropdown.set(false);
    this.highlightedIndex.set(-1);
  }

  clearSearch() {
    this.searchTerm = '';
    this.clearResults();
  }

  private clearResults() {
    this.orderResults.set([]);
    this.clientResults.set([]);
    this.showDropdown.set(false);
    this.loading.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.wrapperEl && !this.wrapperEl.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }
}
