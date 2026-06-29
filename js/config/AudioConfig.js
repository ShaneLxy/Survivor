/**
 * Audio asset registry.
 *
 * Put BGM files under assets/audio/bgm and character voice files under
 * assets/audio/voice/<heroId>. Then register them here.
 */
const AudioConfig = {
    music: {
        yunjing_theme: {
            id: 'yunjing_theme',
            name: '云境',
            src: 'assets/audio/bgm/ParadiseBGM.MP3',
            loop: true
        },
        battle_theme: {
            id: 'battle_theme',
            name: '战斗',
            src: 'assets/audio/bgm/ParadiseBGM.MP3',
            loop: true
        }
    },

    sceneMusic: {
        default: 'yunjing_theme',
        login: 'yunjing_theme',
        shelter: 'yunjing_theme',
        hero: 'yunjing_theme',
        recruit: 'yunjing_theme',
        dungeon: 'yunjing_theme',
        shop: 'yunjing_theme',
        checkin: 'yunjing_theme',
        battle: 'battle_theme'
    },
    voices: {},

    voiceCues: {},
    sfx: {
        battle_attack: {
            sources: []
        },
        battle_critical: {
            sources: []
        }
    },

    preload: {
        music: ['yunjing_theme', 'battle_theme'],
        voices: []
    }
};

window.AudioConfig = AudioConfig;
