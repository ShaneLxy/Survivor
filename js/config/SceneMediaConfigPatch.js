(function() {
    const chapterMediaRoot = 'assets/media/chapters';
    const versionedSceneMedia = path => window.VersionManager?.getVersionedAssetUrl?.(path) || path;

    window.GameSceneBackgrounds = {
        shelter: {
            type: 'video',
            src: versionedSceneMedia('assets/media/house.mp4'),
            mimeType: 'video/mp4',
            poster: versionedSceneMedia('assets/media/house_poster.png'),
            mobileFallbackSrc: versionedSceneMedia('assets/media/house_poster.png')
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

    window.DungeonChapterConfig = [
        {
            id: 'chapter_01',
            index: 1,
            name: '废弃工厂',
            dungeonIds: ['dungeon_001'],
            background: versionedSceneMedia(`${chapterMediaRoot}/chapter_01.png`),
            description: '第一章以锈蚀工厂为主视觉，保留工业废墟的压迫感。'
        },
        {
            id: 'chapter_02',
            index: 2,
            name: '黑潮密林',
            dungeonIds: ['dungeon_002'],
            background: versionedSceneMedia(`${chapterMediaRoot}/chapter_02.png`),
            description: '第二章切到密林场景，气质更潮湿、更危险。'
        },
        {
            id: 'chapter_03',
            index: 3,
            name: '地下裂隙',
            dungeonIds: ['dungeon_003'],
            background: versionedSceneMedia(`${chapterMediaRoot}/chapter_03.png`),
            description: '第三章强调地下空间与裂隙深处的冷色危机感。'
        },
        {
            id: 'chapter_04',
            index: 4,
            name: '废弃医院',
            dungeonIds: ['dungeon_004'],
            background: versionedSceneMedia(`${chapterMediaRoot}/chapter_04.png`),
            description: '第四章预留医院主题背景，后续可直接替换成正式美术。'
        }
    ];
})();
