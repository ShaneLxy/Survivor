/**
 * 装备配置
 */
const EquipmentConfig = {
    slotNames: {
        weapon: '武器',
        clothes: '衣服',
        pants: '裤子',
        shoes: '鞋子'
    },

    rarityOrder: ['common', 'rare', 'epic', 'legendary'],
    rarityNames: {
        common: '普通',
        rare: '稀有',
        epic: '史诗',
        legendary: '传说'
    },

    getTemplateIconSrc(templateId) {
        if (!templateId) {
            return '';
        }
        const fileName = String(templateId).replace(/_/g, '-');
        const src = `assets/images/equipment/${fileName}.png`;
        return window.VersionManager?.getVersionedAssetUrl?.(src) || src;
    },

    withTemplateIcon(template) {
        if (!template) {
            return null;
        }
        return {
            ...template,
            iconSrc: template.iconSrc || this.getTemplateIconSrc(template.id)
        };
    },

    enhanceableStats: ['attack', 'defense', 'hp', 'crit', 'antiCrit'],
    enhanceRates: {
        common: { attack: 0.02, defense: 0.018, hp: 0.012, crit: 0.01, antiCrit: 0.01 },
        rare: { attack: 0.026, defense: 0.023, hp: 0.016, crit: 0.013, antiCrit: 0.013 },
        epic: { attack: 0.032, defense: 0.028, hp: 0.02, crit: 0.016, antiCrit: 0.016 },
        legendary: { attack: 0.04, defense: 0.034, hp: 0.024, crit: 0.02, antiCrit: 0.02 }
    },
    enhanceCostBase: {
        common: { gold: 120, iron_ore: 2 },
        rare: { gold: 180, iron_ore: 3 },
        epic: { gold: 280, iron_ore: 5 },
        legendary: { gold: 420, iron_ore: 8 }
    },
    enhanceSuccessConfig: {
        common: { start: 0.95, step: 0.025, min: 0.35 },
        rare: { start: 0.92, step: 0.028, min: 0.3 },
        epic: { start: 0.88, step: 0.031, min: 0.24 },
        legendary: { start: 0.84, step: 0.034, min: 0.18 }
    },
    starMaxLevel: 5,
    starBonusPerLevel: 0.1,
    starMaterialCount: 5,
    dismantleBaseRewards: {
        common: 2,
        rare: 6,
        epic: 16,
        legendary: 36
    },

    templates: [
        {
            id: 'common_weapon_rusty_dagger',
            slot: 'weapon',
            rarities: ['common'],
            name: '生锈匕首',
            icon: '🗡️',
            description: '刃口已经发暗，但仍能在近身战里派上用场。',
            statRules: {
                attack: { common: [3, 6] },
                crit: { common: [0, 2] }
            }
        },
        {
            id: 'common_weapon_cracked_club',
            slot: 'weapon',
            rarities: ['common'],
            name: '裂木短棒',
            icon: '🪵',
            description: '随手削出来的短棒，胜在结实好修。',
            statRules: {
                attack: { common: [4, 7] },
                accuracy: { common: [0, 2] }
            }
        },
        {
            id: 'common_weapon_blunt_machete',
            slot: 'weapon',
            rarities: ['common'],
            name: '磨钝柴刀',
            icon: '🗡️',
            description: '旧农具改出的近战武器，挥砍手感还算顺手。',
            statRules: {
                attack: { common: [5, 8] },
                defensePen: { common: [0, 1] }
            }
        },
        {
            id: 'common_clothes_canvas_coat',
            slot: 'clothes',
            rarities: ['common'],
            name: '旧帆布外套',
            icon: '🧥',
            description: '厚重帆布挡不住利刃，但能抵消一些擦伤。',
            statRules: {
                hp: { common: [12, 24] },
                defense: { common: [1, 3] }
            }
        },
        {
            id: 'common_clothes_patched_jacket',
            slot: 'clothes',
            rarities: ['common'],
            name: '缝补皮夹克',
            icon: '🧥',
            description: '多处补丁压住了裂口，还保留着一点防护性。',
            statRules: {
                hp: { common: [10, 20] },
                defense: { common: [2, 4] }
            }
        },
        {
            id: 'common_clothes_faded_patrol',
            slot: 'clothes',
            rarities: ['common'],
            name: '褪色巡逻衣',
            icon: '🥋',
            description: '旧时代巡逻员的制服，口袋和绑带还算实用。',
            statRules: {
                hp: { common: [8, 18] },
                dodge: { common: [0, 2] },
                defense: { common: [1, 3] }
            }
        },
        {
            id: 'common_pants_coarse_trousers',
            slot: 'pants',
            rarities: ['common'],
            name: '粗布长裤',
            icon: '👖',
            description: '粗糙但耐磨，能撑过几场短途奔袭。',
            statRules: {
                defense: { common: [1, 3] },
                antiCrit: { common: [1, 3] }
            }
        },
        {
            id: 'common_pants_work_pants',
            slot: 'pants',
            rarities: ['common'],
            name: '旧工装裤',
            icon: '👖',
            description: '膝盖处加过布片，适合在废墟里跋涉。',
            statRules: {
                hp: { common: [6, 14] },
                defense: { common: [2, 4] }
            }
        },
        {
            id: 'common_pants_patched_greaves',
            slot: 'pants',
            rarities: ['common'],
            name: '补丁护腿裤',
            icon: '👖',
            description: '用皮片和铁扣临时加固过的长裤。',
            statRules: {
                defense: { common: [1, 3] },
                dodge: { common: [0, 2] },
                antiCrit: { common: [1, 2] }
            }
        },
        {
            id: 'common_shoes_split_boots',
            slot: 'shoes',
            rarities: ['common'],
            name: '开线短靴',
            icon: '👢',
            description: '鞋底已经磨薄，只要不跑太远还能继续穿。',
            statRules: {
                speed: { common: [1, 3] },
                defense: { common: [0, 2] }
            }
        },
        {
            id: 'common_shoes_canvas_runners',
            slot: 'shoes',
            rarities: ['common'],
            name: '帆布跑鞋',
            icon: '👟',
            description: '轻便但不耐磨，适合短距离移动。',
            statRules: {
                speed: { common: [2, 4] },
                dodge: { common: [0, 2] }
            }
        },
        {
            id: 'common_shoes_worn_patrol',
            slot: 'shoes',
            rarities: ['common'],
            name: '磨底巡路靴',
            icon: '👢',
            description: '鞋面布满划痕，但支撑性仍然可靠。',
            statRules: {
                speed: { common: [1, 3] },
                accuracy: { common: [0, 2] },
                defense: { common: [1, 2] }
            }
        },
        {
            id: 'rare_weapon_katana',
            slot: 'weapon',
            rarities: ['rare'],
            name: '武士刀',
            icon: '⚔️',
            description: '保养良好的弧刃长刀，劈斩速度很快。',
            statRules: {
                attack: { rare: [8, 13] },
                crit: { rare: [2, 5] },
                accuracy: { rare: [1, 4] }
            }
        },
        {
            id: 'rare_weapon_fire_axe',
            slot: 'weapon',
            rarities: ['rare'],
            name: '消防斧',
            icon: '🪓',
            description: '沉重可靠，斧刃能有效撕开防护。',
            statRules: {
                attack: { rare: [9, 14] },
                defensePen: { rare: [2, 5] }
            }
        },
        {
            id: 'rare_weapon_heavy_crowbar',
            slot: 'weapon',
            rarities: ['rare'],
            name: '重型撬棍',
            icon: '🛠️',
            description: '加厚钢材制成的撬棍，既能拆门也能破甲。',
            statRules: {
                attack: { rare: [7, 12] },
                defensePen: { rare: [1, 4] },
                accuracy: { rare: [2, 5] }
            }
        },
        {
            id: 'rare_clothes_stab_vest',
            slot: 'clothes',
            rarities: ['rare'],
            name: '防刺背心',
            icon: '🧥',
            description: '内衬防刺层的背心，适合前线巡逻。',
            statRules: {
                hp: { rare: [26, 44] },
                defense: { rare: [5, 8] },
                antiCrit: { rare: [2, 5] }
            }
        },
        {
            id: 'rare_clothes_fireproof',
            slot: 'clothes',
            rarities: ['rare'],
            name: '消防隔热服',
            icon: '🧥',
            description: '改短后的隔热服，厚重但防护扎实。',
            statRules: {
                hp: { rare: [32, 50] },
                defense: { rare: [6, 9] },
                dodge: { rare: [0, 3] }
            }
        },
        {
            id: 'rare_clothes_city_guard',
            slot: 'clothes',
            rarities: ['rare'],
            name: '城防战术衣',
            icon: '🥋',
            description: '口袋、束带和护片分布合理，适合长期作战。',
            statRules: {
                hp: { rare: [24, 40] },
                defense: { rare: [4, 7] },
                dodge: { rare: [2, 5] }
            }
        },
        {
            id: 'rare_pants_cutproof',
            slot: 'pants',
            rarities: ['rare'],
            name: '防割作战裤',
            icon: '👖',
            description: '腿侧加了防割纤维，能减少突袭伤害。',
            statRules: {
                defense: { rare: [4, 7] },
                antiCrit: { rare: [4, 8] },
                hp: { rare: [12, 24] }
            }
        },
        {
            id: 'rare_pants_ranger_greaves',
            slot: 'pants',
            rarities: ['rare'],
            name: '骑警护胫裤',
            icon: '👖',
            description: '护胫板固定得很牢，适合硬吃冲击。',
            statRules: {
                defense: { rare: [5, 8] },
                antiCrit: { rare: [3, 6] },
                dodge: { rare: [0, 3] }
            }
        },
        {
            id: 'rare_pants_biker_leather',
            slot: 'pants',
            rarities: ['rare'],
            name: '机车皮裤',
            icon: '👖',
            description: '厚皮与金属扣带提供了不错的灵活防护。',
            statRules: {
                defense: { rare: [3, 6] },
                dodge: { rare: [3, 6] },
                antiCrit: { rare: [2, 5] }
            }
        },
        {
            id: 'rare_shoes_tactical_boots',
            slot: 'shoes',
            rarities: ['rare'],
            name: '战术军靴',
            icon: '👢',
            description: '鞋底抓地力优秀，适合复杂地形推进。',
            statRules: {
                speed: { rare: [3, 5] },
                defense: { rare: [2, 4] },
                accuracy: { rare: [1, 4] }
            }
        },
        {
            id: 'rare_shoes_mountain_boots',
            slot: 'shoes',
            rarities: ['rare'],
            name: '山地行军靴',
            icon: '👢',
            description: '强化鞋帮和鞋钉让移动更稳定。',
            statRules: {
                speed: { rare: [2, 5] },
                defense: { rare: [3, 5] },
                antiCrit: { rare: [1, 3] }
            }
        },
        {
            id: 'rare_shoes_light_runners',
            slot: 'shoes',
            rarities: ['rare'],
            name: '轻量跑靴',
            icon: '👟',
            description: '去掉多余护片后非常轻，适合快速穿插。',
            statRules: {
                speed: { rare: [4, 6] },
                dodge: { rare: [2, 5] }
            }
        },
        {
            id: 'epic_weapon_aex_meteor_blade',
            slot: 'weapon',
            rarities: ['epic'],
            name: '艾克斯的陨铁长剑',
            icon: '⚔️',
            description: '据说由坠落金属反复锻打而成，剑身沉稳锋利。',
            statRules: {
                attack: { epic: [14, 21] },
                crit: { epic: [4, 8] },
                defensePen: { epic: [3, 7] }
            }
        },
        {
            id: 'epic_weapon_viktor_broken_saber',
            slot: 'weapon',
            rarities: ['epic'],
            name: '维克托的断锋军刀',
            icon: '🗡️',
            description: '断口被重新打磨过，短促斩击极具威胁。',
            statRules: {
                attack: { epic: [13, 19] },
                accuracy: { epic: [5, 9] },
                crit: { epic: [3, 7] }
            }
        },
        {
            id: 'epic_weapon_lena_red_axe',
            slot: 'weapon',
            rarities: ['epic'],
            name: '莱娜的赤纹战斧',
            icon: '🪓',
            description: '斧面有暗红锻纹，重击时很容易撕开装甲。',
            statRules: {
                attack: { epic: [15, 22] },
                defensePen: { epic: [5, 10] },
                accuracy: { epic: [2, 6] }
            }
        },
        {
            id: 'epic_clothes_mars_blacksteel',
            slot: 'clothes',
            rarities: ['epic'],
            name: '玛尔斯的黑钢护衣',
            icon: '🧥',
            description: '黑钢薄片嵌在衣料内侧，沉重但可靠。',
            statRules: {
                hp: { epic: [58, 92] },
                defense: { epic: [10, 15] },
                antiCrit: { epic: [4, 8] }
            }
        },
        {
            id: 'epic_clothes_eve_gray_cape',
            slot: 'clothes',
            rarities: ['epic'],
            name: '伊芙的灰羽斗篷',
            icon: '🥋',
            description: '柔软斗篷下藏着轻质护层，便于闪避和撤离。',
            statRules: {
                hp: { epic: [48, 78] },
                defense: { epic: [8, 13] },
                dodge: { epic: [5, 9] }
            }
        },
        {
            id: 'epic_clothes_logan_breaker',
            slot: 'clothes',
            rarities: ['epic'],
            name: '洛根的破阵甲',
            icon: '🧥',
            description: '前胸护板经过多次修补，专为正面冲阵设计。',
            statRules: {
                hp: { epic: [66, 100] },
                defense: { epic: [11, 16] },
                antiCrit: { epic: [3, 7] }
            }
        },
        {
            id: 'epic_pants_odin_heavy_greaves',
            slot: 'pants',
            rarities: ['epic'],
            name: '奥丁的重装腿甲',
            icon: '👖',
            description: '沉重腿甲能稳住下盘，抵御致命冲击。',
            statRules: {
                defense: { epic: [9, 14] },
                antiCrit: { epic: [8, 13] },
                hp: { epic: [26, 46] }
            }
        },
        {
            id: 'epic_pants_sera_shadowstep',
            slot: 'pants',
            rarities: ['epic'],
            name: '塞拉的影步长裤',
            icon: '👖',
            description: '贴身剪裁和轻护片让步伐更难被捕捉。',
            statRules: {
                defense: { epic: [7, 12] },
                dodge: { epic: [6, 10] },
                antiCrit: { epic: [6, 10] }
            }
        },
        {
            id: 'epic_pants_karo_ironwall',
            slot: 'pants',
            rarities: ['epic'],
            name: '卡洛的铁壁护腿',
            icon: '👖',
            description: '护腿外层压着旧式合金板，适合守备者使用。',
            statRules: {
                defense: { epic: [10, 15] },
                antiCrit: { epic: [7, 12] },
                hp: { epic: [20, 38] }
            }
        },
        {
            id: 'epic_shoes_noah_gale',
            slot: 'shoes',
            rarities: ['epic'],
            name: '诺亚的疾风战靴',
            icon: '👢',
            description: '轻薄金属扣固定脚踝，跑动时几乎没有拖滞。',
            statRules: {
                speed: { epic: [6, 9] },
                dodge: { epic: [5, 9] },
                moveRange: { epic: [0, 1] }
            }
        },
        {
            id: 'epic_shoes_herman_linebreaker',
            slot: 'shoes',
            rarities: ['epic'],
            name: '赫尔曼的踏阵军靴',
            icon: '👢',
            description: '厚底军靴能承受爆裂冲击，适合压线推进。',
            statRules: {
                speed: { epic: [5, 8] },
                defense: { epic: [5, 8] },
                antiCrit: { epic: [3, 6] }
            }
        },
        {
            id: 'epic_shoes_vein_silent',
            slot: 'shoes',
            rarities: ['epic'],
            name: '薇恩的无声短靴',
            icon: '👟',
            description: '软底材料经过特殊处理，落步轻而稳定。',
            statRules: {
                speed: { epic: [6, 10] },
                dodge: { epic: [6, 11] },
                accuracy: { epic: [3, 7] }
            }
        },
        {
            id: 'legendary_weapon_pulse_scorpion',
            slot: 'weapon',
            rarities: ['legendary'],
            name: '脉冲战刃-雷蝎',
            icon: '⚔️',
            description: '刃背嵌入微型脉冲芯，挥斩时会留下短促电弧。',
            statRules: {
                attack: { legendary: [24, 34] },
                crit: { legendary: [8, 14] },
                defensePen: { legendary: [7, 13] },
                accuracy: { legendary: [4, 8] }
            }
        },
        {
            id: 'legendary_weapon_shock_iron_king',
            slot: 'weapon',
            rarities: ['legendary'],
            name: '震荡重斧-铁魁',
            icon: '🪓',
            description: '斧柄内置低频震荡器，命中护甲时能制造裂隙。',
            statRules: {
                attack: { legendary: [26, 36] },
                defensePen: { legendary: [10, 16] },
                antiCrit: { legendary: [3, 7] }
            }
        },
        {
            id: 'legendary_weapon_phase_white_obsidian',
            slot: 'weapon',
            rarities: ['legendary'],
            name: '相位长刀-白曜',
            icon: '🗡️',
            description: '刀身边缘有细微相位抖动，适合精准切入。',
            statRules: {
                attack: { legendary: [22, 32] },
                crit: { legendary: [10, 16] },
                accuracy: { legendary: [8, 14] },
                attackRange: { legendary: [0, 1] }
            }
        },
        {
            id: 'legendary_clothes_arc_silver_thorn',
            slot: 'clothes',
            rarities: ['legendary'],
            name: '电弧护甲-银棘',
            icon: '🧥',
            description: '护片之间流动着微弱电弧，可分散正面冲击。',
            statRules: {
                hp: { legendary: [98, 150] },
                defense: { legendary: [16, 24] },
                antiCrit: { legendary: [8, 14] }
            }
        },
        {
            id: 'legendary_clothes_magrail_night_sail',
            slot: 'clothes',
            rarities: ['legendary'],
            name: '磁轨斗篷-夜航',
            icon: '🥋',
            description: '斗篷边缘藏有轻型磁轨纤维，转身时能卸开部分力道。',
            statRules: {
                hp: { legendary: [86, 132] },
                defense: { legendary: [14, 21] },
                dodge: { legendary: [8, 13] }
            }
        },
        {
            id: 'legendary_clothes_zero_red_shell',
            slot: 'clothes',
            rarities: ['legendary'],
            name: '零域战衣-赤壳',
            icon: '🧥',
            description: '赤色复合护壳包覆核心区域，兼顾承伤与机动。',
            statRules: {
                hp: { legendary: [108, 160] },
                defense: { legendary: [15, 23] },
                dodge: { legendary: [5, 10] },
                antiCrit: { legendary: [5, 10] }
            }
        },
        {
            id: 'legendary_pants_hydraulic_black_bridge',
            slot: 'pants',
            rarities: ['legendary'],
            name: '液压腿甲-黑桥',
            icon: '👖',
            description: '隐藏式液压结构能稳住重心，承受连续重击。',
            statRules: {
                defense: { legendary: [14, 21] },
                antiCrit: { legendary: [13, 19] },
                hp: { legendary: [58, 96] }
            }
        },
        {
            id: 'legendary_pants_mirror_blue_wolf',
            slot: 'pants',
            rarities: ['legendary'],
            name: '镜面护腿-苍狼',
            icon: '👖',
            description: '镜面合金片排列紧密，能偏折一部分致命打击。',
            statRules: {
                defense: { legendary: [13, 20] },
                antiCrit: { legendary: [15, 22] },
                dodge: { legendary: [5, 10] }
            }
        },
        {
            id: 'legendary_pants_balance_black_rivet',
            slot: 'pants',
            rarities: ['legendary'],
            name: '均衡战裤-玄铆',
            icon: '👖',
            description: '多点铆接的复合战裤，防护和灵活性都很稳定。',
            statRules: {
                defense: { legendary: [12, 18] },
                antiCrit: { legendary: [11, 17] },
                hp: { legendary: [48, 86] },
                dodge: { legendary: [5, 9] }
            }
        },
        {
            id: 'legendary_shoes_vector_falcon',
            slot: 'shoes',
            rarities: ['legendary'],
            name: '矢量战靴-疾隼',
            icon: '👢',
            description: '鞋底矢量片会在蹬地瞬间提供额外推力。',
            statRules: {
                speed: { legendary: [9, 13] },
                dodge: { legendary: [9, 15] },
                moveRange: { legendary: [0, 1] }
            }
        },
        {
            id: 'legendary_shoes_em_blue_track',
            slot: 'shoes',
            rarities: ['legendary'],
            name: '电磁踏靴-蓝轨',
            icon: '👢',
            description: '微型电磁扣让步伐更稳定，适合快速抢占地形。',
            statRules: {
                speed: { legendary: [8, 12] },
                defense: { legendary: [7, 11] },
                accuracy: { legendary: [7, 12] },
                moveRange: { legendary: [0, 1] }
            }
        },
        {
            id: 'legendary_shoes_silent_night_snake',
            slot: 'shoes',
            rarities: ['legendary'],
            name: '静默足具-夜蛇',
            icon: '👟',
            description: '吸音鞋底和短距助推模块让突袭更加隐蔽。',
            statRules: {
                speed: { legendary: [10, 14] },
                dodge: { legendary: [10, 16] },
                accuracy: { legendary: [5, 10] }
            }
        }
    ],

    getTemplate(templateId) {
        return this.withTemplateIcon(this.templates.find(template => template.id === templateId) || null);
    },

    getTemplatesBySlot(slot) {
        return this.templates
            .filter(template => template.slot === slot)
            .map(template => this.withTemplateIcon(template));
    },

    getTemplatesByRarity(rarity, slot = null) {
        return this.templates.filter(template => {
            if (slot && template.slot !== slot) {
                return false;
            }
            return this.templateSupportsRarity(template, rarity);
        }).map(template => this.withTemplateIcon(template));
    },

    getAllTemplates() {
        return this.templates.map(template => this.withTemplateIcon(template));
    },

    getSlotName(slot) {
        return this.slotNames[slot] || slot;
    },

    getRarityName(rarity) {
        return this.rarityNames[rarity] || '普通';
    },

    getEnhanceRates(rarity) {
        return this.enhanceRates[rarity] || this.enhanceRates.common;
    },

    getEnhanceableStats() {
        return [...this.enhanceableStats];
    },

    getStarMaxLevel(slot = 'weapon') {
        return this.starMaxLevel;
    },

    getStarMaterialCount() {
        return this.starMaterialCount;
    },

    getStarBonusPerLevel() {
        return this.starBonusPerLevel;
    },

    calculateStarScaledStats(baseStats = {}, starLevel = 0) {
        const level = Math.max(0, Number(starLevel) || 0);
        if (level <= 0) {
            return { ...(baseStats || {}) };
        }

        const multiplier = 1 + this.getStarBonusPerLevel() * level;
        const scaledStats = {};
        Object.entries(baseStats || {}).forEach(([statKey, value]) => {
            const numericValue = Number(value) || 0;
            scaledStats[statKey] = numericValue > 0 ? Math.round(numericValue * multiplier) : numericValue;
        });
        return scaledStats;
    },

    calculateEnhanceBonus(baseStats = {}, rarity = 'common', level = 0) {
        const enhanceLevel = Math.max(0, Number(level) || 0);
        if (enhanceLevel <= 0) {
            return {};
        }

        const rates = this.getEnhanceRates(rarity);
        const bonus = {};
        this.getEnhanceableStats().forEach(statKey => {
            const baseValue = Number(baseStats?.[statKey]) || 0;
            if (baseValue <= 0) {
                return;
            }
            const totalBonus = Math.floor(baseValue * (Number(rates[statKey]) || 0) * enhanceLevel);
            if (totalBonus > 0) {
                bonus[statKey] = totalBonus;
            }
        });
        return bonus;
    },

    getEnhanceCost(rarity = 'common', targetLevel = 1) {
        const level = Math.max(1, Number(targetLevel) || 1);
        const base = this.enhanceCostBase[rarity] || this.enhanceCostBase.common;
        return {
            gold: Math.max(1, Math.ceil(base.gold * Math.pow(level, 1.18))),
            iron_ore: Math.max(1, Math.ceil(base.iron_ore * Math.pow(level, 1.12)))
        };
    },

    getEnhanceSuccessRate(rarity = 'common', currentLevel = 0) {
        const config = this.enhanceSuccessConfig[rarity] || this.enhanceSuccessConfig.common;
        const level = Math.max(0, Number(currentLevel) || 0);
        return Math.max(config.min, config.start - config.step * level);
    },

    formatSuccessRate(rate = 0) {
        return `${(Math.max(0, Math.min(1, Number(rate) || 0)) * 100).toFixed(1)}%`;
    },

    getDismantleBaseReward(rarity = 'common') {
        return Math.max(1, Number(this.dismantleBaseRewards[rarity]) || Number(this.dismantleBaseRewards.common) || 1);
    },

    getRandomRarity(rates) {
        const random = Math.random();
        let cumulative = 0;
        for (const rarity of ['legendary', 'epic', 'rare', 'common']) {
            cumulative += Number(rates?.[rarity]) || 0;
            if (random < cumulative) {
                return rarity;
            }
        }
        return 'common';
    },

    rollStat(range) {
        if (!Array.isArray(range) || range.length < 2) {
            return 0;
        }
        return Utils.randomInt(Number(range[0]) || 0, Number(range[1]) || 0);
    },

    templateSupportsRarity(template, rarity = 'common') {
        if (!template) {
            return false;
        }

        const finalRarity = this.rarityOrder.includes(rarity) ? rarity : 'common';
        const rarities = Array.isArray(template.rarities) ? template.rarities : [];
        if (rarities.length > 0 && !rarities.includes(finalRarity)) {
            return false;
        }

        const hasFixedStats = Object.keys(template.fixedStats || {}).length > 0;
        const hasRarityStats = Object.values(template.statRules || {}).some(ruleByRarity => (
            Array.isArray(ruleByRarity?.[finalRarity])
        ));
        return hasFixedStats || hasRarityStats;
    },

    createEquipment(templateId, rarity) {
        const template = this.getTemplate(templateId);
        const finalRarity = this.rarityOrder.includes(rarity) ? rarity : 'common';
        if (!this.templateSupportsRarity(template, finalRarity)) {
            return null;
        }

        const mainStats = { ...(template.fixedStats || {}) };
        for (const [statKey, ruleByRarity] of Object.entries(template.statRules || {})) {
            const range = ruleByRarity?.[finalRarity];
            if (!range) {
                continue;
            }
            mainStats[statKey] = this.rollStat(range);
        }

        return new Equipment(template, {
            rarity: finalRarity,
            baseStats: mainStats
        });
    },

    createRandomEquipment(rarity = null, templateId = null) {
        const finalRarity = this.rarityOrder.includes(rarity) ? rarity : 'common';
        const candidates = templateId
            ? [this.getTemplate(templateId)].filter(template => this.templateSupportsRarity(template, finalRarity))
            : this.getTemplatesByRarity(finalRarity);

        if (candidates.length === 0) {
            return null;
        }

        const template = Utils.randomChoice(candidates);
        return this.createEquipment(template.id, finalRarity);
    },

    createLegacyEquipment(itemConfig) {
        if (!itemConfig) {
            return null;
        }

        const slotMap = {
            weapon: 'weapon',
            armor: 'clothes'
        };
        const slot = slotMap[itemConfig.type];
        if (!slot) {
            return null;
        }

        const fakeTemplate = {
            id: itemConfig.id,
            slot,
            name: itemConfig.name,
            icon: itemConfig.icon,
            iconSrc: itemConfig.iconSrc || '',
            description: itemConfig.description,
            fixedStats: {},
            statRules: {}
        };

        return new Equipment(fakeTemplate, {
            rarity: itemConfig.rarity || 'common',
            baseStats: { ...(itemConfig.stats || {}) },
            legacy: true
        });
    }
};

window.EquipmentConfig = EquipmentConfig;
