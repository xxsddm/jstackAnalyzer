document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const jstackInput = document.getElementById('jstackInput');
    const jstackFile = document.getElementById('jstackFile');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const resultSection = document.getElementById('resultSection');
    const analysisResult = document.getElementById('analysisResult');
    let allThreads = []; // 保存所有线程数据
    let allDeadlocks = []; // 保存所有死锁数据
    
    // 绑定事件监听器
    analyzeBtn.addEventListener('click', handleAnalyze);
    jstackFile.addEventListener('change', handleFileSelect);
    
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