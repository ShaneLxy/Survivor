/**
 * 音频管理器 - 单例模式
 */
class AudioManager {
    constructor() {
        if (AudioManager.instance) {
            return AudioManager.instance;
        }
        this.audioContext = null;
        this.sounds = {};
        this.musicVolume = 0.5;
        this.sfxVolume = 0.7;
        this.isMuted = false;
        AudioManager.instance = this;
    }

    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('音频上下文初始化失败:', error);
        }
    }

    playSFX(soundName, volume = this.sfxVolume) {
        if (this.isMuted || !this.audioContext) return;
        this.playBeep(volume);
    }

    playMusic(musicName, loop = true) {
        if (this.isMuted) return;
    }

    stopMusic() {}

    playBeep(volume) {
        if (!this.audioContext) return;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
    }

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    setMuted(muted) {
        this.isMuted = Boolean(muted);
        return this.isMuted;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }
}

const audioManager = new AudioManager();
window.audioManager = audioManager;
