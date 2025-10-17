// Centralized error handling for the application
// Provides consistent error logging, user notifications, and error tracking

export class ErrorHandler {
    static errorCounts = new Map();
    static maxToasts = 3;
    static activeToasts = 0;
    
    /**
     * Handle an error with context, logging, and user notification
     * @param {Error} error - The error that occurred
     * @param {string} context - Where the error occurred (e.g., 'DotParser.parseDotFile')
     * @param {string} userMessage - User-friendly message to display
     * @param {object} additionalData - Additional context for debugging
     */
    static handle(error, context, userMessage, additionalData = {}) {
        // Log to console with full context
        this.logError(error, context, additionalData);
        
        // Track error for metrics
        this.trackError(context);
        
        // Show user-friendly message
        if (userMessage) {
            this.showNotification(userMessage, 'error');
        }
        
        // In production, would send to monitoring service
        // this.sendToMonitoring(error, context, additionalData);
    }
    
    /**
     * Log error with structured format
     */
    static logError(error, context, additionalData) {
        console.group(`❌ Error in ${context}`);
        console.error('Message:', error.message);
        console.error('Stack:', error.stack);
        if (Object.keys(additionalData).length > 0) {
            console.error('Additional Context:', additionalData);
        }
        console.groupEnd();
    }
    
    /**
     * Track error occurrence for metrics
     */
    static trackError(context) {
        const count = this.errorCounts.get(context) || 0;
        this.errorCounts.set(context, count + 1);
        
        // Warn if same error happens repeatedly
        if (count > 3) {
            console.warn(`⚠️ Error in ${context} has occurred ${count} times`);
        }
    }
    
    /**
     * Show user notification (replaces alert())
     * @param {string} message - Message to display
     * @param {'info'|'success'|'warning'|'error'} type - Notification type
     */
    static showNotification(message, type = 'info') {
        // Rate limit: don't show too many toasts
        if (this.activeToasts >= this.maxToasts) {
            console.warn('Too many notifications, skipping:', message);
            return;
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getIcon(type)}</span>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        // Add to document
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(toast);
        this.activeToasts++;
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('toast-fadeout');
                setTimeout(() => {
                    toast.remove();
                    this.activeToasts--;
                }, 300);
            }
        }, 5000);
    }
    
    /**
     * Get icon for notification type
     */
    static getIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };
        return icons[type] || icons.info;
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Get error metrics for monitoring
     */
    static getMetrics() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
            errorsByContext: Object.fromEntries(this.errorCounts),
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Reset error tracking (useful for testing)
     */
    static reset() {
        this.errorCounts.clear();
        this.activeToasts = 0;
    }
    
    // In production, would implement:
    // static sendToMonitoring(error, context, additionalData) {
    //     // Send to Sentry, LogRocket, etc.
    // }
}

