/**
 * 分页指示器组件
 */
class Pagination {
    constructor(config) {
        this.config = {
            currentPage: 1,
            totalPages: 1,
            onPageChange: null,
            ...config
        };

        this.element = this.create();
    }

    /**
     * 创建分页器
     * @returns {HTMLElement}
     */
    create() {
        const container = document.createElement('div');
        container.className = 'pagination';

        // 上一页按钮
        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'pagination-btn';
        prevBtn.setAttribute('aria-label', '上一页');
        prevBtn.innerHTML = '<span aria-hidden="true">‹</span>';
        prevBtn.disabled = this.config.currentPage <= 1;
        prevBtn.addEventListener('click', () => this.prevPage());
        container.appendChild(prevBtn);

        // 页码信息
        const info = document.createElement('div');
        info.className = 'pagination-info';
        info.textContent = `${this.config.currentPage}/${this.config.totalPages}`;
        container.appendChild(info);

        // 下一页按钮
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'pagination-btn';
        nextBtn.setAttribute('aria-label', '下一页');
        nextBtn.innerHTML = '<span aria-hidden="true">›</span>';
        nextBtn.disabled = this.config.currentPage >= this.config.totalPages;
        nextBtn.addEventListener('click', () => this.nextPage());
        container.appendChild(nextBtn);

        this.prevBtn = prevBtn;
        this.nextBtn = nextBtn;
        this.info = info;

        return container;
    }

    /**
     * 上一页
     */
    prevPage() {
        if (this.config.currentPage > 1) {
            this.setPage(this.config.currentPage - 1);
        }
    }

    /**
     * 下一页
     */
    nextPage() {
        if (this.config.currentPage < this.config.totalPages) {
            this.setPage(this.config.currentPage + 1);
        }
    }

    /**
     * 跳转页
     * @param {number} page - 页码
     */
    setPage(page) {
        if (page < 1 || page > this.config.totalPages) return;

        this.config.currentPage = page;
        this.updateUI();

        if (this.config.onPageChange) {
            this.config.onPageChange(page);
        }
    }

    /**
     * 设置总页数
     * @param {number} totalPages - 总页数
     */
    setTotalPages(totalPages) {
        this.config.totalPages = totalPages;
        this.updateUI();
    }

    /**
     * 更新UI
     */
    updateUI() {
        this.info.textContent = `${this.config.currentPage}/${this.config.totalPages}`;
        this.prevBtn.disabled = this.config.currentPage <= 1;
        this.nextBtn.disabled = this.config.currentPage >= this.config.totalPages;
    }

    /**
     * 渲染到容器
     * @param {HTMLElement} container - 容器
     */
    render(container) {
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        if (container) {
            container.appendChild(this.element);
        }
    }

    /**
     * 销毁
     */
    destroy() {
        if (this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
