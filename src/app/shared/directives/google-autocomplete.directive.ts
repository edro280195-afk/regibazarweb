import { Directive, ElementRef, EventEmitter, Output, OnInit, NgZone } from '@angular/core';

@Directive({
    selector: '[appGoogleAutocomplete]',
    standalone: true
})
export class GoogleAutocompleteDirective implements OnInit {
    @Output() onAddressChange = new EventEmitter<any>();

    constructor(private el: ElementRef, private ngZone: NgZone) { }

    ngOnInit() {
        if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
            console.warn('Google Maps Places API not loaded');
            return;
        }

        const autocomplete = new google.maps.places.Autocomplete(this.el.nativeElement, {
            componentRestrictions: { country: 'mx' },
            fields: ['address_components', 'geometry', 'formatted_address']
        });

        autocomplete.addListener('place_changed', () => {
            this.ngZone.run(() => {
                const place = autocomplete.getPlace();
                if (!place.geometry || !place.geometry.location) {
                    return;
                }

                const result = {
                    address: place.formatted_address,
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                    components: place.address_components
                };

                this.onAddressChange.emit(result);
            });
        });
    }
}
