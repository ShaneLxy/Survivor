/**
 * 工具函数集合
 */
const Utils = {
    /**
     * 生成唯一ID
     * @returns {string}
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * 深拷贝对象
     * @param {*} obj - 要拷贝的对象
     * @returns {*}
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },

    /**
     * 随机整数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number}
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * 随机浮点数
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number}
     */
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * 从数组中随机选择一个元素
     * @param {Array} arr - 数组
     * @returns {*}
     */
    randomChoice(arr) {
        return arr[this.randomInt(0, arr.length - 1)];
    },

    /**
     * 洗牌算法
     * @param {Array} arr - 数组
     * @returns {Array}
     */
    shuffle(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    },

    /**
     * 限制数值范围
     * @param {number} value - 值
     * @param {number} min - 最小值
     * @param {number} max - 最大值
     * @returns {number}
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * 线性插值
     * @param {number} start - 起始值
     * @param {number} end - 结束值
     * @param {number} t - 插值因子(0-1)
     * @returns {number}
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    },

    /**
     * 格式化数字(添加千分位)
     * @param {number} num - 数字
     * @returns {string}
     */
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    },

    /**
     * 格式化时间
     * @param {number} seconds - 秒数
     * @returns {string}
     */
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}小时${minutes}分`;
        } else if (minutes > 0) {
            return `${minutes}分${secs}秒`;
        } else {
            return `${secs}秒`;
        }
    },

    /**
     * 格式化时间戳
     * @param {number} timestamp - 时间戳
     * @param {string} format - 格式
     * @returns {string}
     */
    formatTimestamp(timestamp, format = 'YYYY-MM-DD HH:mm:ss') {
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    },

    /**
     * 延迟执行
     * @param {number} ms - 毫秒数
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 节流函数
     * @param {Function} func - 函数
     * @param {number} wait - 等待时间(ms)
     * @returns {Function}
     */
    throttle(func, wait) {
        let timeout;
        return function(...args) {
            if (timeout) return;
            timeout = setTimeout(() => {
                func.apply(this, args);
                timeout = null;
            }, wait);
        };
    },

    /**
     * 防抖函数
     * @param {Function} func - 函数
     * @param {number} wait - 等待时间(ms)
     * @returns {Function}
     */
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    },

    /**
     * 判断是否为移动设备
     * @returns {boolean}
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * 获取设备像素比
     * @returns {number}
     */
    getPixelRatio() {
        return window.devicePixelRatio || 1;
    },

    /**
     * 本地存储封装
     */
    storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('存储失败:', error);
                return false;
            }
        },
        get(key, defaultValue = null) {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch (error) {
                console.error('读取失败:', error);
                return defaultValue;
            }
        },
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('删除失败:', error);
                return false;
            }
        },
        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.error('清空失败:', error);
                return false;
            }
        }
    }
};

// 暴露到全局
window.Utils = Utils;
