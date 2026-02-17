
import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

type BearState = 'hidden' | 'peeking' | 'waving' | 'kissing' | 'eating';
type BearPosition = 'bottom-right' | 'bottom-left';

@Component({
  selector: 'app-easter-egg',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="easter-egg-container" [class]="currentPos()">
      
      <!-- 🐻 EL OSITO -->
      <div class="bear-wrapper" [attr.data-state]="currentState()">
        
        <!-- SVG BEAR -->
        <svg class="bear-svg" viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
          <!-- Body/Head Shape -->
          <path d="M40,160 C40,100 160,100 160,160 L160,200 L40,200 Z" fill="#D2B48C"/> <!-- Body base -->
          <circle cx="50" cy="50" r="25" fill="#D2B48C"/> <!-- Left Ear -->
          <circle cx="150" cy="50" r="25" fill="#D2B48C"/> <!-- Right Ear -->
          <circle cx="50" cy="50" r="15" fill="#C19A6B"/> <!-- Inner Ear L -->
          <circle cx="150" cy="50" r="15" fill="#C19A6B"/> <!-- Inner Ear R -->
          <ellipse cx="100" cy="90" rx="70" ry="60" fill="#D2B48C"/> <!-- Head -->
          
          <!-- Snout -->
          <ellipse cx="100" cy="100" rx="25" ry="20" fill="#FFE4C4"/>
          <circle cx="100" cy="95" r="8" fill="#5D4037"/> <!-- Nose -->
          <path d="M100,103 L100,115 M92,110 Q100,120 108,110" stroke="#5D4037" stroke-width="3" fill="none"/> <!-- Mouth -->

          <!-- Eyes -->
          <circle cx="75" cy="80" r="5" fill="#333">
            <animate attributeName="ry" values="5;0.5;5" dur="4s" repeatCount="indefinite" />
          </circle>
          <circle cx="125" cy="80" r="5" fill="#333">
            <animate attributeName="ry" values="5;0.5;5" dur="4s" repeatCount="indefinite" />
          </circle>

          <!-- Cheeks -->
          <circle cx="60" cy="105" r="8" fill="#FFB6C1" opacity="0.6"/>
          <circle cx="140" cy="105" r="8" fill="#FFB6C1" opacity="0.6"/>

          <!-- Bow (Moño Coquette) -->
          <path d="M85,35 Q100,50 115,35 L125,20 Q100,30 75,20 Z" fill="#FF69B4"/>
          <circle cx="100" cy="35" r="8" fill="#FF1493"/>

          <!-- Arm/Paw (Waving) -->
          <g class="paw-wave" *ngIf="currentState() === 'waving'">
             <circle cx="180" cy="120" r="18" fill="#D2B48C"/>
             <circle cx="180" cy="120" r="8" fill="#FFE4C4"/>
          </g>

          <!-- Kiss Heart -->
          <g class="kiss-heart" *ngIf="currentState() === 'kissing'">
             <path d="M100,100 q-10,-20 -20,0 q-10,20 20,40 q 30,-20 20,-40 q-10,-20 -20,0" fill="#FF1493" transform="translate(40, -40) scale(0.6)"/>
          </g>
        </svg>

        <!-- 🍯 HONEY POT -->
        @if (showHoney()) {
          <div class="honey-pot">
            <svg viewBox="0 0 100 100">
               <path d="M20,40 Q20,90 50,90 Q80,90 80,40 L80,30 Q80,20 50,20 Q20,20 20,30 Z" fill="#FFD700"/>
               <rect x="25" y="45" width="50" height="20" fill="#FFF8DC"/>
               <text x="50" y="60" font-family="cursive" font-weight="bold" font-size="12" text-anchor="middle" fill="#8B4513">Miel 🍯</text>
               <path d="M30,30 Q50,0 70,30" fill="#FFD700" opacity="0.8"/> <!-- Overflowing honey -->
            </svg>
          </div>
        }

      </div>

    </div>
  `,
  styles: [`
    .easter-egg-container {
      position: fixed; z-index: 9999; pointer-events: none;
      bottom: -150px; /* Start hidden */
      transition: bottom 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    .bottom-right { right: 30px; }
    .bottom-left  { left: 30px; }

    .bear-wrapper {
      position: relative; width: 140px; height: 140px;
      &[data-state='peeking'], &[data-state='waving'], &[data-state='kissing'] {
        transform: translateY(-110px); /* Move up */
      }
    }

    /* STATES */
    .easter-egg-container:has([data-state='hidden']) { bottom: -180px; }
    .easter-egg-container:not(:has([data-state='hidden'])) { bottom: -10px; }

    /* ANIMATIONS */
    .paw-wave {
      transform-origin: 160px 140px;
      animation: wavePaw 1s ease-in-out infinite;
    }
    @keyframes wavePaw {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(20deg) translate(5px, -10px); }
    }

    .kiss-heart {
      animation: floatHeart 1.5s ease-out forwards;
      opacity: 0;
    }
    @keyframes floatHeart {
      0% { transform: translate(20px, 0px) scale(0.5); opacity: 0; }
      20% { opacity: 1; transform: translate(30px, -20px) scale(1); }
      100% { transform: translate(60px, -80px) scale(1.2); opacity: 0; }
    }

    .honey-pot {
      position: absolute; bottom: 0; left: -30px; width: 50px; height: 50px;
      animation: potBounce 2s infinite ease-in-out;
    }
    @keyframes potBounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
  `]
})
export class EasterEggComponent implements OnInit {
  currentState = signal<BearState>('hidden');
  currentPos = signal<BearPosition>('bottom-right');
  showHoney = signal(false);

  // Intervalos (20 min = 1200000ms)
  private minTime = 1200000;
  private maxTime = 1200000; // Fixed 20 min or range? User said "cada 20 minutos". Let's make it fixed or slight range.
  // Let's use range 20-25 mins to be organic.
  // actually user said "Ponle cada 20 minutos".
  // I will use 20 mins approx.


  ngOnInit() {
    this.scheduleNext_appearance();
  }

  scheduleNext_appearance() {
    const delay = Math.random() * (this.maxTime - this.minTime) + this.minTime;
    // const delay = 5000; // Debug: 5s
    setTimeout(() => {
      this.triggerEvent();
    }, delay);
  }

  triggerEvent() {
    // 1. Choose Position
    this.currentPos.set(Math.random() > 0.5 ? 'bottom-right' : 'bottom-left');

    // 2. Choose Action
    const actions: BearState[] = ['peeking', 'waving', 'kissing'];
    if (Math.random() > 0.7) this.showHoney.set(true); // 30% chance of honey pot

    const action = actions[Math.floor(Math.random() * actions.length)];
    this.currentState.set(action);

    // 3. Hide after few seconds
    setTimeout(() => {
      this.currentState.set('hidden');
      this.showHoney.set(false);
      this.scheduleNext_appearance();
    }, 6000); // Visible for 6s
  }
}
