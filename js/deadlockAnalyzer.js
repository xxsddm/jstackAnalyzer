class DeadlockAnalyzer {
    /**
     * 渲染死锁报告
     * @param {Array} deadlocks - 死锁对象数组
     * @param {HTMLElement} container - 渲染容器
     */
    static renderDeadlockReport(deadlocks, container) {
        // 清空容器
        container.innerHTML = '';
        
        if (!deadlocks || deadlocks.length === 0) {
            container.innerHTML = '<div class="no-deadlock">未检测到死锁信息</div>';
            return;
        }
        
        // 添加标题
        const titleElement = document.createElement('h3');
        titleElement.textContent = `检测到 ${deadlocks.length} 组死锁`;
        container.appendChild(titleElement);
        
        // 为每组死锁创建报告
        deadlocks.forEach((deadlock, index) => {
            const deadlockElement = this.createDeadlockElement(deadlock, index + 1);
            container.appendChild(deadlockElement);
        });
    }
    
    /**
     * 创建单个死锁元素
     * @param {Object} deadlock - 死锁对象
     * @param {number} index - 死锁索引
     * @returns {HTMLElement} 死锁元素
     */
    static createDeadlockElement(deadlock, index) {
        const deadlockElement = document.createElement('div');
        deadlockElement.className = 'deadlock-item';
        
        // 创建死锁标题
        const titleElement = document.createElement('h4');
        titleElement.textContent = `死锁组 ${index}`;
        titleElement.className = 'deadlock-title';
        deadlockElement.appendChild(titleElement);
        
        // 创建死锁线程关系部分
        const relationElement = document.createElement('div');
        relationElement.className = 'deadlock-relation';
        
        // 添加分隔线
        const separator = document.createElement('div');
        separator.className = 'deadlock-separator';
        relationElement.appendChild(separator);
        
        // 为每个线程创建关系描述
        deadlock.threads.forEach(thread => {
            const threadElement = document.createElement('div');
            threadElement.className = 'deadlock-thread';
            
            const threadNameElement = document.createElement('div');
            threadNameElement.className = 'deadlock-thread-name';
            threadNameElement.textContent = `"${thread.name}":`;
            threadElement.appendChild(threadNameElement);
            
            if (thread.waitingToLock) {
                const waitingElement = document.createElement('div');
                waitingElement.className = 'deadlock-waiting';
                waitingElement.textContent = `  ${thread.waitingToLock}`;
                threadElement.appendChild(waitingElement);
            }
            
            if (thread.lockedBy) {
                const lockedByElement = document.createElement('div');
                lockedByElement.className = 'deadlock-locked-by';
                lockedByElement.textContent = `  which is held by "${thread.lockedBy}"`;
                threadElement.appendChild(lockedByElement);
            }
            
            relationElement.appendChild(threadElement);
        });
        
        deadlockElement.appendChild(relationElement);
        
        return deadlockElement;
    }
}