import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('SW Registered ✨', reg))
        .catch(err => console.error('SW Registration failed ❌', err));
    }
  })
  .catch((err) => console.error(err));
