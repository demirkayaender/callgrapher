// Node collapse/expand operations and state management
import { GraphConfig } from './GraphConfig.js';

export class NodeOperations {
    constructor(viewer) {
        this.viewer = viewer;
        this.collapsedNodes = new Map(); // nodeId -> {outgoing: bool, incoming: bool}
        this.flashTimeouts = new Map();
        this.lastActionNode = null;
    }

    collapseNode(nodeId, mode = 'both') {
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
        const scale = this.viewer.network.getScale();
        const collapseState = this.collapsedNodes.get(nodeId);
        
        if (!collapseState) return;

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
        
        // Fade to normal over 3 seconds
        const steps = 30;
        const stepDuration = 3000 / steps;
        
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
        
        this.viewer.nodes.update({
            id: nodeId,
            color: {
                background: colors.background,
                border: colors.border,
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
        
        // RGB values for interpolation
        const startBg = { r: 255, g: 215, b: 0 };
        const startBorder = { r: 245, g: 127, b: 23 };
        const startFont = { r: 0, g: 0, b: 0 };
        
        const endBg = this.hexToRgb(normalColors.background);
        const endBorder = this.hexToRgb(normalColors.border);
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

        const allEdges = this.viewer.originalData.edges.get();
        const nodesWithIncoming = new Set(allEdges.map(e => e.to));
        const allNodes = this.viewer.originalData.nodes.get();
        const entryFunctions = allNodes.filter(node => !nodesWithIncoming.has(node.id));
        const entryFunctionIds = new Set(entryFunctions.map(n => n.id));

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
        this.collapsedNodes.clear();
        this.viewer.hiddenNodes.clear();
        this.viewer.hiddenEdges.clear();
        this.lastActionNode = null;

        this.viewer.updateGraphVisibility();
        this.viewer.fitGraph();
    }
}

