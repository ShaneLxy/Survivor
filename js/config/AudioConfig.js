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
        checkin: 'yunjing_theme'
    },

    voices: {
        hero_010: {
            select: {
                name: '赤核浪客-夜刃·选中',
                text: '夜色已至，刀锋会替我回答。',
                src: 'assets/audio/voice/hero_010/select.wav'
            },
            battleStart: {
                name: '赤核浪客-夜刃·出战',
                text: '别眨眼，我会从他们身后回来。',
                src: 'assets/audio/voice/hero_010/battle_start.wav'
            }
        },
        hero_024: {
            select: {
                name: '焰罚者-余烬·选中',
                text: '火种还在，我会把黑暗烧穿。',
                src: 'assets/audio/voice/hero_024/select.wav'
            },
            battleStart: {
                name: '焰罚者-余烬·出战',
                text: '灰烬之后，才看得见新的路。',
                src: 'assets/audio/voice/hero_024/battle_start.wav'
            }
        }
    },

    voiceCues: {},
    sfx: {},

    preload: {
        music: ['yunjing_theme'],
        voices: ['hero_010.select', 'hero_024.select']
    }
};

window.AudioConfig = AudioConfig;
