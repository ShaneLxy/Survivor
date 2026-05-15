/**
 * Audio manager for BGM, character voice, and lightweight SFX fallback.
 * Audio assets are configured in js/config/AudioConfig.js.
 */
class AudioManager {
    constructor() {
        if (AudioManager.instance) {
            return AudioManager.instance;
        }

        this.audioContext = null;
        this.cache = new Map();
        this.currentMusic = null;
        this.currentMusicId = null;
        this.lastRequestedMusicId = null;
        this.lastRequestedMusicLoop = true;
        this.lastRequestedMusicOptions = {};
        this.currentVoice = null;
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;
        this.voiceVolume = 0.85;
        this.isMuted = false;
        this.isUnlocked = false;
        AudioManager.instance = this;
    }

    init() {
        this.initAudioContext();
        this.bindUnlockGesture();
        this.preloadConfiguredAudio();
    }

    initAudioContext() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = AudioContextClass ? new AudioContextClass() : null;
        } catch (error) {
            console.warn('[AudioManager] AudioContext init failed:', error);
            this.audioContext = null;
        }
    }

    get config() {
        return window.AudioConfig || {};
    }

    resolveAssetUrl(path) {
        if (!path) return '';
        return window.game?.resolveAssetUrl?.(path) || window.VersionManager?.getVersionedAssetUrl?.(path) || path;
    }

    getVolume(type) {
        if (this.isMuted) return 0;
        if (type === 'music') return this.musicVolume;
        if (type === 'voice') return this.voiceVolume;
        return this.sfxVolume;
    }

    bindUnlockGesture() {
        const unlock = () => {
            this.unlockAudio();
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('touchstart', unlock);
            window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('pointerdown', unlock, { once: true, passive: true });
        window.addEventListener('touchstart', unlock, { once: true, passive: true });
        window.addEventListener('keydown', unlock, { once: true });
    }

    async unlockAudio() {
        this.isUnlocked = true;
        try {
            if (this.audioContext?.state === 'suspended') {
                await this.audioContext.resume();
            }
        } catch (error) {
            console.warn('[AudioManager] Audio unlock failed:', error);
        }
        if (this.currentMusic && this.currentMusic.paused && !this.isMuted) {
            this.currentMusic.play().catch(() => {});
        }
    }

    createAudio(path, options = {}) {
        const src = this.resolveAssetUrl(path);
        const audio = new Audio(src);
        audio.preload = options.preload || 'auto';
        audio.loop = Boolean(options.loop);
        if (options.crossOrigin) {
            audio.crossOrigin = options.crossOrigin;
        }
        audio.volume = this.getVolume(options.type);
        return audio;
    }

    getCachedAudio(key, path, options = {}) {
        if (!key || !path) return null;
        if (!this.cache.has(key)) {
            this.cache.set(key, this.createAudio(path, options));
        }
        const audio = this.cache.get(key);
        audio.loop = Boolean(options.loop);
        audio.volume = this.getVolume(options.type);
        return audio;
    }

    preloadConfiguredAudio() {
        const preload = this.config.preload || {};
        (preload.music || []).forEach((id) => {
            const track = this.config.music?.[id];
            if (track?.src) {
                this.getCachedAudio(`music:${id}`, track.src, { type: 'music', loop: track.loop !== false });
            }
        });
        (preload.voices || []).forEach((voiceKey) => {
            const [heroId, cue] = String(voiceKey).split('.');
            const voice = this.config.voices?.[heroId]?.[cue];
            if (voice?.src) {
                this.getCachedAudio(`voice:${heroId}:${cue}`, voice.src, { type: 'voice' });
            }
        });
    }

    playSFX(soundName, volume = this.sfxVolume) {
        if (this.isMuted) return;
        const sfx = this.config.sfx?.[soundName];
        if (sfx?.src) {
            this.playOneShot(sfx.src, { type: 'sfx', volume });
            return;
        }
        this.playBeep(volume);
    }

    playOneShot(path, options = {}) {
        if (this.isMuted || !path) return null;
        const audio = this.createAudio(path, { type: options.type || 'sfx', preload: 'auto' });
        audio.volume = Math.max(0, Math.min(1, Number(options.volume ?? this.getVolume(options.type)) || 0));
        audio.play().catch((error) => console.warn('[AudioManager] one-shot play failed:', error));
        return audio;
    }

    playMusic(musicName, loop = true, options = {}) {
        const track = this.config.music?.[musicName] || (this.config.music?.default && musicName === 'default' ? this.config.music.default : null);
        const src = track?.src || options.src;
        if (!src) return null;

        this.lastRequestedMusicId = musicName;
        this.lastRequestedMusicLoop = loop;
        this.lastRequestedMusicOptions = { ...options };
        if (this.isMuted) {
            if (this.currentMusicId !== musicName) {
                this.stopMusic(0);
                const audio = this.getCachedAudio(`music:${musicName}`, src, {
                    type: 'music',
                    loop: track?.loop ?? loop
                });
                if (audio) {
                    audio.pause();
                    audio.currentTime = 0;
                    audio.muted = true;
                    this.currentMusic = audio;
                    this.currentMusicId = musicName;
                }
            } else {
                this.currentMusic?.pause();
            }
            return this.currentMusic;
        }

        if (this.currentMusicId === musicName && this.currentMusic) {
            this.currentMusic.muted = false;
            this.currentMusic.volume = this.getVolume('music');
            if (this.currentMusic.paused && this.isUnlocked) {
                this.currentMusic.play().catch(() => {});
            }
            return this.currentMusic;
        }

        this.stopMusic(options.fadeOutMs ?? 250);
        const audio = this.getCachedAudio(`music:${musicName}`, src, {
            type: 'music',
            loop: track?.loop ?? loop
        });
        if (!audio) return null;
        audio.currentTime = 0;
        audio.muted = false;
        audio.volume = this.getVolume('music');
        this.currentMusic = audio;
        this.currentMusicId = musicName;
        if (this.isUnlocked) {
            audio.play().catch((error) => console.warn('[AudioManager] music play failed:', error));
        }
        return audio;
    }

    playSceneBgm(sceneId) {
        const musicId = this.config.sceneMusic?.[sceneId] || this.config.sceneMusic?.default;
        if (musicId) {
            return this.playMusic(musicId, true);
        }
        return null;
    }

    stopMusic(fadeOutMs = 0) {
        const audio = this.currentMusic;
        this.currentMusic = null;
        this.currentMusicId = null;
        if (!audio) return;
        if (!fadeOutMs) {
            audio.pause();
            audio.currentTime = 0;
            return;
        }
        const startVolume = audio.volume;
        const startedAt = performance.now();
        const fade = (now) => {
            const progress = Math.min(1, (now - startedAt) / fadeOutMs);
            audio.volume = startVolume * (1 - progress);
            if (progress < 1) {
                requestAnimationFrame(fade);
                return;
            }
            audio.pause();
            audio.currentTime = 0;
            audio.volume = this.getVolume('music');
        };
        requestAnimationFrame(fade);
    }

    playVoice(voiceId, options = {}) {
        const voice = this.findVoiceConfig(voiceId);
        if (!voice?.src || this.isMuted) return null;
        if (options.interrupt !== false && this.currentVoice) {
            this.currentVoice.pause();
            this.currentVoice.currentTime = 0;
        }
        const key = voice.cacheKey || `voice:${voiceId}`;
        const audio = this.getCachedAudio(key, voice.src, { type: 'voice' });
        if (!audio) return null;
        audio.currentTime = 0;
        audio.volume = Math.max(0, Math.min(1, Number(options.volume ?? this.voiceVolume) || 0));
        this.currentVoice = audio;
        audio.play().catch((error) => console.warn('[AudioManager] voice play failed:', error));
        return audio;
    }

    playHeroVoice(heroId, cue = 'select', options = {}) {
        return this.playVoice(`${heroId}.${cue}`, options);
    }

    findVoiceConfig(voiceId) {
        if (!voiceId) return null;
        const direct = this.config.voiceCues?.[voiceId];
        if (direct) return { ...direct, cacheKey: `voice:${voiceId}` };
        const [heroId, cue] = String(voiceId).split('.');
        const voice = this.config.voices?.[heroId]?.[cue];
        return voice ? { ...voice, cacheKey: `voice:${heroId}:${cue}` } : null;
    }

    playBeep(volume) {
        if (this.isMuted || !this.audioContext) return;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(Math.max(0.01, volume), this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, Number(volume) || 0));
        if (this.currentMusic) {
            this.currentMusic.volume = this.getVolume('music');
        }
    }

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, Number(volume) || 0));
    }

    setVoiceVolume(volume) {
        this.voiceVolume = Math.max(0, Math.min(1, Number(volume) || 0));
        if (this.currentVoice) {
            this.currentVoice.volume = this.getVolume('voice');
        }
    }

    setMuted(muted) {
        this.isMuted = Boolean(muted);
        [...this.cache.values()].forEach((audio) => {
            audio.muted = this.isMuted;
        });
        if (this.isMuted) {
            this.currentMusic?.pause();
            this.currentVoice?.pause();
        } else {
            if (!this.currentMusic && this.lastRequestedMusicId) {
                this.playMusic(this.lastRequestedMusicId, this.lastRequestedMusicLoop, this.lastRequestedMusicOptions);
            } else if (this.currentMusic) {
                this.currentMusic.muted = false;
                this.currentMusic.volume = this.getVolume('music');
                if (this.isUnlocked) {
                    this.currentMusic.play().catch(() => {});
                }
            }
        }
        return this.isMuted;
    }

    toggleMute() {
        return this.setMuted(!this.isMuted);
    }
}

const audioManager = new AudioManager();
window.audioManager = audioManager;
