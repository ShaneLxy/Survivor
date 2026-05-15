const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gmDesktop', {
  platform: process.platform,
  versions: process.versions,
  pickImageFile: () => ipcRenderer.invoke('gm-desktop:pick-image'),
  runAndroidPackage: (options) => ipcRenderer.invoke('gm-desktop:run-android-package', options),
  onPackageLog: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('gm-desktop:package-log', listener);
    return () => ipcRenderer.removeListener('gm-desktop:package-log', listener);
  },
  openPath: (targetPath) => ipcRenderer.invoke('gm-desktop:open-path', targetPath)
});
