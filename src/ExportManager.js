// Graph export functionality

export class ExportManager {
    constructor(viewer) {
        this.viewer = viewer;
    }

    exportToPNG() {
        if (!this.viewer.network) {
            alert('No graph to export. Please load a DOT file first.');
            return;
        }

        const canvas = document.querySelector('#graph-canvas canvas');
        if (canvas) {
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = 'callgraph.png';
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            });
        }
    }
}
