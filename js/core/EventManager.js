/**
 * 事件管理器 - 单例模式
 * 负责游戏内所有事件的发布订阅
 */
class EventManager {
    constructor() {
        if (EventManager.instance) {
            return EventManager.instance;
        }
        this.events = {};
        EventManager.instance = this;
    }

    /**
     * 订阅事件
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    on(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(callback);

        // 返回取消订阅函数
        return () => this.off(eventName, callback);
    }

    /**
     * 订阅事件(一次性)
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     */
    once(eventName, callback) {
        const wrapper = (...args) => {
            callback(...args);
            this.off(eventName, wrapper);
        };
        this.on(eventName, wrapper);
    }

    /**
     * 取消订阅事件
     * @param {string} eventName - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(eventName, callback) {
        if (!this.events[eventName]) return;
        const index = this.events[eventName].indexOf(callback);
        if (index !== -1) {
            this.events[eventName].splice(index, 1);
        }
    }

    /**
     * 发布事件
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     */
    emit(eventName, data) {
        if (!this.events[eventName]) return;
        this.events[eventName].forEach(callback => {
            callback(data);
        });
    }

    /**
     * 清除所有事件或指定事件
     * @param {string} eventName - 可选,事件名称
     */
    clear(eventName) {
        if (eventName) {
            delete this.events[eventName];
        } else {
            this.events = {};
        }
    }
}

// 导出单例
const eventManager = new EventManager();

// 暴露到全局
window.eventManager = eventManager;
