// Main CallGraph Viewer - Composes all modules
import { DotParser } from './DotParser.js';
import { GraphConfig } from './GraphConfig.js';
import { NodeOperations } from './NodeOperations.js';
import { LayoutManager } from './LayoutManager.js';
import { SearchManager } from './SearchManager.js';
import { ExportManager } from './ExportManager.js';
import { UIManager } from './UIManager.js';
import { ErrorHandler } from './ErrorHandler.js';
import { Logger } from './Logger.js';
import { Constants } from './Constants.js';

export class CallGraphViewer {
    constructor() {
        // Core state
        this.network = null;
        this.nodes = null;
        this.edges = null;
        this.originalData = null;
        
        // Visibility state
        this.hiddenNodes = new Set();
        this.hiddenEdges = new Set();
        this.showIsolatedNodes = false;
        
        // Initialize all managers
        this.dotParser = new DotParser(this);
        this.nodeOps = new NodeOperations(this);
        this.layoutManager = new LayoutManager(this);
        this.searchManager = new SearchManager(this);
        this.exportManager = new ExportManager(this);
        this.uiManager = new UIManager(this);
        
        // Initialize UI
        this.uiManager.initializeEventListeners();
        this.uiManager.showHelpOverlay();
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.uiManager.hideHelpOverlay();
        document.getElementById('file-name').textContent = file.name;

        Logger.info('CallGraphViewer', 'Loading DOT file', { fileName: file.name, size: file.size });

        try {
            const content = await this.dotParser.readFile(file);
            this.parseDotFile(content);
        } catch (error) {
            ErrorHandler.handle(
                error,
                'CallGraphViewer.handleFileUpload',
                'Failed to read file. Please check that the file is accessible and try again.',
                { fileName: file.name }
            );
        }
    }

    async handleGenerateFromFolder() {
        try {
            if (!('showDirectoryPicker' in window)) {
                ErrorHandler.showNotification(
                    'Your browser does not support folder selection. Please use Chrome, Edge, or another Chromium-based browser.',
                    'warning'
                );
                return;
            }

            this.uiManager.hideHelpOverlay();

            const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
            document.getElementById('generate-status').textContent = 'Scanning folder...';
            document.getElementById('generate-status').textContent = `Analyzing: ${dirHandle.name}`;

            Logger.info('CallGraphViewer', 'Generating callgraph from folder', { folderName: dirHandle.name });

            const parser = new GoParser();
            const callGraph = await parser.parseDirectory(dirHandle);

            if (callGraph.functions.length === 0) {
                ErrorHandler.showNotification('No Go functions found in the selected folder.', 'warning');
                document.getElementById('generate-status').textContent = 'No functions found';
                return;
            }

            document.getElementById('generate-status').textContent = `Generating DOT for ${dirHandle.name}...`;
            const dotContent = parser.generateDOT(callGraph);
            document.getElementById('generate-status').textContent = `Generated: ${callGraph.functions.length} functions, ${callGraph.edges.length} calls`;

            Logger.info('CallGraphViewer', 'Callgraph generated successfully', { 
                functionCount: callGraph.functions.length, 
                edgeCount: callGraph.edges.length 
            });

            this.parseDotFile(dotContent);
        } catch (error) {
            if (error.name !== 'AbortError') {
                ErrorHandler.handle(
                    error,
                    'CallGraphViewer.handleGenerateFromFolder',
                    'Failed to generate callgraph from folder. Please check folder permissions and try again.',
                    { errorName: error.name }
                );
                document.getElementById('generate-status').textContent = 'Error generating DOT';
            }
        }
    }

    parseDotFile(dotContent) {
        Logger.debug('CallGraphViewer', 'Parsing DOT file', { contentLength: dotContent.length });

        try {
            const parsedData = vis.parseDOTNetwork(dotContent);
            
            this.originalData = {
                nodes: new vis.DataSet(parsedData.nodes),
                edges: new vis.DataSet(parsedData.edges)
            };

            this.nodes = new vis.DataSet(parsedData.nodes);
            this.edges = new vis.DataSet(parsedData.edges);

            Logger.info('CallGraphViewer', 'DOT file parsed successfully', { 
                nodeCount: parsedData.nodes.length, 
                edgeCount: parsedData.edges.length 
            });

            // Filter isolated nodes if needed
            if (!this.showIsolatedNodes) {
                this.filterIsolatedNodes();
            }

            // Apply default styling
            this.applyDefaultStyling();
            
            // Calculate chain statistics
            this.calculateChainStatistics();
            
            this.renderGraph();
            this.updateStats();
        } catch (error) {
            ErrorHandler.handle(
                error,
                'CallGraphViewer.parseDotFile',
                'Failed to parse DOT file. Please check that the file is in valid DOT format.',
                { contentLength: dotContent.length }
            );
        }
    }

    filterIsolatedNodes() {
        const allEdges = this.edges.get();
        const isolatedNodeIds = [];
        
        this.nodes.forEach(node => {
            const hasIncoming = allEdges.some(e => e.to === node.id);
            const hasOutgoing = allEdges.some(e => e.from === node.id);
            
            if (!hasIncoming && !hasOutgoing) {
                isolatedNodeIds.push(node.id);
            }
        });
        
        this.nodes.remove(isolatedNodeIds);
    }

    calculateChainStatistics() {
        if (!this.originalData) return;
        
        const allEdges = this.originalData.edges.get();
        const allNodes = this.originalData.nodes.get();
        
        // Build adjacency lists
        const incomingEdges = new Map(); // nodeId -> [sourceNodes]
        const outgoingEdges = new Map(); // nodeId -> [targetNodes]
        
        allNodes.forEach(node => {
            incomingEdges.set(node.id, []);
            outgoingEdges.set(node.id, []);
        });
        
        allEdges.forEach(edge => {
            if (outgoingEdges.has(edge.from)) {
                outgoingEdges.get(edge.from).push(edge.to);
            }
            if (incomingEdges.has(edge.to)) {
                incomingEdges.get(edge.to).push(edge.from);
            }
        });
        
        // Calculate longest chains for each node
        allNodes.forEach(node => {
            const longestIncoming = this.findLongestChain(node.id, incomingEdges, new Set());
            const longestOutgoing = this.findLongestChain(node.id, outgoingEdges, new Set());
            
            // Store in original data
            this.originalData.nodes.update({
                id: node.id,
                longestIncomingChain: longestIncoming,
                longestOutgoingChain: longestOutgoing
            });
            
            // Update visible nodes if they exist
            if (this.nodes.get(node.id)) {
                this.nodes.update({
                    id: node.id,
                    longestIncomingChain: longestIncoming,
                    longestOutgoingChain: longestOutgoing
                });
            }
        });
        
        Logger.info('CallGraphViewer', 'Chain statistics calculated');
    }

    findLongestChain(nodeId, edgeMap, visited) {
        if (visited.has(nodeId)) {
            return 0; // Cycle detection
        }
        
        const neighbors = edgeMap.get(nodeId) || [];
        
        if (neighbors.length === 0) {
            return 0;
        }
        
        visited.add(nodeId);
        
        let maxChain = 0;
        for (const neighbor of neighbors) {
            const chainLength = 1 + this.findLongestChain(neighbor, edgeMap, visited);
            maxChain = Math.max(maxChain, chainLength);
        }
        
        visited.delete(nodeId);
        
        return maxChain;
    }

    applyDefaultStyling() {
        const nodeDefaults = GraphConfig.getNodeDefaults();
        const edgeDefaults = GraphConfig.getEdgeDefaults();
        
        this.nodes.forEach((node) => {
            this.nodes.update({ id: node.id, ...nodeDefaults });
        });

        this.edges.forEach((edge) => {
            this.edges.update({ id: edge.id, ...edgeDefaults });
        });
    }

    renderGraph() {
        const container = document.getElementById('graph-canvas');
        const data = { nodes: this.nodes, edges: this.edges };
        const options = GraphConfig.getOptions();

        if (this.network) {
            this.network.destroy();
        }
        
        this.network = new vis.Network(container, data, options);

        this.network.once('stabilizationIterationsDone', () => {
            this.layoutManager.storeOriginalPositions();
        });

        this.setupNetworkEvents();
    }

    setupNetworkEvents() {
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.uiManager.showNodeDetails(nodeId);
            } else if (params.edges.length === 0) {
                this.network.unselectAll();
                this.uiManager.hideDetailPanel();
            }
        });

        this.network.on('doubleClick', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.nodeOps.toggleNodeCollapse(nodeId);
                this.updateStats();
            }
        });

        this.network.on('oncontext', (params) => {
            params.event.preventDefault();
            const nodeId = this.network.getNodeAt(params.pointer.DOM);
            if (nodeId) {
                this.uiManager.showContextMenu(params.event.pageX, params.event.pageY, nodeId);
            }
        });

        this.network.on('dragEnd', (params) => {
            if (params.nodes.length > 0) {
                this.network.storePositions();
            }
        });
    }

    hideOthers(nodeId) {
        Logger.debug('CallGraphViewer', 'Hiding other nodes', { targetNode: nodeId });

        this.hiddenNodes.clear();
        this.hiddenEdges.clear();
        
        const allEdges = this.originalData.edges.get();
        const reachableNodes = this.findReachableNodes(nodeId, allEdges);
        
        // Hide unreachable nodes
        const allNodes = this.originalData.nodes.get();
        allNodes.forEach(node => {
            if (!reachableNodes.has(node.id)) {
                this.hiddenNodes.add(node.id);
            }
        });
        
        // Also hide isolated nodes if setting dictates
        if (!this.showIsolatedNodes) {
            allNodes.forEach(node => {
                const isIsolated = !allEdges.some(edge => edge.from === node.id || edge.to === node.id);
                if (isIsolated && !this.hiddenNodes.has(node.id)) {
                    this.hiddenNodes.add(node.id);
                }
            });
        }
        
        // Hide edges not connecting visible nodes
        allEdges.forEach(edge => {
            if (!reachableNodes.has(edge.from) || !reachableNodes.has(edge.to)) {
                this.hiddenEdges.add(edge.id);
            }
        });
        
        this.updateGraphVisibility();
        this.nodeOps.updateNodeAppearance(nodeId);
        
        // Reorganize layout
        this.reorganizeLayout(nodeId);
    }

    findReachableNodes(startNode, allEdges) {
        const reachable = new Set([startNode]);
        
        // BFS outgoing
        const outgoingQueue = [startNode];
        const visitedOut = new Set([startNode]);
        
        while (outgoingQueue.length > 0) {
            const current = outgoingQueue.shift();
            allEdges.forEach(edge => {
                if (edge.from === current && !visitedOut.has(edge.to)) {
                    visitedOut.add(edge.to);
                    reachable.add(edge.to);
                    outgoingQueue.push(edge.to);
                }
            });
        }
        
        // BFS incoming
        const incomingQueue = [startNode];
        const visitedIn = new Set([startNode]);
        
        while (incomingQueue.length > 0) {
            const current = incomingQueue.shift();
            allEdges.forEach(edge => {
                if (edge.to === current && !visitedIn.has(edge.from)) {
                    visitedIn.add(edge.from);
                    reachable.add(edge.from);
                    incomingQueue.push(edge.from);
                }
            });
        }
        
        return reachable;
    }

    reorganizeLayout(nodeId) {
        // Step 1: Order nodes left-to-right based on levels
        const visibleNodeIds = this.nodes.get().map(n => n.id);
        const visibleEdges = this.edges.get();
        const nodeLevels = this.layoutManager.calculateNodeLevels(visibleNodeIds, visibleEdges);
        
        // Group by level
        const levelGroups = new Map();
        nodeLevels.forEach((level, id) => {
            if (!levelGroups.has(level)) {
                levelGroups.set(level, []);
            }
            levelGroups.get(level).push(id);
        });
        
        // Position nodes
        const levelSpacing = 200;
        const verticalSpacing = 150;
        
        this.nodes.get().forEach((node) => {
            const level = nodeLevels.get(node.id) || 0;
            const nodesInLevel = levelGroups.get(level) || [];
            const indexInLevel = nodesInLevel.indexOf(node.id);
            
            const x = level * levelSpacing;
            const y = indexInLevel * verticalSpacing - (nodesInLevel.length * verticalSpacing) / 2;
            
            this.nodes.update({ id: node.id, x, y });
        });
        
        // Step 2: Apply physics for compaction
        this.network.setOptions(GraphConfig.getCompactPhysicsOptions());
        
        const finishReorganization = () => {
            this.network.setOptions({ physics: { enabled: false } });
            
            setTimeout(() => {
                // Store final positions
                const allNodes = this.nodes.get();
                allNodes.forEach((node) => {
                    const position = this.network.getPositions([node.id])[node.id];
                    if (position) {
                        this.layoutManager.originalPositions.set(node.id, position);
                    }
                });
                
                // Enable free movement
                allNodes.forEach((node) => {
                    this.nodes.update({
                        id: node.id,
                        fixed: { x: false, y: false },
                        physics: false
                    });
                });
                
                this.network.redraw();
                this.layoutManager.fixHorizontalOverlaps();
                
                // Step 3: Fit to view and select node
                setTimeout(() => {
                    this.network.selectNodes([nodeId]);
                    this.network.fit({
                        animation: {
                            duration: 500,
                            easingFunction: 'easeInOutQuad'
                        }
                    });
                }, 300);
            }, 200);
        };
        
        let stabilizationHandled = false;
        
        this.network.once('stabilizationIterationsDone', () => {
            if (!stabilizationHandled) {
                stabilizationHandled = true;
                finishReorganization();
            }
        });
        
        setTimeout(() => {
            if (!stabilizationHandled) {
                stabilizationHandled = true;
                finishReorganization();
            }
        }, 5);
    }

    updateGraphVisibility() {
        // Store current positions
        const currentPositions = {};
        this.nodes.forEach((node) => {
            const pos = this.network.getPositions([node.id])[node.id];
            if (pos) {
                currentPositions[node.id] = pos;
            }
        });
        
        const allEdges = this.originalData.edges.get();
        const isIsolated = (nodeId) => {
            return !allEdges.some(edge => edge.from === nodeId || edge.to === nodeId);
        };
        
        // Filter visible nodes
        const visibleNodes = this.originalData.nodes.get({
            filter: (node) => {
                if (this.hiddenNodes.has(node.id)) return false;
                if (!this.showIsolatedNodes && isIsolated(node.id)) return false;
                return true;
            }
        });

        // Filter visible edges
        const visibleEdges = this.originalData.edges.get({
            filter: (edge) => !this.hiddenEdges.has(edge.id) && 
                              !this.hiddenNodes.has(edge.from) && 
                              !this.hiddenNodes.has(edge.to)
        });

        this.nodes.clear();
        this.edges.clear();
        
        // Separate isolated and connected nodes
        const connectedNodes = [];
        const isolatedNodes = [];
        
        visibleNodes.forEach((node) => {
            if (isIsolated(node.id)) {
                isolatedNodes.push(node);
            } else {
                connectedNodes.push(node);
            }
        });
        
        // Add connected nodes
        connectedNodes.forEach((node) => {
            this.addStyledNode(node, currentPositions[node.id]);
        });
        
        // Position and add isolated nodes
        if (isolatedNodes.length > 0) {
            const isolatedPositions = this.layoutManager.positionIsolatedNodes(isolatedNodes, connectedNodes);
            isolatedNodes.forEach((node, index) => {
                this.addIsolatedNode(node, isolatedPositions[index]);
            });
        }

        // Add edges
        visibleEdges.forEach((edge) => {
            this.edges.add({
                ...edge,
                ...GraphConfig.getEdgeDefaults()
            });
        });
        
        // Ensure free movement
        this.network.setOptions({ 
            physics: { enabled: false },
            layout: { hierarchical: { enabled: false } }
        });
        
        const allNodes = this.nodes.get();
        allNodes.forEach((node) => {
            this.nodes.update({
                id: node.id,
                fixed: { x: false, y: false },
                physics: false
            });
        });
        
        this.network.redraw();
    }

    addStyledNode(node, position) {
        const collapseState = this.nodeOps.collapsedNodes.get(node.id);
        const colors = GraphConfig.getNodeColors(collapseState);
        
        const pos = position || this.layoutManager.originalPositions.get(node.id) || {};
        
        this.nodes.add({
            ...node,
            x: pos.x,
            y: pos.y,
            font: { 
                size: 14, 
                color: colors.fontColor,
                bold: !!collapseState
            },
            color: {
                background: colors.background,
                border: colors.border,
                highlight: {
                    background: colors.highlightBg,
                    border: colors.highlightBorder
                }
            },
            borderWidth: 2,
            shape: 'box',
            margin: 10,
            widthConstraint: { minimum: 100, maximum: 200 },
            shapeProperties: colors.borderDashes ? { borderDashes: colors.borderDashes } : { borderDashes: false }
        });
    }

    addIsolatedNode(node, position) {
        const colors = GraphConfig.getIsolatedNodeColors();
        
        this.nodes.add({
            ...node,
            x: position.x,
            y: position.y,
            font: { size: 14, color: colors.fontColor },
            color: {
                background: colors.background,
                border: colors.border,
                highlight: {
                    background: colors.highlightBg,
                    border: colors.highlightBorder
                }
            },
            borderWidth: 1,
            shape: 'box',
            margin: 10,
            widthConstraint: { minimum: 100, maximum: 200 }
        });
    }

    toggleIsolatedNodes() {
        if (!this.network || !this.originalData) return;

        this.showIsolatedNodes = !this.showIsolatedNodes;

        const button = document.getElementById('toggle-isolated-button');
        if (this.showIsolatedNodes) {
            button.classList.add('btn-primary');
            button.classList.remove('btn-secondary');
            button.title = 'Hide Isolated Nodes';
        } else {
            button.classList.remove('btn-primary');
            button.classList.add('btn-secondary');
            button.title = 'Show Isolated Nodes';
        }

        this.updateGraphVisibility();
        this.fitGraph();
    }

    resetLayout() {
        if (!this.network || !this.originalData) return;

        Logger.info('CallGraphViewer', 'Resetting layout');

        this.nodeOps.collapsedNodes.clear();
        this.hiddenNodes.clear();
        this.hiddenEdges.clear();

        // Re-hide isolated nodes if setting dictates
        if (!this.showIsolatedNodes) {
            const allEdges = this.originalData.edges.get();
            this.originalData.nodes.forEach((node) => {
                const isIsolated = !allEdges.some(edge => edge.from === node.id || edge.to === node.id);
                if (isIsolated) {
                    this.hiddenNodes.add(node.id);
                }
            });
        }

        // Restore all nodes
        this.nodes.clear();
        this.edges.clear();

        this.originalData.nodes.forEach((node) => {
            if (this.hiddenNodes.has(node.id)) return;
            
            const originalPos = this.layoutManager.originalPositions.get(node.id);
            
            this.nodes.add({
                ...node,
                ...GraphConfig.getNodeDefaults(),
                x: originalPos?.x,
                y: originalPos?.y,
                fixed: { x: false, y: false },
                physics: false
            });
        });

        this.originalData.edges.forEach((edge) => {
            this.edges.add({
                ...edge,
                ...GraphConfig.getEdgeDefaults()
            });
        });

        this.network.setOptions({
            physics: { enabled: false },
            layout: { hierarchical: { enabled: false } }
        });
        
        this.network.redraw();
        this.layoutManager.fixHorizontalOverlaps();
        this.fitGraph();
        this.updateStats();
    }

    fitGraph() {
        if (this.network) {
            this.network.fit({
                animation: {
                    duration: 500,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }
    }

    zoomToText() {
        if (!this.network) {
            ErrorHandler.showNotification('No graph loaded. Please load a DOT file first.', 'info');
            return;
        }

        const minTextSize = Constants.SEARCH.MIN_TEXT_SIZE_PX;
        const nodeFontSize = Constants.SEARCH.NODE_FONT_SIZE_PX;
        const targetScale = minTextSize / nodeFontSize;

        const viewPosition = this.network.getViewPosition();

        this.network.moveTo({
            position: viewPosition,
            scale: targetScale,
            animation: {
                duration: Constants.TIMING.ANIMATION_DURATION_MS,
                easingFunction: 'easeInOutQuad'
            }
        });

        Logger.debug('CallGraphViewer', 'Zoomed to text', { targetScale });
    }

    updateStats() {
        const nodeCount = this.nodes ? this.nodes.length : 0;
        const edgeCount = this.edges ? this.edges.length : 0;

        document.getElementById('node-count').textContent = nodeCount;
        document.getElementById('edge-count').textContent = edgeCount;
    }
}
