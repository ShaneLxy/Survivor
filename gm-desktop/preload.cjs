const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gmDesktop', {
  platform: process.platform,
  versions: process.versions,
  pickImageFile: () => ipcRenderer.invoke('gm-desktop:pick-image'),
  /**
   * 选择音频文件并返回相对路径(如 'assets/audio/voice/hero_023/death_1.wav')
   * @param {{heroId?: string, subDir?: string}} [hints] 可选,引导对话框默认目录
   * @returns {Promise<{ relativePath: string } | { error: string } | { canceled: true }>}
   */
  pickVoiceFile: (hints) => ipcRenderer.invoke('gm-desktop:pick-voice-file', hints),
  getAndroidSigningConfig: () => ipcRenderer.invoke('gm-desktop:get-android-signing-config'),
  runAndroidPackage: (options) => ipcRenderer.invoke('gm-desktop:run-android-package', options),
  runServerDeploy: (options) => ipcRenderer.invoke('gm-desktop:run-server-deploy', options),
  onPackageLog: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('gm-desktop:package-log', listener);
    return () => ipcRenderer.removeListener('gm-desktop:package-log', listener);
  },
  onServerDeployLog: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('gm-desktop:server-deploy-log', listener);
    return () => ipcRenderer.removeListener('gm-desktop:server-deploy-log', listener);
  },
  openPath: (targetPath) => ipcRenderer.invoke('gm-desktop:open-path', targetPath)
});
