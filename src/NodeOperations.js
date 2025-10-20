// Node collapse/expand operations and state management
import { GraphConfig } from './GraphConfig.js';
import { Logger } from './Logger.js';
import { Constants } from './Constants.js';

export class NodeOperations {
    constructor(viewer) {
        this.viewer = viewer;
        this.collapsedNodes = new Map(); // nodeId -> {outgoing: bool, incoming: bool}
        this.flashTimeouts = new Map();
        this.lastActionNode = null;
    }

    collapseNode(nodeId, mode = 'both') {
        Logger.debug('NodeOperations', 'Collapsing node', { nodeId, mode });

        const viewPosition = this.viewer.network.getViewPosition();
        const scale = this.viewer.network.getScale();
        
        let collapseState = this.collapsedNodes.get(nodeId) || { outgoing: false, incoming: false };
        
        if (mode === 'outgoing' || mode === 'both') {
            collapseState.outgoing = true;
        }
        if (mode === 'incoming' || mode === 'both') {
            collapseState.incoming = true;
        }
        
        this.collapsedNodes.set(nodeId, collapseState);

        const connectedEdges = this.viewer.originalData.edges.get({
            filter: (edge) => edge.from === nodeId || edge.to === nodeId
        });

        const affectedNodeIds = new Set();
        
        connectedEdges.forEach((edge) => {
            if (edge.from === nodeId && collapseState.outgoing) {
                affectedNodeIds.add(edge.to);
                this.viewer.hiddenEdges.add(edge.id);
            }
            if (edge.to === nodeId && collapseState.incoming) {
                affectedNodeIds.add(edge.from);
                this.viewer.hiddenEdges.add(edge.id);
            }
        });

        affectedNodeIds.forEach((id) => {
            if (!this.isNodeReferenced(id)) {
                this.viewer.hiddenNodes.add(id);
                
                const nodeEdges = this.viewer.originalData.edges.get({
                    filter: (edge) => edge.from === id || edge.to === id
                });
                
                nodeEdges.forEach((edge) => {
                    this.viewer.hiddenEdges.add(edge.id);
                });
            }
        });

        this.viewer.updateGraphVisibility();
        this.updateNodeAppearance(nodeId);
        
        this.viewer.network.focus(nodeId, {
            scale: scale,
            animation: {
                duration: 300,
                easingFunction: 'easeInOutQuad'
            }
        });
    }

    expandNode(nodeId, mode = 'both') {
        Logger.debug('NodeOperations', 'Expanding node', { nodeId, mode });

        const scale = this.viewer.network.getScale();
        const collapseState = this.collapsedNodes.get(nodeId);
        
        if (!collapseState) {
            Logger.warn('NodeOperations', 'Attempted to expand node with no collapse state', { nodeId });
            return;
        }

        if (mode === 'outgoing' || mode === 'both') {
            collapseState.outgoing = false;
        }
        if (mode === 'incoming' || mode === 'both') {
            collapseState.incoming = false;
        }

        if (!collapseState.outgoing && !collapseState.incoming) {
            this.collapsedNodes.delete(nodeId);
        } else {
            this.collapsedNodes.set(nodeId, collapseState);
        }

        const connectedEdges = this.viewer.originalData.edges.get({
            filter: (edge) => edge.from === nodeId || edge.to === nodeId
        });

        const outgoingNodeIds = new Set();
        const incomingNodeIds = new Set();
        
        connectedEdges.forEach((edge) => {
            if (edge.from === nodeId && (mode === 'outgoing' || mode === 'both')) {
                outgoingNodeIds.add(edge.to);
                this.viewer.hiddenEdges.delete(edge.id);
            }
            if (edge.to === nodeId && (mode === 'incoming' || mode === 'both')) {
                incomingNodeIds.add(edge.from);
                this.viewer.hiddenEdges.delete(edge.id);
            }
        });

        outgoingNodeIds.forEach((id) => {
            if (!this.isNodeCollapsedByOthers(id)) {
                this.viewer.hiddenNodes.delete(id);
                
                // Auto-collapse outgoing calls for newly revealed child nodes
                if (!this.collapsedNodes.has(id)) {
                    const allEdges = this.viewer.originalData.edges.get();
                    const hasOutgoing = allEdges.some(e => e.from === id);
                    
                    if (hasOutgoing) {
                        this.collapsedNodes.set(id, { outgoing: true, incoming: false });
                    }
                }
                
                this.restoreNodeEdges(id);
            }
        });
        
        incomingNodeIds.forEach((id) => {
            if (!this.isNodeCollapsedByOthers(id)) {
                this.viewer.hiddenNodes.delete(id);
                this.restoreNodeEdges(id);
            }
        });

        this.viewer.updateGraphVisibility();
        this.updateNodeAppearance(nodeId);
        
        this.viewer.network.focus(nodeId, {
            scale: scale,
            animation: {
                duration: 300,
                easingFunction: 'easeInOutQuad'
            }
        });
    }

    restoreNodeEdges(nodeId) {
        const nodeEdges = this.viewer.originalData.edges.get({
            filter: (edge) => edge.from === nodeId || edge.to === nodeId
        });
        
        nodeEdges.forEach((edge) => {
            if (!this.isEdgeHiddenByCollapse(edge)) {
                this.viewer.hiddenEdges.delete(edge.id);
            }
        });
    }

    isNodeReferenced(nodeId) {
        const edges = this.viewer.originalData.edges.get({
            filter: (edge) => (edge.from === nodeId || edge.to === nodeId)
        });

        for (const edge of edges) {
            const otherNode = edge.from === nodeId ? edge.to : edge.from;
            const collapseState = this.collapsedNodes.get(otherNode);
            
            if (!collapseState && !this.viewer.hiddenNodes.has(otherNode)) {
                return true;
            }
        }
        
        return false;
    }

    isNodeCollapsedByOthers(nodeId) {
        for (const [collapsedId, state] of this.collapsedNodes.entries()) {
            if (collapsedId === nodeId) continue;
            
            const edges = this.viewer.originalData.edges.get({
                filter: (edge) => 
                    (edge.from === collapsedId && edge.to === nodeId && state.outgoing) ||
                    (edge.to === collapsedId && edge.from === nodeId && state.incoming)
            });
            
            if (edges.length > 0) return true;
        }
        return false;
    }

    isEdgeHiddenByCollapse(edge) {
        const fromState = this.collapsedNodes.get(edge.from);
        const toState = this.collapsedNodes.get(edge.to);
        
        if (fromState?.outgoing) return true;
        if (toState?.incoming) return true;
        
        return false;
    }

    updateNodeAppearance(nodeId) {
        const collapseState = this.collapsedNodes.get(nodeId);
        const isLastAction = nodeId === this.lastActionNode;
        
        if (isLastAction) {
            this.flashNode(nodeId, collapseState);
        } else {
            this.applyNormalAppearance(nodeId, collapseState);
        }
    }

    flashNode(nodeId, collapseState) {
        const flashColors = GraphConfig.getFlashColors();
        
        // Clear any existing timeout
        if (this.flashTimeouts.has(nodeId)) {
            clearTimeout(this.flashTimeouts.get(nodeId));
        }
        
        // Apply initial flash color
        this.viewer.nodes.update({
            id: nodeId,
            color: {
                background: flashColors.background,
                border: flashColors.border,
                highlight: {
                    background: '#ffeb3b',
                    border: '#f9a825'
                }
            },
            font: { size: 14, color: flashColors.font },
            borderWidth: 2
        });
        
        // Fade to normal over configured duration
        const steps = Constants.TIMING.FLASH_STEPS;
        const stepDuration = Constants.TIMING.FLASH_DURATION_MS / steps;
        
        for (let i = 1; i <= steps; i++) {
            const timeoutId = setTimeout(() => {
                const progress = i / steps;
                this.applyFadedColor(nodeId, progress, collapseState);
                
                if (i === steps) {
                    this.flashTimeouts.delete(nodeId);
                }
            }, stepDuration * i);
            
            if (i === 1) {
                this.flashTimeouts.set(nodeId, timeoutId);
            }
        }
    }

    applyNormalAppearance(nodeId, collapseState) {
        const colors = GraphConfig.getNodeColors(collapseState);
        
        // Apply folder-based border color if not collapsed
        let borderColor = colors.border;
        if (!collapseState || (!collapseState.outgoing && !collapseState.incoming)) {
            const node = this.viewer.nodes.get(nodeId);
            if (node) {
                const filePath = node.file || node.path || node.filepath || node.location;
                const folderName = this.viewer.getFolderFromPath(filePath);
                if (folderName) {
                    borderColor = this.viewer.getFolderColor(folderName);
                }
            }
        }
        
        this.viewer.nodes.update({
            id: nodeId,
            color: {
                background: colors.background,
                border: borderColor,
                highlight: {
                    background: colors.highlightBg,
                    border: colors.highlightBorder
                }
            },
            borderWidth: 2,
            font: { 
                size: 14, 
                color: colors.fontColor, 
                bold: !!collapseState 
            },
            shapeProperties: colors.borderDashes ? { borderDashes: colors.borderDashes } : { borderDashes: false }
        });
    }

    applyFadedColor(nodeId, progress, collapseState) {
        const flashColors = GraphConfig.getFlashColors();
        const normalColors = GraphConfig.getNodeColors(collapseState);
        
        // Apply folder-based border color if not collapsed
        let targetBorderColor = normalColors.border;
        if (!collapseState || (!collapseState.outgoing && !collapseState.incoming)) {
            const node = this.viewer.nodes.get(nodeId);
            if (node) {
                const filePath = node.file || node.path || node.filepath || node.location;
                const folderName = this.viewer.getFolderFromPath(filePath);
                if (folderName) {
                    targetBorderColor = this.viewer.getFolderColor(folderName);
                }
            }
        }
        
        // RGB values for interpolation
        const startBg = { r: 255, g: 215, b: 0 };
        const startBorder = { r: 245, g: 127, b: 23 };
        const startFont = { r: 0, g: 0, b: 0 };
        
        const endBg = this.hexToRgb(normalColors.background);
        const endBorder = this.parseColorToRgb(targetBorderColor);
        const endFont = this.hexToRgb(normalColors.fontColor);
        
        const lerp = (start, end, t) => Math.round(start + (end - start) * t);
        
        const bgColor = `rgb(${lerp(startBg.r, endBg.r, progress)}, ${lerp(startBg.g, endBg.g, progress)}, ${lerp(startBg.b, endBg.b, progress)})`;
        const borderColor = `rgb(${lerp(startBorder.r, endBorder.r, progress)}, ${lerp(startBorder.g, endBorder.g, progress)}, ${lerp(startBorder.b, endBorder.b, progress)})`;
        const fontColor = `rgb(${lerp(startFont.r, endFont.r, progress)}, ${lerp(startFont.g, endFont.g, progress)}, ${lerp(startFont.b, endFont.b, progress)})`;
        
        this.viewer.nodes.update({
            id: nodeId,
            color: {
                background: bgColor,
                border: borderColor,
                highlight: { background: bgColor, border: borderColor }
            },
            borderWidth: 2,
            font: { size: 14, color: fontColor, bold: !!collapseState },
            shapeProperties: normalColors.borderDashes ? { borderDashes: normalColors.borderDashes } : { borderDashes: false }
        });
    }

    hexToRgb(hex) {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex to RGB
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return { r, g, b };
    }

    parseColorToRgb(color) {
        // Handle hex colors
        if (color.startsWith('#')) {
            return this.hexToRgb(color);
        }
        
        // Handle HSL colors
        if (color.startsWith('hsl')) {
            // Parse HSL values
            const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
            if (match) {
                const h = parseInt(match[1]) / 360;
                const s = parseInt(match[2]) / 100;
                const l = parseInt(match[3]) / 100;
                
                // Convert HSL to RGB
                let r, g, b;
                if (s === 0) {
                    r = g = b = l; // achromatic
                } else {
                    const hue2rgb = (p, q, t) => {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1/6) return p + (q - p) * 6 * t;
                        if (t < 1/2) return q;
                        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                        return p;
                    };
                    
                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    const p = 2 * l - q;
                    r = hue2rgb(p, q, h + 1/3);
                    g = hue2rgb(p, q, h);
                    b = hue2rgb(p, q, h - 1/3);
                }
                
                return {
                    r: Math.round(r * 255),
                    g: Math.round(g * 255),
                    b: Math.round(b * 255)
                };
            }
        }
        
        // Fallback to default
        return { r: 74, g: 144, b: 226 };
    }

    toggleNodeCollapse(nodeId) {
        this.lastActionNode = nodeId;
        if (this.collapsedNodes.has(nodeId)) {
            this.expandNode(nodeId, 'both');
        } else {
            this.collapseNode(nodeId, 'both');
        }
    }

    collapseAll() {
        if (!this.viewer.network || !this.viewer.originalData) return;

        Logger.info('NodeOperations', 'Collapsing all nodes');

        const allEdges = this.viewer.originalData.edges.get();
        const nodesWithIncoming = new Set(allEdges.map(e => e.to));
        const allNodes = this.viewer.originalData.nodes.get();
        const entryFunctions = allNodes.filter(node => !nodesWithIncoming.has(node.id));
        const entryFunctionIds = new Set(entryFunctions.map(n => n.id));

        Logger.debug('NodeOperations', 'Found entry functions', { count: entryFunctions.length });

        this.collapsedNodes.clear();
        this.viewer.hiddenNodes.clear();
        this.viewer.hiddenEdges.clear();

        // Hide all non-entry nodes
        allNodes.forEach(node => {
            if (!entryFunctionIds.has(node.id)) {
                this.viewer.hiddenNodes.add(node.id);
            }
        });

        // Hide all edges
        allEdges.forEach(edge => {
            this.viewer.hiddenEdges.add(edge.id);
        });

        // Mark entry functions as outgoing collapsed
        entryFunctions.forEach(node => {
            const hasOutgoing = allEdges.some(e => e.from === node.id);
            if (hasOutgoing) {
                this.collapsedNodes.set(node.id, { outgoing: true, incoming: false });
            }
        });

        this.viewer.updateGraphVisibility();
        this.viewer.fitGraph();
    }

    expandAll() {
        Logger.info('NodeOperations', 'Expanding all nodes');

        this.collapsedNodes.clear();
        this.viewer.hiddenNodes.clear();
        this.viewer.hiddenEdges.clear();
        this.lastActionNode = null;

        this.viewer.updateGraphVisibility();
        this.viewer.fitGraph();
    }
}

