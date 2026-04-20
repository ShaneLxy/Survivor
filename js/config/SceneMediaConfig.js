const versionedSceneMedia = path => window.VersionManager?.getVersionedAssetUrl?.(path) || path;

window.GameSceneBackgrounds = {
    shelter: {
        type: 'video',
        src: versionedSceneMedia('assets/media/house.mp4'),
        mimeType: 'video/mp4'
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

window.DungeonChapterConfig = [
    {
        id: 'chapter_01',
        index: 1,
        name: '废弃工厂',
        dungeonIds: ['dungeon_001'],
        background: versionedSceneMedia('assets/media/fuben.png'),
        description: '感染与机械残骸交错的工业废墟，是幸存者最先踏入的危险区域。'
    },
    {
        id: 'chapter_02',
        index: 2,
        name: '黑暗森林',
        dungeonIds: ['dungeon_002'],
        background: versionedSceneMedia('assets/media/fuben.png'),
        description: '密林深处潜伏着变异野兽，前进越深，敌人越凶狠。'
    },
    {
        id: 'chapter_03',
        index: 3,
        name: '地下墓窟',
        dungeonIds: ['dungeon_003'],
        background: versionedSceneMedia('assets/media/fuben.png'),
        description: '古老墓窟被亡灵占据，阴影与诅咒在狭窄通道中徘徊。'
    },
    {
        id: 'chapter_04',
        index: 4,
        name: '废弃医院',
        dungeonIds: ['dungeon_004'],
        background: versionedSceneMedia('assets/media/fuben.png'),
        description: '废弃病房和实验室里仍有变异体活动，是更高危险度的区域。'
    }
];
