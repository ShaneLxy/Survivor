const versionedSceneMedia = path => window.VersionManager?.getVersionedAssetUrl?.(path) || path;

window.GameSceneBackgrounds = {
    shelter: {
        type: 'image',
        src: versionedSceneMedia('assets/media/shelter/shelter_bg.png')
    },
    dungeon: {
        type: 'image',
        src: versionedSceneMedia('assets/media/fuben.png')
    },
    battle: {
        type: 'image',
        src: versionedSceneMedia('assets/media/fuben.png')
    }
};

// 章节数据由 GM 工具同步注入，见 js/config/GmCatalogSyncPatch.js applyDungeonChapters
window.DungeonChapterConfig = [];
