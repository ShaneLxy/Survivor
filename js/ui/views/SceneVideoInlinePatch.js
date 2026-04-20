(function() {
    const isRiskyMobileVideoEnv = () => {
        const ua = navigator.userAgent || '';
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
        const isWechat = /MicroMessenger/i.test(ua);
        const isX5 = /MQQBrowser|QQBrowser|TBS|QBCore/i.test(ua);
        const isCapacitor = Boolean(window.Capacitor);
        return isMobile && (isWechat || isX5 || isCapacitor);
    };

    const replaceSceneVideoWithImage = (hostElement) => {
        const video = hostElement?.querySelector('.scene-loop-media');
        if (!(video instanceof HTMLVideoElement)) {
            return;
        }

        const source = video.querySelector('source');
        const mediaSrc = video.getAttribute('data-mobile-fallback-src') || video.getAttribute('poster');
        if (!mediaSrc) {
            return;
        }

        const image = document.createElement('img');
        image.className = video.className;
        image.src = mediaSrc;
        image.alt = '';
        image.setAttribute('data-media-fallback-from', source?.getAttribute('src') || '');
        video.replaceWith(image);
    };

    const patchSceneVideoPlayback = (ViewClass) => {
        if (typeof ViewClass === 'undefined') {
            return;
        }

        ViewClass.prototype.hardenSceneVideoPlayback = function() {
            if (isRiskyMobileVideoEnv()) {
                replaceSceneVideoWithImage(this.element);
                return;
            }

            const video = this.element?.querySelector('.scene-loop-media');
            if (!(video instanceof HTMLVideoElement)) {
                return;
            }

            video.muted = true;
            video.defaultMuted = true;
            video.autoplay = true;
            video.loop = true;
            video.playsInline = true;
            video.setAttribute('muted', '');
            video.setAttribute('autoplay', '');
            video.setAttribute('loop', '');
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', 'true');
            video.setAttribute('x5-playsinline', 'true');
            video.setAttribute('x5-video-player-type', 'h5-page');
            video.setAttribute('x5-video-player-fullscreen', 'false');

            const playPromise = video.play?.();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        };

        const originalRender = ViewClass.prototype.render;
        if (typeof originalRender !== 'function') {
            return;
        }

        ViewClass.prototype.render = function(...args) {
            const result = originalRender.apply(this, args);
            this.hardenSceneVideoPlayback?.();
            return result;
        };
    };

    patchSceneVideoPlayback(window.ShelterView);
    patchSceneVideoPlayback(window.DungeonView);
})();
