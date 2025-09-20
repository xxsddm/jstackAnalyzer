class Visualizer {
    /**
     * 渲染线程分析结果
     * @param {Array} threads - 线程对象数组
     * @param {HTMLElement} container - 渲染容器
     * @param {string} filterState - 筛选状态
     */
    static renderThreads(threads, container, filterState = 'all') {
        // 清空容器
        container.innerHTML = '';
        
        // 根据筛选状态过滤线程
        const filteredThreads = filterState === 'all' ? threads : threads.filter(thread => {
            // 使用标准化的状态进行筛选
            const normalizedState = ThreadStateUtils.normalizeState(thread.state);
            return normalizedState === filterState;
        });
        
        // 创建线程统计信息
        const stats = this.calculateStats(threads);
        const statsElement = this.createStatsElement(stats);
        container.appendChild(statsElement);
        
        // 创建筛选控件
        const filterSection = document.createElement('div');
        filterSection.className = 'filter-section';
        filterSection.innerHTML = `
            <label for="stateFilter">线程状态筛选:</label>
            <select id="stateFilter">
                <option value="all" ${filterState === 'all' ? 'selected' : ''}>全部状态</option>
                <option value="RUNNABLE" ${filterState === 'RUNNABLE' ? 'selected' : ''}>RUNNABLE</option>
                <option value="BLOCKED" ${filterState === 'BLOCKED' ? 'selected' : ''}>BLOCKED</option>
                <option value="WAITING" ${filterState === 'WAITING' ? 'selected' : ''}>WAITING</option>
                <option value="TIMED_WAITING" ${filterState === 'TIMED_WAITING' ? 'selected' : ''}>TIMED_WAITING</option>
                <option value="UNKNOWN" ${filterState === 'UNKNOWN' ? 'selected' : ''}>UNKNOWN</option>
            </select>
            <button id="applyFilterBtn">应用筛选</button>
            <button id="resetFilterBtn">重置筛选</button>
        `;
        container.appendChild(filterSection);
        
        // 创建线程列表
        const threadList = document.createElement('div');
        threadList.className = 'thread-list';
        
        filteredThreads.forEach(thread => {
            const threadElement = this.createThreadElement(thread);
            threadList.appendChild(threadElement);
        });
        
        container.appendChild(threadList);
        
        // 绑定筛选事件
        this.bindFilterEvents(threads, container);
    }
    
    /**
     * 绑定筛选事件
     * @param {Array} threads - 线程对象数组
     * @param {HTMLElement} container - 渲染容器
     */
    static bindFilterEvents(threads, container) {
        const stateFilter = container.querySelector('#stateFilter');
        const applyFilterBtn = container.querySelector('#applyFilterBtn');
        const resetFilterBtn = container.querySelector('#resetFilterBtn');
        
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => {
                const selectedState = stateFilter.value;
                this.renderThreads(threads, container, selectedState);
            });
        }
        
        if (resetFilterBtn) {
            resetFilterBtn.addEventListener('click', () => {
                stateFilter.value = 'all';
                this.renderThreads(threads, container, 'all');
            });
        }
    }
    
    /**
     * 计算线程统计信息
     * @param {Array} threads - 线程对象数组
     * @returns {Object} 统计信息对象
     */
    static calculateStats(threads) {
        const stateCounts = {};
        let totalThreads = threads.length;
        
        threads.forEach(thread => {
            // 使用标准化的状态进行统计
            const state = ThreadStateUtils.normalizeState(thread.state);
            stateCounts[state] = (stateCounts[state] || 0) + 1;
        });
        
        return {
            total: totalThreads,
            states: stateCounts
        };
    }
    
    /**
     * 创建统计信息元素
     * @param {Object} stats - 统计信息
     * @returns {HTMLElement} 统计信息元素
     */
    static createStatsElement(stats) {
        const statsElement = document.createElement('div');
        statsElement.className = 'stats-summary';
        
        let statsHTML = `<h3>线程统计 (总计: ${stats.total})</h3><div class="state-stats">`;
        
        for (const [state, count] of Object.entries(stats.states)) {
            statsHTML += `<span class="state-stat state-${state}">${state}: ${count}</span>`;
        }
        
        statsHTML += '</div>';
        statsElement.innerHTML = statsHTML;
        
        return statsElement;
    }
    
    /**
     * 创建单个线程元素
     * @param {Object} thread - 线程对象
     * @returns {HTMLElement} 线程元素
     */
    static createThreadElement(thread) {
        const threadElement = document.createElement('div');
        threadElement.className = 'thread-item';
        
        // 使用标准化的状态显示
        const normalizedState = ThreadStateUtils.normalizeState(thread.state);
        const displayState = ThreadStateUtils.getDisplayState(thread.state);
        const stateClass = `state-${normalizedState ? normalizedState.replace(/_/g, '-') : 'UNKNOWN'}`;
        
        // 构建完整的原始线程信息显示
        let originalInfo = '';
        if (thread.originalThreadLine) {
            originalInfo += thread.originalThreadLine + '\n';
        }
        if (thread.originalStateLine) {
            originalInfo += thread.originalStateLine + '\n';
        }
        
        threadElement.innerHTML = `
            <div class="thread-header">
                <span class="thread-name">${thread.name || '未知线程'}</span>
                <span class="thread-state state-${stateClass}">${displayState}</span>
            </div>
            <div class="original-thread-info">${originalInfo ? originalInfo : (thread.details || '')}</div>
            <div class="stack-trace">${thread.stackTrace ? thread.stackTrace.join('\n') : ''}</div>
        `;
        
        return threadElement;
    }
    
    /**
     * 显示错误信息
     * @param {string} message - 错误信息
     * @param {HTMLElement} container - 容器元素
     */
    static showError(message, container) {
        container.innerHTML = `<div class="error-message">${message}</div>`;
    }
}