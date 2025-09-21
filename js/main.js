document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const featureSelection = document.getElementById('featureSelection');
    const threadAnalysisSection = document.getElementById('threadAnalysisSection');
    const threadComparisonSection = document.getElementById('threadComparisonSection');
    const jstackInput = document.getElementById('jstackInput');
    const jstackFile = document.getElementById('jstackFile');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultSection = document.getElementById('resultSection');
    const analysisResult = document.getElementById('analysisResult');
    let allThreads = []; // 保存所有线程数据
    let allDeadlocks = []; // 保存所有死锁数据
    
    // 功能选择事件监听
    const featureOptions = document.querySelectorAll('.feature-option');
    featureOptions.forEach(option => {
        option.addEventListener('click', function() {
            const featureType = this.dataset.feature;
            if (featureType === 'thread-analysis') {
                featureSelection.style.display = 'none';
                threadAnalysisSection.style.display = 'block';
            } else if (featureType === 'thread-comparison') {
                featureSelection.style.display = 'none';
                threadComparisonSection.style.display = 'block';
            }
        });
    });
    
    // 返回功能选择界面的按钮事件
    const backToFeaturesBtn = document.getElementById('backToFeatures');
    if (backToFeaturesBtn) {
        backToFeaturesBtn.addEventListener('click', function() {
            threadAnalysisSection.style.display = 'none';
            featureSelection.style.display = 'block';
            resultSection.style.display = 'none';
            jstackInput.value = '';
            jstackFile.value = '';
        });
    }
    
    // 返回功能选择界面的按钮事件（对比分析）
    const backToFeaturesComparisonBtn = document.getElementById('backToFeaturesComparison');
    if (backToFeaturesComparisonBtn) {
        backToFeaturesComparisonBtn.addEventListener('click', function() {
            threadComparisonSection.style.display = 'none';
            featureSelection.style.display = 'block';
            document.getElementById('comparisonResultSection').style.display = 'none';
            document.getElementById('threadFiles').value = '';
        });
    }
    
    // 绑定事件监听器
    analyzeBtn.addEventListener('click', handleAnalyze);
    jstackFile.addEventListener('change', handleFileSelect);
    
    // 线程信息对比分析按钮事件
    const compareBtn = document.getElementById('compareBtn');
    const threadFilesInput = document.getElementById('threadFiles');
    if (compareBtn && threadFilesInput) {
        compareBtn.addEventListener('click', handleCompare);
        threadFilesInput.addEventListener('change', handleThreadFilesSelect);
    }
    
    // 添加页签切换功能
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有按钮的active类
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // 为当前按钮添加active类
            button.classList.add('active');
            
            // 隐藏所有页签内容
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // 显示对应的内容页签
            const tabId = button.dataset.tab + 'Tab';
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    /**
     * 处理分析按钮点击事件
     */
    function handleAnalyze() {
        // 获取输入数据
        const inputData = jstackInput.value;
        let dataToAnalyze = '';
        
        // 优先使用文本输入，如果没有则检查文件
        if (inputData.trim() !== '') {
            dataToAnalyze = inputData;
        } else if (jstackFile.files.length > 0) {
            // 如果选择了文件但还没有读取，我们需要等待文件读取完成
            // 这种情况会在handleFileSelect中自动处理
            return;
        } else {
            showResult('请输入jstack数据或选择文件', true);
            return;
        }
        
        // 验证数据
        const validationResult = JStackValidator.validate(dataToAnalyze);
        if (!validationResult.isValid) {
            showResult(validationResult.error, true);
            return;
        }
        
        // 解析数据
        try {
            allThreads = JStackParser.parse(dataToAnalyze);
            if (allThreads.length === 0) {
                showResult('未解析到任何线程信息', true);
                return;
            }
            
            // 解析死锁信息
            allDeadlocks = JStackParser.parseDeadlocks(dataToAnalyze);
            
            // 分析CPU使用情况
            const threadsWithCPU = CPUAnalyzer.analyzeCPUUsage(allThreads);
            
            // 渲染结果（默认显示所有线程）
            renderExtendedThreads(threadsWithCPU, analysisResult, 'all');
            resultSection.style.display = 'block';
            
            // 创建线程表格（替换原来的图表）
            createThreadTable(threadsWithCPU);
            
            // 渲染死锁报告
            const deadlockReportContainer = document.getElementById('deadlockReportContainer');
            DeadlockAnalyzer.renderDeadlockReport(allDeadlocks, deadlockReportContainer);
        } catch (error) {
            showResult(`解析过程中发生错误: ${error.message}`, true);
        }
    }
    
    /**
     * 处理文件选择事件
     */
    function handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(e) {
            jstackInput.value = e.target.result;
            // 文件读取完成后不再自动触发分析，而是等待用户点击"开始分析"按钮
            // 只有在用户点击分析按钮时才进行分析
        };
        reader.onerror = function() {
            showResult('读取文件时发生错误', true);
        };
        reader.readAsText(file);
    }
    
    /**
     * 处理多线程信息文件选择事件
     */
    function handleThreadFilesSelect(event) {
        // 文件选择事件处理（可选）
    }
    
    /**
     * 处理线程信息对比分析按钮点击事件
     */
    function handleCompare() {
        const files = threadFilesInput.files;
        
        if (files.length < 2) {
            showComparisonResult('请至少选择2个线程信息文件进行对比分析', true);
            return;
        }
        
        // 读取所有文件
        const fileReaders = [];
        const fileData = [];
        const fileNames = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            fileNames.push(file.name);
            
            const reader = new FileReader();
            const promise = new Promise((resolve, reject) => {
                reader.onload = function(e) {
                    try {
                        // 解析文件内容获取时间戳
                        const content = e.target.result;
                        const timestamp = parseTimestamp(content);
                        fileData.push({
                            name: file.name,
                            content: content,
                            timestamp: timestamp
                        });
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = function() {
                    reject(new Error(`读取文件 ${file.name} 时发生错误`));
                };
            });
            
            reader.readAsText(file);
            fileReaders.push(promise);
        }
        
        // 等待所有文件读取完成
        Promise.all(fileReaders)
            .then(() => {
                // 按时间戳排序文件
                fileData.sort((a, b) => a.timestamp - b.timestamp);
                
                // 执行对比分析
                performThreadComparison(fileData);
            })
            .catch(error => {
                showComparisonResult(`文件读取过程中发生错误: ${error.message}`, true);
            });
    }
    
    /**
     * 解析文件时间戳
     * @param {string} content - 文件内容
     * @returns {Date} 时间戳
     */
    function parseTimestamp(content) {
        // 查找文件开头的时间戳（格式：YYYY-MM-DD HH:MM:SS）
        const lines = content.split('\n');
        for (let i = 0; i < Math.min(lines.length, 10); i++) {
            const line = lines[i].trim();
            // 匹配时间戳格式
            const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
            if (timestampMatch) {
                return new Date(timestampMatch[1]);
            }
        }
        // 如果没有找到时间戳，返回当前时间
        return new Date();
    }
    
    /**
     * 执行线程对比分析
     * @param {Array} fileData - 文件数据数组
     */
    function performThreadComparison(fileData) {
        try {
            // 解析每个文件中的线程信息
            const parsedData = fileData.map(file => {
                const threads = JStackParser.parse(file.content);
                const threadsWithCPU = CPUAnalyzer.analyzeCPUUsage(threads);
                return {
                    name: file.name,
                    timestamp: file.timestamp,
                    threads: threadsWithCPU
                };
            });
            
            // 执行对比分析
            const comparisonResult = analyzeThreadChanges(parsedData);
            
            // 渲染对比结果
            renderComparisonResult(comparisonResult);
        } catch (error) {
            showComparisonResult(`对比分析过程中发生错误: ${error.message}`, true);
        }
    }
    
    /**
     * 分析线程变化
     * @param {Array} parsedData - 解析后的数据
     * @returns {Array} 对比结果
     */
    function analyzeThreadChanges(parsedData) {
        // 创建一个映射来存储每个线程ID在不同时刻的数据
        const threadMap = new Map();
        
        // 遍历每个时间点的数据
        parsedData.forEach(data => {
            const timestamp = data.timestamp;
            const threads = data.threads;
            
            // 遍历当前时间点的所有线程
            threads.forEach(thread => {
                // 使用线程名称和tid的组合作为唯一标识符
                const threadId = thread.tid ? `${thread.name} (${thread.tid})` : thread.name;
                
                // 如果该线程ID还没有记录，则创建新条目
                if (!threadMap.has(threadId)) {
                    threadMap.set(threadId, []);
                }
                
                // 添加当前时间点的数据
                threadMap.get(threadId).push({
                    timestamp: timestamp,
                    cpuTime: thread.cpuTime,
                    elapsedTime: thread.elapsedTime,
                    cpuUsage: thread.cpuUsage
                });
            });
        });
        
        // 过滤出在多个时间点都出现的线程
        const result = [];
        threadMap.forEach((timeSeries, threadId) => {
            // 只处理在多个时间点都出现的线程
            if (timeSeries.length > 1) {
                // 按时间戳排序
                timeSeries.sort((a, b) => a.timestamp - b.timestamp);
                
                // 计算变化情况
                const changes = [];
                for (let i = 1; i < timeSeries.length; i++) {
                    const prev = timeSeries[i - 1];
                    const curr = timeSeries[i];
                    
                    // 计算时间间隔（毫秒）
                    const timeDiff = curr.timestamp - prev.timestamp;
                    
                    // 计算CPU时间变化
                    let cpuTimeDiff = null;
                    if (curr.cpuTime !== null && prev.cpuTime !== null) {
                        cpuTimeDiff = curr.cpuTime - prev.cpuTime;
                    }
                    
                    // 计算Elapsed时间变化
                    let elapsedTimeDiff = null;
                    if (curr.elapsedTime !== null && prev.elapsedTime !== null) {
                        elapsedTimeDiff = curr.elapsedTime - prev.elapsedTime;
                    }
                    
                    // 计算CPU使用率变化
                    let cpuUsageDiff = null;
                    if (curr.cpuUsage !== null && prev.cpuUsage !== null) {
                        cpuUsageDiff = curr.cpuUsage - prev.cpuUsage;
                    }
                    
                    // 计算时段内的平均CPU使用率
                    let avgCpuUsage = null;
                    if (cpuTimeDiff !== null && elapsedTimeDiff !== null && elapsedTimeDiff > 0) {
                        avgCpuUsage = (cpuTimeDiff / elapsedTimeDiff) * 100;
                    }
                    
                    changes.push({
                        periodStart: prev.timestamp,
                        periodEnd: curr.timestamp,
                        timeDiff: timeDiff,
                        cpuTimeDiff: cpuTimeDiff,
                        elapsedTimeDiff: elapsedTimeDiff,
                        cpuUsageDiff: cpuUsageDiff,
                        avgCpuUsage: avgCpuUsage
                    });
                }
                
                result.push({
                    threadId: threadId,
                    timeSeries: timeSeries,
                    changes: changes
                });
            }
        });
        
        return result;
    }
    
    /**
     * 渲染对比结果
     * @param {Array} comparisonResult - 对比结果
     */
    function renderComparisonResult(comparisonResult) {
        const container = document.getElementById('comparisonResult');
        container.innerHTML = '';
        
        if (comparisonResult.length === 0) {
            showComparisonResult('没有找到在多个时间点都出现的线程', true);
            return;
        }
        
        // 创建结果标题
        const titleElement = document.createElement('h3');
        titleElement.textContent = `找到 ${comparisonResult.length} 个在多个时间点出现的线程`;
        container.appendChild(titleElement);
        
        // 为每个线程创建对比表格
        comparisonResult.forEach((threadData, index) => {
            const threadElement = document.createElement('div');
            threadElement.className = 'thread-comparison-item';
            // 为每个线程元素添加唯一ID
            threadElement.id = `thread-${index}`;
            
            // 线程标题
            const threadTitle = document.createElement('h4');
            threadTitle.textContent = `线程: ${threadData.threadId}`;
            threadElement.appendChild(threadTitle);
            
            // 创建表格
            const table = document.createElement('table');
            table.className = 'thread-comparison-table';
            // 为每个表格添加唯一ID
            table.id = `table-${index}`;
            
            // 表头
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            const headers = [
                '时间段', 
                '时间间隔(ms)', 
                'CPU时间变化(ms)', 
                'Elapsed时间变化(ms)', 
                'CPU使用率变化(%)', 
                { text: '时段平均CPU使用率(%)', sortable: true, field: 'avgCpuUsage' }
            ];
            headers.forEach(header => {
                const th = document.createElement('th');
                if (typeof header === 'string') {
                    th.textContent = header;
                } else {
                    th.textContent = header.text;
                    if (header.sortable) {
                        th.dataset.field = header.field;
                        th.classList.add('sortable');
                        th.addEventListener('click', () => sortComparisonTable(threadData, index, header.field));
                    }
                }
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // 表体
            const tbody = document.createElement('tbody');
            tbody.id = `tbody-${index}`; // 为每个tbody添加唯一ID
            threadData.changes.forEach(change => {
                const row = document.createElement('tr');
                
                // 时间段
                const periodCell = document.createElement('td');
                periodCell.textContent = `${formatTime(change.periodStart)} → ${formatTime(change.periodEnd)}`;
                row.appendChild(periodCell);
                
                // 时间间隔
                const timeDiffCell = document.createElement('td');
                timeDiffCell.textContent = change.timeDiff.toFixed(2);
                row.appendChild(timeDiffCell);
                
                // CPU时间变化
                const cpuTimeDiffCell = document.createElement('td');
                cpuTimeDiffCell.textContent = change.cpuTimeDiff !== null ? change.cpuTimeDiff.toFixed(2) : '无数据';
                row.appendChild(cpuTimeDiffCell);
                
                // Elapsed时间变化
                const elapsedTimeDiffCell = document.createElement('td');
                elapsedTimeDiffCell.textContent = change.elapsedTimeDiff !== null ? change.elapsedTimeDiff.toFixed(2) : '无数据';
                row.appendChild(elapsedTimeDiffCell);
                
                // CPU使用率变化
                const cpuUsageDiffCell = document.createElement('td');
                if (change.cpuUsageDiff !== null) {
                    cpuUsageDiffCell.textContent = change.cpuUsageDiff.toFixed(2);
                    // 添加颜色标识
                    if (change.cpuUsageDiff > 0) {
                        cpuUsageDiffCell.style.color = 'red';
                        cpuUsageDiffCell.textContent += ' ↑';
                    } else if (change.cpuUsageDiff < 0) {
                        cpuUsageDiffCell.style.color = 'green';
                        cpuUsageDiffCell.textContent += ' ↓';
                    }
                } else {
                    cpuUsageDiffCell.textContent = '无数据';
                }
                row.appendChild(cpuUsageDiffCell);
                
                // 时段平均CPU使用率
                const avgCpuUsageCell = document.createElement('td');
                if (change.avgCpuUsage !== null) {
                    avgCpuUsageCell.textContent = change.avgCpuUsage.toFixed(2);
                } else {
                    avgCpuUsageCell.textContent = '无数据';
                }
                row.appendChild(avgCpuUsageCell);
                
                tbody.appendChild(row);
            });
            table.appendChild(tbody);
            
            threadElement.appendChild(table);
            container.appendChild(threadElement);
        });
        
        // 显示结果区域
        document.getElementById('comparisonResultSection').style.display = 'block';
    }
    
    /**
     * 格式化时间显示
     * @param {Date} date - 时间对象
     * @returns {string} 格式化后的时间字符串
     */
    function formatTime(date) {
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
    
    /**
     * 显示结果或错误信息
     * @param {string} message - 要显示的消息
     * @param {boolean} isError - 是否为错误信息
     */
    function showResult(message, isError = false) {
        if (isError) {
            Visualizer.showError(message, analysisResult);
        } else {
            analysisResult.innerHTML = message;
        }
        resultSection.style.display = 'block';
    }
    
    /**
     * 显示对比分析结果或错误信息
     * @param {string} message - 要显示的消息
     * @param {boolean} isError - 是否为错误信息
     */
    function showComparisonResult(message, isError = false) {
        const container = document.getElementById('comparisonResult');
        if (isError) {
            container.innerHTML = `<div class="error-message">${message}</div>`;
        } else {
            container.innerHTML = message;
        }
        document.getElementById('comparisonResultSection').style.display = 'block';
    }
    
    /**
     * 渲染扩展线程分析结果
     * @param {Array} threads - 包含CPU信息的线程对象数组
     * @param {HTMLElement} container - 渲染容器
     * @param {string} filterState - 筛选状态
     */
    function renderExtendedThreads(threads, container, filterState = 'all') {
        // 清空容器
        container.innerHTML = '';
        
        // 根据筛选状态过滤线程
        const filteredThreads = filterState === 'all' ? threads : threads.filter(thread => {
            // 使用标准化的状态进行筛选
            const normalizedState = ThreadStateUtils.normalizeState(thread.state);
            return normalizedState === filterState;
        });
        
        // 创建线程统计信息
        const stats = Visualizer.calculateStats(threads);
        const statsElement = CPUAnalyzer.createExtendedStatsElement(stats, threads);
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
            const threadElement = CPUAnalyzer.createExtendedThreadElement(thread);
            threadList.appendChild(threadElement);
        });
        
        container.appendChild(threadList);
        
        // 绑定筛选事件
        bindExtendedFilterEvents(threads, container);
    }
    
    /**
     * 绑定扩展筛选事件
     * @param {Array} threads - 包含CPU信息的线程对象数组
     * @param {HTMLElement} container - 渲染容器
     */
    function bindExtendedFilterEvents(threads, container) {
        const stateFilter = container.querySelector('#stateFilter');
        const applyFilterBtn = container.querySelector('#applyFilterBtn');
        const resetFilterBtn = container.querySelector('#resetFilterBtn');
        
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => {
                const selectedState = stateFilter.value;
                renderExtendedThreads(threads, container, selectedState);
            });
        }
        
        if (resetFilterBtn) {
            resetFilterBtn.addEventListener('click', () => {
                stateFilter.value = 'all';
                renderExtendedThreads(threads, container, 'all');
            });
        }
    }
    
    /**
     * 创建线程表格
     * @param {Array} threads - 包含CPU信息的线程对象数组
     */
    function createThreadTable(threads) {
        // 获取表格容器
        const tableContainer = document.getElementById('threadTableContainer');
        tableContainer.innerHTML = '';
        
        // 创建表格元素
        const table = document.createElement('table');
        table.className = 'thread-table';
        
        // 创建表头
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // 定义表头列
        const headers = [
            { text: '线程ID', sortable: true, field: 'name' },
            { text: '线程状态', sortable: true, field: 'state' },
            { text: 'CPU (ms)', sortable: true, field: 'cpuTime' },
            { text: 'Elapsed (ms)', sortable: true, field: 'elapsedTime' },
            { text: 'CPU占用率 (%)', sortable: true, field: 'cpuUsage' }
        ];
        
        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header.text;
            if (header.sortable) {
                th.dataset.field = header.field;
                th.classList.add('sortable');
                // 修复排序箭头问题：移除多余的<span class="sort-arrow"></span>
                th.innerHTML = header.text;
                th.addEventListener('click', () => sortTable(threads, header.field));
            }
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // 创建表体
        const tbody = document.createElement('tbody');
        tbody.id = 'threadTableBody';
        table.appendChild(tbody);
        tableContainer.appendChild(table);
        
        // 填充表格数据
        renderTableData(threads);
    }
    
    /**
     * 渲染表格数据
     * @param {Array} threads - 包含CPU信息的线程对象数组
     */
    function renderTableData(threads) {
        const tbody = document.getElementById('threadTableBody');
        tbody.innerHTML = '';
        
        threads.forEach(thread => {
            const row = document.createElement('tr');
            
            // 线程ID
            const idCell = document.createElement('td');
            idCell.textContent = thread.name || '未知';
            row.appendChild(idCell);
            
            // 线程状态
            const stateCell = document.createElement('td');
            // 使用标准化的状态显示
            const normalizedState = ThreadStateUtils.normalizeState(thread.state);
            const displayState = ThreadStateUtils.getDisplayState(thread.state);
            stateCell.textContent = displayState;
            stateCell.className = `state-${normalizedState ? normalizedState.replace(/_/g, '-') : 'UNKNOWN'}`;
            row.appendChild(stateCell);
            
            // CPU耗时 (ms)
            const cpuTimeCell = document.createElement('td');
            cpuTimeCell.textContent = thread.cpuTime !== null ? thread.cpuTime.toFixed(2) : '无';
            row.appendChild(cpuTimeCell);
            
            // Elapsed耗时 (ms) - 直接显示毫秒
            const elapsedTimeCell = document.createElement('td');
            const elapsedInMilliseconds = thread.elapsedTime !== null ? thread.elapsedTime.toFixed(2) : '无';
            elapsedTimeCell.textContent = elapsedInMilliseconds;
            row.appendChild(elapsedTimeCell);
            
            // CPU平均使用率 (%)
            const cpuUsageCell = document.createElement('td');
            cpuUsageCell.textContent = thread.cpuUsage !== null ? thread.cpuUsage.toFixed(2) : '无';
            row.appendChild(cpuUsageCell);
            
            tbody.appendChild(row);
        });
    }
    
    // 排序方向缓存
    const sortDirections = {};
    
    /**
     * 对表格进行排序
     * @param {Array} threads - 包含CPU信息的线程对象数组
     * @param {string} field - 排序列
     */
    function sortTable(threads, field) {
        // 切换排序方向
        sortDirections[field] = !sortDirections[field];
        const ascending = sortDirections[field];
        
        // 对线程数据进行排序
        const sortedThreads = [...threads].sort((a, b) => {
            let valueA = a[field];
            let valueB = b[field];
            
            // 处理缺失值(null)的情况 - 将null值排在最后
            if (valueA === null && valueB === null) return 0;
            if (valueA === null) return ascending ? 1 : -1;
            if (valueB === null) return ascending ? -1 : 1;
            
            // 处理字符串比较
            if (typeof valueA === 'string') {
                return ascending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
            }
            
            // 数值比较
            return ascending ? valueA - valueB : valueB - valueA;
        });
        
        // 更新排序箭头
        updateSortArrows(field, ascending);
        
        // 重新渲染表格数据
        renderTableData(sortedThreads);
    }
    
    /**
     * 对比分析表格排序函数
     * @param {Object} threadData - 线程数据
     * @param {number} index - 线程索引
     * @param {string} field - 排序列
     */
    function sortComparisonTable(threadData, index, field) {
        // 为每个线程创建唯一的排序字段键
        const sortKey = `${index}-${field}`;
        
        // 切换排序方向
        sortDirections[sortKey] = !sortDirections[sortKey];
        const ascending = sortDirections[sortKey];
        
        // 对线程数据进行排序
        const sortedChanges = [...threadData.changes].sort((a, b) => {
            let valueA = a[field];
            let valueB = b[field];
            
            // 处理缺失值(null)的情况 - 将null值排在最后
            if (valueA === null && valueB === null) return 0;
            if (valueA === null) return ascending ? 1 : -1;
            if (valueB === null) return ascending ? -1 : 1;
            
            // 数值比较
            return ascending ? valueA - valueB : valueB - valueA;
        });
        
        // 更新排序箭头
        updateComparisonSortArrows(index, field, ascending);
        
        // 重新渲染表格数据
        renderComparisonTableData(index, sortedChanges);
    }
    
    /**
     * 更新对比分析排序箭头
     * @param {number} index - 线程索引
     * @param {string} field - 排序列
     * @param {boolean} ascending - 是否升序
     */
    function updateComparisonSortArrows(index, field, ascending) {
        // 清除当前线程表格的所有排序箭头
        const table = document.getElementById(`table-${index}`);
        if (!table) return;
        
        const allHeaders = table.querySelectorAll('th.sortable');
        allHeaders.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });
        
        // 设置当前列的排序箭头
        const currentHeader = table.querySelector(`th[data-field="${field}"]`);
        if (currentHeader) {
            currentHeader.classList.add(ascending ? 'sort-asc' : 'sort-desc');
        }
    }
    
    /**
     * 渲染对比分析表格数据
     * @param {number} index - 线程索引
     * @param {Array} changes - 变化数据
     */
    function renderComparisonTableData(index, changes) {
        const tbody = document.getElementById(`tbody-${index}`);
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        changes.forEach(change => {
            const row = document.createElement('tr');
            
            // 时间段
            const periodCell = document.createElement('td');
            periodCell.textContent = `${formatTime(change.periodStart)} → ${formatTime(change.periodEnd)}`;
            row.appendChild(periodCell);
            
            // 时间间隔
            const timeDiffCell = document.createElement('td');
            timeDiffCell.textContent = change.timeDiff.toFixed(2);
            row.appendChild(timeDiffCell);
            
            // CPU时间变化
            const cpuTimeDiffCell = document.createElement('td');
            cpuTimeDiffCell.textContent = change.cpuTimeDiff !== null ? change.cpuTimeDiff.toFixed(2) : '无数据';
            row.appendChild(cpuTimeDiffCell);
            
            // Elapsed时间变化
            const elapsedTimeDiffCell = document.createElement('td');
            elapsedTimeDiffCell.textContent = change.elapsedTimeDiff !== null ? change.elapsedTimeDiff.toFixed(2) : '无数据';
            row.appendChild(elapsedTimeDiffCell);
            
            // CPU使用率变化
            const cpuUsageDiffCell = document.createElement('td');
            if (change.cpuUsageDiff !== null) {
                cpuUsageDiffCell.textContent = change.cpuUsageDiff.toFixed(2);
                // 添加颜色标识
                if (change.cpuUsageDiff > 0) {
                    cpuUsageDiffCell.style.color = 'red';
                    cpuUsageDiffCell.textContent += ' ↑';
                } else if (change.cpuUsageDiff < 0) {
                    cpuUsageDiffCell.style.color = 'green';
                    cpuUsageDiffCell.textContent += ' ↓';
                }
            } else {
                cpuUsageDiffCell.textContent = '无数据';
            }
            row.appendChild(cpuUsageDiffCell);
            
            // 时段平均CPU使用率
            const avgCpuUsageCell = document.createElement('td');
            if (change.avgCpuUsage !== null) {
                avgCpuUsageCell.textContent = change.avgCpuUsage.toFixed(2);
            } else {
                avgCpuUsageCell.textContent = '无数据';
            }
            row.appendChild(avgCpuUsageCell);
            
            tbody.appendChild(row);
        });
    }
    
    /**
     * 更新排序箭头
     * @param {string} field - 排序列
     * @param {boolean} ascending - 是否升序
     */
    function updateSortArrows(field, ascending) {
        // 清除所有排序箭头
        const allHeaders = document.querySelectorAll('.thread-table th.sortable');
        allHeaders.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });
        
        // 设置当前列的排序箭头
        const currentHeader = document.querySelector(`.thread-table th[data-field="${field}"]`);
        if (currentHeader) {
            currentHeader.classList.add(ascending ? 'sort-asc' : 'sort-desc');
        }
    }
});