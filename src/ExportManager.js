// Graph export functionality
import { ErrorHandler } from './ErrorHandler.js';
import { Logger } from './Logger.js';

export class ExportManager {
    constructor(viewer) {
        this.viewer = viewer;
    }

    exportToPNG() {
        if (!this.viewer.network) {
            ErrorHandler.showNotification('No graph to export. Please load a DOT file first.', 'info');
            return;
        }

        Logger.info('ExportManager', 'Exporting graph to PNG');

        const canvas = document.querySelector('#graph-canvas canvas');
        if (canvas) {
            canvas.toBlob((blob) => {
                try {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = 'callgraph.png';
                    link.href = url;
                    link.click();
                    URL.revokeObjectURL(url);
                    
                    Logger.info('ExportManager', 'Graph exported successfully');
                    ErrorHandler.showNotification('Graph exported successfully!', 'success');
                } catch (error) {
                    ErrorHandler.handle(
                        error,
                        'ExportManager.exportToPNG',
                        'Failed to export graph. Please try again.'
                    );
                }
            });
        } else {
            ErrorHandler.showNotification('Cannot find graph canvas to export.', 'error');
        }
    }
}
