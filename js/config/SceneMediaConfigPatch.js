(function() {
    const chapterMediaRoot = 'assets/media/chapters';
    const versionedSceneMedia = path => window.VersionManager?.getVersionedAssetUrl?.(path) || path;

    window.GameSceneBackgrounds = {
        shelter: {
            type: 'image',
            src: versionedSceneMedia('assets/media/shelter/shelter_bg.png'),
            poster: versionedSceneMedia('assets/media/shelter/shelter_bg.png'),
            mobileFallbackSrc: versionedSceneMedia('assets/media/shelter/shelter_bg.png')
        },
        dungeon: {
            type: 'image',
            src: versionedSceneMedia(`${chapterMediaRoot}/chapter_01.png`)
        },
        battle: {
            type: 'image',
            src: versionedSceneMedia(`${chapterMediaRoot}/chapter_01.png`)
        }
    };

    // 章节数据由 GM 工具同步注入，见 js/config/GmCatalogSyncPatch.js applyDungeonChapters
    window.DungeonChapterConfig = [];
})();
