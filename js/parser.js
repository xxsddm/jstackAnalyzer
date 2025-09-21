class JStackParser {
        /**
     * 解析jstack数据为结构化线程信息
     * @param {string} data - jstack数据内容
     * @returns {Array} 解析后的线程对象数组
     */
    static parse(data) {
        const threads = [];
        const lines = data.split('\n');
        let currentThread = null;
        let inStackTrace = false;
        let inLockedSynchronizers = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 匹配线程头信息
            const threadHeaderMatch = line.match(/"(.+)"\s+(.*)/);
            if (threadHeaderMatch) {
                // 保存之前的线程
                if (currentThread) {
                    threads.push(currentThread);
                }
                
                // 从线程详情中提取CPU时间和elapsed时间
                const details = threadHeaderMatch[2];
                const cpuTimeMatch = details.match(/cpu=([0-9.]+)ms/);
                const elapsedTimeMatch = details.match(/elapsed=([0-9.]+)s/);
                // 提取tid信息
                const tidMatch = details.match(/tid=([0-9a-fx]+)/);
                
                // 创建新线程对象，默认状态为UNKNOWN
                currentThread = {
                    name: threadHeaderMatch[1],
                    details: details,
                    state: 'UNKNOWN',
                    stackTrace: [],
                    lockedSynchronizers: [], // 添加锁信息字段
                    // 保存原始的线程ID行
                    originalThreadLine: line,
                    // 保存原始的状态行
                    originalStateLine: '',
                    // 解析CPU时间（毫秒）
                    cpuTime: cpuTimeMatch ? parseFloat(cpuTimeMatch[1]) : null, // 使用null表示缺失
                    // 解析elapsed时间并转换为毫秒
                    elapsedTime: elapsedTimeMatch ? parseFloat(elapsedTimeMatch[1]) * 1000 : null, // 使用null表示缺失
                    // 解析tid
                    tid: tidMatch ? tidMatch[1] : null
                };
                
                inStackTrace = false;
                inLockedSynchronizers = false;
                continue;
            }
            
            // 匹配线程状态
            const stateMatch = line.match(/java.lang.Thread.State:\s+(.+)/);
            if (stateMatch && currentThread) {
                currentThread.state = ThreadStateUtils.normalizeState(stateMatch[1]);
                inStackTrace = true;
                inLockedSynchronizers = false;
                // 保存原始的状态行
                currentThread.originalStateLine = line;
                continue;
            }
            
            // 检查是否进入Locked ownable synchronizers部分
            if (currentThread && line.trim() === 'Locked ownable synchronizers:') {
                inStackTrace = false;
                inLockedSynchronizers = true;
                continue;
            }
            
            // 收集Locked ownable synchronizers信息
            if (currentThread && inLockedSynchronizers) {
                // 如果遇到空行或者下一个线程头，结束当前线程的锁信息收集
                if (line.trim() === '' || (line.startsWith('"') && line.includes('" '))) {
                    inLockedSynchronizers = false;
                    // 检查是否是下一个线程头
                    if (line.startsWith('"') && line.includes('" ')) {
                        // 重新处理这个线程头
                        i--; // 回退一行，让循环重新处理这一行
                        continue;
                    }
                } else if (line.trim() !== '') {
                    currentThread.lockedSynchronizers.push(line.trim());
                }
                continue;
            }
            
            // 收集堆栈跟踪
            if (currentThread && inStackTrace) {
                // 如果遇到空行或者下一个线程头，结束当前线程的堆栈收集
                if (line.trim() === '' || (line.startsWith('"') && line.includes('" '))) {
                    inStackTrace = false;
                    // 检查是否是下一个线程头
                    if (line.startsWith('"') && line.includes('" ')) {
                        // 重新处理这个线程头
                        i--; // 回退一行，让循环重新处理这一行
                        continue;
                    }
                } else if (line.trim() !== '') {
                    currentThread.stackTrace.push(line);
                }
            }
        }
        
        // 添加最后一个线程
        if (currentThread) {
            threads.push(currentThread);
        }
        
        return threads;
    }
    
        /**
     * 解析jstack数据中的死锁信息
     * @param {string} data - jstack数据内容
     * @returns {Array} 解析后的死锁对象数组
     */
    static parseDeadlocks(data) {
        const deadlocks = [];
        const lines = data.split('\n');
        let inDeadlock = false;
        let currentDeadlock = null;
        let inJavaStackInfo = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 检查是否开始一个新的死锁报告
            if (line.startsWith('Found one Java-level deadlock:')) {
                if (currentDeadlock) {
                    deadlocks.push(currentDeadlock);
                }
                currentDeadlock = {
                    threads: [],
                    stackTraces: {}
                };
                inDeadlock = true;
                inJavaStackInfo = false;
                continue;
            }
            
            // 检查是否进入Java堆栈信息部分
            if (line.startsWith('Java stack information for the threads listed above:')) {
                inJavaStackInfo = true;
                continue;
            }
            
            // 检查是否结束当前死锁报告
            if (line.startsWith('Found') && line.includes('deadlocks')) {
                if (currentDeadlock) {
                    deadlocks.push(currentDeadlock);
                }
                inDeadlock = false;
                inJavaStackInfo = false;
                currentDeadlock = null;
                continue;
            }
            
            // 解析死锁线程信息
            if (inDeadlock && !inJavaStackInfo) {
                // 匹配线程名称行
                const threadNameMatch = line.match(/^"(.+)":$/);
                if (threadNameMatch && currentDeadlock) {
                    const threadName = threadNameMatch[1];
                    // 检查是否已存在该线程
                    let thread = currentDeadlock.threads.find(t => t.name === threadName);
                    if (!thread) {
                        thread = {
                            name: threadName,
                            waitingToLock: '',
                            lockedBy: ''
                        };
                        currentDeadlock.threads.push(thread);
                    }
                    continue;
                }
                
                // 匹配等待锁信息和持有者信息
                if (line.includes('waiting to lock') && currentDeadlock && currentDeadlock.threads.length > 0) {
                    const lastThread = currentDeadlock.threads[currentDeadlock.threads.length - 1];
                    
                    // 匹配等待锁信息
                    const waitingMatch = line.match(/waiting to lock monitor .+ \(object .+, a .+\),?/);
                    if (waitingMatch) {
                        lastThread.waitingToLock = waitingMatch[0].trim().replace(/,$/, ''); // 去掉末尾的逗号
                    }
                    
                    // 匹配持有者信息
                    const heldByMatch = line.match(/which is held by "(.+)"/);
                    if (heldByMatch) {
                        lastThread.lockedBy = heldByMatch[1];
                    }
                }
                
                // 单独处理持有者信息（以防在单独的一行）
                if (line.includes('which is held by') && currentDeadlock && currentDeadlock.threads.length > 0) {
                    const lastThread = currentDeadlock.threads[currentDeadlock.threads.length - 1];
                    const heldByMatch = line.match(/which is held by "(.+)"/);
                    if (heldByMatch) {
                        lastThread.lockedBy = heldByMatch[1];
                    }
                }
            }
            
            // 解析Java堆栈信息
            if (inDeadlock && inJavaStackInfo) {
                // 匹配线程名称行
                const threadNameMatch = line.match(/^"(.+)":$/);
                if (threadNameMatch && currentDeadlock) {
                    const threadName = threadNameMatch[1];
                    currentDeadlock.stackTraces[threadName] = [];
                    continue;
                }
                
                // 收集堆栈跟踪行
                if (line.startsWith('\t') && currentDeadlock) {
                    const threadNames = Object.keys(currentDeadlock.stackTraces);
                    if (threadNames.length > 0) {
                        const lastThreadName = threadNames[threadNames.length - 1];
                        currentDeadlock.stackTraces[lastThreadName].push(line);
                    }
                }
            }
        }
        
        // 添加最后一个死锁
        if (currentDeadlock) {
            deadlocks.push(currentDeadlock);
        }
        
        return deadlocks;
    }
    
    /**
     * 从线程详情中提取线程状态
     * @param {string} details - 线程详情
     * @returns {string} 线程状态
     */
    static extractThreadState(details) {
        return ThreadStateUtils.normalizeState(details);
    }
}