import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class SearchService {
    searchTerm = signal('');

    updateSearch(term: string) {
        this.searchTerm.set(term);
    }

    clear() {
        this.searchTerm.set('');
    }
}
