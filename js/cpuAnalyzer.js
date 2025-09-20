class CPUAnalyzer {
    /**
     * 分析线程的CPU使用情况（使用真实数据）
     * @param {Array} threads - 线程对象数组
     * @returns {Array} 包含CPU使用信息的线程数组
     */
    static analyzeCPUUsage(threads) {
        // 直接使用从jstack解析出的真实CPU时间和elapsed时间来计算CPU占用率
        return threads.map(thread => {
            // 计算真实的CPU占用率 (%)
            // CPU占用率 = (CPU时间 / elapsed时间) * 100%
            // 注意：cpuTime是毫秒，elapsedTime是毫秒（已经从秒转换）
            let cpuUsage = null; // 使用null表示缺失
            
            // 只有当cpuTime和elapsedTime都存在且elapsedTime大于0时才计算CPU占用率
            if (thread.cpuTime !== null && thread.elapsedTime !== null && thread.elapsedTime > 0) {
                cpuUsage = (thread.cpuTime / thread.elapsedTime) * 100;
                // 确保CPU占用率不超过100%
                cpuUsage = Math.min(cpuUsage, 100);
            }
            
            // 使用解析出的elapsed时间(已转换为毫秒)
            const elapsedTime = thread.elapsedTime !== null ? thread.elapsedTime : null;
            
            return {
                ...thread,
                cpuUsage: cpuUsage,
                elapsedTime: elapsedTime
            };
        });
    }
    
    /**
     * 创建CPU使用情况图表
     * @param {Array} threads - 包含CPU信息的线程数组
     * @param {string} chartType - 图表类型 ('bar' 或 'pie')
     * @returns {Object} Chart.js配置对象
     */
    static createCPUChartConfig(threads, chartType = 'bar') {
        // 过滤掉缺失CPU使用率的线程
        const validThreads = threads.filter(thread => thread.cpuUsage !== null);
        
        // 按CPU占用率排序，取前10个线程
        const topThreads = validThreads
            .sort((a, b) => b.cpuUsage - a.cpuUsage)
            .slice(0, 10);
            
        const labels = topThreads.map(thread => thread.name);
        const cpuData = topThreads.map(thread => thread.cpuUsage);
        const elapsedData = topThreads.map(thread => thread.elapsedTime);
        
        if (chartType === 'pie') {
            return {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'CPU占用率 (%)',
                        data: cpuData,
                        backgroundColor: this.generateColors(cpuData.length)
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Top 10 线程CPU占用率'
                        }
                    }
                }
            };
        } else {
            return {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'CPU占用率 (%)',
                            data: cpuData,
                            backgroundColor: 'rgba(54, 162, 235, 0.6)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Elapsed时间 (ms)',
                            data: elapsedData,
                            backgroundColor: 'rgba(255, 99, 132, 0.6)',
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 1,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: 'CPU占用率 (%)'
                            },
                            min: 0,
                            max: 100
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Elapsed时间 (ms)'
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Top 10 线程CPU占用率和Elapsed时间'
                        }
                    }
                }
            };
        }
    }
    
    /**
     * 生成随机颜色数组
     * @param {number} count - 颜色数量
     * @returns {Array} 颜色数组
     */
    static generateColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const r = Math.floor(Math.random() * 255);
            const g = Math.floor(Math.random() * 255);
            const b = Math.floor(Math.random() * 255);
            colors.push(`rgba(${r}, ${g}, ${b}, 0.6)`);
        }
        return colors;
    }
    
    /**
     * 创建统计信息元素（扩展版本）
     * @param {Object} stats - 基础统计信息
     * @param {Array} threads - 包含CPU信息的线程数组
     * @returns {HTMLElement} 统计信息元素
     */
    static createExtendedStatsElement(stats, threads) {
        const statsElement = document.createElement('div');
        statsElement.className = 'stats-summary';
        
        // 基础统计信息（使用标准化的状态进行统计）
        const normalizedStats = {};
        for (const [state, count] of Object.entries(stats.states)) {
            const normalizedState = ThreadStateUtils.normalizeState(state);
            normalizedStats[normalizedState] = (normalizedStats[normalizedState] || 0) + count;
        }
        
        let statsHTML = `<h3>线程统计 (总计: ${stats.total})</h3><div class="state-stats">`;
        
        for (const [state, count] of Object.entries(normalizedStats)) {
            statsHTML += `<span class="state-stat state-${state}">${state}: ${count}</span>`;
        }
        
        // 过滤掉缺失数据的线程用于统计计算
        const validThreads = threads.filter(thread => 
            thread.cpuUsage !== null && thread.elapsedTime !== null);
        
        if (validThreads.length > 0) {
            // CPU使用统计
            const avgCPU = validThreads.reduce((sum, thread) => sum + thread.cpuUsage, 0) / validThreads.length;
            const maxCPU = Math.max(...validThreads.map(t => t.cpuUsage));
            const minCPU = Math.min(...validThreads.map(t => t.cpuUsage));
            
            // Elapsed时间统计
            const avgElapsed = validThreads.reduce((sum, thread) => sum + thread.elapsedTime, 0) / validThreads.length;
            const maxElapsed = Math.max(...validThreads.map(t => t.elapsedTime));
            const minElapsed = Math.min(...validThreads.map(t => t.elapsedTime));
            
            statsHTML += `
                </div>
                <div class="cpu-stats">
                    <h4>CPU使用情况</h4>
                    <span class="cpu-stat">平均CPU占用率: ${avgCPU.toFixed(2)}%</span>
                    <span class="cpu-stat">最高CPU占用率: ${maxCPU.toFixed(2)}%</span>
                    <span class="cpu-stat">最低CPU占用率: ${minCPU.toFixed(2)}%</span>
                </div>
                <div class="elapsed-stats">
                    <h4>Elapsed时间 (ms)</h4>
                    <span class="elapsed-stat">平均时间: ${avgElapsed.toFixed(2)}ms</span>
                    <span class="elapsed-stat">最长时间: ${maxElapsed.toFixed(2)}ms</span>
                    <span class="elapsed-stat">最短时间: ${minElapsed.toFixed(2)}ms</span>
                </div>
            `;
        } else {
            statsHTML += `
                </div>
                <div class="cpu-stats">
                    <h4>CPU使用情况</h4>
                    <span class="cpu-stat">无有效数据</span>
                </div>
                <div class="elapsed-stats">
                    <h4>Elapsed时间 (ms)</h4>
                    <span class="elapsed-stat">无有效数据</span>
                </div>
            `;
        }
        
        statsElement.innerHTML = statsHTML;
        return statsElement;
    }
    
    /**
     * 创建单个线程元素（扩展版本）
     * @param {Object} thread - 包含CPU信息的线程对象
     * @returns {HTMLElement} 线程元素
     */
    static createExtendedThreadElement(thread) {
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
        
        // 处理CPU和elapsed时间的显示
        const cpuDisplay = thread.cpuTime !== null ? thread.cpuTime.toFixed(2) + 'ms' : '无';
        const elapsedDisplay = thread.elapsedTime !== null ? thread.elapsedTime.toFixed(2) + 'ms' : '无';
        const cpuUsageDisplay = thread.cpuUsage !== null ? thread.cpuUsage.toFixed(2) + '%' : '无';
        
        // 构建锁信息显示
        let lockedSynchronizersHTML = '';
        if (thread.lockedSynchronizers && thread.lockedSynchronizers.length > 0) {
            // 为每个锁信息创建独立的元素，确保每个锁独占一行
            const synchronizersItems = thread.lockedSynchronizers.map(sync => 
                `<div class="synchronizer-item">${sync}</div>`
            ).join('');
            
            lockedSynchronizersHTML = `
                <div class="locked-synchronizers">
                    <h4>Locked ownable synchronizers:</h4>
                    <div class="synchronizers-list">${synchronizersItems}</div>
                </div>
            `;
        }
        
        threadElement.innerHTML = `
            <div class="thread-header">
                <span class="thread-name">${thread.name || '未知线程'}</span>
                <span class="thread-state state-${stateClass}">${displayState}</span>
                <span class="thread-cpu">CPU: ${cpuDisplay}</span>
                <span class="thread-elapsed">Elapsed: ${elapsedDisplay}</span>
                <span class="thread-cpu-usage">CPU占用率: ${cpuUsageDisplay}</span>
            </div>
            <div class="original-thread-info">${originalInfo ? originalInfo : (thread.details || '')}</div>
            <div class="stack-trace">${thread.stackTrace ? thread.stackTrace.join('\n') : ''}</div>
            ${lockedSynchronizersHTML}
        `;
        
        return threadElement;
    }
}