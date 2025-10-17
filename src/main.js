// Application entry point
import { CallGraphViewer } from './CallGraphViewer.js';

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.callgraphViewer = new CallGraphViewer();
});

