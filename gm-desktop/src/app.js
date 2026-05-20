const state = {
  baseUrl: localStorage.getItem('survivor_gm_base_url') || 'https://mom-wed-engaging-laura.trycloudflare.com/api',
  gmSecret: localStorage.getItem('survivor_gm_secret') || 'survivor_gm_secret',
  view: 'catalog',
  catalogType: 'items',
  catalog: { resources: [], items: [], equipment: [], enemySkills: [], gachaPools: [], shelterBuildings: [], dungeonChapters: [], dungeons: [], shopItems: [], welfareGifts: [], enemies: [] },
  selectedEntry: null,
  selectedEnemy: null,
  selectedPool: null,
  selectedDungeon: null,
  selectedDungeonMode: 'stage',
  selectedChapterKey: '',
  selectedShopItem: null,
  selectedWelfareGift: null,
  selectedShelterBuilding: null,
  mailRewards: [],
  cdkeyRewards: [],
  welfareGiftRewards: [],
  pickerTarget: 'mail',
  cdkeys: [],
  packageRunning: false,
  packageLastOutputPath: ''
};

const viewMeta = {
  enemy: ['怪物信息', '维护怪物名称、介绍和立绘资源，具体属性在关卡中配置'],
  shop: ['商城配置', '配置商城页面中出售的商品、价格、限购和发放内容'],
  welfare: ['福利礼包', '配置福利页横向礼包的名称、描述、排序和奖励内容'],
  catalog: ['资源目录', '查询和维护资源、道具、装备配置'],
  gacha: ['招募奖池', '配置英雄招募和装备打造的奖励条目、数量范围和概率'],
  dungeon: ['副本关卡', '配置章节、关卡、敌人、奖励和棋盘布局'],
  mail: ['玩家邮件', '向玩家 ID 或全体玩家发送系统邮件'],
  cdkey: ['CDKEY', '批量创建、查询、修改兑换码'],
  package: ['打包模块', '选择正式或测试版本并生成 Android 安装包'],
  settings: ['连接设置', '配置服务端地址和 GM 密钥']
};

const catalogConfig = {
  resources: { label: '资源', category: 'resource', typeField: 'type' },
  items: { label: '道具', category: 'item', typeField: 'type' },
  equipment: { label: '装备', category: 'equipment', typeField: 'slot' },
  enemySkills: { label: '敌人技能', category: 'enemySkill', typeField: 'effectType' }
};

const rarityLabels = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

const raritySortOrder = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1
};

const dungeonEnvironmentEffectOptions = new Set(['none', 'smoke', 'poison_fog', 'dust_smoke', 'rain', 'storm_night', 'snow']);

const gachaEntryTypeLabels = {
  resource: '资源',
  item: '道具',
  fragment: '随机英雄碎片',
  hero: '随机英雄',
  equipment: '随机装备'
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const DEFAULT_PACKAGE_APPLICATION_ID = 'com.survivor.game';
const DEFAULT_PACKAGE_APP_NAME = '云境Paradise';
const DEFAULT_PACKAGE_OUTPUT_DIR = 'E:\\AIGame\\Survivor\\android\\app\\build\\outputs\\apk\\debug';
const EXPANDED_SELECT_SIZE = 12;

viewMeta.shelter = ['避难所建筑', '配置农场、林场、水井等建筑的图标、描述、每级收益和升级消耗'];

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  bindScrollableSelects();
  bindPackageLogStream();
  syncSettingsInputs();
  syncPackageDefaults();
  syncPackageChannelDefaults();
  refreshAll();
});

function bindEvents() {
  $$('.nav-item').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  $$('.segment').forEach((button) => {
    button.addEventListener('click', () => {
      state.catalogType = button.dataset.catalogType;
      $$('.segment').forEach((entry) => entry.classList.toggle('active', entry === button));
      state.selectedEntry = null;
      renderTypeFilter();
      renderCatalogList();
      renderCatalogEditor(null);
    });
  });

  $('#globalSearchInput').addEventListener('input', () => {
    renderCatalogList();
    renderRewardPicker();
  });
  $('#rarityFilter').addEventListener('change', renderCatalogList);
  $('#typeFilter').addEventListener('change', renderCatalogList);
  $('#newCatalogBtn').addEventListener('click', createBlankCatalogEntry);
  $('#catalogForm').addEventListener('submit', saveCatalogEntry);
  $('#deleteCatalogBtn').addEventListener('click', deleteCatalogOverride);
  $('#catalogIconSrc').addEventListener('input', updateImagePreviewFromForm);
  $('#catalogImageFile').addEventListener('change', handleImageFile);
  $('#enemySearchInput').addEventListener('input', renderEnemyList);
  $('#newEnemyBtn').addEventListener('click', createBlankEnemyEntry);
  $('#enemyForm').addEventListener('submit', saveEnemyEntry);
  $('#deleteEnemyBtn').addEventListener('click', deleteEnemyOverride);
  $('#enemyArtSrc').addEventListener('input', updateEnemyImagePreviewFromForm);
  $('#enemyImageFile').addEventListener('change', handleEnemyImageFile);

  $('#settingsForm').addEventListener('submit', saveSettings);
  $('#resetSettingsBtn').addEventListener('click', resetSettings);
  $('#testConnectionBtn').addEventListener('click', testConnection);
  $('#refreshAllBtn').addEventListener('click', refreshAll);
  $('#packageForm').addEventListener('submit', startAndroidPackage);
  $('#packageBuildChannel').addEventListener('change', syncPackageChannelDefaults);
  $('#clearPackageLogBtn').addEventListener('click', clearPackageLog);
  $('#openPackageOutputBtn').addEventListener('click', openPackageOutputPath);

  $('#mailForm').addEventListener('submit', sendMail);
  $('#mailScope').addEventListener('change', () => {
    $('#mailAccountIds').disabled = $('#mailScope').value === 'all';
  });
  $('#searchPlayersBtn').addEventListener('click', loadPlayers);
  $('#loadMailsBtn').addEventListener('click', loadMails);

  $$('[data-open-picker]').forEach((button) => {
    button.addEventListener('click', () => openRewardDrawer(button.dataset.openPicker));
  });
  $$('[data-close-drawer]').forEach((entry) => {
    entry.addEventListener('click', closeRewardDrawer);
  });
  $('#rewardSearchInput').addEventListener('input', renderRewardPicker);
  $('#rewardCategoryFilter').addEventListener('change', renderRewardPicker);

  $('#cdkeyCreateForm').addEventListener('submit', createCdkeys);
  $('#loadCdkeysBtn').addEventListener('click', loadCdkeys);
  $('#bulkUpdateCdkeysBtn').addEventListener('click', bulkUpdateCdkeys);

  $('#poolSearchInput').addEventListener('input', renderGachaPools);
  $('#newPoolBtn').addEventListener('click', createBlankPool);
  $('#poolForm').addEventListener('submit', savePool);
  $('#deletePoolBtn').addEventListener('click', deletePoolOverride);
  $('#addPoolEntryBtn').addEventListener('click', () => {
    renderGachaEntryRows([...readGachaEntryRows(), createBlankGachaEntry()]);
  });

  $('#shopSearchInput').addEventListener('input', renderShopItems);
  $('#newShopItemBtn').addEventListener('click', createBlankShopItem);
  $('#shopForm').addEventListener('submit', saveShopItem);
  $('#deleteShopItemBtn').addEventListener('click', deleteShopItemOverride);
  $('#welfareGiftSearchInput').addEventListener('input', renderWelfareGifts);
  $('#newWelfareGiftBtn').addEventListener('click', createBlankWelfareGift);
  $('#welfareGiftForm').addEventListener('submit', saveWelfareGift);
  $('#deleteWelfareGiftBtn').addEventListener('click', deleteWelfareGiftOverride);
  $('#welfareGiftKind').addEventListener('change', toggleWelfareGiftModeFields);
  $('#shelterBuildingSearchInput').addEventListener('input', renderShelterBuildings);
  $('#newShelterBuildingBtn').addEventListener('click', createBlankShelterBuilding);
  $('#shelterBuildingForm').addEventListener('submit', saveShelterBuilding);
  $('#deleteShelterBuildingBtn').addEventListener('click', deleteShelterBuildingOverride);
  $('#shelterBuildingIcon').addEventListener('input', updateShelterBuildingImagePreviewFromForm);
  $('#shelterBuildingIconSrc').addEventListener('input', updateShelterBuildingImagePreviewFromForm);
  $('#pickShelterBuildingImageBtn').addEventListener('click', pickShelterBuildingImageFile);
  $('#addShelterBuildingLevelBtn').addEventListener('click', () => {
    const currentLevels = readShelterBuildingLevels();
    const nextLevel = currentLevels.reduce((max, entry) => Math.max(max, Number(entry.level) || 0), 0) + 1;
    renderShelterBuildingLevelRows([...currentLevels, createBlankShelterBuildingLevel(nextLevel)]);
  });

  $('#dungeonSearchInput').addEventListener('input', renderDungeons);
  $('#newDungeonChapterBtn').addEventListener('click', createBlankChapter);
  $('#newDungeonBtn').addEventListener('click', createBlankDungeon);
  $('#dungeonForm').addEventListener('submit', saveDungeon);
  $('#deleteDungeonBtn').addEventListener('click', deleteDungeonOverride);
  $('#addChapterRewardBtn').addEventListener('click', () => {
    renderRewardRangeRows('#chapterRewardRows', [...readRewardRangeRows('#chapterRewardRows'), createBlankRewardRange()], false);
  });
  $('#addStageRewardBtn').addEventListener('click', () => {
    renderRewardRangeRows('#stageRewardRows', [...readRewardRangeRows('#stageRewardRows'), createBlankRewardRange()], true);
  });
  $('#addDungeonEnemyBtn').addEventListener('click', () => {
    renderDungeonEnemyRows([...readDungeonEnemyRows(), createBlankDungeonEnemy('normal')]);
  });
  $('#addDungeonEliteBtn').addEventListener('click', () => {
    renderDungeonEnemyRows([...readDungeonEnemyRows(), createBlankDungeonEnemy('elite')]);
  });
  $('#syncDungeonEnemyJsonBtn').addEventListener('click', () => {
    syncDungeonEnemyJsonFromRows();
    showToast('敌人清单 JSON 已同步');
  });
  $('#loadDungeonEnemyJsonBtn').addEventListener('click', () => {
    renderDungeonEnemyRows(parseJsonField('#dungeonEnemyJson', []));
    $('#dungeonEnemyJson').dataset.dirty = 'false';
    showToast('敌人清单已载入表单');
  });
  $('#addDungeonBossBtn').addEventListener('click', () => {
    renderDungeonBossRows([...readDungeonBossEntries(), createBlankDungeonBossEntry()]);
  });
  $('#syncDungeonBossJsonBtn').addEventListener('click', () => {
    syncDungeonBossJsonFromRows();
    showToast('BOSS 波次 JSON 已同步');
  });
  $('#loadDungeonBossJsonBtn').addEventListener('click', () => {
    renderDungeonBossRows(parseJsonField('#dungeonBossWaves', []));
    $('#dungeonBossWaves').dataset.dirty = 'false';
    showToast('BOSS 波次已载入表单');
  });
  $('#dungeonEnemyJson').addEventListener('input', () => {
    $('#dungeonEnemyJson').dataset.dirty = 'true';
  });
  $('#dungeonBossWaves').addEventListener('input', () => {
    $('#dungeonBossWaves').dataset.dirty = 'true';
  });
  $('#loadDungeonBatchBtn').addEventListener('click', loadDungeonBatchJson);
  $('#saveDungeonBatchBtn').addEventListener('click', saveDungeonBatch);
}

function collapseScrollableSelect(select) {
  if (!select) return;
  const originalSize = Number(select.dataset.originalSize || 0);
  if (originalSize > 0) {
    select.size = originalSize;
  } else {
    select.size = 0;
    select.removeAttribute('size');
  }
  select.classList.remove('select-expanded');
  delete select.dataset.originalSize;
}

function collapseAllScrollableSelects(except = null) {
  $$('select.select-input.select-expanded').forEach((select) => {
    if (except && select === except) return;
    collapseScrollableSelect(select);
  });
}

function expandScrollableSelect(select) {
  if (!select || select.disabled) return;
  if (!select.classList.contains('select-expanded')) {
    select.dataset.originalSize = String(Number(select.getAttribute('size')) || 0);
  }
  collapseAllScrollableSelects(select);
  select.size = Math.max(2, Math.min(EXPANDED_SELECT_SIZE, select.options.length || 2));
  select.classList.add('select-expanded');
}

function bindScrollableSelects() {
  document.addEventListener('mousedown', (event) => {
    const select = event.target instanceof Element
      ? event.target.closest('select.select-input')
      : null;
    if (!select) {
      collapseAllScrollableSelects();
      return;
    }
    if (!select.classList.contains('select-expanded')) {
      event.preventDefault();
      expandScrollableSelect(select);
      select.focus();
    }
  });

  document.addEventListener('change', (event) => {
    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (select?.classList.contains('select-input')) {
      collapseScrollableSelect(select);
    }
  });

  document.addEventListener('keydown', (event) => {
    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!select?.classList.contains('select-input')) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === 'Tab') {
      collapseScrollableSelect(select);
    }
  });

  document.addEventListener('focusout', (event) => {
    const select = event.target instanceof HTMLSelectElement ? event.target : null;
    if (!select?.classList.contains('select-input')) return;
    window.setTimeout(() => {
      if (document.activeElement !== select) {
        collapseScrollableSelect(select);
      }
    }, 0);
  });
}

async function refreshAll() {
  const connected = await testConnection(false);
  if (!connected) {
    return;
  }
  await loadCatalog();
  if (state.view === 'cdkey') {
    await loadCdkeys();
  }
}

function setView(view) {
  if (!viewMeta[view]) return;
  state.view = view;
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $$('.view').forEach((section) => section.classList.remove('active'));
  $(`#${view}View`)?.classList.add('active');
  $('#viewTitle').textContent = viewMeta[view][0];
  $('#viewSubtitle').textContent = viewMeta[view][1];
  $('#globalSearchInput').style.display = view === 'catalog' ? '' : 'none';

  if (view === 'cdkey') {
    loadCdkeys();
  }
  if (view === 'mail') {
    loadPlayers();
    loadMails();
  }
  if (view === 'gacha') {
    renderGachaPools();
    renderPoolEditor(state.selectedPool);
  }
  if (view === 'enemy') {
    renderEnemyList();
    renderEnemyEditor(state.selectedEnemy);
  }
  if (view === 'shop') {
    renderShopItems();
    renderShopEditor(state.selectedShopItem);
  }
  if (view === 'welfare') {
    renderWelfareGifts();
    renderWelfareGiftEditor(state.selectedWelfareGift);
  }
  if (view === 'shelter') {
    renderShelterBuildings();
    renderShelterBuildingEditor(state.selectedShelterBuilding);
  }
  if (view === 'dungeon') {
    renderDungeons();
    renderDungeonEditor(state.selectedDungeon);
  }
  if (view === 'package') {
    syncPackageChannelDefaults();
  }
}

function syncSettingsInputs() {
  $('#apiBaseUrlInput').value = state.baseUrl;
  $('#gmSecretInput').value = state.gmSecret;
}

function saveSettings(event) {
  event.preventDefault();
  state.baseUrl = normalizeBaseUrl($('#apiBaseUrlInput').value);
  state.gmSecret = $('#gmSecretInput').value.trim();
  localStorage.setItem('survivor_gm_base_url', state.baseUrl);
  localStorage.setItem('survivor_gm_secret', state.gmSecret);
  showToast('设置已保存');
  refreshAll();
}

function resetSettings() {
  state.baseUrl = 'http://127.0.0.1:9000/api';
  state.gmSecret = 'survivor_gm_secret';
  localStorage.setItem('survivor_gm_base_url', state.baseUrl);
  localStorage.setItem('survivor_gm_secret', state.gmSecret);
  syncSettingsInputs();
  showToast('已恢复默认连接');
}

function bindPackageLogStream() {
  if (!window.gmDesktop?.onPackageLog) return;
  window.gmDesktop.onPackageLog((payload) => {
    appendPackageLog(payload?.text || '');
  });
}

function formatPackageVersionCode(date = new Date()) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ];
  return parts.join('');
}

function syncPackageDefaults() {
  const applicationIdInput = $('#packageApplicationId');
  const appNameInput = $('#packageAppName');
  const versionCodeInput = $('#packageVersionCode');
  const outputDirInput = $('#packageOutputDir');

  if (applicationIdInput && !applicationIdInput.value.trim()) {
    applicationIdInput.value = DEFAULT_PACKAGE_APPLICATION_ID;
  }
  if (appNameInput && !appNameInput.value.trim()) {
    appNameInput.value = DEFAULT_PACKAGE_APP_NAME;
  }
  if (versionCodeInput && !versionCodeInput.value.trim()) {
    versionCodeInput.value = formatPackageVersionCode();
  }
  if (outputDirInput && !outputDirInput.value.trim()) {
    outputDirInput.value = DEFAULT_PACKAGE_OUTPUT_DIR;
  }
}

function syncPackageChannelDefaults() {
  const channelInput = $('#packageBuildChannel');
  const debugInput = $('#packageWebViewDebugging');
  if (!channelInput || !debugInput || state.packageRunning) return;
  debugInput.checked = channelInput.value !== 'formal';
}

function clearPackageLog() {
  const output = $('#packageResultOutput');
  if (output) {
    output.value = '';
  }
  state.packageLastOutputPath = '';
}

function appendPackageLog(text) {
  const output = $('#packageResultOutput');
  if (!output || !text) return;
  output.value += text;
  output.scrollTop = output.scrollHeight;
}

function appendPackageLine(text = '') {
  appendPackageLog(`${text}\n`);
}

function readPackageOptions() {
  return {
    buildChannel: $('#packageBuildChannel').value,
    artifact: $('#packageArtifact').value,
    versionName: $('#packageVersionName').value.trim(),
    versionCode: $('#packageVersionCode').value.trim(),
    applicationId: $('#packageApplicationId').value.trim(),
    appName: $('#packageAppName').value.trim(),
    buildVersion: $('#packageBuildVersion').value.trim(),
    serverUrl: $('#packageServerUrl').value.trim(),
    outputDir: $('#packageOutputDir').value.trim(),
    gmNote: $('#packageGmNote').value.trim(),
    signingStoreFile: $('#packageSigningStoreFile').value.trim(),
    signingStorePassword: $('#packageSigningStorePassword').value,
    signingKeyAlias: $('#packageSigningKeyAlias').value.trim(),
    signingKeyPassword: $('#packageSigningKeyPassword').value,
    webViewDebugging: $('#packageWebViewDebugging').checked,
    clean: $('#packageCleanBuild').checked,
    skipDoctor: $('#packageSkipDoctor').checked
  };
}

function validatePackageOptions(options) {
  if (!options.versionName) {
    return '请填写版本号';
  }
  if (!/^[1-9]\d*$/.test(options.versionCode)) {
    return '版本编码必须大于 0';
  }
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(options.applicationId)) {
    return '应用包名格式不正确，例如 com.survivor.game';
  }
  if (!options.appName) {
    return '请填写应用名称';
  }
  if (!options.outputDir) {
    return '请填写输出目录';
  }
  const signingFields = [
    options.signingStoreFile,
    options.signingStorePassword,
    options.signingKeyAlias,
    options.signingKeyPassword
  ].filter(Boolean);
  if (signingFields.length > 0 && signingFields.length < 4) {
    return '正式签名配置需要同时填写签名文件、签名库密码、签名别名和签名密钥密码';
  }
  return '';
}

function setPackageRunning(running) {
  state.packageRunning = running;
  const startButton = $('#startPackageBtn');
  if (startButton) {
    startButton.textContent = running ? '打包中...' : '开始打包';
  }
}

async function startAndroidPackage(event) {
  event.preventDefault();
  if (state.packageRunning) return;
  if (!window.gmDesktop?.runAndroidPackage) {
    showToast('当前 GM 壳层不支持本地打包，请重启 GM 工具');
    return;
  }

  const options = readPackageOptions();
  const errorMessage = validatePackageOptions(options);
  if (errorMessage) {
    showToast(errorMessage);
    return;
  }

  clearPackageLog();
  setPackageRunning(true);
  appendPackageLine(`开始打包：${options.buildChannel === 'formal' ? '正式版本' : '测试版本'} / ${options.artifact.toUpperCase()}`);
  appendPackageLine('----------------------------------------');

  try {
    const result = await window.gmDesktop.runAndroidPackage(options);
    appendPackageLine('----------------------------------------');
    if (result?.success) {
      state.packageLastOutputPath = result.artifactPath || result.result?.artifactPath || '';
      appendPackageLine(`打包成功：${state.packageLastOutputPath || '已生成安装包'}`);
      showToast('打包成功');
    } else {
      const message = result?.error || '未知错误';
      appendPackageLine(`打包失败：${message}`);
      showToast(`打包失败：${message}`);
    }
  } catch (error) {
    appendPackageLine('----------------------------------------');
    appendPackageLine(`打包失败：${error.message || error}`);
    showToast(`打包失败：${error.message || error}`);
  } finally {
    setPackageRunning(false);
  }
}

async function openPackageOutputPath() {
  const targetPath = state.packageLastOutputPath || $('#packageOutputDir')?.value?.trim();
  if (!targetPath || !window.gmDesktop?.openPath) return;
  const result = await window.gmDesktop.openPath(targetPath);
  if (!result?.success) {
    showToast(`打开路径失败：${result?.error || '未知错误'}`);
  }
}

async function testConnection(showSuccess = true) {
  try {
    await api('/gm/health');
    setConnection(true, '已连接');
    if (showSuccess) {
      showToast('GM 服务连接正常');
    }
    return true;
  } catch (error) {
    setConnection(false, error.message || '连接失败');
    if (showSuccess) {
      showToast(error.message || '连接失败');
    }
    return false;
  }
}

function setConnection(ok, text) {
  $('#connectionDot').classList.toggle('ok', Boolean(ok));
  $('#connectionDot').classList.toggle('bad', !ok);
  $('#connectionText').textContent = text;
}

async function loadCatalog() {
  try {
    const catalog = await api('/gm/catalog');
    state.catalog = {
      resources: catalog.resources || [],
      items: catalog.items || [],
      equipment: catalog.equipment || [],
      enemySkills: catalog.enemySkills || [],
      gachaPools: catalog.gachaPools || [],
      shelterBuildings: catalog.shelterBuildings || [],
      dungeonChapters: catalog.dungeonChapters || [],
      dungeons: catalog.dungeons || [],
      shopItems: catalog.shopItems || [],
      welfareGifts: catalog.welfareGifts || [],
      enemies: catalog.enemies || []
    };
    renderTypeFilter();
    renderCatalogList();
    state.selectedEnemy = state.selectedEnemy?.id
      ? ((state.catalog.enemies || []).find((entry) => entry.id === state.selectedEnemy.id) || null)
      : null;
    renderEnemyList();
    if (state.view === 'enemy') {
      renderEnemyEditor(state.selectedEnemy);
    }
    renderReferenceDatalists();
    renderGachaPools();
    renderShopItems();
    renderWelfareGifts();
    state.selectedShelterBuilding = state.selectedShelterBuilding?.id
      ? ((state.catalog.shelterBuildings || []).find((entry) => entry.id === state.selectedShelterBuilding.id) || null)
      : null;
    state.selectedWelfareGift = state.selectedWelfareGift?.id
      ? ((state.catalog.welfareGifts || []).find((entry) => entry.id === state.selectedWelfareGift.id) || null)
      : null;
    renderShelterBuildings();
    if (state.view === 'welfare') {
      renderWelfareGiftEditor(state.selectedWelfareGift);
    }
    if (state.view === 'shelter') {
      renderShelterBuildingEditor(state.selectedShelterBuilding);
    }
    renderDungeons();
    renderRewardLists();
    renderRewardPicker();
  } catch (error) {
    showToast(`资源目录加载失败：${error.message}`);
  }
}

function renderTypeFilter() {
  const select = $('#typeFilter');
  const key = catalogConfig[state.catalogType].typeField;
  const values = [...new Set((state.catalog[state.catalogType] || []).map((entry) => entry[key]).filter(Boolean))];
  select.innerHTML = '<option value="">全部类型</option>';
  values.sort((left, right) => String(left).localeCompare(String(right), 'zh-Hans-CN-u-co-pinyin')).forEach((value) => {
    select.append(new Option(value, value));
  });
}

function renderCatalogList() {
  const list = $('#catalogList');
  const keyword = $('#globalSearchInput').value.trim().toLowerCase();
  const rarity = $('#rarityFilter').value;
  const typeValue = $('#typeFilter').value;
  const typeKey = catalogConfig[state.catalogType].typeField;
  const rows = (state.catalog[state.catalogType] || []).filter((entry) => {
    const text = `${entry.id || ''} ${entry.name || ''} ${entry.description || ''}`.toLowerCase();
    if (keyword && !text.includes(keyword)) return false;
    if (rarity && entry.rarity !== rarity && !(entry.rarities || []).includes(rarity)) return false;
    if (typeValue && entry[typeKey] !== typeValue) return false;
    return true;
  }).sort((left, right) => compareCatalogEntries(left, right, typeKey));

  if (rows.length === 0) {
    list.innerHTML = '<div class="empty-state">没有匹配的条目</div>';
    return;
  }

  list.innerHTML = rows.map((entry) => `
    <button class="catalog-row ${state.selectedEntry?.id === entry.id ? 'active' : ''}" data-id="${escapeAttr(entry.id)}" type="button">
      ${renderThumb(entry)}
      <span>
        <span class="row-title">${escapeHtml(entry.name || entry.id)}</span>
        <span class="row-meta">${escapeHtml(entry.id)} · ${escapeHtml(entry.type || entry.slot || entry.category || '')}</span>
      </span>
      ${renderRarity(entry)}
    </button>
  `).join('');

  list.querySelectorAll('.catalog-row').forEach((row) => {
    row.addEventListener('click', () => {
      const entry = rows.find((item) => item.id === row.dataset.id);
      state.selectedEntry = entry || null;
      renderCatalogList();
      renderCatalogEditor(entry);
    });
  });
}

function compareCatalogEntries(left, right, typeKey) {
  const leftType = String(left?.[typeKey] || '');
  const rightType = String(right?.[typeKey] || '');
  const typeCompare = leftType.localeCompare(rightType, 'zh-Hans-CN-u-co-pinyin');
  if (typeCompare !== 0) return typeCompare;

  const rarityCompare = getCatalogEntryRarityRank(right) - getCatalogEntryRarityRank(left);
  if (rarityCompare !== 0) return rarityCompare;

  const leftName = String(left?.name || left?.id || '');
  const rightName = String(right?.name || right?.id || '');
  const nameCompare = leftName.localeCompare(rightName, 'zh-Hans-CN-u-co-pinyin');
  if (nameCompare !== 0) return nameCompare;

  return String(left?.id || '').localeCompare(String(right?.id || ''), 'en');
}

function getCatalogEntryRarityRank(entry) {
  const rarity = entry?.rarity || (entry?.rarities || [])[0] || 'common';
  return raritySortOrder[rarity] || 0;
}

function renderCatalogEditor(entry) {
  const type = state.catalogType;
  const effective = entry || {};
  const hasGmOverride = entry?.source === 'gm';
  $('#editorTitle').textContent = entry ? (entry.name || entry.id) : `新建${catalogConfig[type].label}`;
  $('#editorMeta').textContent = entry ? `${entry.id} · ${catalogConfig[type].label}` : '填写 ID 后保存';
  $('#editorSource').textContent = hasGmOverride ? 'GM改动' : '基础配置';

  $('#catalogId').value = effective.id || '';
  $('#catalogId').disabled = Boolean(entry?.id);
  $('#catalogName').value = effective.name || '';
  $('#catalogIcon').value = effective.icon || effective.fallback || '';
  $('#catalogIconSrc').value = effective.iconSrc || effective.src || '';
  $('#catalogTypeField').value = type === 'enemySkills' ? (effective.effectType || 'damage') : (effective.type || effective.slot || '');
  $('#catalogRarity').value = effective.rarity || (effective.rarities || [])[0] || 'common';
  $('#catalogStackLimit').value = effective.stackLimit || '';
  $('#catalogRarities').value = (effective.rarities || []).join(',');
  $('#catalogDescription').value = effective.description || '';
  $('#catalogEffect').value = type === 'enemySkills' ? stringifyJson(getEnemySkillEditableConfig(effective)) : stringifyJson(effective.effect);
  $('#catalogStats').value = stringifyJson(effective.stats || effective.fixedStats);
  $('#catalogStatRules').value = stringifyJson(effective.statRules);
  $('#deleteCatalogBtn').disabled = !hasGmOverride;
  $('#deleteCatalogBtn').title = hasGmOverride
    ? '删除这条 GM 改动；基础条目会恢复默认，GM 新增条目会从目录移除'
    : '当前条目没有 GM 改动可撤销';
  updateImagePreview(effective);
}

function getEnemySkillEditableConfig(skill) {
  const config = { ...(skill || {}) };
  ['id', 'name', 'icon', 'iconSrc', 'src', 'rarity', 'category', 'source', 'updatedAt', 'deleted', 'description'].forEach((field) => {
    delete config[field];
  });
  return config;
}

function createBlankCatalogEntry() {
  state.selectedEntry = null;
  renderCatalogList();
  renderCatalogEditor({
    id: '',
    name: '',
    category: catalogConfig[state.catalogType].category,
    rarity: 'common',
    effectType: state.catalogType === 'enemySkills' ? 'damage' : undefined,
    multiplier: state.catalogType === 'enemySkills' ? 1 : undefined,
    cooldownTurns: state.catalogType === 'enemySkills' ? 0 : undefined,
    range: state.catalogType === 'enemySkills' ? 1 : undefined,
    targetType: state.catalogType === 'enemySkills' ? 'enemy' : undefined,
    targetCount: state.catalogType === 'enemySkills' ? 1 : undefined,
    stackLimit: state.catalogType === 'items' ? 99 : undefined,
    rarities: state.catalogType === 'equipment' ? ['common'] : undefined
  });
}

async function saveCatalogEntry(event) {
  event.preventDefault();
  const type = state.catalogType;
  const id = $('#catalogId').value.trim();
  if (!id) {
    showToast('请填写条目 ID');
    return;
  }

  const payload = {
    id,
    name: $('#catalogName').value.trim(),
    icon: $('#catalogIcon').value.trim(),
    iconSrc: $('#catalogIconSrc').value.trim(),
    rarity: $('#catalogRarity').value,
    description: $('#catalogDescription').value.trim()
  };

  const typeValue = $('#catalogTypeField').value.trim();
  try {
    if (state.catalogType === 'equipment') {
      payload.slot = typeValue;
      payload.rarities = $('#catalogRarities').value.split(',').map((entry) => entry.trim()).filter(Boolean);
      payload.statRules = parseJsonField('#catalogStatRules', {});
      payload.fixedStats = parseJsonField('#catalogStats', {});
    } else if (state.catalogType === 'enemySkills') {
      Object.assign(payload, parseJsonField('#catalogEffect', {}));
      payload.effectType = typeValue || payload.effectType || 'damage';
    } else if (state.catalogType === 'items') {
      payload.type = typeValue;
      payload.stackLimit = Number($('#catalogStackLimit').value) || 1;
      payload.effect = parseJsonField('#catalogEffect', null);
      payload.stats = parseJsonField('#catalogStats', null);
    } else {
      payload.type = 'resource';
      payload.fallback = payload.icon;
      payload.src = payload.iconSrc;
    }
  } catch (error) {
    showToast(error.message);
    return;
  }

  try {
    await api(`/gm/catalog/${type}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload
    });
    showToast('资源条目已保存');
    await loadCatalog();
    const next = (state.catalog[type] || []).find((entry) => entry.id === id);
    state.selectedEntry = next || null;
    renderCatalogEditor(next);
  } catch (error) {
    showToast(`保存失败：${error.message}`);
  }
}

async function deleteCatalogOverride() {
  const id = $('#catalogId').value.trim();
  if (!id) return;
  if (state.selectedEntry?.source !== 'gm') {
    showToast('当前条目没有 GM 改动可撤销');
    return;
  }
  if (!confirm(`确认撤销 ${id} 的 GM 改动吗？基础条目会恢复为基础配置，GM 新增条目会从目录中移除。`)) return;
  try {
    await api(`/gm/catalog/${state.catalogType}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('GM 改动已撤销');
    state.selectedEntry = null;
    await loadCatalog();
    renderCatalogEditor(null);
  } catch (error) {
    showToast(`移除失败：${error.message}`);
  }
}

function renderEnemyList() {
  const list = $('#enemyList');
  if (!list) return;
  const keyword = $('#enemySearchInput')?.value?.trim().toLowerCase() || '';
  const rows = [...(state.catalog.enemies || [])]
    .filter((entry) => {
      const text = `${entry.id || ''} ${entry.name || ''} ${entry.description || ''}`.toLowerCase();
      return !keyword || text.includes(keyword);
    })
    .sort((left, right) => {
      const leftName = String(left?.name || left?.id || '');
      const rightName = String(right?.name || right?.id || '');
      const nameCompare = leftName.localeCompare(rightName, 'zh-Hans-CN-u-co-pinyin');
      if (nameCompare !== 0) return nameCompare;
      return String(left?.id || '').localeCompare(String(right?.id || ''), 'en');
    });

  list.innerHTML = rows.length ? rows.map((entry) => `
    <button class="catalog-row ${state.selectedEnemy?.id === entry.id ? 'active' : ''}" data-enemy-id="${escapeAttr(entry.id)}" type="button">
      ${renderThumb(entry)}
      <span>
        <span class="row-title">${escapeHtml(entry.name || entry.id)}</span>
        <span class="row-meta">${escapeHtml(entry.id)}</span>
      </span>
      <span class="rarity-chip">${entry.source === 'gm' ? 'GM' : '基础'}</span>
    </button>
  `).join('') : '<div class="empty-state">没有匹配的怪物</div>';

  list.querySelectorAll('[data-enemy-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedEnemy = rows.find((entry) => entry.id === button.dataset.enemyId) || null;
      renderEnemyList();
      renderEnemyEditor(state.selectedEnemy);
    });
  });
}

function renderEnemyEditor(entry) {
  const effective = entry || {};
  const hasGmOverride = entry?.source === 'gm';
  $('#enemyEditorTitle').textContent = entry ? (entry.name || entry.id) : '新建怪物';
  $('#enemyEditorMeta').textContent = entry ? `${entry.id} · 怪物信息` : '填写怪物 ID 后保存';
  $('#enemyEditorSource').textContent = hasGmOverride ? 'GM改动' : '基础配置';
  $('#enemyId').value = effective.id || '';
  $('#enemyId').disabled = Boolean(entry?.id);
  $('#enemyName').value = effective.name || '';
  $('#enemyArtSrc').value = effective.portrait || effective.iconSrc || effective.src || '';
  $('#enemyDescription').value = effective.description || '';
  $('#deleteEnemyBtn').disabled = !hasGmOverride;
  $('#deleteEnemyBtn').title = hasGmOverride ? '撤销这条 GM 怪物配置' : '当前怪物没有 GM 改动可撤销';
  updateEnemyImagePreview(effective);
}

function createBlankEnemyEntry() {
  state.selectedEnemy = null;
  renderEnemyList();
  renderEnemyEditor({
    id: '',
    name: '',
    description: '',
    iconSrc: ''
  });
}

async function saveEnemyEntry(event) {
  event.preventDefault();
  const id = $('#enemyId').value.trim();
  if (!id) {
    showToast('请填写怪物 ID');
    return;
  }

  const artSrc = $('#enemyArtSrc').value.trim();
  const payload = {
    id,
    category: 'enemy',
    name: $('#enemyName').value.trim(),
    description: $('#enemyDescription').value.trim(),
    portrait: artSrc,
    iconSrc: artSrc,
    src: artSrc
  };

  try {
    await api(`/gm/catalog/enemies/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: payload
    });
    showToast('怪物信息已保存');
    await loadCatalog();
    const next = (state.catalog.enemies || []).find((entry) => entry.id === id) || null;
    state.selectedEnemy = next;
    renderEnemyEditor(next);
  } catch (error) {
    showToast(`怪物信息保存失败：${error.message}`);
  }
}

async function deleteEnemyOverride() {
  const id = $('#enemyId').value.trim();
  if (!id) return;
  if (state.selectedEnemy?.source !== 'gm') {
    showToast('当前怪物没有 GM 改动可撤销');
    return;
  }
  if (!confirm(`确认撤销 ${id} 的 GM 怪物配置吗？`)) return;
  try {
    await api(`/gm/catalog/enemies/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('怪物 GM 改动已撤销');
    state.selectedEnemy = null;
    await loadCatalog();
    renderEnemyEditor(null);
  } catch (error) {
    showToast(`怪物配置移除失败：${error.message}`);
  }
}

function handleEnemyImageFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    $('#enemyArtSrc').value = String(reader.result || '');
    updateEnemyImagePreviewFromForm();
  };
  reader.readAsDataURL(file);
}

function updateEnemyImagePreviewFromForm() {
  updateEnemyImagePreview({
    portrait: $('#enemyArtSrc').value.trim(),
    iconSrc: $('#enemyArtSrc').value.trim(),
    name: $('#enemyName').value.trim(),
    id: $('#enemyId').value.trim()
  });
}

function updateEnemyImagePreview(entry) {
  const preview = $('#enemyImagePreview');
  const src = resolveAssetSrc(entry.portrait || entry.iconSrc || entry.src || '');
  if (src) {
    preview.innerHTML = `<img src="${escapeAttr(src)}" alt="${escapeAttr(entry.name || entry.id || 'enemy')}">`;
  } else {
    preview.textContent = 'IMG';
  }
}

function handleImageFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    $('#catalogIconSrc').value = String(reader.result || '');
    updateImagePreviewFromForm();
  };
  reader.readAsDataURL(file);
}

function updateImagePreviewFromForm() {
  updateImagePreview({
    iconSrc: $('#catalogIconSrc').value.trim(),
    icon: $('#catalogIcon').value.trim(),
    name: $('#catalogName').value.trim()
  });
}

function updateImagePreview(entry) {
  const preview = $('#catalogImagePreview');
  const src = resolveAssetSrc(entry.iconSrc || entry.src || '');
  if (src) {
    preview.innerHTML = `<img src="${escapeAttr(src)}" alt="${escapeAttr(entry.name || entry.id || 'icon')}">`;
  } else {
    preview.textContent = entry.icon || 'IMG';
  }
}

async function loadPlayers() {
  try {
    const keyword = $('#playerSearchInput').value.trim();
    const data = await api(`/gm/players?keyword=${encodeURIComponent(keyword)}&limit=50`);
    const players = data.players || [];
    $('#playerList').innerHTML = players.length ? players.map((player) => `
      <div class="table-row">
        <div>
          <div class="table-title">${escapeHtml(player.nickname || player.account || player.id)}</div>
          <div class="table-meta">${escapeHtml(player.id)} · ${escapeHtml(player.account || '')}</div>
        </div>
        <button class="ghost-button" data-player-id="${escapeAttr(player.id)}" type="button">加入</button>
      </div>
    `).join('') : '<div class="empty-state">没有匹配玩家</div>';
    $('#playerList').querySelectorAll('[data-player-id]').forEach((button) => {
      button.addEventListener('click', () => appendAccountId(button.dataset.playerId));
    });
  } catch (error) {
    showToast(`玩家查询失败：${error.message}`);
  }
}

function appendAccountId(id) {
  const textarea = $('#mailAccountIds');
  const values = textarea.value.split(/[\s,;，；]+/).filter(Boolean);
  if (!values.includes(id)) values.push(id);
  textarea.value = values.join('\n');
}

async function sendMail(event) {
  event.preventDefault();
  const payload = {
    scope: $('#mailScope').value,
    accountIds: $('#mailAccountIds').value,
    sender: $('#mailSender').value.trim() || 'GM',
    title: $('#mailTitle').value.trim(),
    body: $('#mailBody').value.trim(),
    expireAt: dateTimeLocalToIso($('#mailExpireAt').value),
    attachments: state.mailRewards
  };
  try {
    const result = await api('/gm/mail/send', { method: 'POST', body: payload });
    showToast(`邮件已发送：${result.insertedCount || 0} 封`);
    await loadMails();
  } catch (error) {
    showToast(`邮件发送失败：${error.message}`);
  }
}

async function loadMails() {
  try {
    const data = await api('/gm/mails?limit=60');
    const mails = data.mails || [];
    $('#mailHistory').innerHTML = mails.length ? mails.map((mail) => `
      <div class="table-row">
        <div>
          <div class="table-title">${escapeHtml(mail.title || '未命名邮件')}</div>
          <div class="table-meta">${escapeHtml(mail.accountId)} · 附件 ${mail.attachments?.length || 0} · ${formatDate(mail.createdAt)}</div>
        </div>
        <span class="rarity-chip">${mail.claimedAt ? '已领取' : '未领取'}</span>
      </div>
    `).join('') : '<div class="empty-state">暂无邮件记录</div>';
  } catch (error) {
    showToast(`邮件记录加载失败：${error.message}`);
  }
}

function openRewardDrawer(target) {
  state.pickerTarget = target;
  $('#rewardDrawer').classList.add('open');
  $('#rewardDrawer').setAttribute('aria-hidden', 'false');
  renderRewardPicker();
}

function closeRewardDrawer() {
  $('#rewardDrawer').classList.remove('open');
  $('#rewardDrawer').setAttribute('aria-hidden', 'true');
}

function renderRewardPicker() {
  const keyword = $('#rewardSearchInput')?.value?.trim().toLowerCase() || $('#globalSearchInput').value.trim().toLowerCase();
  const category = $('#rewardCategoryFilter')?.value || '';
  const entries = [...(state.catalog.resources || []), ...(state.catalog.items || [])].filter((entry) => {
    if (category && entry.category !== category) return false;
    const text = `${entry.id || ''} ${entry.name || ''} ${entry.description || ''}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });
  const list = $('#rewardCatalogList');
  if (!list) return;
  list.innerHTML = entries.length ? entries.map((entry) => `
    <button class="drawer-item" data-id="${escapeAttr(entry.id)}" data-category="${escapeAttr(entry.category)}" type="button">
      ${renderThumb(entry)}
      <span>
        <span class="row-title">${escapeHtml(entry.name || entry.id)}</span>
        <span class="row-meta">${escapeHtml(entry.id)} · ${getRewardTypeLabel(entry)}</span>
      </span>
      ${renderRarity(entry)}
    </button>
  `).join('') : '<div class="empty-state">没有匹配的奖励</div>';

  list.querySelectorAll('.drawer-item').forEach((button) => {
    button.addEventListener('click', () => {
      const source = button.dataset.category === 'resource' ? state.catalog.resources : state.catalog.items;
      const entry = source.find((item) => item.id === button.dataset.id);
      addReward(entry);
    });
  });
}

function addReward(entry) {
  if (!entry) return;
  const amount = Math.max(1, Number($('#rewardAmountInput').value) || 1);
  const target = getRewardCollection(state.pickerTarget);
  const type = entry.category === 'resource' ? 'resource' : (entry.type === 'fragment' ? 'fragment' : 'item');
  const existing = target.find((reward) => reward.type === type && reward.id === entry.id);
  if (existing) {
    existing.amount += amount;
  } else {
    target.push({ type, id: entry.id, amount });
  }
  renderRewardLists();
}

function getRewardCollection(targetKey) {
  if (targetKey === 'cdkey') return state.cdkeyRewards;
  if (targetKey === 'welfare') return state.welfareGiftRewards;
  return state.mailRewards;
}

function renderRewardLists() {
  renderRewardList('#mailRewards', state.mailRewards);
  renderRewardList('#cdkeyRewards', state.cdkeyRewards);
  renderRewardList('#welfareGiftRewards', state.welfareGiftRewards, '未添加奖励');
}

function renderRewardList(selector, rewards, emptyText = '未添加附件') {
  const root = $(selector);
  if (!root) return;
  root.innerHTML = rewards.length ? rewards.map((reward, index) => {
    const entry = findRewardCatalogEntry(reward);
    return `
      <span class="reward-pill">
        ${escapeHtml(entry?.name || reward.id)} × ${reward.amount}
        <button data-remove-reward="${index}" data-list="${selector}" type="button">×</button>
      </span>
    `;
  }).join('') : `<span class="table-meta">${escapeHtml(emptyText)}</span>`;
  root.querySelectorAll('[data-remove-reward]').forEach((button) => {
    button.addEventListener('click', () => {
      rewards.splice(Number(button.dataset.removeReward), 1);
      renderRewardLists();
    });
  });
}

function findRewardCatalogEntry(reward) {
  const source = reward.type === 'resource' ? state.catalog.resources : state.catalog.items;
  return source.find((entry) => entry.id === reward.id);
}

function getRewardOptions() {
  return [
    ...(state.catalog.resources || []).map((entry) => ({ id: entry.id, name: entry.name || entry.id, typeLabel: getRewardTypeLabel(entry) })),
    ...(state.catalog.items || []).map((entry) => ({ id: entry.id, name: entry.name || entry.id, typeLabel: getRewardTypeLabel(entry) })),
    { id: 'random_fragment', name: '随机英雄碎片', typeLabel: '商城' },
    { id: 'rare_fragment', name: '稀有英雄碎片', typeLabel: '商城' },
    { id: 'epic_fragment', name: '史诗英雄碎片', typeLabel: '商城' },
    ...Object.entries(rarityLabels).map(([id, name]) => ({ id, name: `${name}品质`, typeLabel: '品质' }))
  ];
}

function getEnemyOptions() {
  return (state.catalog.enemies || [])
    .map((entry) => ({ id: entry.id, name: entry.name || entry.id, typeLabel: '敌人' }))
    .sort((left, right) => {
      const nameCompare = String(left.name || left.id || '').localeCompare(String(right.name || right.id || ''), 'zh-Hans-CN-u-co-pinyin');
      if (nameCompare !== 0) return nameCompare;
      return String(left.id || '').localeCompare(String(right.id || ''), 'en');
    });
}

function formatNamedDisplay(id, options) {
  if (!id) return '';
  const option = options.find((entry) => entry.id === id);
  return option?.name || id;
}

function parseNamedInput(raw, options) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const suffixMatch = value.match(/\(([^()]+)\)\s*$/);
  if (suffixMatch) {
    const suffixId = suffixMatch[1].trim();
    if (options.some((entry) => entry.id === suffixId)) return suffixId;
  }
  const exactId = options.find((entry) => entry.id === value);
  if (exactId) return exactId.id;
  const exactName = options.find((entry) => entry.name === value);
  if (exactName) return exactName.id;
  const combined = options.find((entry) => `${entry.name} (${entry.id})` === value);
  return combined?.id || value;
}

function formatRewardDisplay(id) {
  return formatNamedDisplay(id, getRewardOptions());
}

function parseRewardInput(raw) {
  return parseNamedInput(raw, getRewardOptions());
}

function renderRewardSelectOptions(selectedId = '', placeholder = '请选择') {
  const normalizedSelectedId = String(selectedId || '').trim();
  const options = getRewardOptions();
  const placeholderOption = `<option value="">${escapeHtml(placeholder)}</option>`;
  const selectedExists = normalizedSelectedId && options.some((entry) => entry.id === normalizedSelectedId);
  const customOption = normalizedSelectedId && !selectedExists
    ? `<option value="${escapeAttr(normalizedSelectedId)}" selected>${escapeHtml(formatRewardDisplay(normalizedSelectedId))}</option>`
    : '';
  const rewardOptions = options.map((entry) => `
    <option value="${escapeAttr(entry.id)}" ${entry.id === normalizedSelectedId ? 'selected' : ''}>
      ${escapeHtml(`${entry.name || entry.id} (${entry.id}) · ${entry.typeLabel || getRewardTypeLabel(entry)}`)}
    </option>
  `).join('');
  return `${placeholderOption}${customOption}${rewardOptions}`;
}

function renderEnemySelectOptions(selectedId = '', placeholder = '请选择怪物') {
  const normalizedSelectedId = String(selectedId || '').trim();
  const options = getEnemyOptions();
  const placeholderOption = `<option value="">${escapeHtml(placeholder)}</option>`;
  const selectedExists = normalizedSelectedId && options.some((entry) => entry.id === normalizedSelectedId);
  const customOption = normalizedSelectedId && !selectedExists
    ? `<option value="${escapeAttr(normalizedSelectedId)}" selected>${escapeHtml(formatEnemyDisplay(normalizedSelectedId))}</option>`
    : '';
  const enemyOptions = options.map((entry) => `
    <option value="${escapeAttr(entry.id)}" ${entry.id === normalizedSelectedId ? 'selected' : ''}>
      ${escapeHtml(`${entry.name || entry.id} (${entry.id})`)}
    </option>
  `).join('');
  return `${placeholderOption}${customOption}${enemyOptions}`;
}

function renderGachaTargetSelectOptions(type, selectedValue = '') {
  if (type === 'fragment' || type === 'hero' || type === 'equipment') {
    const normalizedSelectedId = parseRarityInput(selectedValue) || String(selectedValue || '').trim();
    const placeholderOption = '<option value="">请选择品质</option>';
    const rarityOptions = Object.entries(rarityLabels).map(([value, label]) => `
      <option value="${escapeAttr(value)}" ${value === normalizedSelectedId ? 'selected' : ''}>${escapeHtml(label)}</option>
    `).join('');
    return `${placeholderOption}${rarityOptions}`;
  }
  return renderRewardSelectOptions(parseRewardInput(selectedValue) || String(selectedValue || '').trim(), '请选择资源或道具');
}

function formatEnemyDisplay(id) {
  return formatNamedDisplay(id, getEnemyOptions());
}

function parseEnemyInput(raw) {
  return parseNamedInput(raw, getEnemyOptions());
}

function getEnemySkillOptions() {
  return (state.catalog.enemySkills || []).map((entry) => ({ id: entry.id, name: entry.name || entry.id, typeLabel: '敌人技能' }));
}

function formatEnemySkillDisplay(id) {
  return formatNamedDisplay(id, getEnemySkillOptions());
}

function parseEnemySkillInput(raw) {
  return parseNamedInput(raw, getEnemySkillOptions());
}

function formatEnemySkillListDisplay(skillIds) {
  return (Array.isArray(skillIds) ? skillIds : [])
    .map((skillId) => formatEnemySkillDisplay(skillId))
    .filter(Boolean)
    .join(', ');
}

function parseEnemySkillListInput(raw) {
  return String(raw || '')
    .split(/[,，；\n]+/)
    .map((entry) => parseEnemySkillInput(entry.trim()))
    .filter(Boolean);
}

function getEnemySkillIdsFromEntry(entry) {
  if (Array.isArray(entry?.skillIds)) {
    return entry.skillIds;
  }
  if (Array.isArray(entry?.skillRefs)) {
    return entry.skillRefs
      .map((ref) => typeof ref === 'string' ? ref : (ref?.skillId || ref?.id || ref?.refId || ''))
      .filter(Boolean);
  }
  return [];
}

function getRarityOptions() {
  return Object.entries(rarityLabels).map(([id, name]) => ({ id, name }));
}

function formatRarityDisplay(id) {
  return formatNamedDisplay(id, getRarityOptions());
}

function parseRarityInput(raw) {
  const parsed = parseNamedInput(raw, getRarityOptions());
  if (rarityLabels[parsed]) return parsed;
  return parseNamedInput(String(raw || '').replace(/品质$/, ''), getRarityOptions());
}

function renderReferenceDatalists() {
  const rewardList = $('#rewardTargetOptions');
  if (rewardList) {
    rewardList.innerHTML = getRewardOptions().map((entry) =>
      `<option value="${escapeAttr(entry.name)}" label="${escapeAttr(`(${entry.id}) · ${entry.typeLabel}`)}"></option>`
    ).join('');
  }

  const enemyList = $('#enemyIdOptions');
  if (enemyList) {
    enemyList.innerHTML = getEnemyOptions().map((entry) =>
      `<option value="${escapeAttr(entry.name)}" label="${escapeAttr(`(${entry.id})`)}"></option>`
    ).join('');
  }

  const enemySkillList = $('#enemySkillOptions');
  if (enemySkillList) {
    enemySkillList.innerHTML = getEnemySkillOptions().map((entry) =>
      `<option value="${escapeAttr(entry.name)}" label="${escapeAttr(`(${entry.id})`)}"></option>`
    ).join('');
  }
}

function getRewardTypeLabel(entry) {
  if (entry?.category === 'resource') return '资源';
  if (entry?.type === 'fragment') return '英雄碎片';
  return '道具';
}

function renderGachaPools() {
  const root = $('#poolList');
  if (!root) return;
  const keyword = $('#poolSearchInput')?.value?.trim().toLowerCase() || '';
  const pools = (state.catalog.gachaPools || []).filter((pool) => {
    const text = `${pool.id || ''} ${pool.name || ''} ${pool.description || ''}`.toLowerCase();
    return !keyword || text.includes(keyword);
  });

  root.innerHTML = pools.length ? pools.map((pool) => `
    <button class="catalog-row ${state.selectedPool?.id === pool.id ? 'active' : ''}" data-pool-id="${escapeAttr(pool.id)}" type="button">
      <span class="thumb">${escapeHtml(pool.icon || '池')}</span>
      <span>
        <span class="row-title">${escapeHtml(pool.name || pool.id)}</span>
        <span class="row-meta">${escapeHtml(pool.id)} · ${pool.entries?.length || 0} 条 · 总权重 ${formatNumber(getPoolTotalWeight(pool))}</span>
      </span>
      <span class="rarity-chip">${pool.source === 'gm' ? 'GM' : '基础'}</span>
    </button>
  `).join('') : '<div class="empty-state">没有匹配的奖池</div>';

  root.querySelectorAll('[data-pool-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedPool = pools.find((pool) => pool.id === button.dataset.poolId) || null;
      renderGachaPools();
      renderPoolEditor(state.selectedPool);
    });
  });
}

function getPoolTotalWeight(pool) {
  return (pool?.entries || []).reduce((sum, entry) => sum + (Number(entry.weight) || 0), 0);
}

function renderPoolEditor(pool) {
  const effective = pool || {};
  const hasGmOverride = pool?.source === 'gm';
  const firstCostKey = Object.keys(effective.costs || {})[0] || 'diamond';
  const firstCost = effective.costs?.[firstCostKey] || {};
  $('#poolEditorTitle').textContent = pool ? (pool.name || pool.id) : '新建奖池';
  $('#poolEditorMeta').textContent = pool ? `${pool.id} · 总权重 ${formatNumber(getPoolTotalWeight(pool))}` : '填写 ID 后保存';
  $('#poolEditorSource').textContent = hasGmOverride ? 'GM改动' : '基础配置';
  $('#poolId').value = effective.id || '';
  $('#poolId').disabled = Boolean(pool?.id);
  $('#poolName').value = effective.name || '';
  $('#poolIcon').value = effective.icon || '';
  $('#poolCostResource').innerHTML = renderRewardSelectOptions(firstCostKey, '请选择消耗资源');
  $('#poolCostSingle').value = firstCost.single ?? '';
  $('#poolCostTen').value = firstCost.ten ?? '';
  $('#poolDescription').value = effective.description || '';
  $('#deletePoolBtn').disabled = !hasGmOverride;
  renderGachaEntryRows(effective.entries || []);
}

function createBlankPool() {
  state.selectedPool = null;
  renderGachaPools();
  renderPoolEditor({
    id: '',
    type: 'mixed',
    name: '',
    icon: '池',
    costs: { diamond: { single: 100, ten: 950 } },
    entries: [createBlankGachaEntry()]
  });
}

function createBlankGachaEntry() {
  const suffix = Math.random().toString(36).slice(2, 7);
  return { id: `item_${suffix}`, type: 'item', itemId: '', min: 1, max: 1, weight: 1, label: '', rateText: '1%' };
}

function renderGachaEntryRows(entries) {
  const root = $('#poolEntryRows');
  if (!root) return;
  root.innerHTML = entries.length ? entries.map((entry, index) => `
    <div class="editable-row pool-entry-grid" data-entry-index="${index}">
      <input class="text-input" data-field="id" value="${escapeAttr(entry.id || '')}" placeholder="条目 ID">
      <select class="select-input" data-field="type">
        ${Object.entries(gachaEntryTypeLabels).map(([value, label]) =>
          `<option value="${escapeAttr(value)}" ${entry.type === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
        ).join('')}
      </select>
      <select class="select-input" data-field="target">
        ${renderGachaTargetSelectOptions(entry.type || 'item', getGachaEntryTarget(entry))}
      </select>
      <input class="text-input" data-field="min" type="number" min="0" value="${escapeAttr(entry.min ?? '')}" placeholder="最小">
      <input class="text-input" data-field="max" type="number" min="0" value="${escapeAttr(entry.max ?? '')}" placeholder="最大">
      <input class="text-input" data-field="weight" type="number" min="0" step="0.01" value="${escapeAttr(entry.weight ?? '')}" placeholder="概率">
      <input class="text-input" data-field="label" value="${escapeAttr(entry.label || '')}" placeholder="显示文案">
      <button class="icon-button" data-remove-row="${index}" type="button">×</button>
    </div>
  `).join('') : '<div class="empty-state">暂未配置奖池条目</div>';

  root.querySelectorAll('[data-remove-row]').forEach((button) => {
    button.addEventListener('click', () => {
      const rows = readGachaEntryRows();
      rows.splice(Number(button.dataset.removeRow), 1);
      renderGachaEntryRows(rows);
    });
  });

  root.querySelectorAll('[data-field="type"]').forEach((select) => {
    select.addEventListener('change', () => {
      const rows = readGachaEntryRows();
      renderGachaEntryRows(rows);
    });
  });
}

function getGachaEntryTarget(entry) {
  if (entry.type === 'resource') return entry.resourceId || '';
  if (entry.type === 'item') return entry.itemId || '';
  if (entry.type === 'fragment' || entry.type === 'hero') return entry.heroRarity || 'common';
  if (entry.type === 'equipment') return entry.rarity || 'common';
  return '';
}

function formatGachaEntryTarget(entry) {
  const target = getGachaEntryTarget(entry);
  if (entry.type === 'resource' || entry.type === 'item') return formatRewardDisplay(target);
  if (entry.type === 'fragment' || entry.type === 'hero' || entry.type === 'equipment') return formatRarityDisplay(target);
  return target;
}

function parseGachaEntryTarget(type, value) {
  if (type === 'resource' || type === 'item') return parseRewardInput(value);
  if (type === 'fragment' || type === 'hero' || type === 'equipment') return parseRarityInput(value);
  return String(value || '').trim();
}

function readGachaEntryRows() {
  return $$('#poolEntryRows .editable-row').map((row, index) => {
    const type = row.querySelector('[data-field="type"]').value;
    const target = parseGachaEntryTarget(type, row.querySelector('[data-field="target"]').value);
    const weight = Number(row.querySelector('[data-field="weight"]').value) || 0;
    const entry = {
      id: row.querySelector('[data-field="id"]').value.trim() || `${type}_${target || index + 1}`,
      type,
      min: Math.max(0, Number(row.querySelector('[data-field="min"]').value) || 0),
      max: Math.max(0, Number(row.querySelector('[data-field="max"]').value) || 0),
      weight,
      label: row.querySelector('[data-field="label"]').value.trim(),
      rateText: weight ? `${weight}%` : ''
    };
    if (type === 'resource') entry.resourceId = target;
    if (type === 'item') entry.itemId = target;
    if (type === 'fragment' || type === 'hero') entry.heroRarity = target || 'common';
    if (type === 'equipment') entry.rarity = target || 'common';
    if (!entry.label) {
      entry.label = buildGachaEntryLabel(entry);
    }
    return entry;
  }).filter((entry) => entry.id && entry.weight > 0);
}

function buildGachaEntryLabel(entry) {
  const rangeText = entry.type === 'hero' || entry.type === 'equipment'
    ? ''
    : ` ${entry.min}-${Math.max(entry.min, entry.max || entry.min)}`;
  if (entry.type === 'resource') return `${entry.resourceId || '资源'}${rangeText}`;
  if (entry.type === 'item') return `${entry.itemId || '道具'}${rangeText}`;
  if (entry.type === 'fragment') return `${getRarityLabel(entry.heroRarity)}英雄碎片${rangeText}`;
  if (entry.type === 'hero') return `随机${getRarityLabel(entry.heroRarity)}英雄`;
  if (entry.type === 'equipment') return `随机${getRarityLabel(entry.rarity)}装备`;
  return entry.id;
}

async function savePool(event) {
  event.preventDefault();
  const id = $('#poolId').value.trim();
  if (!id) {
    showToast('请填写奖池 ID');
    return;
  }
  const costResource = parseRewardInput($('#poolCostResource').value) || 'diamond';
  const payload = {
    id,
    type: 'mixed',
    name: $('#poolName').value.trim(),
    icon: $('#poolIcon').value.trim(),
    description: $('#poolDescription').value.trim(),
    costs: {
      [costResource]: {
        single: Number($('#poolCostSingle').value) || 0,
        ten: Number($('#poolCostTen').value) || 0
      }
    },
    entries: readGachaEntryRows()
  };
  try {
    await api(`/gm/catalog/gachaPools/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
    showToast('奖池已保存');
    await loadCatalog();
    state.selectedPool = (state.catalog.gachaPools || []).find((entry) => entry.id === id) || null;
    renderPoolEditor(state.selectedPool);
  } catch (error) {
    showToast(`奖池保存失败：${error.message}`);
  }
}

async function deletePoolOverride() {
  const id = $('#poolId').value.trim();
  if (!id || state.selectedPool?.source !== 'gm') {
    showToast('当前奖池没有 GM 改动可撤销');
    return;
  }
  if (!confirm(`确认撤销 ${id} 的 GM 奖池改动吗？`)) return;
  try {
    await api(`/gm/catalog/gachaPools/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('奖池 GM 改动已撤销');
    state.selectedPool = null;
    await loadCatalog();
    renderPoolEditor(null);
  } catch (error) {
    showToast(`撤销失败：${error.message}`);
  }
}

function renderShopItems() {
  const root = $('#shopItemList');
  if (!root) return;
  const keyword = $('#shopSearchInput')?.value?.trim().toLowerCase() || '';
  const rows = [...(state.catalog.shopItems || [])]
    .sort((left, right) => (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0))
    .filter((item) => {
      const text = `${item.id || ''} ${item.name || ''} ${item.giveItem || ''} ${item.description || ''}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });

  root.innerHTML = rows.length ? rows.map((item) => `
    <button class="catalog-row ${state.selectedShopItem?.id === item.id ? 'active' : ''}" data-shop-item-id="${escapeAttr(item.id)}" type="button">
      ${renderThumb(item)}
      <span>
        <span class="row-title">${escapeHtml(item.name || item.id)}</span>
        <span class="row-meta">${escapeHtml(item.id)} · ${getShopItemTypeLabel(item.type)} · ${escapeHtml(item.currency || 'gold')} ${Number(item.price) || 0}</span>
      </span>
      <span class="rarity-chip">${item.source === 'gm' ? 'GM' : '基础'}</span>
    </button>
  `).join('') : '<div class="empty-state">没有匹配的商城商品</div>';

  root.querySelectorAll('[data-shop-item-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedShopItem = rows.find((item) => item.id === button.dataset.shopItemId) || null;
      renderShopItems();
      renderShopEditor(state.selectedShopItem);
    });
  });
}

function getShopItemTypeLabel(type) {
  const labels = {
    resource: '资源',
    consumable: '道具',
    fragment: '英雄碎片'
  };
  return labels[type] || type || '商品';
}

function renderShopEditor(item) {
  const effective = item || {};
  const hasGmOverride = item?.source === 'gm';
  $('#shopEditorTitle').textContent = item ? (item.name || item.id) : '新建商品';
  $('#shopEditorMeta').textContent = item
    ? `${item.id} · ${getShopItemTypeLabel(item.type)} · 限购 ${Number(item.maxBuy) || 0}`
    : '填写 ID 后保存';
  $('#shopEditorSource').textContent = hasGmOverride ? 'GM改动' : '基础配置';
  $('#shopItemId').value = effective.id || '';
  $('#shopItemId').dataset.originalId = item?.id || '';
  $('#shopItemName').value = effective.name || '';
  $('#shopItemIcon').value = effective.icon || '';
  $('#shopItemIconSrc').value = effective.iconSrc || '';
  $('#shopItemType').value = effective.type || 'consumable';
  $('#shopItemRarity').value = effective.rarity || 'common';
  $('#shopItemPrice').value = effective.price ?? 0;
  $('#shopItemCurrency').innerHTML = renderRewardSelectOptions(effective.currency || 'gold', '请选择货币类型');
  $('#shopItemMaxBuy').value = effective.maxBuy ?? 0;
  $('#shopItemSortOrder').value = effective.sortOrder ?? '';
  $('#shopItemGiveItem').innerHTML = renderRewardSelectOptions(effective.giveItem || '', '请选择发放道具');
  $('#shopItemGiveCount').value = effective.giveCount ?? 1;
  $('#shopItemDescription').value = effective.description || '';
  $('#deleteShopItemBtn').disabled = !effective.id;
}

function getNextShopItemId() {
  const usedIds = new Set((state.catalog.shopItems || []).map((item) => String(item.id || '').trim()).filter(Boolean));
  let nextIndex = Math.max(1, (state.catalog.shopItems || []).length + 1);
  let candidate = `shop_${String(nextIndex).padStart(3, '0')}`;
  while (usedIds.has(candidate)) {
    nextIndex += 1;
    candidate = `shop_${String(nextIndex).padStart(3, '0')}`;
  }
  return { id: candidate, sortOrder: nextIndex };
}

function createBlankShopItem() {
  const { id, sortOrder } = getNextShopItemId();
  state.selectedShopItem = null;
  renderShopItems();
  renderShopEditor({
    id,
    name: '',
    icon: '',
    type: 'consumable',
    rarity: 'common',
    price: 0,
    currency: 'gold',
    maxBuy: 1,
    giveItem: '',
    giveCount: 1,
    sortOrder
  });
}

async function saveShopItem(event) {
  event.preventDefault();
  const id = $('#shopItemId').value.trim();
  const originalId = $('#shopItemId').dataset.originalId?.trim() || '';
  if (!id) {
    showToast('请填写商品 ID');
    return;
  }

  const payload = {
    id,
    name: $('#shopItemName').value.trim(),
    icon: $('#shopItemIcon').value.trim(),
    iconSrc: $('#shopItemIconSrc').value.trim(),
    type: $('#shopItemType').value,
    rarity: $('#shopItemRarity').value,
    price: Number($('#shopItemPrice').value) || 0,
    currency: parseRewardInput($('#shopItemCurrency').value) || 'gold',
    maxBuy: Number($('#shopItemMaxBuy').value) || 0,
    giveItem: parseRewardInput($('#shopItemGiveItem').value),
    giveCount: Number($('#shopItemGiveCount').value) || 1,
    description: $('#shopItemDescription').value.trim(),
    sortOrder: Number($('#shopItemSortOrder').value) || 0
  };

  try {
    await api(`/gm/catalog/shopItems/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
    if (originalId && originalId !== id) {
      await api(`/gm/catalog/shopItems/${encodeURIComponent(originalId)}`, { method: 'DELETE' });
    }
    showToast('商城商品已保存');
    await loadCatalog();
    state.selectedShopItem = (state.catalog.shopItems || []).find((entry) => entry.id === id) || null;
    renderShopEditor(state.selectedShopItem);
  } catch (error) {
    showToast(`商城商品保存失败：${error.message}`);
  }
}

async function deleteShopItemOverride() {
  const id = $('#shopItemId').value.trim();
  if (!id) {
    showToast('请先选择或填写商品 ID');
    return;
  }
  if (!confirm(`确认下架商品 ${id} 吗？下架后商城将不再展示该商品。`)) return;
  try {
    await api(`/gm/catalog/shopItems/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('商城商品已下架');
    state.selectedShopItem = null;
    await loadCatalog();
    renderShopEditor(null);
  } catch (error) {
    showToast(`下架失败：${error.message}`);
  }
}

function renderWelfareGifts() {
  const root = $('#welfareGiftList');
  if (!root) return;
  const keyword = $('#welfareGiftSearchInput')?.value?.trim().toLowerCase() || '';
  const rows = [...(state.catalog.welfareGifts || [])]
    .sort((left, right) =>
      Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
      String(left.name || left.id || '').localeCompare(String(right.name || right.id || ''), 'zh-Hans-CN-u-co-pinyin')
    )
    .filter((gift) => {
      const text = `${gift.id || ''} ${gift.name || gift.title || ''} ${gift.description || ''}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });

  root.innerHTML = rows.length ? rows.map((gift) => `
    <button class="catalog-row ${state.selectedWelfareGift?.id === gift.id ? 'active' : ''}" data-welfare-gift-id="${escapeAttr(gift.id)}" type="button">
      <span class="thumb">礼</span>
      <span>
        <span class="row-title">${escapeHtml(gift.name || gift.title || gift.id)}</span>
        <span class="row-meta">${escapeHtml(gift.id)} · ${escapeHtml(getWelfareEntryKindLabel(gift))} · 排序 ${Number(gift.sortOrder) || 0} · ${formatWelfareRewardSummary(getWelfareRewardList(gift))}</span>
      </span>
      <span class="rarity-chip">${gift.source === 'gm' ? 'GM' : '基础'}</span>
    </button>
  `).join('') : '<div class="empty-state">没有匹配的福利礼包</div>';

  root.querySelectorAll('[data-welfare-gift-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedWelfareGift = rows.find((gift) => gift.id === button.dataset.welfareGiftId) || null;
      renderWelfareGifts();
      renderWelfareGiftEditor(state.selectedWelfareGift);
    });
  });
}

function formatWelfareRewardSummary(rewards) {
  const entries = Array.isArray(rewards) ? rewards : [];
  if (!entries.length) {
    return '未配置奖励';
  }
  return entries.slice(0, 2).map((reward) => {
    const entry = findRewardCatalogEntry(reward);
    const amount = Number(reward.count ?? reward.amount ?? 0) || 0;
    return `${entry?.name || reward.id} x${amount}`;
  }).join(' / ');
}

function toRewardDrafts(rewards) {
  return (Array.isArray(rewards) ? rewards : []).map((reward) => ({
    type: reward.type,
    id: reward.id,
    amount: Math.max(1, Number(reward.amount ?? reward.count ?? 1) || 1)
  }));
}

function isMonthCardEntry(entry) {
  const id = String(entry?.id || '').trim();
  return entry?.kind === 'monthCard' || id.includes('month_card');
}

function getWelfareEntryKindLabel(entry) {
  return isMonthCardEntry(entry) ? '月卡' : '礼包';
}

function getWelfareRewardList(entry) {
  if (isMonthCardEntry(entry)) {
    return Array.isArray(entry?.dailyRewards) ? entry.dailyRewards : [];
  }
  return Array.isArray(entry?.rewards) ? entry.rewards : [];
}

function toggleWelfareGiftModeFields() {
  const isMonthCard = $('#welfareGiftKind').value === 'monthCard';
  $$('.month-card-only').forEach((node) => {
    node.style.display = isMonthCard ? '' : 'none';
  });
  $$('.welfare-gift-only').forEach((node) => {
    node.style.display = isMonthCard ? 'none' : '';
  });
  const rewardTitle = $('#welfareRewardBlockTitle');
  if (rewardTitle) {
    rewardTitle.textContent = isMonthCard ? '每日领取奖励' : '奖励内容';
  }
}

function renderWelfareGiftEditor(gift) {
  const effective = gift || {};
  const hasGmOverride = effective.source === 'gm';
  const isMonthCard = isMonthCardEntry(effective);
  $('#welfareGiftEditorTitle').textContent = gift ? (gift.name || gift.title || gift.id) : '新建福利配置';
  $('#welfareGiftEditorMeta').textContent = gift
    ? `${gift.id} · ${getWelfareEntryKindLabel(gift)} · 排序 ${Number(gift.sortOrder) || 0} · ${formatWelfareRewardSummary(getWelfareRewardList(gift))}`
    : '填写配置 ID 后保存';
  $('#welfareGiftEditorSource').textContent = hasGmOverride ? 'GM改动' : '基础配置';
  $('#welfareGiftId').value = effective.id || '';
  $('#welfareGiftId').disabled = Boolean(gift?.id);
  $('#welfareGiftKind').value = isMonthCard ? 'monthCard' : 'gift';
  $('#welfareGiftName').value = effective.name || effective.title || '';
  $('#welfareGiftSortOrder').value = effective.sortOrder ?? '';
  $('#welfareGiftDescription').value = effective.description || '';
  $('#welfareGiftLimitNormal').value = effective.adLimits?.normal ?? 3;
  $('#welfareGiftLimitWelfare').value = effective.adLimits?.welfare ?? 4;
  $('#welfareGiftLimitSupreme').value = effective.adLimits?.supreme ?? 5;
  $('#welfareGiftSubtitle').value = effective.subtitle || '';
  $('#welfareGiftRequiredViews').value = effective.requiredViews ?? effective.activationViews ?? 1;
  $('#welfareGiftBadge').value = effective.badge || '';
  state.welfareGiftRewards = toRewardDrafts(getWelfareRewardList(effective));
  toggleWelfareGiftModeFields();
  renderRewardLists();
  $('#deleteWelfareGiftBtn').disabled = !effective.id;
}

function createBlankWelfareGift() {
  const nextIndex = (state.catalog.welfareGifts || []).length + 1;
  state.selectedWelfareGift = null;
  state.welfareGiftRewards = [];
  renderWelfareGifts();
  renderWelfareGiftEditor({
    id: `welfare_gift_${String(nextIndex).padStart(2, '0')}`,
    kind: 'gift',
    name: '',
    description: '',
    sortOrder: nextIndex,
    rewards: [],
    adLimits: { normal: 3, welfare: 4, supreme: 5 }
  });
}

async function saveWelfareGift(event) {
  event.preventDefault();
  const id = $('#welfareGiftId').value.trim();
  if (!id) {
    showToast('请填写礼包 ID');
    return;
  }
  if (!state.welfareGiftRewards.length) {
    showToast('请至少添加一个奖励');
    return;
  }

  const kind = $('#welfareGiftKind').value === 'monthCard' ? 'monthCard' : 'gift';

  const payload = {
    id,
    kind,
    name: $('#welfareGiftName').value.trim(),
    title: $('#welfareGiftName').value.trim(),
    description: $('#welfareGiftDescription').value.trim(),
    sortOrder: Number($('#welfareGiftSortOrder').value) || 0
  };

  const rewardPayload = state.welfareGiftRewards.map((reward) => ({
      type: reward.type,
      id: reward.id,
      count: Math.max(1, Number(reward.amount) || 1)
  }));

  if (kind === 'monthCard') {
    payload.subtitle = $('#welfareGiftSubtitle').value.trim();
    payload.requiredViews = Math.max(1, Number($('#welfareGiftRequiredViews').value) || 1);
    payload.activationViews = payload.requiredViews;
    payload.badge = $('#welfareGiftBadge').value.trim();
    payload.dailyRewards = rewardPayload;
  } else {
    payload.adLimits = {
      normal: Math.max(0, Number($('#welfareGiftLimitNormal').value) || 0),
      welfare: Math.max(0, Number($('#welfareGiftLimitWelfare').value) || 0),
      supreme: Math.max(0, Number($('#welfareGiftLimitSupreme').value) || 0)
    };
    payload.rewards = rewardPayload;
  }

  try {
    await api(`/gm/catalog/welfareGifts/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
    showToast(kind === 'monthCard' ? '月卡配置已保存' : '福利礼包已保存');
    await loadCatalog();
    state.selectedWelfareGift = (state.catalog.welfareGifts || []).find((entry) => entry.id === id) || null;
    renderWelfareGifts();
    renderWelfareGiftEditor(state.selectedWelfareGift);
  } catch (error) {
    showToast(`福利礼包保存失败：${error.message}`);
  }
}

async function deleteWelfareGiftOverride() {
  const id = $('#welfareGiftId').value.trim();
  if (!id) {
    showToast('请先选择或填写礼包 ID');
    return;
  }
  if (!confirm(`确认下架福利礼包 ${id} 吗？`)) return;
  try {
    await api(`/gm/catalog/welfareGifts/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('福利配置已下架');
    state.selectedWelfareGift = null;
    state.welfareGiftRewards = [];
    await loadCatalog();
    renderWelfareGiftEditor(null);
  } catch (error) {
    showToast(`下架失败：${error.message}`);
  }
}

function renderShelterBuildings() {
  const root = $('#shelterBuildingList');
  if (!root) return;
  const keyword = $('#shelterBuildingSearchInput')?.value?.trim().toLowerCase() || '';
  const rows = [...(state.catalog.shelterBuildings || [])]
    .filter((building) => {
      const text = `${building.id || ''} ${building.name || ''} ${building.description || ''}`.toLowerCase();
      return !keyword || text.includes(keyword);
    })
    .sort((left, right) =>
      Number(left.sortOrder || 0) - Number(right.sortOrder || 0) ||
      String(left.name || left.id || '').localeCompare(String(right.name || right.id || ''), 'zh-Hans-CN-u-co-pinyin'),
    );

  root.innerHTML = rows.length ? rows.map((building) => `
    <button class="catalog-row ${state.selectedShelterBuilding?.id === building.id ? 'active' : ''}" data-shelter-building-id="${escapeAttr(building.id)}" type="button">
      ${renderThumb(building)}
      <span>
        <span class="row-title">${escapeHtml(building.name || building.id)}</span>
        <span class="row-meta">${escapeHtml(building.id)} · ${escapeHtml(getShelterBuildingModeLabel(building))} · Lv.${Number(building.maxLevel) || 1} · ${escapeHtml(getShelterBuildingOutputSummary(building))}</span>
      </span>
      <span class="rarity-chip">${building.source === 'gm' ? 'GM' : '基础'}</span>
    </button>
  `).join('') : '<div class="empty-state">没有匹配的建筑</div>';

  root.querySelectorAll('[data-shelter-building-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedShelterBuilding = rows.find((building) => building.id === button.dataset.shelterBuildingId) || null;
      renderShelterBuildings();
      renderShelterBuildingEditor(state.selectedShelterBuilding);
    });
  });
}

function getShelterBuildingOutputSummary(building) {
  const level1 = (building?.levels || []).find((entry) => Number(entry?.level) === 1) || (building?.levels || [])[0] || {};
  if (level1.energyBonus !== undefined) {
    return `体力上限 +${Number(level1.energyBonus) || 0}`;
  }
  if (level1.statBonus !== undefined) {
    return `英雄属性 +${Math.round((Number(level1.statBonus) || 0) * 100)}%`;
  }
  const outputs = Array.isArray(level1.outputs) ? level1.outputs : [];
  if (!outputs.length) {
    return '无产出';
  }
  return outputs.map((output) => `${formatRewardDisplay(output.id)} ${Number(output.amountPerHour) || 0}/h`).join(' / ');
}

function resolveShelterOutputType(id) {
  const outputId = String(id || '').trim();
  if (!outputId) {
    return 'resource';
  }
  if ((state.catalog.items || []).some((entry) => entry.id === outputId)) {
    return 'item';
  }
  return 'resource';
}

function getShelterBuildingMode(building) {
  const id = String(building?.id || '').trim();
  if (id === 'building_shelter') {
    return 'energy';
  }
  if (id === 'building_training_ground') {
    return 'stat';
  }
  const firstLevel = Array.isArray(building?.levels) ? building.levels[0] : null;
  if (firstLevel?.energyBonus !== undefined) return 'energy';
  if (firstLevel?.statBonus !== undefined) return 'stat';
  return 'production';
}

function getShelterBuildingModeLabel(building) {
  const mode = getShelterBuildingMode(building);
  if (mode === 'energy') return '体力建筑';
  if (mode === 'stat') return '属性建筑';
  return '产出建筑';
}

function isShelterCoreBuildingId(id) {
  return String(id || '').trim() === 'building_shelter';
}

function getDefaultShelterLevelMedia(levelNumber) {
  return {
    backgroundVideo: 'assets/media/house.mp4',
    backgroundImage: 'assets/media/house_poster.png',
  };
}

function getShelterLevelMediaPayload(level) {
  const backgroundVideo = String(level?.backgroundVideo || '').trim();
  const backgroundImage = String(level?.backgroundImage || level?.backgroundPoster || level?.mobileFallbackSrc || '').trim();
  return {
    ...(backgroundVideo ? { backgroundVideo } : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
  };
}

function createBlankShelterOutput(type = 'resource', id = 'meat', amountPerHour = 0) {
  return {
    type,
    id,
    amountPerHour,
  };
}

function renderShelterBuildingEditor(building) {
  const effective = building || {};
  const hasGmOverride = effective.source === 'gm';
  $('#shelterBuildingEditorTitle').textContent = building ? (building.name || building.id) : '新建建筑';
  $('#shelterBuildingEditorMeta').textContent = building
    ? `${building.id} · 类型 ${getShelterBuildingModeLabel(building)} · 等级上限 ${Number(building.maxLevel) || 1}`
    : '填写建筑 ID 后保存';
  $('#shelterBuildingEditorSource').textContent = hasGmOverride ? 'GM改动' : '基础配置';
  $('#shelterBuildingId').value = effective.id || '';
  $('#shelterBuildingId').disabled = Boolean(building?.id);
  $('#shelterBuildingName').value = effective.name || '';
  $('#shelterBuildingIcon').value = effective.icon || '';
  $('#shelterBuildingIconSrc').value = effective.iconSrc || effective.src || '';
  $('#shelterBuildingMaxLevel').value = effective.maxLevel || Math.max((effective.levels || []).length, 1) || 1;
  $('#shelterBuildingDescription').value = effective.description || '';
  renderShelterBuildingLevelRows((effective.levels || []).length ? effective.levels : [createBlankShelterBuildingLevel()], effective);
  $('#deleteShelterBuildingBtn').disabled = !hasGmOverride;
  updateShelterBuildingImagePreview(effective);
}

function createBlankShelterBuilding() {
  const nextIndex = (state.catalog.shelterBuildings || []).length + 1;
  state.selectedShelterBuilding = null;
  renderShelterBuildings();
  renderShelterBuildingEditor({
    id: `building_custom_${String(nextIndex).padStart(2, '0')}`,
    name: '',
    icon: '',
    iconSrc: '',
    description: '',
    maxLevel: 1,
    levels: [createBlankShelterBuildingLevel(1)],
  });
}

async function pickShelterBuildingImageFile() {
  try {
    const filePath = await window.gmDesktop?.pickImageFile?.();
    if (!filePath) return;
    $('#shelterBuildingIconSrc').value = filePath;
    updateShelterBuildingImagePreviewFromForm();
  } catch (error) {
    showToast(`选择图片失败：${error.message}`);
  }
}

function updateShelterBuildingImagePreviewFromForm() {
  updateShelterBuildingImagePreview({
    icon: $('#shelterBuildingIcon').value.trim(),
    iconSrc: $('#shelterBuildingIconSrc').value.trim(),
    src: $('#shelterBuildingIconSrc').value.trim(),
    name: $('#shelterBuildingName').value.trim(),
    id: $('#shelterBuildingId').value.trim()
  });
}

function updateShelterBuildingImagePreview(entry) {
  const preview = $('#shelterBuildingImagePreview');
  if (!preview) return;
  const src = resolveAssetSrc(entry.iconSrc || entry.src || '');
  if (src) {
    preview.innerHTML = `<img src="${escapeAttr(src)}" alt="${escapeAttr(entry.name || entry.id || 'building')}">`;
  } else {
    preview.textContent = entry.icon || 'IMG';
  }
}

function createBlankShelterBuildingLevel(level = 1) {
  return {
    level,
    outputs: [createBlankShelterOutput()],
    upgradeCost: { gold: 0 },
  };
}

function renderShelterBuildingMediaRows(level, buildingId) {
  if (!isShelterCoreBuildingId(buildingId)) {
    return '';
  }
  const levelNumber = Number(level?.level) || 1;
  const defaults = getDefaultShelterLevelMedia(levelNumber);
  const backgroundVideo = String(level?.backgroundVideo || defaults.backgroundVideo || '').trim();
  const backgroundImage = String(level?.backgroundImage || level?.backgroundPoster || level?.mobileFallbackSrc || defaults.backgroundImage || '').trim();
  return `
    <div class="shelter-level-media-grid">
      <label class="field-inline-label">
        <span>背景视频地址</span>
        <input class="text-input code-input" data-field="backgroundVideo" value="${escapeAttr(backgroundVideo)}" placeholder="assets/media/shelter/level-${levelNumber}.mp4">
      </label>
      <label class="field-inline-label">
        <span>降级静态图地址</span>
        <input class="text-input code-input" data-field="backgroundImage" value="${escapeAttr(backgroundImage)}" placeholder="assets/media/shelter/level-${levelNumber}.png">
      </label>
    </div>
  `;
}

function renderShelterBuildingOutputRows(level, levelIndex, buildingMode) {
  if (buildingMode !== 'production') {
    return '';
  }
  const outputs = Array.isArray(level.outputs) && level.outputs.length ? level.outputs : [createBlankShelterOutput()];
  return `
    <div class="shelter-output-editor">
      <div class="block-title compact">
        <span>产出列表</span>
        <button class="ghost-button" data-add-output="${levelIndex}" type="button">添加产出</button>
      </div>
      <div class="editable-table">
        ${outputs.map((output, outputIndex) => `
          <div class="editable-row shelter-output-row" data-output-index="${outputIndex}">
            <label class="field-inline-label">
              <span>产出类型</span>
              <select class="select-input" data-field="outputType">
                <option value="resource" ${output.type === 'item' ? '' : 'selected'}>资源</option>
                <option value="item" ${output.type === 'item' ? 'selected' : ''}>道具</option>
              </select>
            </label>
            <label class="field-inline-label">
              <span>资源/道具 ID</span>
              <select class="select-input" data-field="resourceId">
                ${renderRewardSelectOptions(output.id || '', '请选择资源或道具')}
              </select>
            </label>
            <label class="field-inline-label">
              <span>每小时产出</span>
              <input class="text-input" data-field="amountPerHour" type="number" min="0" value="${escapeAttr(output.amountPerHour ?? 0)}" placeholder="0">
            </label>
            <button class="icon-button" data-remove-output="${levelIndex}:${outputIndex}" type="button">-</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderShelterBuildingLevelRows(levels, building = state.selectedShelterBuilding || null) {
  const root = $('#shelterBuildingLevelRows');
  if (!root) return;
  const rows = (Array.isArray(levels) ? levels : []).slice().sort((left, right) => Number(left.level || 1) - Number(right.level || 1));
  const buildingId = $('#shelterBuildingId')?.value?.trim() || building?.id;
  const buildingMode = getShelterBuildingMode({
    ...building,
    id: buildingId,
    levels: rows,
  });
  root.innerHTML = rows.length ? rows.map((level, levelIndex) => `
    <div class="editable-row shelter-building-level-row" data-level="${Number(level.level) || 1}">
      <div class="shelter-level-card">
        <div class="shelter-level-topbar shelter-level-topbar-${buildingMode}">
          <div class="field-inline-label shelter-level-label">
            <span>等级</span>
            <strong>Lv.${Number(level.level) || levelIndex + 1}</strong>
          </div>
          ${buildingMode === 'energy' ? `
            <label class="field-inline-label">
              <span>体力上限</span>
              <input class="text-input" data-field="energyBonus" type="number" min="0" value="${escapeAttr(level.energyBonus ?? 0)}" placeholder="0">
            </label>
          ` : ''}
          ${buildingMode === 'stat' ? `
            <label class="field-inline-label">
              <span>属性加成比例</span>
              <input class="text-input" data-field="statBonus" type="number" min="0" step="0.01" value="${escapeAttr(level.statBonus ?? 0)}" placeholder="0.05">
            </label>
          ` : ''}
          <label class="field-inline-label shelter-cost-field">
            <span>升级消耗 JSON</span>
            <input class="text-input code-input" data-field="upgradeCost" value="${escapeAttr(stringifyInlineJson(level.upgradeCost || {}))}" placeholder='{"gold":100,"wood":20}'>
          </label>
          <button class="icon-button" data-remove-level="${Number(level.level) || 1}" type="button">-</button>
        </div>
        ${renderShelterBuildingMediaRows(level, buildingId)}
        ${renderShelterBuildingOutputRows(level, levelIndex, buildingMode)}
      </div>
    </div>
  `).join('') : '<div class="empty-state">请至少配置一个等级</div>';

  root.querySelectorAll('[data-remove-level]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextLevels = readShelterBuildingLevels().filter((entry) => String(entry.level) !== String(button.dataset.removeLevel));
      renderShelterBuildingLevelRows(nextLevels.length ? nextLevels : [createBlankShelterBuildingLevel()], building);
    });
  });

  root.querySelectorAll('[data-add-output]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextLevels = readShelterBuildingLevels();
      const levelIndex = Number(button.dataset.addOutput);
      if (!nextLevels[levelIndex]) {
        return;
      }
      nextLevels[levelIndex].outputs = [...(nextLevels[levelIndex].outputs || []), createBlankShelterOutput()];
      renderShelterBuildingLevelRows(nextLevels, building);
    });
  });

  root.querySelectorAll('[data-remove-output]').forEach((button) => {
    button.addEventListener('click', () => {
      const [levelIndexRaw, outputIndexRaw] = String(button.dataset.removeOutput || '').split(':');
      const levelIndex = Number(levelIndexRaw);
      const outputIndex = Number(outputIndexRaw);
      const nextLevels = readShelterBuildingLevels();
      if (!nextLevels[levelIndex]) {
        return;
      }
      const currentOutputs = Array.isArray(nextLevels[levelIndex].outputs) ? nextLevels[levelIndex].outputs : [];
      nextLevels[levelIndex].outputs = currentOutputs.filter((_, index) => index !== outputIndex);
      if (!nextLevels[levelIndex].outputs.length) {
        nextLevels[levelIndex].outputs = [createBlankShelterOutput()];
      }
      renderShelterBuildingLevelRows(nextLevels, building);
    });
  });
}

function readShelterBuildingLevels() {
  const buildingId = $('#shelterBuildingId')?.value?.trim();
  const buildingMode = getShelterBuildingMode({ id: buildingId });
  const isShelterCore = isShelterCoreBuildingId(buildingId);
  return [...document.querySelectorAll('#shelterBuildingLevelRows .shelter-building-level-row')].map((row, index) => {
    const costRaw = row.querySelector('[data-field="upgradeCost"]').value.trim();
    let upgradeCost = {};
    if (costRaw) {
      try {
        upgradeCost = JSON.parse(costRaw);
      } catch (error) {
        throw new Error(`等级 ${index + 1} 的升级消耗 JSON 格式错误`);
      }
    }
    const entry = {
      level: Math.max(1, Number(row.dataset.level) || index + 1),
      upgradeCost,
    };
    if (isShelterCore) {
      Object.assign(entry, getShelterLevelMediaPayload({
        backgroundVideo: row.querySelector('[data-field="backgroundVideo"]')?.value,
        backgroundImage: row.querySelector('[data-field="backgroundImage"]')?.value,
      }));
    }
    if (buildingMode === 'energy') {
      entry.energyBonus = Math.max(0, Number(row.querySelector('[data-field="energyBonus"]')?.value) || 0);
      return entry;
    }
    if (buildingMode === 'stat') {
      entry.statBonus = Math.max(0, Number(row.querySelector('[data-field="statBonus"]')?.value) || 0);
      return entry;
    }
    entry.outputs = [...row.querySelectorAll('.shelter-output-row')].map((outputRow) => {
      const parsedId = parseRewardInput(outputRow.querySelector('[data-field="resourceId"]').value) || '';
      const selectedType = outputRow.querySelector('[data-field="outputType"]')?.value || '';
      return {
        type: selectedType === 'item' ? 'item' : resolveShelterOutputType(parsedId),
        id: parsedId,
        amountPerHour: Math.max(0, Number(outputRow.querySelector('[data-field="amountPerHour"]').value) || 0),
      };
    }).filter((output) => output.id);
    return entry;
  }).filter((entry) => {
    if (buildingMode === 'production') {
      return Array.isArray(entry.outputs) && entry.outputs.length > 0;
    }
    return true;
  });
}

async function saveShelterBuilding(event) {
  event.preventDefault();
  const id = $('#shelterBuildingId').value.trim();
  if (!id) {
    showToast('请填写建筑 ID');
    return;
  }

  let levels = [];
  try {
    levels = readShelterBuildingLevels();
  } catch (error) {
    showToast(error.message);
    return;
  }
  if (!levels.length) {
    showToast('请至少配置一个等级');
    return;
  }

  const payload = {
    id,
    name: $('#shelterBuildingName').value.trim(),
    icon: $('#shelterBuildingIcon').value.trim(),
    iconSrc: $('#shelterBuildingIconSrc').value.trim(),
    src: $('#shelterBuildingIconSrc').value.trim(),
    description: $('#shelterBuildingDescription').value.trim(),
    maxLevel: Math.max(Number($('#shelterBuildingMaxLevel').value) || levels.length, levels.length),
    levels,
  };

  const mode = getShelterBuildingMode({ id, levels });
  if (mode === 'energy') {
    payload.levels = payload.levels.map((level) => ({
      level: level.level,
      energyBonus: Math.max(0, Number(level.energyBonus) || 0),
      upgradeCost: level.upgradeCost || {},
      ...getShelterLevelMediaPayload(level),
    }));
  } else if (mode === 'stat') {
    payload.levels = payload.levels.map((level) => ({
      level: level.level,
      statBonus: Math.max(0, Number(level.statBonus) || 0),
      upgradeCost: level.upgradeCost || {},
    }));
  }

  try {
    await api(`/gm/catalog/shelterBuildings/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
    showToast('建筑配置已保存');
    await loadCatalog();
    state.selectedShelterBuilding = (state.catalog.shelterBuildings || []).find((entry) => entry.id === id) || null;
    renderShelterBuildings();
    renderShelterBuildingEditor(state.selectedShelterBuilding);
  } catch (error) {
    showToast(`建筑配置保存失败：${error.message}`);
  }
}

async function deleteShelterBuildingOverride() {

  const id = $('#shelterBuildingId').value.trim();
  if (!id) {
    showToast('请先选择建筑');
    return;
  }
  if (state.selectedShelterBuilding?.source !== 'gm') {
    showToast('当前建筑没有 GM 改动可撤销');
    return;
  }
  if (!confirm(`确认撤销建筑 ${id} 的 GM 配置吗？`)) return;
  try {
    await api(`/gm/catalog/shelterBuildings/${encodeURIComponent(id)}`, { method: 'DELETE' });
    showToast('建筑 GM 改动已撤销');
    state.selectedShelterBuilding = null;
    await loadCatalog();
    renderShelterBuildingEditor(null);
  } catch (error) {
    showToast(`建筑配置移除失败：${error.message}`);
  }
}

function renderDungeons() {
  const root = $('#dungeonList');
  if (!root) return;
  const keyword = $('#dungeonSearchInput')?.value?.trim().toLowerCase() || '';
  const chapters = getDungeonChapters().filter((chapter) => {
    const chapterText = `${chapter.id} ${chapter.title} ${chapter.description || ''}`.toLowerCase();
    const stageHit = chapter.stages.some((stage) => {
      const text = `${stage.id || ''} ${stage.name || ''} ${stage.description || ''}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
    return !keyword || chapterText.includes(keyword) || stageHit;
  });

  root.innerHTML = chapters.length ? chapters.map((chapter) => `
    <div class="chapter-tree">
      <button class="catalog-row chapter-row ${state.selectedDungeonMode === 'chapter' && state.selectedChapterKey === chapter.id ? 'active' : ''}" data-chapter-key="${escapeAttr(chapter.id)}" type="button">
        <span class="thumb">${escapeHtml(chapter.icon || '章')}</span>
        <span>
          <span class="row-title">${escapeHtml(chapter.title)}</span>
          <span class="row-meta">第 ${chapter.chapterNumber} 章 · ${chapter.stages.length} 个关卡 · 推荐 Lv.${chapter.level}</span>
        </span>
        <span class="rarity-chip">${chapter.hasGmOverride ? 'GM' : '基础'}</span>
      </button>
      <div class="stage-tree">
        ${chapter.stages.map((stage) => `
          <button class="catalog-row stage-row ${state.selectedDungeonMode === 'stage' && state.selectedDungeon?.id === stage.id ? 'active' : ''}" data-dungeon-id="${escapeAttr(stage.id)}" type="button">
            <span class="stage-index">${Number(stage.stageNumber || 1)}</span>
            <span>
              <span class="row-title">${escapeHtml(stage.name || stage.id)}</span>
              <span class="row-meta">${escapeHtml(stage.id)} · 推荐 Lv.${Number(stage.level || stage.recommendedLevel || 1)}</span>
            </span>
            <span class="rarity-chip">${stage.source === 'gm' ? 'GM' : '基础'}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `).join('') : '<div class="empty-state">没有匹配的副本章节</div>';

  root.querySelectorAll('[data-chapter-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const chapter = chapters.find((item) => item.key === button.dataset.chapterKey);
      state.selectedDungeonMode = 'chapter';
      state.selectedChapterKey = chapter?.id || '';
      state.selectedDungeon = chapter || null;
      renderDungeons();
      renderDungeonEditor(state.selectedDungeon);
    });
  });

  root.querySelectorAll('[data-dungeon-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDungeonMode = 'stage';
      state.selectedDungeon = (state.catalog.dungeons || []).find((dungeon) => dungeon.id === button.dataset.dungeonId) || null;
      state.selectedChapterKey = state.selectedDungeon?.chapterId || getChapterKey(state.selectedDungeon);
      renderDungeons();
      renderDungeonEditor(state.selectedDungeon);
    });
  });
}

function getDungeonChapters() {
  const dungeonById = new Map((state.catalog.dungeons || []).map((dungeon) => [dungeon.id, dungeon]));
  return (state.catalog.dungeonChapters || [])
    .map((chapter) => {
      const stages = (chapter.dungeonIds || [])
        .map((dungeonId, index) => {
          const dungeon = dungeonById.get(dungeonId);
          return dungeon ? { ...dungeon, chapterId: chapter.id, chapterNumber: chapter.index || chapter.chapterNumber || 1, stageNumber: index + 1 } : null;
        })
        .filter(Boolean);
      const stageLevels = stages.map((stage) => Number(stage.level || stage.recommendedLevel || 1)).filter(Number.isFinite);
      return {
        ...chapter,
        key: chapter.id,
        title: chapter.name || chapter.id,
        chapterNumber: Number(chapter.index || chapter.chapterNumber || 1),
        level: Number(chapter.recommendedLevel || (stageLevels.length ? Math.min(...stageLevels) : 1)),
        hasGmOverride: chapter.source === 'gm',
        stages
      };
    })
    .sort((left, right) => Number(left.index || 1) - Number(right.index || 1));
}

function getChapterKey(dungeon) {
  return dungeon?.chapterId || `chapter_${String(Number(dungeon?.chapterNumber || 1)).padStart(2, '0')}`;
}

function getChapterTitle(dungeon) {
  if (dungeon?.category === 'dungeonChapter') {
    return dungeon.name || dungeon.id;
  }
  const chapter = getDungeonChapters().find((entry) => entry.id === getChapterKey(dungeon));
  return chapter?.name || `第${Number(dungeon?.chapterNumber || 1)}章`;
}

function getSelectedChapterStages() {
  const key = state.selectedChapterKey || getChapterKey(state.selectedDungeon);
  const chapter = getDungeonChapters().find((entry) => entry.id === key);
  return chapter?.stages || [];
}

function getSelectedChapter() {
  const key = state.selectedChapterKey || getChapterKey(state.selectedDungeon);
  return getDungeonChapters().find((chapter) => chapter.id === key) || null;
}

function normalizeDungeonEnvironmentEffect(value) {
  const type = String(value || 'none').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    poison: 'poison_fog',
    toxic: 'poison_fog',
    toxic_fog: 'poison_fog',
    dust: 'dust_smoke',
    sand: 'dust_smoke',
    storm: 'storm_night',
    stormnight: 'storm_night',
    heavy_rain: 'storm_night',
    lightning_rain: 'storm_night'
  };
  const normalized = aliases[type] || type;
  return dungeonEnvironmentEffectOptions.has(normalized) ? normalized : 'none';
}

function renderDungeonEditor(dungeon) {
  const effective = dungeon || {};
  const battlefield = effective.battlefield || {};
  const rewards = effective.rewards || {};
  const isChapterMode = state.selectedDungeonMode === 'chapter';
  const chapter = isChapterMode ? (effective.id ? effective : getSelectedChapter()) : getDungeonChapters().find((entry) => entry.id === getChapterKey(effective));
  const chapterStages = isChapterMode ? (chapter?.stages || getSelectedChapterStages()) : [];
  const hasGmOverride = isChapterMode
    ? chapter?.source === 'gm'
    : dungeon?.source === 'gm';
  $('#dungeonEditorTitle').textContent = isChapterMode
    ? (chapter?.name || getChapterTitle(effective))
    : (dungeon ? (dungeon.name || dungeon.id) : '新建关卡');
  $('#dungeonEditorMeta').textContent = isChapterMode
    ? `${chapter?.id || ''} · 第${Number(chapter?.index || chapter?.chapterNumber || 1)}章 · ${chapterStages.length}个关卡`
    : (dungeon ? `${dungeon.id} · ${chapter?.name || getChapterTitle(dungeon)} · 第${Number(dungeon.stageNumber || 1)}关` : '填写 ID 后保存');
  $('#dungeonEditorSource').textContent = hasGmOverride ? 'GM改动' : '基础配置';
  $('#dungeonId').value = isChapterMode ? (chapter?.id || '') : (effective.id || '');
  $('#dungeonId').disabled = isChapterMode || Boolean(dungeon?.id);
  $('#dungeonName').value = isChapterMode ? (chapter?.name || '') : (effective.name || '');
  $('#dungeonChapterNumber').value = isChapterMode ? (chapter?.index || chapter?.chapterNumber || 1) : (chapter?.index || effective.chapterNumber || 1);
  $('#dungeonStageNumber').value = effective.stageNumber || 1;
  $('#dungeonRecommendedLevel').value = isChapterMode ? (chapter?.recommendedLevel || 1) : (effective.recommendedLevel || effective.level || 1);
  $('#dungeonEnergyCost').value = effective.energyCost || 0;
  $('#dungeonIcon').value = isChapterMode ? (chapter?.icon || '') : (effective.icon || '');
  $('#dungeonSceneId').value = effective.sceneId || 'standard_9x9';
  $('#dungeonEnvironmentEffect').value = normalizeDungeonEnvironmentEffect(effective.environmentEffect || effective.battleEnvironmentEffect || effective.battlefield?.environmentEffect);
  $('#dungeonChapterDescription').value = chapter?.description || '';
  $('#dungeonChapterBackground').value = chapter?.background || '';
  $('#dungeonDescription').value = effective.description || '';
  $('#dungeonCols').value = battlefield.cols || battlefield.width || 7;
  $('#dungeonRows').value = battlefield.rows || battlefield.height || 10;
  $('#dungeonHeroSpawn').value = formatCoordinates(battlefield.heroSpawn?.positions || []);
  $('#dungeonObstacles').value = formatCoordinates(battlefield.obstacles || []);
  $('#dungeonSpecialTiles').value = formatSpecialTiles(battlefield.specialTiles || []);
  $('#dungeonGoldMin').value = rewards.gold?.min ?? '';
  $('#dungeonGoldMax').value = rewards.gold?.max ?? '';
  $('#dungeonExpMin').value = rewards.exp?.min ?? '';
  $('#dungeonExpMax').value = rewards.exp?.max ?? '';
  $('#dungeonBossWaves').value = stringifyJson(effective.bossWaves || []);
  $('#dungeonEnemyJson').value = stringifyJson(effective.initialEnemies || effective.enemies || []);
  $('#dungeonEnemyJson').dataset.dirty = 'false';
  $('#dungeonBossWaves').dataset.dirty = 'false';
  $('#deleteDungeonBtn').disabled = isChapterMode ? !chapter?.id : !effective.id;
  renderRewardRangeRows('#chapterRewardRows', [], false);
  renderRewardRangeRows('#stageRewardRows', rewards.items || [], true);
  renderDungeonEnemyRows(effective.initialEnemies || effective.enemies || []);
  renderDungeonBossRows(effective.bossWaves || []);
  setDungeonEditorMode(isChapterMode);
}

function setDungeonEditorMode(isChapterMode) {
  setInputLabel('#dungeonName', isChapterMode ? '章节名称' : '关卡名称');
  setInputLabel('#dungeonRecommendedLevel', isChapterMode ? '章节推荐等级' : '关卡推荐等级');
  setInputLabel('#dungeonIcon', isChapterMode ? '章节图标' : '关卡图标');
  setFieldVisible('#dungeonId', !isChapterMode);
  setFieldVisible('#dungeonStageNumber', !isChapterMode);
  setFieldVisible('#dungeonChapterDescription', isChapterMode);
  setFieldVisible('#dungeonChapterBackground', isChapterMode);
  setFieldVisible('#dungeonEnergyCost', !isChapterMode);
  setFieldVisible('#dungeonSceneId', !isChapterMode);
  setFieldVisible('#dungeonEnvironmentEffect', !isChapterMode);
  setFieldVisible('#dungeonDescription', !isChapterMode);
  setFieldVisible('#dungeonCols', !isChapterMode);
  setFieldVisible('#dungeonRows', !isChapterMode);
  setFieldVisible('#dungeonHeroSpawn', !isChapterMode);
  setFieldVisible('#dungeonObstacles', !isChapterMode);
  setFieldVisible('#dungeonSpecialTiles', !isChapterMode);
  setFieldVisible('#dungeonGoldMin', !isChapterMode);
  setFieldVisible('#dungeonGoldMax', !isChapterMode);
  setFieldVisible('#dungeonExpMin', !isChapterMode);
  setFieldVisible('#dungeonExpMax', !isChapterMode);
  setClosestBlockVisible('#chapterRewardRows', false);
  setClosestBlockVisible('#stageRewardRows', !isChapterMode);
  setClosestBlockVisible('#dungeonEnemyRows', !isChapterMode);
  setClosestBlockVisible('#dungeonBossRows', !isChapterMode);
  const form = $('#dungeonForm');
  if (form) {
    form.dataset.mode = isChapterMode ? 'chapter' : 'stage';
  }
}

function setInputLabel(selector, text) {
  const label = $(selector)?.closest('label');
  const span = label?.querySelector('span');
  if (span) {
    span.textContent = text;
  }
}

function setFieldVisible(selector, visible) {
  const element = $(selector);
  const wrapper = element?.closest('label') || element;
  if (wrapper) {
    wrapper.style.display = visible ? '' : 'none';
  }
}

function setClosestBlockVisible(selector, visible) {
  const element = $(selector);
  const wrapper = element?.closest('.nested-editor') || element?.closest('label') || element;
  if (wrapper) {
    wrapper.style.display = visible ? '' : 'none';
  }
}

function createBlankDungeon() {
  const selectedChapter = getSelectedChapter() || getDungeonChapters()[0] || null;
  const chapterId = selectedChapter?.id || 'chapter_01';
  const chapterNumber = Number(selectedChapter?.index || selectedChapter?.chapterNumber || 1) || 1;
  const chapterStages = selectedChapter?.stages || [];
  const nextStageNumber = chapterStages.reduce((max, stage) => Math.max(max, Number(stage.stageNumber || 1)), 0) + 1;
  const nextIndex = (state.catalog.dungeons || []).length + 1;
  state.selectedDungeon = null;
  state.selectedDungeonMode = 'stage';
  state.selectedChapterKey = chapterId;
  renderDungeons();
  renderDungeonEditor({
    id: `dungeon_${String(nextIndex).padStart(3, '0')}`,
    name: '',
    icon: '关',
    chapterId,
    chapterNumber,
    stageNumber: nextStageNumber,
    level: 1,
    recommendedLevel: 1,
    energyCost: 5,
    sceneId: 'standard_9x9',
    environmentEffect: 'none',
    battlefield: {
      cols: 7,
      rows: 10,
      heroSpawn: { positions: [[10, 3], [10, 4], [10, 5], [9, 4]] },
      obstacles: [],
      specialTiles: []
    },
    rewards: { gold: { min: 0, max: 0 }, exp: { min: 0, max: 0 }, chapter: [], items: [] },
    initialEnemies: [],
    bossWaves: []
  });
}

function createBlankChapter() {
  const chapters = getDungeonChapters();
  const nextChapterNumber = chapters.reduce((max, chapter) => Math.max(max, Number(chapter.index || chapter.chapterNumber || 1)), 0) + 1;
  state.selectedDungeon = {
    id: `chapter_${String(nextChapterNumber).padStart(2, '0')}`,
    index: nextChapterNumber,
    chapterNumber: nextChapterNumber,
    name: `第${nextChapterNumber}章`,
    recommendedLevel: 1,
    description: '',
    background: '',
    icon: '章',
    dungeonIds: [],
    category: 'dungeonChapter',
    __chapterDraft: true
  };
  state.selectedDungeonMode = 'chapter';
  state.selectedChapterKey = state.selectedDungeon.id;
  renderDungeons();
  renderDungeonEditor(state.selectedDungeon);
}

function createBlankRewardRange() {
  return { id: '', min: 1, max: 1, chance: 1 };
}

function renderRewardRangeRows(selector, rewards, withChance) {
  const root = $(selector);
  if (!root) return;
  root.innerHTML = rewards.length ? rewards.map((reward, index) => `
    <div class="editable-row reward-range-grid" data-reward-index="${index}">
      <select class="select-input" data-field="id">
        ${renderRewardSelectOptions(reward.id || '', '请选择道具或资源')}
      </select>
      <input class="text-input" data-field="min" type="number" min="0" value="${escapeAttr(reward.min ?? reward.count ?? 1)}" placeholder="最小">
      <input class="text-input" data-field="max" type="number" min="0" value="${escapeAttr(reward.max ?? reward.count ?? 1)}" placeholder="最大">
      ${withChance ? `<input class="text-input" data-field="chance" type="number" min="0" max="1" step="0.01" value="${escapeAttr(reward.chance ?? 1)}" placeholder="概率 0-1">` : ''}
      <button class="icon-button" data-remove-row="${index}" type="button">×</button>
    </div>
  `).join('') : '<div class="empty-state">暂未配置奖励</div>';

  root.querySelectorAll('[data-remove-row]').forEach((button) => {
    button.addEventListener('click', () => {
      const rows = readRewardRangeRows(selector);
      rows.splice(Number(button.dataset.removeRow), 1);
      renderRewardRangeRows(selector, rows, withChance);
    });
  });
}

function readRewardRangeRows(selector) {
  return $$(`${selector} .editable-row`).map((row) => {
    const chanceInput = row.querySelector('[data-field="chance"]');
    const entry = {
      id: parseRewardInput(row.querySelector('[data-field="id"]').value),
      min: Math.max(0, Number(row.querySelector('[data-field="min"]').value) || 0),
      max: Math.max(0, Number(row.querySelector('[data-field="max"]').value) || 0)
    };
    if (chanceInput) {
      entry.chance = chanceInput.value === ''
        ? 1
        : Math.max(0, Math.min(1, Number(chanceInput.value) || 0));
    }
    return entry;
  }).filter((entry) => entry.id);
}

function createBlankDungeonEnemy(rank = 'normal') {
  return { id: '', rank, count: 1, positions: [], stats: {} };
}

function renderDungeonEnemyRows(enemies) {
  const root = $('#dungeonEnemyRows');
  if (!root) return;
  root.innerHTML = enemies.length ? enemies.map((enemy, index) => `
    <div class="editable-row dungeon-enemy-grid" data-enemy-index="${index}">
      <input class="text-input" data-field="id" list="enemyIdOptions" value="${escapeAttr(formatEnemyDisplay(enemy.id || ''))}" placeholder="怪物">
      <input class="text-input" data-field="count" type="number" min="1" value="${escapeAttr(enemy.count || 1)}" placeholder="数量">
      <input class="text-input" data-field="positions" value="${escapeAttr(formatCoordinates(enemy.positions || enemy.spawnPositions || []))}" placeholder="出生点 2,3;2,4">
      <input class="text-input" data-field="multiplier" type="number" min="0.1" step="0.1" value="${escapeAttr(enemy.multiplier ?? 1)}" placeholder="倍率">
      <input class="text-input code-input" data-field="overrideStats" value="${escapeAttr(stringifyInlineJson(enemy.overrideStats || {}))}" placeholder='属性 JSON'>
      <button class="icon-button" data-remove-row="${index}" type="button">×</button>
    </div>
  `).join('') : '<div class="empty-state">暂未配置敌人</div>';

  root.querySelectorAll('[data-remove-row]').forEach((button) => {
    button.addEventListener('click', () => {
      const rows = readDungeonEnemyRows();
      rows.splice(Number(button.dataset.removeRow), 1);
      renderDungeonEnemyRows(rows);
    });
  });
}

function readDungeonEnemyRows() {
  return $$('#dungeonEnemyRows .editable-row').map((row) => {
    const overrideStatsRaw = row.querySelector('[data-field="overrideStats"]').value.trim();
    let overrideStats = {};
    if (overrideStatsRaw) {
      try {
        overrideStats = JSON.parse(overrideStatsRaw);
      } catch (error) {
    throw new Error('敌人属性 JSON 格式错误');
      }
    }
    return {
      id: parseEnemyInput(row.querySelector('[data-field="id"]').value),
      count: Math.max(1, Number(row.querySelector('[data-field="count"]').value) || 1),
      positions: parseCoordinateInput(row.querySelector('[data-field="positions"]').value),
      multiplier: Math.max(0.1, Number(row.querySelector('[data-field="multiplier"]').value) || 1),
      overrideStats
    };
  }).filter((entry) => entry.id);
}

function renderDungeonEnemyRows(enemies) {
  const root = $('#dungeonEnemyRows');
  if (!root) return;
  root.innerHTML = enemies.length ? enemies.map((enemy, index) => `
    <div class="editable-row dungeon-enemy-grid" data-enemy-index="${index}">
      <select class="select-input" data-field="id">
        ${renderEnemySelectOptions(enemy.id || '', '请选择怪物')}
      </select>
      <select class="select-input" data-field="rank">${renderRankOptions(enemy.rank || 'normal')}</select>
      <input class="text-input" data-field="count" type="number" min="1" value="${escapeAttr(enemy.count || 1)}" placeholder="数量">
      <input class="text-input" data-field="positions" value="${escapeAttr(formatCoordinates(enemy.positions || enemy.spawnPositions || []))}" placeholder="出生点 2,3;2,4">
      <input class="text-input" data-field="skillIds" list="enemySkillOptions" value="${escapeAttr(formatEnemySkillListDisplay(getEnemySkillIdsFromEntry(enemy)))}" placeholder="技能，可逗号分隔">
      <input class="text-input" data-field="hp" type="number" min="1" value="${escapeAttr(enemy.stats?.hp ?? enemy.overrideStats?.hp ?? '')}" placeholder="生命">
      <input class="text-input" data-field="attack" type="number" min="1" value="${escapeAttr(enemy.stats?.attack ?? enemy.overrideStats?.attack ?? '')}" placeholder="攻击">
      <input class="text-input" data-field="attackRange" type="number" min="1" value="${escapeAttr(enemy.stats?.attackRange ?? enemy.overrideStats?.attackRange ?? '')}" placeholder="攻击距离">
      <input class="text-input" data-field="moveRange" type="number" min="1" value="${escapeAttr(enemy.stats?.moveRange ?? enemy.overrideStats?.moveRange ?? '')}" placeholder="移动距离">
      <input class="text-input" data-field="defense" type="number" min="0" value="${escapeAttr(enemy.stats?.defense ?? enemy.overrideStats?.defense ?? '')}" placeholder="防御">
      <input class="text-input" data-field="speed" type="number" min="1" value="${escapeAttr(enemy.stats?.speed ?? enemy.overrideStats?.speed ?? '')}" placeholder="速度">
      <input class="text-input" data-field="crit" type="number" min="0" value="${escapeAttr(enemy.stats?.crit ?? enemy.overrideStats?.crit ?? '')}" placeholder="暴击">
      <input class="text-input" data-field="antiCrit" type="number" min="0" value="${escapeAttr(enemy.stats?.antiCrit ?? enemy.overrideStats?.antiCrit ?? '')}" placeholder="抗暴">
      <input class="text-input" data-field="defensePen" type="number" min="0" value="${escapeAttr(enemy.stats?.defensePen ?? enemy.overrideStats?.defensePen ?? '')}" placeholder="破防">
      <input class="text-input" data-field="accuracy" type="number" min="0" value="${escapeAttr(enemy.stats?.accuracy ?? enemy.overrideStats?.accuracy ?? '')}" placeholder="命中">
      <input class="text-input" data-field="dodge" type="number" min="0" value="${escapeAttr(enemy.stats?.dodge ?? enemy.overrideStats?.dodge ?? '')}" placeholder="闪避">
      <input class="text-input code-input" data-field="extraStats" value="${escapeAttr(stringifyInlineJson(getExtraStats(enemy.stats || enemy.overrideStats || {})))}" placeholder='其他属性 JSON'>
      <button class="icon-button" data-remove-row="${index}" type="button">×</button>
    </div>
  `).join('') : '<div class="empty-state">暂未配置敌人</div>';

  root.querySelectorAll('[data-remove-row]').forEach((button) => {
    button.addEventListener('click', () => {
      const rows = readDungeonEnemyRows();
      rows.splice(Number(button.dataset.removeRow), 1);
      renderDungeonEnemyRows(rows);
    });
  });
  root.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', () => syncDungeonEnemyJsonFromRows());
    field.addEventListener('change', () => syncDungeonEnemyJsonFromRows());
  });
  syncDungeonEnemyJsonFromRows(false);
}

function readDungeonEnemyRows() {
  const jsonField = $('#dungeonEnemyJson');
  if (jsonField?.dataset.dirty === 'true') {
    return parseJsonField('#dungeonEnemyJson', []);
  }
  return $$('#dungeonEnemyRows .editable-row').map((row) => {
    const stats = readEnemyStatsFromRow(row);
    const entry = {
      id: parseEnemyInput(row.querySelector('[data-field="id"]').value),
      rank: row.querySelector('[data-field="rank"]').value || 'normal',
      count: Math.max(1, Number(row.querySelector('[data-field="count"]').value) || 1),
      positions: parseCoordinateInput(row.querySelector('[data-field="positions"]').value)
    };
    const skillIds = parseEnemySkillListInput(row.querySelector('[data-field="skillIds"]')?.value || '');
    if (skillIds.length) {
      entry.skillIds = skillIds;
    }
    if (Object.keys(stats).length) {
      entry.stats = stats;
    }
    return entry;
  }).filter((entry) => entry.id);
}

function createBlankDungeonBossEntry() {
  return { waveId: '', spawnRound: 12, spawnOnClearBeforeRound: true, id: '', rank: 'boss', count: 1, positions: [], stats: {} };
}

function renderDungeonBossRows(waves) {
  const root = $('#dungeonBossRows');
  if (!root) return;
  const entries = flattenBossWaveEntries(waves);
  root.innerHTML = entries.length ? entries.map((entry, index) => `
    <div class="editable-row dungeon-boss-grid" data-boss-index="${index}">
      <input class="text-input" data-field="waveId" value="${escapeAttr(entry.waveId || '')}" placeholder="波次 ID">
      <input class="text-input" data-field="spawnRound" type="number" min="1" value="${escapeAttr(entry.spawnRound || 12)}" placeholder="回合">
      <select class="select-input" data-field="spawnOnClearBeforeRound">
        <option value="true" ${entry.spawnOnClearBeforeRound !== false ? 'selected' : ''}>清场前可出现</option>
        <option value="false" ${entry.spawnOnClearBeforeRound === false ? 'selected' : ''}>固定回合</option>
      </select>
      <select class="select-input" data-field="id">
        ${renderEnemySelectOptions(entry.id || '', '请选择BOSS')}
      </select>
      <select class="select-input" data-field="rank">${renderRankOptions(entry.rank || 'boss')}</select>
      <input class="text-input" data-field="count" type="number" min="1" value="${escapeAttr(entry.count || 1)}" placeholder="数量">
      <input class="text-input" data-field="positions" value="${escapeAttr(formatCoordinates(entry.positions || entry.spawnPositions || []))}" placeholder="出生点">
      <input class="text-input" data-field="skillIds" list="enemySkillOptions" value="${escapeAttr(formatEnemySkillListDisplay(getEnemySkillIdsFromEntry(entry)))}" placeholder="技能，可逗号分隔">
      <input class="text-input" data-field="hp" type="number" min="1" value="${escapeAttr(entry.stats?.hp ?? entry.overrideStats?.hp ?? '')}" placeholder="生命">
      <input class="text-input" data-field="attack" type="number" min="1" value="${escapeAttr(entry.stats?.attack ?? entry.overrideStats?.attack ?? '')}" placeholder="攻击">
      <input class="text-input" data-field="attackRange" type="number" min="1" value="${escapeAttr(entry.stats?.attackRange ?? entry.overrideStats?.attackRange ?? '')}" placeholder="攻击距离">
      <input class="text-input" data-field="moveRange" type="number" min="1" value="${escapeAttr(entry.stats?.moveRange ?? entry.overrideStats?.moveRange ?? '')}" placeholder="移动距离">
      <input class="text-input" data-field="defense" type="number" min="0" value="${escapeAttr(entry.stats?.defense ?? entry.overrideStats?.defense ?? '')}" placeholder="防御">
      <input class="text-input" data-field="speed" type="number" min="1" value="${escapeAttr(entry.stats?.speed ?? entry.overrideStats?.speed ?? '')}" placeholder="速度">
      <input class="text-input" data-field="crit" type="number" min="0" value="${escapeAttr(entry.stats?.crit ?? entry.overrideStats?.crit ?? '')}" placeholder="暴击">
      <input class="text-input" data-field="antiCrit" type="number" min="0" value="${escapeAttr(entry.stats?.antiCrit ?? entry.overrideStats?.antiCrit ?? '')}" placeholder="抗暴">
      <input class="text-input" data-field="defensePen" type="number" min="0" value="${escapeAttr(entry.stats?.defensePen ?? entry.overrideStats?.defensePen ?? '')}" placeholder="破防">
      <input class="text-input" data-field="accuracy" type="number" min="0" value="${escapeAttr(entry.stats?.accuracy ?? entry.overrideStats?.accuracy ?? '')}" placeholder="命中">
      <input class="text-input" data-field="dodge" type="number" min="0" value="${escapeAttr(entry.stats?.dodge ?? entry.overrideStats?.dodge ?? '')}" placeholder="闪避">
      <input class="text-input code-input" data-field="extraStats" value="${escapeAttr(stringifyInlineJson(getExtraStats(entry.stats || entry.overrideStats || {})))}" placeholder='其他属性 JSON'>
      <button class="icon-button" data-remove-boss-row="${index}" type="button">×</button>
    </div>
  `).join('') : '<div class="empty-state">暂未配置 BOSS</div>';

  root.querySelectorAll('[data-remove-boss-row]').forEach((button) => {
    button.addEventListener('click', () => {
      const rows = readDungeonBossEntries();
      rows.splice(Number(button.dataset.removeBossRow), 1);
      renderDungeonBossRows(groupBossWaveEntries(rows));
    });
  });
  root.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', () => syncDungeonBossJsonFromRows());
    field.addEventListener('change', () => syncDungeonBossJsonFromRows());
  });
  syncDungeonBossJsonFromRows(false);
}

function flattenBossWaveEntries(waves) {
  return (Array.isArray(waves) ? waves : []).flatMap((wave, waveIndex) => {
    if (!Array.isArray(wave.bosses) && isBossEntryLike(wave)) {
      return [wave];
    }
    const waveId = wave.id || `boss_wave_${waveIndex + 1}`;
    const bosses = Array.isArray(wave.bosses) ? wave.bosses : [];
    return bosses.map((boss) => ({
      ...boss,
      waveId,
      spawnRound: wave.spawnRound ?? 12,
      spawnOnClearBeforeRound: wave.spawnOnClearBeforeRound !== false
    }));
  });
}

function isBossEntryLike(entry) {
  if (!entry || typeof entry !== 'object') return false;
  return ['id', 'waveId', 'rank', 'count', 'positions', 'spawnPositions', 'skillIds', 'skillRefs', 'skills', 'skill', 'stats', 'overrideStats'].some((field) =>
    Object.prototype.hasOwnProperty.call(entry, field)
  );
}

function readDungeonBossEntries() {
  const jsonField = $('#dungeonBossWaves');
  if (jsonField?.dataset.dirty === 'true') {
    return flattenBossWaveEntries(parseJsonField('#dungeonBossWaves', []));
  }
  return $$('#dungeonBossRows .editable-row').map((row) => {
    const stats = readEnemyStatsFromRow(row);
    const entry = {
      waveId: row.querySelector('[data-field="waveId"]').value.trim(),
      spawnRound: Math.max(1, Number(row.querySelector('[data-field="spawnRound"]').value) || 12),
      spawnOnClearBeforeRound: row.querySelector('[data-field="spawnOnClearBeforeRound"]').value !== 'false',
      id: parseEnemyInput(row.querySelector('[data-field="id"]').value),
      rank: row.querySelector('[data-field="rank"]').value || 'boss',
      count: Math.max(1, Number(row.querySelector('[data-field="count"]').value) || 1),
      positions: parseCoordinateInput(row.querySelector('[data-field="positions"]').value)
    };
    const skillIds = parseEnemySkillListInput(row.querySelector('[data-field="skillIds"]')?.value || '');
    if (skillIds.length) {
      entry.skillIds = skillIds;
    }
    if (Object.keys(stats).length) {
      entry.stats = stats;
    }
    return entry;
  }).filter((entry) => entry.id);
}

function readDungeonBossWaves() {
  const jsonField = $('#dungeonBossWaves');
  if (jsonField?.dataset.dirty === 'true') {
    return parseJsonField('#dungeonBossWaves', []);
  }
  return groupBossWaveEntries(readDungeonBossEntries());
}

function groupBossWaveEntries(entries) {
  const waveMap = new Map();
  entries.forEach((entry, index) => {
    const waveId = entry.waveId || `boss_wave_${index + 1}`;
    if (!waveMap.has(waveId)) {
      waveMap.set(waveId, {
        id: waveId,
        spawnRound: entry.spawnRound || 12,
        spawnOnClearBeforeRound: entry.spawnOnClearBeforeRound !== false,
        bosses: []
      });
    }
    const wave = waveMap.get(waveId);
    const boss = { id: entry.id, rank: entry.rank || 'boss', count: Math.max(1, Number(entry.count) || 1) };
    if (entry.positions?.length) {
      boss.positions = entry.positions;
    }
    if (entry.skillIds?.length) {
      boss.skillIds = entry.skillIds;
    }
    if (entry.skillRefs?.length) {
      boss.skillRefs = entry.skillRefs;
    }
    if (entry.skills?.length) {
      boss.skills = entry.skills;
    }
    if (entry.skill) {
      boss.skill = entry.skill;
    }
    if (entry.stats && Object.keys(entry.stats).length) {
      boss.stats = entry.stats;
    }
    wave.bosses.push(boss);
  });
  return [...waveMap.values()];
}

function readEnemyStatsFromRow(row) {
  const stats = {};
  ['hp', 'attack', 'attackRange', 'moveRange', 'defense', 'speed', 'crit', 'antiCrit', 'defensePen', 'accuracy', 'dodge'].forEach((field) => {
    const raw = row.querySelector(`[data-field="${field}"]`)?.value;
    if (raw !== undefined && raw !== '') {
      stats[field] = Number(raw) || 0;
    }
  });
  const extraRaw = row.querySelector('[data-field="extraStats"]')?.value.trim();
  if (extraRaw) {
    try {
      Object.assign(stats, JSON.parse(extraRaw));
    } catch (error) {
      throw new Error('敌人额外属性 JSON 格式错误');
    }
  }
  return stats;
}

function getExtraStats(stats) {
  const extra = { ...(stats || {}) };
  ['hp', 'attack', 'attackRange', 'moveRange', 'defense', 'speed', 'crit', 'antiCrit', 'defensePen', 'accuracy', 'dodge'].forEach((field) => delete extra[field]);
  return extra;
}

function renderRankOptions(selectedRank) {
  const labels = { normal: '普通', elite: '精英', boss: '首领' };
  return Object.entries(labels).map(([value, label]) =>
    `<option value="${value}" ${selectedRank === value ? 'selected' : ''}>${label}</option>`
  ).join('');
}

function syncDungeonEnemyJsonFromRows(markClean = true) {
  const field = $('#dungeonEnemyJson');
  if (!field) return;
  const previousDirty = field.dataset.dirty;
  field.dataset.dirty = 'false';
  field.value = stringifyJson(readDungeonEnemyRows());
  field.dataset.dirty = markClean ? 'false' : previousDirty || 'false';
}

function syncDungeonBossJsonFromRows(markClean = true) {
  const field = $('#dungeonBossWaves');
  if (!field) return;
  const previousDirty = field.dataset.dirty;
  field.dataset.dirty = 'false';
  field.value = stringifyJson(readDungeonBossWaves());
  field.dataset.dirty = markClean ? 'false' : previousDirty || 'false';
}

async function saveDungeon(event) {
  event.preventDefault();
  if (state.selectedDungeonMode === 'chapter') {
    await saveDungeonChapter();
    return;
  }

  const id = $('#dungeonId').value.trim();
  if (!id) {
    showToast('请填写副本 ID');
    return;
  }

  let initialEnemies = [];
  let bossWaves = [];
  try {
    initialEnemies = readDungeonEnemyRows();
    bossWaves = readDungeonBossWaves();
  } catch (error) {
    showToast(error.message);
    return;
  }

  const level = Math.max(1, Number($('#dungeonRecommendedLevel').value) || 1);
  const currentBattlefield = state.selectedDungeon?.battlefield || {};
  const chapter = getSelectedChapter();
  const chapterId = state.selectedChapterKey || chapter?.id || state.selectedDungeon?.chapterId || '';
  const payload = {
    id,
    name: $('#dungeonName').value.trim(),
    icon: $('#dungeonIcon').value.trim(),
    level,
    recommendedLevel: level,
    energyCost: Number($('#dungeonEnergyCost').value) || 0,
    sceneId: $('#dungeonSceneId').value.trim() || 'standard_9x9',
    environmentEffect: normalizeDungeonEnvironmentEffect($('#dungeonEnvironmentEffect').value),
    chapterId,
    chapterNumber: Number($('#dungeonChapterNumber').value) || Number(chapter?.index || chapter?.chapterNumber || 1) || 1,
    stageNumber: Number($('#dungeonStageNumber').value) || 1,
    description: $('#dungeonDescription').value.trim(),
    battlefield: {
      ...currentBattlefield,
      cols: Number($('#dungeonCols').value) || 7,
      rows: Number($('#dungeonRows').value) || 10,
      heroSpawn: { positions: parseCoordinateInput($('#dungeonHeroSpawn').value) },
      enemySpawn: currentBattlefield.enemySpawn || {},
      obstacles: parseCoordinateInput($('#dungeonObstacles').value),
      specialTiles: parseSpecialTileInput($('#dungeonSpecialTiles').value)
    },
    initialEnemies,
    bossWaves,
    rewards: {
      gold: {
        min: Number($('#dungeonGoldMin').value) || 0,
        max: Number($('#dungeonGoldMax').value) || 0
      },
      exp: {
        min: Number($('#dungeonExpMin').value) || 0,
        max: Number($('#dungeonExpMax').value) || 0
      },
      chapter: state.selectedDungeon?.rewards?.chapter || [],
      items: readRewardRangeRows('#stageRewardRows')
    }
  };

  try {
    await api(`/gm/catalog/dungeons/${encodeURIComponent(id)}`, { method: 'PUT', body: payload });
    if (chapterId) {
      await ensureDungeonInChapter(chapterId, id, payload.stageNumber);
    }
    showToast('副本已保存');
    await loadCatalog();
    const reloadedDungeon = (state.catalog.dungeons || []).find((entry) => entry.id === id) || {};
    state.selectedDungeon = {
      ...reloadedDungeon,
      ...payload,
      source: reloadedDungeon.source || 'gm',
      updatedAt: reloadedDungeon.updatedAt
    };
    renderDungeons();
    renderDungeonEditor(state.selectedDungeon);
  } catch (error) {
    showToast(`副本保存失败：${error.message}`);
  }
}

async function saveDungeonChapter() {
  const currentChapter = getSelectedChapter() || state.selectedDungeon || {};
  const chapterId = currentChapter.id || $('#dungeonId').value.trim();
  if (!chapterId) {
    showToast('请填写章节 ID');
    return;
  }
  const chapterNumber = Number($('#dungeonChapterNumber').value) || 1;
  const level = Math.max(1, Number($('#dungeonRecommendedLevel').value) || 1);
  const chapterName = $('#dungeonName').value.trim() || `第${chapterNumber}章`;
  const payload = {
    id: chapterId,
    index: chapterNumber,
    chapterNumber,
    name: chapterName,
    icon: $('#dungeonIcon').value.trim(),
    recommendedLevel: level,
    description: $('#dungeonChapterDescription').value.trim(),
    background: $('#dungeonChapterBackground').value.trim(),
    dungeonIds: Array.isArray(currentChapter.dungeonIds) ? currentChapter.dungeonIds : []
  };

  try {
    await api(`/gm/catalog/dungeonChapters/${encodeURIComponent(chapterId)}`, { method: 'PUT', body: payload });
    showToast('章节已保存');
    await loadCatalog();
    const nextChapter = (state.catalog.dungeonChapters || []).find((chapter) => chapter.id === chapterId) || null;
    state.selectedDungeon = nextChapter;
    state.selectedChapterKey = chapterId;
    state.selectedDungeonMode = 'chapter';
    renderDungeons();
    renderDungeonEditor(nextChapter);
  } catch (error) {
    showToast(`章节保存失败：${error.message}`);
  }
}

async function ensureDungeonInChapter(chapterId, dungeonId, stageNumber) {
  const chapter = getDungeonChapters().find((entry) => entry.id === chapterId);
  if (!chapter) {
    return;
  }
  const dungeonIds = [...(chapter.dungeonIds || [])].filter((id) => id !== dungeonId);
  const insertIndex = Math.max(0, Math.min(dungeonIds.length, Number(stageNumber || dungeonIds.length + 1) - 1));
  dungeonIds.splice(insertIndex, 0, dungeonId);
  await api(`/gm/catalog/dungeonChapters/${encodeURIComponent(chapterId)}`, {
    method: 'PUT',
    body: {
      id: chapter.id,
      index: chapter.index || chapter.chapterNumber || 1,
      name: chapter.name || chapter.title || chapter.id,
      icon: chapter.icon || '',
      recommendedLevel: chapter.recommendedLevel || chapter.level || 1,
      description: chapter.description || '',
      background: chapter.background || '',
      dungeonIds
    }
  });
}

async function deleteDungeonOverride() {
  if (state.selectedDungeonMode === 'chapter') {
    await deleteDungeonChapterOverride();
    return;
  }

  const id = $('#dungeonId').value.trim();
  if (!id) {
    showToast('请先选择或填写关卡 ID');
    return;
  }
  if (!confirm(`确认删除关卡 ${id} 吗？该关卡会从所属章节中移除。`)) return;
  try {
    const chapterId = state.selectedDungeon?.chapterId || state.selectedChapterKey;
    await api(`/gm/catalog/dungeons/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (chapterId) {
      await removeDungeonFromChapter(chapterId, id);
    }
    showToast('关卡已删除');
    state.selectedDungeon = null;
    await loadCatalog();
    renderDungeonEditor(null);
  } catch (error) {
    showToast(`删除失败：${error.message}`);
  }
}

async function deleteDungeonChapterOverride() {
  const chapter = getSelectedChapter() || state.selectedDungeon;
  if (!chapter?.id) {
    showToast('请先选择章节');
    return;
  }
  if (!confirm(`确认删除章节 ${chapter.name || chapter.id} 吗？删除后该章节下的关卡将不再出现在章节列表中。`)) return;
  try {
    await api(`/gm/catalog/dungeonChapters/${encodeURIComponent(chapter.id)}`, { method: 'DELETE' });
    showToast('章节已删除');
    state.selectedDungeon = null;
    state.selectedDungeonMode = 'stage';
    await loadCatalog();
    renderDungeonEditor(null);
  } catch (error) {
    showToast(`删除失败：${error.message}`);
  }
}

async function removeDungeonFromChapter(chapterId, dungeonId) {
  const chapter = getDungeonChapters().find((entry) => entry.id === chapterId);
  if (!chapter) {
    return;
  }
  await api(`/gm/catalog/dungeonChapters/${encodeURIComponent(chapterId)}`, {
    method: 'PUT',
    body: {
      id: chapter.id,
      index: chapter.index || chapter.chapterNumber || 1,
      name: chapter.name || chapter.title || chapter.id,
      icon: chapter.icon || '',
      recommendedLevel: chapter.recommendedLevel || chapter.level || 1,
      description: chapter.description || '',
      background: chapter.background || '',
      dungeonIds: (chapter.dungeonIds || []).filter((id) => id !== dungeonId)
    }
  });
}

function loadDungeonBatchJson() {
  $('#dungeonBatchJson').value = JSON.stringify({
    chapters: state.catalog.dungeonChapters || [],
    dungeons: state.catalog.dungeons || []
  }, null, 2);
}

async function saveDungeonBatch() {
  let payload = null;
  try {
    payload = JSON.parse($('#dungeonBatchJson').value || '{}');
  } catch (error) {
    showToast('批量 JSON 格式错误');
    return;
  }
  const chapters = Array.isArray(payload) ? [] : (payload?.chapters || []);
  const dungeons = Array.isArray(payload) ? payload : (payload?.dungeons || []);
  if ((!Array.isArray(chapters) || chapters.length === 0) && (!Array.isArray(dungeons) || dungeons.length === 0)) {
    showToast('请填写章节或副本 JSON');
    return;
  }
  try {
    let chapterCount = 0;
    let dungeonCount = 0;
    if (Array.isArray(chapters) && chapters.length > 0) {
      const result = await api('/gm/catalog/dungeonChapters/batch', { method: 'POST', body: { entries: chapters } });
      chapterCount = result.savedCount || 0;
    }
    if (Array.isArray(dungeons) && dungeons.length > 0) {
      const result = await api('/gm/catalog/dungeons/batch', { method: 'POST', body: { entries: dungeons } });
      dungeonCount = result.savedCount || 0;
    }
    showToast(`已批量保存 ${chapterCount} 个章节、${dungeonCount} 个副本`);
    await loadCatalog();
    renderDungeons();
  } catch (error) {
    showToast(`批量保存失败：${error.message}`);
  }
}

function parseCoordinateInput(value) {
  return String(value || '')
    .split(/[;\n]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [row, col] = chunk.split(/[,，\s]+/).map((part) => Number(part));
      return [Math.max(1, row || 1), Math.max(1, col || 1)];
    });
}

function formatCoordinates(value) {
  return (Array.isArray(value) ? value : []).map((entry) => {
    if (Array.isArray(entry)) {
      return `${entry[0]},${entry[1]}`;
    }
    if (entry && typeof entry === 'object') {
      return `${entry.row ?? entry.y ?? 1},${entry.col ?? entry.x ?? 1}`;
    }
    return '';
  }).filter(Boolean).join(';');
}

function parseSpecialTileInput(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return [];
  }
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try {
      return normalizeSpecialTileGroups(JSON.parse(raw));
    } catch (error) {
      showToast(`特殊地格格式错误：${error.message}`);
      return [];
    }
  }
  return raw
    .split(/[;\n]+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [typePart, coordPart] = chunk.includes(':') ? chunk.split(':') : chunk.split('@');
      const [row, col] = String(coordPart || '').split(/[,，\s]+/).map((part) => Number(part));
      const type = String(typePart || '').trim();
      if (!type) {
        return null;
      }
      return {
        type,
        row: Math.max(1, row || 1),
        col: Math.max(1, col || 1)
      };
    })
    .filter(Boolean);
}

function normalizeSpecialTileGroups(value) {
  const list = Array.isArray(value)
    ? value
    : (value?.type && Array.isArray(value?.positions || value?.coords || value?.cells)
      ? [value]
      : Object.entries(value || {}).map(([type, positions]) => ({ type, positions })));
  return list
    .map((entry) => {
      const type = String(Array.isArray(entry) ? entry[2] : (entry?.type || entry?.kind || entry?.effect || '')).trim();
      const positions = Array.isArray(entry)
        ? [entry]
        : (Array.isArray(entry?.positions || entry?.coords || entry?.cells)
        ? (entry.positions || entry.coords || entry.cells)
        : (entry?.row !== undefined || entry?.col !== undefined || entry?.x !== undefined || entry?.y !== undefined ? [entry] : []));
      if (!type || !positions.length) {
        return null;
      }
      return {
        type,
        positions: positions
          .map((position) => {
            const row = Array.isArray(position) ? position[0] : position?.row ?? (Number(position?.y) + 1);
            const col = Array.isArray(position) ? position[1] : position?.col ?? (Number(position?.x) + 1);
            return [
              Math.max(1, Number(row) || 1),
              Math.max(1, Number(col) || 1)
            ];
          })
          .filter(Boolean)
      };
    })
    .filter(Boolean);
}

function formatSpecialTiles(value) {
  const groups = new Map();
  (Array.isArray(value) ? value : normalizeSpecialTileGroups(value)).forEach((entry) => {
    const type = String(Array.isArray(entry) ? entry[2] : entry?.type || '').trim();
    if (!type) {
      return;
    }
    const positions = Array.isArray(entry)
      ? [entry]
      : (Array.isArray(entry?.positions || entry?.coords || entry?.cells)
        ? (entry.positions || entry.coords || entry.cells)
        : [entry]);
    if (!groups.has(type)) {
      groups.set(type, []);
    }
    positions.forEach((position) => {
      const row = Array.isArray(position)
        ? Math.max(1, Number(position[0]) || 1)
        : (position?.row !== undefined ? Math.max(1, Number(position.row) || 1) : Math.max(1, Number(position?.y) + 1 || 1));
      const col = Array.isArray(position)
        ? Math.max(1, Number(position[1]) || 1)
        : (position?.col !== undefined ? Math.max(1, Number(position.col) || 1) : Math.max(1, Number(position?.x) + 1 || 1));
      groups.get(type).push([row, col]);
    });
  });
  const result = Array.from(groups.entries()).map(([type, positions]) => ({ type, positions }));
  return result.length ? JSON.stringify(result, null, 2) : '';
}

function stringifyInlineJson(value) {
  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
    return '';
  }
  return JSON.stringify(value);
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '');
}

async function createCdkeys(event) {
  event.preventDefault();
  const payload = {
    batchId: $('#cdkeyBatchId').value.trim(),
    title: $('#cdkeyTitle').value.trim(),
    prefix: $('#cdkeyPrefix').value.trim(),
    count: Number($('#cdkeyCount').value) || 0,
    codes: $('#cdkeyCodes').value,
    expireAt: dateTimeLocalToIso($('#cdkeyExpireAt').value),
    enabled: $('#cdkeyEnabled').value === 'true',
    remark: $('#cdkeyRemark').value.trim(),
    rewards: state.cdkeyRewards
  };
  try {
    const result = await api('/gm/cdkeys', { method: 'POST', body: payload });
    showToast(`已创建 ${result.insertedCount || 0} 个 CDKEY`);
    await loadCdkeys();
  } catch (error) {
    showToast(`CDKEY 创建失败：${error.message}`);
  }
}

async function loadCdkeys() {
  try {
    const params = new URLSearchParams({
      keyword: $('#cdkeySearchInput')?.value || '',
      used: $('#cdkeyUsedFilter')?.value || '',
      enabled: $('#cdkeyEnabledFilter')?.value || '',
      limit: '200'
    });
    const data = await api(`/gm/cdkeys?${params.toString()}`);
    state.cdkeys = data.cdkeys || [];
    renderCdkeys();
  } catch (error) {
    showToast(`CDKEY 查询失败：${error.message}`);
  }
}

function renderCdkeys() {
  const root = $('#cdkeyList');
  if (!state.cdkeys.length) {
    root.innerHTML = '<div class="empty-state">暂无 CDKEY</div>';
    return;
  }
  root.innerHTML = state.cdkeys.map((entry) => `
    <div class="cdkey-row">
      <input type="checkbox" data-cdkey-code="${escapeAttr(entry.code)}">
      <div>
        <div class="table-title">${escapeHtml(entry.code)}</div>
        <div class="table-meta">${escapeHtml(entry.batchId || '')}</div>
      </div>
      <div>${escapeHtml(entry.title || '')}</div>
      <div>${entry.used ? '已使用' : '未使用'} / ${entry.enabled ? '启用' : '停用'}</div>
      <div>${formatDate(entry.expireAt) || '长期'}</div>
    </div>
  `).join('');
}

async function bulkUpdateCdkeys() {
  const codes = $$('#cdkeyList [data-cdkey-code]:checked').map((input) => input.dataset.cdkeyCode);
  if (!codes.length) {
    showToast('请选择要修改的 CDKEY');
    return;
  }
  const update = {};
  if ($('#bulkEnabled').value) {
    update.enabled = $('#bulkEnabled').value === 'true';
  }
  if ($('#bulkTitle').value.trim()) {
    update.title = $('#bulkTitle').value.trim();
  }
  if ($('#bulkExpireAt').value) {
    update.expireAt = dateTimeLocalToIso($('#bulkExpireAt').value);
  }
  if (Object.keys(update).length === 0) {
    showToast('请填写要修改的字段');
    return;
  }
  try {
    const result = await api('/gm/cdkeys/batch', {
      method: 'PUT',
      body: { codes, update }
    });
    showToast(`已修改 ${result.modifiedCount || 0} 个 CDKEY`);
    await loadCdkeys();
  } catch (error) {
    showToast(`批量修改失败：${error.message}`);
  }
}

async function api(path, options = {}) {
  const url = `${normalizeBaseUrl(state.baseUrl)}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'x-gm-secret': state.gmSecret,
    ...(options.headers || {})
  };
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = { message: text };
    }
  }
  if (!response.ok) {
    throw new Error(payload?.message || `HTTP ${response.status}`);
  }
  return payload || {};
}

function normalizeBaseUrl(value) {
  const raw = String(value || 'http://127.0.0.1:9000/api').trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  const cleaned = withProtocol.replace(/\/+$/, '');
  if (/\/api$/i.test(cleaned)) {
    return cleaned;
  }
  return `${cleaned}/api`;
}

function parseJsonField(selector, fallback) {
  const value = $(selector).value.trim();
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`${selector} JSON 格式错误`);
  }
}

function stringifyJson(value) {
  if (!value || (typeof value === 'object' && Object.keys(value).length === 0)) {
    return '';
  }
  return JSON.stringify(value, null, 2);
}

function renderThumb(entry) {
  const src = resolveAssetSrc(entry.portrait || entry.iconSrc || entry.src || '');
  if (src) {
    return `<span class="thumb"><img src="${escapeAttr(src)}" alt="${escapeAttr(entry.name || entry.id || 'icon')}"></span>`;
  }
  return `<span class="thumb">${escapeHtml(entry.icon || entry.fallback || 'IMG')}</span>`;
}

function resolveAssetSrc(src) {
  if (!src) return '';
  const normalized = String(src).trim();
  if (/^(https?:|data:|file:)/i.test(normalized)) return normalized;
  if (/^[a-zA-Z]:[\\/]/.test(normalized)) {
    return encodeURI(`file:///${normalized.replace(/\\/g, '/').replace(/^([a-zA-Z]):/, '$1:')}`);
  }
  if (/^\\\\/.test(normalized)) {
    return encodeURI(`file:${normalized.replace(/\\/g, '/')}`);
  }
  return `../${normalized.replace(/^\/+/, '')}`;
}

function renderRarity(entry) {
  const rarity = entry.rarity || (entry.rarities || [])[0] || 'common';
  return `<span class="rarity-chip ${escapeAttr(rarity)}" title="${escapeAttr(rarity)}">${escapeHtml(getRarityLabel(rarity))}</span>`;
}

function getRarityLabel(rarity) {
  return rarityLabels[rarity] || rarity || '普通';
}

function dateTimeLocalToIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  $('#toastRoot').append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}






