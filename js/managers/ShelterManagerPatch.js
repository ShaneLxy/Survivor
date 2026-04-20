(function() {
    if (typeof ShelterManager === 'undefined' || !window.shelterManager) {
        return;
    }

    ShelterManager.prototype.getAggregateProductionStatus = function(now = Date.now()) {
        const buildingIds = ShelterManager.PRODUCTION_BUILDING_IDS || ['building_farm', 'building_mine', 'building_well'];
        const statuses = buildingIds.map((buildingId) => ({
            buildingId,
            ...this.getProductionStatus(buildingId, now)
        }));
        const elapsedSeconds = statuses.length > 0 ? Math.min(...statuses.map((status) => status.elapsedSeconds)) : 0;
        const rewards = [];

        statuses.forEach((status) => {
            status.rewards.forEach((reward) => {
                const existing = rewards.find((entry) => entry.type === reward.type && entry.id === reward.id);
                if (existing) {
                    existing.amount += reward.amount;
                } else {
                    rewards.push({ ...reward });
                }
            });
        });

        return {
            elapsedSeconds,
            roundedHours: this.getRoundedProductionHours(elapsedSeconds),
            canCollect: rewards.length > 0 && elapsedSeconds >= 3600,
            rewards,
            buildingStatuses: statuses
        };
    };

    ShelterManager.prototype.collectAllProduction = function() {
        const aggregate = this.getAggregateProductionStatus();
        if (aggregate.elapsedSeconds < 3600) {
            return { success: false, message: '资源累计满一小时后才能收获' };
        }
        if (!aggregate.rewards.length) {
            return { success: false, message: '当前暂无可收获资源' };
        }

        aggregate.rewards.forEach((reward) => {
            if (reward.type === 'item') {
                itemManager.addItem(reward.id, reward.amount);
            } else {
                this.addResource(reward.id, reward.amount);
            }
        });

        const resetAt = Date.now();
        aggregate.buildingStatuses.forEach((status) => {
            this.productionTimers[status.buildingId] = resetAt;
        });

        eventManager.emit('shelterProductionCollect', {
            buildingId: 'all',
            hours: aggregate.roundedHours,
            rewards: aggregate.rewards
        });

        return {
            success: true,
            hours: aggregate.roundedHours,
            rewards: aggregate.rewards
        };
    };
})();
