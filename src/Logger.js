// Structured logging for debugging and monitoring

export const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

export class Logger {
    static level = LogLevel.INFO;  // Default level
    static logs = [];              // Store logs for export
    static maxLogs = 1000;         // Prevent memory leak
    
    /**
     * Set the logging level
     * @param {number} level - LogLevel constant
     */
    static setLevel(level) {
        this.level = level;
        console.info(`🔧 Log level set to: ${this.getLevelName(level)}`);
    }
    
    /**
     * Debug logging - detailed information for diagnosis
     * @param {string} module - Module name (e.g., 'LayoutManager')
     * @param {string} message - Log message
     * @param {object} data - Additional data
     */
    static debug(module, message, data = {}) {
        if (this.level <= LogLevel.DEBUG) {
            const entry = this.createEntry('DEBUG', module, message, data);
            console.debug(`🔍 [${module}]`, message, data);
            this.storeLog(entry);
        }
    }
    
    /**
     * Info logging - general informational messages
     */
    static info(module, message, data = {}) {
        if (this.level <= LogLevel.INFO) {
            const entry = this.createEntry('INFO', module, message, data);
            console.info(`ℹ️ [${module}]`, message, data);
            this.storeLog(entry);
        }
    }
    
    /**
     * Warning logging - potentially harmful situations
     */
    static warn(module, message, data = {}) {
        if (this.level <= LogLevel.WARN) {
            const entry = this.createEntry('WARN', module, message, data);
            console.warn(`⚠️ [${module}]`, message, data);
            this.storeLog(entry);
            // Could send to monitoring service
        }
    }
    
    /**
     * Error logging - error events
     */
    static error(module, message, error, data = {}) {
        if (this.level <= LogLevel.ERROR) {
            const entry = this.createEntry('ERROR', module, message, { 
                error: error?.message || error,
                stack: error?.stack,
                ...data 
            });
            console.error(`❌ [${module}]`, message, error, data);
            this.storeLog(entry);
            // Could send to monitoring service
        }
    }
    
    /**
     * Performance logging - track operation timing
     * @param {string} module - Module name
     * @param {string} operation - Operation name
     * @param {number} durationMs - Duration in milliseconds
     * @param {object} data - Additional data
     */
    static perf(module, operation, durationMs, data = {}) {
        if (this.level <= LogLevel.DEBUG) {
            const message = `${operation} completed in ${durationMs.toFixed(2)}ms`;
            const entry = this.createEntry('PERF', module, message, { 
                operation, 
                durationMs,
                ...data 
            });
            console.debug(`⏱️ [${module}]`, message, data);
            this.storeLog(entry);
        }
    }
    
    /**
     * Create log entry object
     */
    static createEntry(level, module, message, data) {
        return {
            timestamp: new Date().toISOString(),
            level,
            module,
            message,
            data: Object.keys(data).length > 0 ? data : undefined
        };
    }
    
    /**
     * Store log entry in memory
     */
    static storeLog(entry) {
        this.logs.push(entry);
        
        // Prevent memory leak by limiting stored logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }
    
    /**
     * Get level name from constant
     */
    static getLevelName(level) {
        const names = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];
        return names[level] || 'UNKNOWN';
    }
    
    /**
     * Export logs as JSON (useful for bug reports)
     */
    static exportLogs() {
        const blob = new Blob(
            [JSON.stringify(this.logs, null, 2)], 
            { type: 'application/json' }
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `callgraph-logs-${Date.now()}.json`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    /**
     * Get recent logs for debugging
     */
    static getRecentLogs(count = 50) {
        return this.logs.slice(-count);
    }
    
    /**
     * Clear all logs
     */
    static clear() {
        this.logs = [];
        console.clear();
    }
    
    /**
     * Helper to measure function execution time
     * @param {string} module - Module name
     * @param {string} operation - Operation name
     * @param {Function} fn - Function to measure
     * @returns {*} - Return value of the function
     */
    static async measure(module, operation, fn) {
        const start = performance.now();
        try {
            const result = await fn();
            const duration = performance.now() - start;
            this.perf(module, operation, duration, { success: true });
            return result;
        } catch (error) {
            const duration = performance.now() - start;
            this.perf(module, operation, duration, { success: false, error: error.message });
            throw error;
        }
    }
}

// Expose logger to window for debugging in console
if (typeof window !== 'undefined') {
    window.Logger = Logger;
    window.LogLevel = LogLevel;
}

