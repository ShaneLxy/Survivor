(function() {
    const RETRY_EVENT_NAMES = ['pointerdown', 'touchstart', 'click'];
    const isAndroidAppMode = () => /Android/i.test(navigator.userAgent || '') || Boolean(window.Capacitor);

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

    const bindOneShotPlaybackRetries = (video) => {
        if (!(video instanceof HTMLVideoElement) || video.dataset.retryBindingReady === '1') {
            return;
        }

        video.dataset.retryBindingReady = '1';

        const tryPlay = () => {
            const playPromise = video.play?.();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(() => {});
            }
        };

        const cleanup = () => {
            RETRY_EVENT_NAMES.forEach(eventName => {
                document.removeEventListener(eventName, onUserGesture, true);
            });
            document.removeEventListener('visibilitychange', onVisibilityChange, true);
            video.removeEventListener('playing', onPlaying, true);
            video.removeEventListener('error', onError, true);
            delete video.__sceneRetryCleanup;
        };

        const onUserGesture = () => tryPlay();
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                tryPlay();
            }
        };
        const onPlaying = () => {
            video.dataset.retryBindingReady = '0';
            cleanup();
        };
        const onError = () => {
            video.dataset.retryBindingReady = '0';
            cleanup();
            replaceSceneVideoWithImage(video.parentElement);
        };

        RETRY_EVENT_NAMES.forEach(eventName => {
            document.addEventListener(eventName, onUserGesture, true);
        });
        document.addEventListener('visibilitychange', onVisibilityChange, true);
        video.addEventListener('playing', onPlaying, true);
        video.addEventListener('error', onError, true);
        video.__sceneRetryCleanup = cleanup;
    };

    const setupSceneVideo = (video) => {
        if (!(video instanceof HTMLVideoElement)) {
            return;
        }

        if (typeof video.__sceneRetryCleanup === 'function') {
            video.__sceneRetryCleanup();
        }

        video.muted = true;
        video.defaultMuted = true;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'auto';
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
            playPromise.catch(() => {
                if (isAndroidAppMode()) {
                    bindOneShotPlaybackRetries(video);
                    return;
                }
                replaceSceneVideoWithImage(video.parentElement);
            });
        }

        video.addEventListener('pause', () => {
            if (!video.ended && document.visibilityState === 'visible') {
                const retryPromise = video.play?.();
                if (retryPromise && typeof retryPromise.catch === 'function') {
                    retryPromise.catch(() => {
                        if (isAndroidAppMode()) {
                            bindOneShotPlaybackRetries(video);
                            return;
                        }
                        replaceSceneVideoWithImage(video.parentElement);
                    });
                }
            }
        }, { passive: true });
    };

    const patchSceneVideoPlayback = (ViewClass) => {
        if (typeof ViewClass === 'undefined') {
            return;
        }

        ViewClass.prototype.hardenSceneVideoPlayback = function() {
            const video = this.element?.querySelector('.scene-loop-media');
            if (!(video instanceof HTMLVideoElement)) {
                return;
            }
            setupSceneVideo(video);
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
