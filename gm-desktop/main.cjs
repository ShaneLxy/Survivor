const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Client } = require('ssh2');

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
    applicationId: asCleanString(rawOptions.applicationId, 'game.taptap.yunjing.game'),
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

function removeDirSafe(targetPath) {
  if (targetPath && fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

function copyProjectEntry(sourcePath, targetPath) {
  const ignored = new Set(['node_modules', '.git', '.gradle', 'build']);
  fs.cpSync(sourcePath, targetPath, {
    recursive: true,
    filter: (src) => !ignored.has(path.basename(src))
  });
}

function zipDirectory(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar.exe', ['-a', '-cf', zipPath, '-C', sourceDir, '.'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk) => { output += chunk.toString('utf8'); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(output || `tar exited with code ${code}`));
    });
  });
}

async function createBackendDeployZip() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'survivor-backend-'));
  const stagingDir = path.join(workDir, 'payload');
  const zipPath = path.join(workDir, 'survivor-server.zip');
  fs.mkdirSync(stagingDir, { recursive: true });
  copyProjectEntry(path.join(projectRoot, 'server'), path.join(stagingDir, 'server'));
  await zipDirectory(stagingDir, zipPath);
  return { workDir, zipPath };
}

async function createRuntimeDeployZip() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'survivor-runtime-'));
  const stagingDir = path.join(workDir, 'payload');
  const zipPath = path.join(workDir, 'survivor-runtime.zip');
  fs.mkdirSync(stagingDir, { recursive: true });
  ['js', 'data', 'mobile'].forEach((entry) => {
    copyProjectEntry(path.join(projectRoot, entry), path.join(stagingDir, entry));
  });
  const serverDataPath = path.join(projectRoot, 'server', 'data');
  if (fs.existsSync(serverDataPath)) {
    copyProjectEntry(serverDataPath, path.join(stagingDir, 'server', 'data'));
  }
  const audioConfigPath = path.join(projectRoot, 'server', 'gm-audio-config.json');
  if (fs.existsSync(audioConfigPath)) {
    fs.mkdirSync(path.join(stagingDir, 'server'), { recursive: true });
    fs.copyFileSync(audioConfigPath, path.join(stagingDir, 'server', 'gm-audio-config.json'));
  }
  const indexPath = path.join(projectRoot, 'index.html');
  if (fs.existsSync(indexPath)) {
    fs.copyFileSync(indexPath, path.join(stagingDir, 'index.html'));
  }
  await zipDirectory(stagingDir, zipPath);
  return { workDir, zipPath };
}

function normalizeDeployOptions(rawOptions = {}) {
  const host = asCleanString(rawOptions.host, '');
  return {
    host,
    port: Math.max(1, Number(rawOptions.port) || 22),
    username: asCleanString(rawOptions.username, 'root'),
    password: String(rawOptions.password || ''),
    remoteRoot: asCleanString(rawOptions.remoteRoot, '/opt').replace(/\/+$/, '') || '/opt',
    appDir: asCleanString(rawOptions.appDir, '/opt/survivor-server').replace(/\/+$/, '') || '/opt/survivor-server',
    healthUrl: asCleanString(rawOptions.healthUrl, host ? `https://${host}/api/health` : ''),
    action: ['backend', 'sync', 'restart', 'status'].includes(rawOptions.action) ? rawOptions.action : 'backend'
  };
}

function shellQuote(value) {
  return `'${String(value ?? '').replace(/'/g, `'\\''`)}'`;
}

function connectSsh(options) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect({
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password,
      readyTimeout: 20000
    });
  });
}

function sftpUpload(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((error, sftp) => {
      if (error) {
        reject(error);
        return;
      }
      sftp.fastPut(localPath, remotePath, (uploadError) => {
        if (uploadError) reject(uploadError);
        else resolve();
      });
    });
  });
}

function sftpDownload(conn, remotePath, localPath) {
  return new Promise((resolve, reject) => {
    conn.sftp((error, sftp) => {
      if (error) {
        reject(error);
        return;
      }
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      sftp.fastGet(remotePath, localPath, (downloadError) => {
        if (downloadError) reject(downloadError);
        else resolve();
      });
    });
  });
}

function sftpExists(conn, remotePath) {
  return new Promise((resolve) => {
    conn.sftp((error, sftp) => {
      if (error) {
        resolve(false);
        return;
      }
      sftp.stat(remotePath, (statError) => {
        resolve(!statError);
      });
    });
  });
}

async function sftpDownloadFirstExisting(conn, candidates, localPath) {
  for (const remotePath of candidates) {
    if (await sftpExists(conn, remotePath)) {
      await sftpDownload(conn, remotePath, localPath);
      return remotePath;
    }
  }
  throw new Error(`No such file: ${candidates[0]}`);
}

function execRemote(conn, command, onLog) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }
      let output = '';
      stream.on('close', (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Remote command exited with code ${code}`));
      });
      stream.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        output += text;
        onLog(text);
      });
      stream.stderr.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        output += text;
        onLog(text);
      });
    });
  });
}

function getBackendDeployScript(options, remoteZip) {
  const remoteRoot = shellQuote(options.remoteRoot);
  const appDir = shellQuote(options.appDir);
  const healthUrl = shellQuote(options.healthUrl);
  return [
    'set -e',
    `cd ${remoteRoot}`,
    'rm -rf survivor-server-next survivor-server-new survivor-server-bak',
    `unzip -oq ${shellQuote(remoteZip)} -d survivor-server-next`,
    'if [ -d survivor-server-next/server ]; then mv survivor-server-next/server survivor-server-new; else mv survivor-server-next survivor-server-new; fi',
    `if [ -f ${appDir}/.env.production ]; then cp ${appDir}/.env.production survivor-server-new/.env.production; fi`,
    `if [ -d ${appDir} ]; then mv ${appDir} survivor-server-bak; fi`,
    `mv survivor-server-new ${appDir}`,
    `cd ${appDir}`,
    'npm install',
    'npm run build',
    'ENV_FILE=.env.production pm2 restart survivor-server --update-env || ENV_FILE=.env.production pm2 start dist/main.js --name survivor-server',
    'pm2 save',
    `for i in $(seq 1 30); do curl -f ${healthUrl} && exit 0; sleep 2; done`,
    `curl -i ${healthUrl}`,
    'exit 1'
  ].join('\n');
}

function getRuntimeDeployScript(options, remoteZip) {
  const remoteRoot = shellQuote(options.remoteRoot);
  const healthUrl = shellQuote(options.healthUrl);
  return [
    'set -e',
    `cd ${remoteRoot}`,
    `unzip -oq ${shellQuote(remoteZip)} -d ${remoteRoot}`,
    `curl -f ${healthUrl}`
  ].join('\n');
}

function getRestartScript(options) {
  const healthUrl = shellQuote(options.healthUrl);
  return [
    'set -e',
    'ENV_FILE=.env.production pm2 restart survivor-server --update-env',
    'pm2 save',
    `for i in $(seq 1 30); do curl -f ${healthUrl} && exit 0; sleep 2; done`,
    `curl -i ${healthUrl}`,
    'exit 1'
  ].join('\n');
}

function getStatusScript(options) {
  const healthUrl = shellQuote(options.healthUrl);
  return [
    'pm2 status survivor-server',
    `curl -i ${healthUrl}`
  ].join('\n');
}

async function runServerDeploy(event, rawOptions) {
  const options = normalizeDeployOptions(rawOptions);
  const log = (text) => event.sender.send('gm-desktop:server-deploy-log', { text });
  if (!options.host) return { success: false, error: '请填写服务器公网 IP 或域名' };
  if (!options.username) return { success: false, error: '请填写 SSH 用户名' };
  if (!options.password) return { success: false, error: '请填写 SSH 密码' };

  let temp = null;
  let conn = null;
  try {
    log(`连接服务器 ${options.username}@${options.host}:${options.port}\n`);
    conn = await connectSsh(options);
    log('SSH 连接成功\n');

    let command = '';
    if (options.action === 'backend') {
      log('正在打包后端代码...\n');
      temp = await createBackendDeployZip();
      const remoteZip = `${options.remoteRoot}/survivor-server.zip`;
      log(`上传 ${remoteZip}\n`);
      await sftpUpload(conn, temp.zipPath, remoteZip);
      command = getBackendDeployScript(options, remoteZip);
    } else if (options.action === 'sync') {
      log('正在同步服务器 GM 配置到本地...\n');
      const remoteBases = [
        options.appDir,
        options.remoteRoot,
        '/opt/survivor-server',
        '/opt',
      ];
      const catalogRemote = remoteBases.map((base) => `${base}/server/data/gm-catalog-overrides.json`);
      const battleRemote = remoteBases.map((base) => `${base}/server/data/gm-special-battles.json`);
      const audioRemote = remoteBases.map((base) => `${base}/server/gm-audio-config.json`);
      await sftpDownloadFirstExisting(conn, catalogRemote, path.join(projectRoot, 'server', 'data', 'gm-catalog-overrides.json'));
      await sftpDownloadFirstExisting(conn, battleRemote, path.join(projectRoot, 'server', 'data', 'gm-special-battles.json'));
      await sftpDownloadFirstExisting(conn, audioRemote, path.join(projectRoot, 'server', 'gm-audio-config.json'));
      log('同步完成\n');
      command = getStatusScript(options);
    } else if (options.action === 'restart') {
      command = getRestartScript(options);
    } else {
      command = getStatusScript(options);
    }

    log('执行远程命令...\n----------------------------------------\n');
    await execRemote(conn, command, log);
    log('\n----------------------------------------\n完成\n');
    return { success: true };
  } catch (error) {
    const message = error.message || String(error);
    log(`\n失败：${message}\n`);
    return { success: false, error: message };
  } finally {
    if (conn) conn.end();
    if (temp?.workDir) removeDirSafe(temp.workDir);
  }
}

function readAndroidSigningConfig() {
  const configPath = path.join(projectRoot, 'android', 'signing', 'signing.properties');
  if (!fs.existsSync(configPath)) {
    return {};
  }
  const values = {};
  fs.readFileSync(configPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const text = line.trim();
    if (!text || text.startsWith('#')) return;
    const index = text.indexOf('=');
    if (index < 0) return;
    values[text.slice(0, index).trim()] = text.slice(index + 1).trim();
  });
  return {
    signingStoreFile: values.SigningStoreFile || '',
    signingStorePassword: values.SigningStorePassword || '',
    signingKeyAlias: values.SigningKeyAlias || '',
    signingKeyPassword: values.SigningKeyPassword || ''
  };
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

  /**
   * 选择音频文件并返回相对于 projectRoot 的路径(用正斜杠)。
   * 入参 hints 可选,前端可传:
   *   - heroId: 用来把对话框默认目录引导到 assets/audio/voice/<heroId>/
   *   - subDir: 备选默认子目录(优先级低于 heroId)
   *
   * 返回:
   *   - { canceled: true }                 用户取消
   *   - { error: '...' }                   选了但不在 projectRoot/assets 下
   *   - { relativePath: 'assets/...' }     成功
   */
  ipcMain.handle('gm-desktop:pick-voice-file', async (_event, hints = {}) => {
    // 计算默认目录的优先级:具体英雄目录 > assets/audio/voice > assets > projectRoot
    const candidateDirs = [];
    if (hints?.heroId) {
      candidateDirs.push(path.join(projectRoot, 'assets', 'audio', 'voice', String(hints.heroId)));
    }
    if (hints?.subDir) {
      candidateDirs.push(path.join(projectRoot, String(hints.subDir)));
    }
    candidateDirs.push(
      path.join(projectRoot, 'assets', 'audio', 'voice'),
      path.join(projectRoot, 'assets'),
      projectRoot,
    );
    let defaultPath = projectRoot;
    for (const dir of candidateDirs) {
      try {
        if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
          defaultPath = dir;
          break;
        }
      } catch (_) {
        // ignore — 继续尝试下一个候选目录
      }
    }

    const result = await dialog.showOpenDialog({
      title: '选择战斗语音文件',
      defaultPath,
      properties: ['openFile'],
      filters: [
        { name: '音频文件', extensions: ['wav', 'mp3', 'ogg', 'm4a', 'aac', 'opus', 'flac'] },
      ],
    });

    if (result.canceled || !result.filePaths?.length) {
      return { canceled: true };
    }

    const absolutePath = result.filePaths[0];

    // 计算相对路径。如果不在 projectRoot 内,拒绝并提示
    const rootWithSep = projectRoot.endsWith(path.sep) ? projectRoot : projectRoot + path.sep;
    if (!absolutePath.toLowerCase().startsWith(rootWithSep.toLowerCase())) {
      return {
        error: `所选文件不在游戏项目目录内,请将音频文件放到 ${path.join(projectRoot, 'assets', 'audio', 'voice')} 下再选择`,
      };
    }

    // 转换为正斜杠相对路径,符合 game 引擎和配置文件惯例
    const relativePath = path
      .relative(projectRoot, absolutePath)
      .split(path.sep)
      .join('/');

    return { relativePath };
  });

  ipcMain.handle('gm-desktop:run-android-package', runAndroidPackage);
  ipcMain.handle('gm-desktop:run-server-deploy', runServerDeploy);
  ipcMain.handle('gm-desktop:get-android-signing-config', async () => readAndroidSigningConfig());

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
