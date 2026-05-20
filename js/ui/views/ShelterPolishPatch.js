(function() {
    if (typeof ShelterView === 'undefined' || !window.shelterView) {
        return;
    }

    const STAGE_MEDIA = [
        {
            stage: 1,
            minLevel: 1,
            maxLevel: 2,
            src: 'assets/media/house.mp4',
            poster: 'assets/media/house_poster.png',
            mobileFallbackSrc: 'assets/media/house_poster.png'
        },
        {
            stage: 2,
            minLevel: 3,
            maxLevel: 4,
            src: 'assets/media/house.mp4',
            poster: 'assets/media/house_poster.png',
            mobileFallbackSrc: 'assets/media/house_poster.png'
        },
        {
            stage: 3,
            minLevel: 5,
            maxLevel: 6,
            src: 'assets/media/house.mp4',
            poster: 'assets/media/house_poster.png',
            mobileFallbackSrc: 'assets/media/house_poster.png'
        },
        {
            stage: 4,
            minLevel: 7,
            maxLevel: 8,
            src: 'assets/media/house.mp4',
            poster: 'assets/media/house_poster.png',
            mobileFallbackSrc: 'assets/media/house_poster.png'
        },
        {
            stage: 5,
            minLevel: 9,
            maxLevel: 10,
            src: 'assets/media/house.mp4',
            poster: 'assets/media/house_poster.png',
            mobileFallbackSrc: 'assets/media/house_poster.png'
        }
    ];

    const normalizeMediaPath = (path) => String(path || '').trim().replace(/\\/g, '/');

    const hasConfiguredMedia = (levelConfig) => Boolean(
        normalizeMediaPath(levelConfig?.backgroundVideo || levelConfig?.videoSrc || levelConfig?.sceneVideo) ||
        normalizeMediaPath(
            levelConfig?.backgroundImage ||
            levelConfig?.backgroundPoster ||
            levelConfig?.mobileFallbackSrc ||
            levelConfig?.fallbackImage ||
            levelConfig?.poster
        )
    );

    ShelterView.prototype.getShelterStageEntry = function(levelOverride) {
        const level = Number(levelOverride || shelterManager.getBuilding('building_shelter')?.level || 1);
        return STAGE_MEDIA.find((entry) => level >= entry.minLevel && level <= entry.maxLevel) || STAGE_MEDIA[0];
    };

    ShelterView.prototype.getConfiguredShelterMediaEntry = function(level) {
        const buildingConfig = window.BuildingConfig?.getBuildingConfig?.('building_shelter');
        const levels = Array.isArray(buildingConfig?.levels)
            ? buildingConfig.levels.slice().sort((left, right) => Number(left.level || 1) - Number(right.level || 1))
            : [];
        if (!levels.length) {
            return null;
        }

        const exact = levels.find((entry) => Number(entry.level || 1) === Number(level) && hasConfiguredMedia(entry));
        const previous = levels
            .filter((entry) => Number(entry.level || 1) <= Number(level) && hasConfiguredMedia(entry))
            .pop();
        const selected = exact || previous || levels.find(hasConfiguredMedia);
        if (!selected) {
            return null;
        }

        const backgroundVideo = normalizeMediaPath(selected.backgroundVideo || selected.videoSrc || selected.sceneVideo);
        const backgroundImage = normalizeMediaPath(
            selected.backgroundImage ||
            selected.backgroundPoster ||
            selected.mobileFallbackSrc ||
            selected.fallbackImage ||
            selected.poster
        );
        const fallbackStage = this.getShelterStageEntry(level);
        return {
            ...fallbackStage,
            type: backgroundVideo ? 'video' : 'image',
            src: backgroundVideo || backgroundImage,
            poster: backgroundImage,
            mobileFallbackSrc: backgroundImage,
            configuredLevel: Number(selected.level || level)
        };
    };

    ShelterView.prototype.getShelterSceneMediaConfig = function() {
        const level = Number(shelterManager.getBuilding('building_shelter')?.level || 1);
        const entry = this.getConfiguredShelterMediaEntry(level) || this.getShelterStageEntry(level);
        const versioned = (path) => {
            const normalized = normalizeMediaPath(path);
            return normalized ? (window.VersionManager?.getVersionedAssetUrl?.(normalized) || normalized) : '';
        };
        return {
            type: entry.type || 'video',
            src: versioned(entry.src),
            mimeType: 'video/mp4',
            poster: entry.poster ? versioned(entry.poster) : '',
            mobileFallbackSrc: entry.mobileFallbackSrc ? versioned(entry.mobileFallbackSrc) : ''
        };
    };

    const originalGetSceneMediaMarkup = ShelterView.prototype.getSceneMediaMarkup;
    ShelterView.prototype.getSceneMediaMarkup = function(sceneKey) {
        if (sceneKey !== 'shelter') {
            return originalGetSceneMediaMarkup.call(this, sceneKey);
        }

        const mediaConfig = this.getShelterSceneMediaConfig();
        if (!mediaConfig?.src) {
            return '';
        }

        if (mediaConfig.type !== 'video') {
            return `<img class="scene-loop-media" src="${mediaConfig.src}" alt="">`;
        }

        const poster = mediaConfig.poster ? ` poster="${mediaConfig.poster}"` : '';
        const mimeType = mediaConfig.mimeType || 'video/mp4';
        const mobileFallbackSrc = mediaConfig.mobileFallbackSrc
            ? ` data-mobile-fallback-src="${mediaConfig.mobileFallbackSrc}"`
            : '';

        return `
            <video
                class="scene-loop-media"
                autoplay
                muted
                loop
                playsinline
                webkit-playsinline="true"
                x5-playsinline="true"
                x5-video-player-type="h5-page"
                x5-video-player-fullscreen="false"
                x-webkit-airplay="deny"
                disablepictureinpicture
                controlslist="nofullscreen nodownload noremoteplayback"
                preload="auto"${poster}${mobileFallbackSrc}>
                <source src="${mediaConfig.src}" type="${mimeType}">
            </video>
        `;
    };

    ShelterView.prototype.applyShelterTierPresentation = function() {
        const scene = this.element?.querySelector('.scene-view.shelter-view');
        if (!scene) {
            return;
        }

        const stage = this.getShelterStageEntry()?.stage || 1;
        scene.classList.remove('shelter-tier-1', 'shelter-tier-2', 'shelter-tier-3', 'shelter-tier-4', 'shelter-tier-5');
        scene.classList.add(`shelter-tier-${stage}`);
        scene.setAttribute('data-shelter-stage', String(stage));
    };

    const originalRender = ShelterView.prototype.render;
    ShelterView.prototype.render = function(...args) {
        const result = originalRender.apply(this, args);
        this.applyShelterTierPresentation?.();
        this.hardenSceneVideoPlayback?.();
        return result;
    };

    ShelterView.prototype.getCompactMainButtons = function(buttons) {
        const list = Array.isArray(buttons) ? buttons : this.getCompactButtonList();
        const collectButton = list.find((button) => button.id === 'collect_all');
        const mailboxButton = list.find((button) => button.id === 'mailbox');
        return [
            ...(mailboxButton ? [mailboxButton] : []),
            { id: 'building_menu', label: '\u5efa\u7b51', icon: '\ud83c\udfd7\ufe0f' },
            ...(collectButton ? [collectButton] : [])
        ];
    };

    ShelterView.prototype.upgradeBuilding = function(buildingId) {
        const previousTeamPower = window.heroManager?.getTeamPower?.() || 0;
        const result = shelterManager.upgradeBuilding(buildingId);

        if (!result?.success) {
            Toast.error(result?.message || '\u5347\u7ea7\u5931\u8d25');
            return;
        }

        const nextTeamPower = window.heroManager?.getTeamPower?.() || previousTeamPower;
        const powerGain = Math.max(0, nextTeamPower - previousTeamPower);

        if (buildingId === 'building_training_ground' && powerGain > 0) {
            window.playerPowerTicker?.show?.(previousTeamPower, nextTeamPower);
            window.game?.ui?.heroView?.updateTeamPowerDisplay?.();
            Toast.success(`${result.message}\uff0c\u603b\u6218\u529b +${GameConfig.formatCombatPower(powerGain)}`);
        } else {
            Toast.success(result.message);
        }

        window.game?.refreshRuntimeUI?.();
        window.game?.save?.();
    };
})();
