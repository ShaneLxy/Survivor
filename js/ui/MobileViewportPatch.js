(function() {
    const root = document.documentElement;

    function getViewportSize() {
        const visualViewport = window.visualViewport;
        const width = Math.round(visualViewport?.width || window.innerWidth || root.clientWidth || 0);
        const height = Math.round(visualViewport?.height || window.innerHeight || root.clientHeight || 0);
        return { width, height };
    }

    function syncViewportVars() {
        const { width, height } = getViewportSize();
        if (width > 0) {
            root.style.setProperty('--app-viewport-width', `${width}px`);
        }
        if (height > 0) {
            root.style.setProperty('--app-viewport-height', `${height}px`);
        }
        root.classList.toggle('is-compact-height', height > 0 && height <= 700);
        root.classList.toggle('is-short-height', height > 0 && height <= 640);
        root.classList.toggle('is-narrow-width', width > 0 && width <= 380);
    }

    syncViewportVars();

    let rafId = 0;
    function requestSync() {
        if (rafId) {
            cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
            rafId = 0;
            syncViewportVars();
        });
    }

    window.addEventListener('resize', requestSync, { passive: true });
    window.addEventListener('orientationchange', requestSync, { passive: true });
    window.visualViewport?.addEventListener('resize', requestSync, { passive: true });
    window.visualViewport?.addEventListener('scroll', requestSync, { passive: true });
})();
