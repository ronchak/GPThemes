# Runtime architecture

GPThemes uses two content-script entry points because they serve different latency budgets.

`src/js/inject-theme.js` is the prepaint path. It reads the saved theme and applies the minimum root classes and attributes once. It must remain synchronous, dependency-light, and free of observers.

`src/js/content.js` owns the long-lived runtime. It initializes theme synchronization immediately, waits for the document body before mounting extension UI, and remounts only the owned UI surface if ChatGPT removes it. Host-page mutations must not trigger full runtime teardown or reinitialization.

`src/js/app/themeManager.js` is the only persistent owner of theme state after prepaint. New theme behavior belongs there rather than in another root observer.

`src/js/app/custom-fab/index.js` owns the floating controls. The settings surface is intentionally created on first use so normal ChatGPT page loads do not render every settings tab or read every preference.

## Lifecycle rules

Every mounted module returns an idempotent cleanup function. A remount must clean the previous surface before attaching listeners or storage watchers again. Observers should watch the narrowest stable node and mutation type that can answer their question. A feature-specific DOM scan must never be attached to every mutation on the entire ChatGPT document.

## Performance rules

The prepaint path may not import the settings or feature graph. Page-specific behavior should activate only on the relevant route. Expensive DOM queries should be incremental or explicitly scheduled, and normal token streaming must not cause a full-page scan.
