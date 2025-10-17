// Graph visualization configuration
export class GraphConfig {
    static getOptions() {
        return {
            physics: {
                enabled: true,
                solver: 'hierarchicalRepulsion',
                hierarchicalRepulsion: {
                    centralGravity: 0.0,
                    springLength: 90,
                    springConstant: 0.01,
                    nodeDistance: 100,
                    damping: 0.09,
                    avoidOverlap: 0.3
                },
                stabilization: {
                    enabled: true,
                    iterations: 300
                }
            },
            layout: {
                hierarchical: {
                    enabled: true,
                    direction: 'LR',
                    sortMethod: 'directed',
                    levelSeparation: 90,
                    nodeSpacing: 85,
                    treeSpacing: 130
                }
            },
            interaction: {
                dragNodes: true,
                dragView: true,
                zoomView: true,
                hover: true,
                navigationButtons: true,
                keyboard: true,
                multiselect: true,
                selectConnectedEdges: false
            },
            manipulation: {
                enabled: false
            },
            edges: {
                smooth: {
                    enabled: true,
                    type: 'cubicBezier',
                    roundness: 0.2
                },
                physics: false
            }
        };
    }

    static getCompactPhysicsOptions() {
        return {
            physics: {
                enabled: true,
                solver: 'forceAtlas2Based',
                forceAtlas2Based: {
                    gravitationalConstant: -35,
                    centralGravity: 0.005,
                    springLength: 100,
                    springConstant: 0.08,
                    damping: 0.4,
                    avoidOverlap: 0.5
                },
                stabilization: {
                    enabled: true,
                    iterations: 200,
                    updateInterval: 25
                }
            }
        };
    }

    static getNodeDefaults() {
        return {
            font: { size: 14, color: '#1e293b' },
            color: {
                background: '#ffffff',
                border: '#4f46e5',
                highlight: {
                    background: '#e0e7ff',
                    border: '#4338ca'
                }
            },
            borderWidth: 2,
            shape: 'box',
            margin: 5,
            widthConstraint: { minimum: 80, maximum: 150 },
            physics: true,
            mass: 1
        };
    }

    static getEdgeDefaults() {
        return {
            arrows: { to: { enabled: true, scaleFactor: 0.8 } },
            color: { color: '#94a3b8', highlight: '#4f46e5' },
            width: 2,
            smooth: { type: 'cubicBezier', roundness: 0.2 }
        };
    }

    static getNodeColors(collapseState) {
        const colors = {};
        
        // Background indicates incoming state
        if (collapseState?.incoming) {
            colors.background = '#d1d5db';
            colors.highlightBg = '#e5e7eb';
            colors.fontColor = '#1f2937';
        } else {
            colors.background = '#ffffff';
            colors.highlightBg = '#e0e7ff';
            colors.fontColor = '#1e293b';
        }
        
        // Border indicates outgoing state
        if (collapseState?.outgoing) {
            colors.border = '#374151';
            colors.highlightBorder = '#1f2937';
            colors.borderDashes = [5, 5];  // Dashed for outgoing collapsed
        } else {
            colors.border = '#4f46e5';
            colors.highlightBorder = '#4338ca';
            colors.borderDashes = false;
        }
        
        return colors;
    }

    static getFlashColors() {
        return {
            background: '#ffd700',
            border: '#f57f17',
            font: '#000000'
        };
    }

    static getIsolatedNodeColors() {
        return {
            background: '#f3f4f6',
            border: '#9ca3af',
            highlightBg: '#e5e7eb',
            highlightBorder: '#6b7280',
            fontColor: '#6b7280'
        };
    }
}

