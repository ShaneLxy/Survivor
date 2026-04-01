/**
 * 音频管理器 - 单例模式
 * 负责游戏音效和背景音乐播放
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

    /**
     * 初始化音频上下文
     */
    init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('音频上下文初始化失败:', error);
        }
    }

    /**
     * 播放音效
     * @param {string} soundName - 音效名称
     * @param {number} volume - 音量(0-1)
     */
    playSFX(soundName, volume = this.sfxVolume) {
        if (this.isMuted || !this.audioContext) return;

        // 简单实现:使用Audio API生成提示音
        // 实际项目中应该加载音频文件
        this.playBeep(volume);
    }

    /**
     * 播放背景音乐
     * @param {string} musicName - 音乐名称
     * @param {boolean} loop - 是否循环
     */
    playMusic(musicName, loop = true) {
        if (this.isMuted) return;
        // 实际项目中应该加载音频文件并播放
    }

    /**
     * 停止背景音乐
     */
    stopMusic() {
        // 实际项目中应该停止正在播放的音乐
    }

    /**
     * 播放提示音(简单实现)
     * @param {number} volume - 音量
     */
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

    /**
     * 设置音乐音量
     * @param {number} volume - 音量(0-1)
     */
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * 设置音效音量
     * @param {number} volume - 音量(0-1)
     */
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * 静音/取消静音
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }
}

// 导出单例
const audioManager = new AudioManager();

// 暴露到全局
window.audioManager = audioManager;
