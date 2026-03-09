import { Directive, ElementRef, EventEmitter, OnInit, Output, OnDestroy } from '@angular/core';

declare var google: any;

@Directive({
    selector: '[appGoogleAutocomplete]',
    standalone: true
})
export class GoogleAutocompleteDirective implements OnInit, OnDestroy {
    @Output() placeChanged = new EventEmitter<string>();
    private autocomplete: any;
    private listener: any;

    constructor(private el: ElementRef) { }

    ngOnInit() {
        if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
            console.warn('Google Maps Places API not loaded');
            return;
        }

        this.autocomplete = new google.maps.places.Autocomplete(this.el.nativeElement, {
            types: ['address'],
            componentRestrictions: { country: 'mx' } // Restrict to Mexico since it's Regi Bazar
        });

        this.listener = this.autocomplete.addListener('place_changed', () => {
            const place = this.autocomplete.getPlace();
            if (place && place.formatted_address) {
                this.placeChanged.emit(place.formatted_address);
            }
        });

        // Prevent enter from submitting forms when selecting address
        this.el.nativeElement.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
    }

    ngOnDestroy() {
        if (this.listener && typeof google !== 'undefined') {
            google.maps.event.removeListener(this.listener);
        }
    }
}
