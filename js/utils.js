/**
 * 线程状态处理工具类
 */
class ThreadStateUtils {
    /**
     * 标准化线程状态，提取状态前缀
     * @param {string} state - 原始线程状态
     * @returns {string} 标准化后的线程状态
     */
    static normalizeState(state) {
        if (!state) return 'UNKNOWN';
        
        // 定义Java线程的标准状态枚举值
        const standardStates = ['NEW', 'RUNNABLE', 'BLOCKED', 'WAITING', 'TIMED_WAITING', 'TERMINATED'];
        
        // 遍历标准状态，检查是否以该状态开头（精确匹配）
        for (const standardState of standardStates) {
            // 检查状态字符串是否以标准状态开头
            if (state.startsWith(standardState)) {
                return standardState;
            }
        }
        
        // 如果没有匹配的标准状态，返回UNKNOWN
        return 'UNKNOWN';
    }
    
    /**
     * 从线程状态中提取显示用的状态前缀
     * @param {string} state - 线程状态
     * @returns {string} 显示用的状态前缀
     */
    static getDisplayState(state) {
        if (!state) return 'UNKNOWN';
        
        // 首先尝试标准化状态
        const normalized = this.normalizeState(state);
        if (normalized !== 'UNKNOWN') {
            return normalized;
        }
        
        // 如果标准化失败，取状态字符串的第一个单词作为显示状态
        return state.split(' ')[0];
    }
}