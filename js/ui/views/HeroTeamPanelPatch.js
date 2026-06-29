/**
 * 编队页 (HeroView.activePanel === 'team') 防闪烁补丁
 *
 *  问题:
 *   原版 toggleTeam() 在编队页会调 this.render() 全量重建 element.innerHTML,
 *   导致所有 hero-card 的 <img> 被销毁重建。移动端 WebView 在 DOM 重建
 *   <img> 时即便图片有缓存,仍会闪一帧(尤其没被 preload 解码过的卡)。
 *
 *  方案:
 *   在编队页 toggleTeam 后,只更新真正变化的局部:
 *    - 顶部"总战力"数字
 *    - hero-team-slots 4 个槽位
 *    - 候选名单计数
 *    - 候选卡的 selected / is-in-team / is-team-blocked 状态切换
 *    - 被点击那张卡上的 hero-team-badge(增加/删除)
 *
 *   候选卡的 <img>、<div> 结构完全不动 → 不会触发图片重新解码 → 不闪。
 *
 *  本补丁仅劫持"编队页"路径,其它视图(英雄主页 / 图鉴 / teamModal)
 *  保持原渲染行为不变,避免影响别处逻辑。
 *
 *  加载顺序:必须在 HeroView.js 之后。
 */
(function() {
    if (typeof HeroView === 'undefined' || !HeroView.prototype) {
        return;
    }

    /**
     * 拼一个 hero-team-slot 的 HTML(与 getTeamModalContent 中保持一致)
     */
    function buildSlotMarkup(view, hero, index) {
        if (!hero) {
            return `
                <div class="hero-team-slot is-empty">
                    <span class="hero-team-slot-index">0${index + 1}</span>
                    <strong>待编入</strong>
                    <span>EMPTY</span>
                </div>
            `;
        }
        const rarityColor = view.getRarityColor(hero.rarity);
        return `
            <button type="button" class="hero-team-slot is-filled"
                style="--hero-card-rarity:${rarityColor};"
                onclick="window.game.ui.heroView.toggleTeam('${hero.id}')"
                title="点击移出编队">
                <span class="hero-team-slot-index">0${index + 1}</span>
                <strong>${hero.name}</strong>
                <span>${view.formatPower(hero.getPower?.() || 0)} 战力</span>
            </button>
        `;
    }

    /**
     * 原地更新编队页,不重建整页 DOM
     * @returns {boolean} 是否成功原地更新;返回 false 则调用方应回退到全量 render
     */
    HeroView.prototype.updateTeamPanelInPlace = function() {
        if (!this.element || this.activePanel !== 'team') {
            return false;
        }

        // 1) 找出关键节点。任何一个缺失就回退到全量 render,确保兼容性
        const slotsEl = this.element.querySelector('.hero-team-slots');
        const gridEl = this.element.querySelector('.hero-team-grid');
        const sectionHead = this.element.querySelector('.hero-roster-section-head strong');
        const metricsEl = this.element.querySelector('.hero-roster-metrics .hero-roster-metric strong');
        if (!slotsEl || !gridEl) {
            return false;
        }

        const heroes = heroManager.getAllHeroes();
        const maxTeamSize = Number(heroManager.maxTeamSize) || 4;
        const teamHeroes = typeof heroManager.getTeam === 'function'
            ? heroManager.getTeam()
            : heroes.filter(hero => heroManager.isHeroInTeam(hero.id));
        const isTeamFull = teamHeroes.length >= maxTeamSize;

        // 2) 槽位:整体替换 innerHTML(4 个槽位重建不会触发图片解码,因为槽位里没有 <img>)
        slotsEl.innerHTML = Array.from({ length: maxTeamSize })
            .map((_, index) => buildSlotMarkup(this, teamHeroes[index], index))
            .join('');

        // 3) 候选名单计数(只动文本)
        if (sectionHead) {
            sectionHead.textContent = `${heroes.length} 名`;
        }

        // 4) 顶部"总战力"数字(只动文本)
        if (metricsEl) {
            metricsEl.textContent = this.formatPower(heroManager.getTeamPower());
        }

        // 5) 候选卡:不重建,只切 class + 增删 badge
        gridEl.querySelectorAll('.hero-team-roster-card').forEach(card => {
            const heroId = card.dataset.heroId;
            if (!heroId) return;
            const inTeam = heroManager.isHeroInTeam(heroId);
            const blocked = !inTeam && isTeamFull;

            card.classList.toggle('selected', inTeam);
            card.classList.toggle('is-in-team', inTeam);
            card.classList.toggle('is-team-blocked', blocked);
            card.title = inTeam ? '点击移出编队' : '点击加入编队';

            // 同步 "参战" 角标的存在性
            // 注意:必须只查直接子节点的 badge,避免误删卡片内部其它位置带同名 class 的元素
            // (实际上候选卡里只在卡片自身根部有 badge,但用 :scope > 保险)
            let badge = null;
            for (const child of card.children) {
                if (child.classList && child.classList.contains('hero-team-badge')) {
                    badge = child;
                    break;
                }
            }
            if (inTeam && !badge) {
                badge = document.createElement('div');
                badge.className = 'hero-team-badge';
                badge.textContent = '参战';
                // 插在最前面,跟 getTeamModalContent 模板顺序一致
                card.insertBefore(badge, card.firstChild);
            } else if (!inTeam && badge) {
                badge.remove();
            }
        });

        return true;
    };

    // 包装原 toggleTeam:在编队页路径上用 in-place 更新替代 render()
    const originalToggleTeam = HeroView.prototype.toggleTeam;
    HeroView.prototype.toggleTeam = function(heroId) {
        const hero = heroManager.getHero(heroId);
        if (!hero) return;

        // 走和原版完全一样的业务流程(状态变更 + Toast)
        if (heroManager.isHeroInTeam(heroId)) {
            heroManager.removeFromTeam(heroId);
            Toast.info('已取消参战');
        } else {
            const success = heroManager.addToTeam(heroId);
            if (success) {
                Toast.info('已设为参战');
            } else {
                Toast.error('参战队伍已满');
                return; // 入队失败:不改 DOM,直接退出
            }
        }

        if (this.visible && this.activePanel === 'team') {
            // 编队页:用 in-place 更新,失败则兜底 render
            const ok = this.updateTeamPanelInPlace();
            if (!ok) {
                this.render();
            }
        } else {
            // 其它视图(英雄主页等):保持原行为
            if (this.visible) {
                this.renderHeroes();
                this.updateTeamPowerDisplay();
            }
            this.updateTeamModal();
        }

        window.game.save();
    };
})();
