const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const defaultPackageOutputDir = path.join(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug');

function getDefaultPackageVersionCode(date = new Date()) {
  const parts = [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ];
  return parts.join('');
}

function asCleanString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizePackageOptions(rawOptions = {}) {
  const buildChannel = rawOptions.buildChannel === 'formal' ? 'formal' : 'test';
  const artifact = rawOptions.artifact === 'aab' ? 'aab' : 'apk';
  const versionCode = asCleanString(rawOptions.versionCode, getDefaultPackageVersionCode());
  const webViewDebugging = typeof rawOptions.webViewDebugging === 'boolean'
    ? rawOptions.webViewDebugging
    : buildChannel === 'test';
  const rawOutputDir = asCleanString(rawOptions.outputDir, defaultPackageOutputDir);

  return {
    buildChannel,
    artifact,
    versionName: asCleanString(rawOptions.versionName, '1.0'),
    versionCode,
    applicationId: asCleanString(rawOptions.applicationId, 'com.survivor.game'),
    appName: asCleanString(rawOptions.appName, '云境Paradise'),
    buildVersion: asCleanString(rawOptions.buildVersion, ''),
    outputDir: path.isAbsolute(rawOutputDir) ? rawOutputDir : path.resolve(projectRoot, rawOutputDir),
    webViewDebugging,
    signingStoreFile: asCleanString(rawOptions.signingStoreFile, ''),
    signingStorePassword: asCleanString(rawOptions.signingStorePassword, ''),
    signingKeyAlias: asCleanString(rawOptions.signingKeyAlias, ''),
    signingKeyPassword: asCleanString(rawOptions.signingKeyPassword, ''),
    serverUrl: asCleanString(rawOptions.serverUrl, ''),
    gmNote: asCleanString(rawOptions.gmNote, ''),
    clean: Boolean(rawOptions.clean),
    skipDoctor: Boolean(rawOptions.skipDoctor)
  };
}

function pushValueArg(args, name, value) {
  if (value === undefined || value === null || value === '') {
    return;
  }
  args.push(`-${name}`, String(value));
}

function parsePackageResult(output) {
  const marker = 'PACKAGE_RESULT_JSON:';
  const markerIndex = output.lastIndexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const rawLine = output.slice(markerIndex + marker.length).split(/\r?\n/)[0].trim();
  try {
    return JSON.parse(rawLine);
  } catch (error) {
    return null;
  }
}

function runAndroidPackage(event, rawOptions) {
  const options = normalizePackageOptions(rawOptions);
  const scriptPath = path.join(projectRoot, 'scripts', 'package-android.ps1');

  if (!fs.existsSync(scriptPath)) {
    return Promise.resolve({
      success: false,
      error: `Package script not found: ${scriptPath}`,
      output: ''
    });
  }

  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath
  ];

  pushValueArg(args, 'BuildChannel', options.buildChannel);
  pushValueArg(args, 'Artifact', options.artifact);
  pushValueArg(args, 'VersionName', options.versionName);
  pushValueArg(args, 'VersionCode', options.versionCode);
  pushValueArg(args, 'ApplicationId', options.applicationId);
  pushValueArg(args, 'AppName', options.appName);
  pushValueArg(args, 'BuildVersion', options.buildVersion);
  pushValueArg(args, 'OutputDir', options.outputDir);
  pushValueArg(args, 'WebViewDebugging', String(options.webViewDebugging));
  pushValueArg(args, 'SigningStoreFile', options.signingStoreFile);
  pushValueArg(args, 'SigningStorePassword', options.signingStorePassword);
  pushValueArg(args, 'SigningKeyAlias', options.signingKeyAlias);
  pushValueArg(args, 'SigningKeyPassword', options.signingKeyPassword);
  pushValueArg(args, 'ServerUrl', options.serverUrl);
  pushValueArg(args, 'GmNote', options.gmNote);
  if (options.clean) args.push('-Clean');
  if (options.skipDoctor) args.push('-SkipDoctor');

  return new Promise((resolve) => {
    let output = '';
    const child = spawn('powershell.exe', args, {
      cwd: projectRoot,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORCE_COLOR: '0'
      }
    });

    const sendChunk = (stream, chunk) => {
      const text = chunk.toString('utf8');
      output += text;
      event.sender.send('gm-desktop:package-log', { stream, text });
    };

    child.stdout.on('data', (chunk) => sendChunk('stdout', chunk));
    child.stderr.on('data', (chunk) => sendChunk('stderr', chunk));
    child.on('error', (error) => {
      const message = error.message || String(error);
      output += `${message}\n`;
      event.sender.send('gm-desktop:package-log', { stream: 'stderr', text: `${message}\n` });
      resolve({ success: false, error: message, output });
    });
    child.on('close', (code) => {
      const result = parsePackageResult(output);
      if (code === 0) {
        resolve({
          success: true,
          artifactPath: result?.artifactPath || '',
          result,
          output
        });
        return;
      }
      resolve({
        success: false,
        error: `Package process exited with code ${code}`,
        output,
        result
      });
    });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 760,
    title: 'Survivor GM Console',
    backgroundColor: '#f3f6f8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  ipcMain.handle('gm-desktop:pick-image', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择建筑图片',
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] },
      ],
    });
    if (result.canceled || !result.filePaths?.length) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('gm-desktop:run-android-package', runAndroidPackage);

  ipcMain.handle('gm-desktop:open-path', async (_event, targetPath) => {
    const normalizedPath = asCleanString(targetPath);
    if (!normalizedPath) {
      return { success: false, error: 'Path is empty.' };
    }
    try {
      const stat = fs.existsSync(normalizedPath) ? fs.statSync(normalizedPath) : null;
      if (stat?.isFile()) {
        shell.showItemInFolder(normalizedPath);
        return { success: true };
      }
      const errorMessage = await shell.openPath(normalizedPath);
      return errorMessage ? { success: false, error: errorMessage } : { success: true };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
