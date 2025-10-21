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
        this.isLargeGraphFiltered = false;
        
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
            // OPTIMIZED FLOW:
            // 1. Parse DOT to raw data
            // 2. Calculate statistics on raw data
            // 3. Filter nodes BEFORE creating UI DataSets (performance!)
            // 4. Create UI DataSets with filtered data only
            // 5. Apply styling to filtered nodes
            // 6. Render graph (which applies package clustering to filtered nodes)
            
            const parsedData = vis.parseDOTNetwork(dotContent);
            
            // Store original data for reference
            this.originalData = {
                nodes: new vis.DataSet(parsedData.nodes),
                edges: new vis.DataSet(parsedData.edges)
            };

            Logger.info('CallGraphViewer', 'DOT file parsed successfully', { 
                nodeCount: parsedData.nodes.length, 
                edgeCount: parsedData.edges.length 
            });

            // Calculate chain statistics on raw data (before any filtering)
            this.calculateChainStatistics();
            
            // Get nodes with chain statistics from originalData
            // (parsedData.nodes doesn't have the statistics)
            const nodesWithStats = this.originalData.nodes.get();
            const edgesData = this.originalData.edges.get();
            
            // Determine which nodes/edges to show BEFORE creating UI DataSets
            let nodesToShow = nodesWithStats;
            let edgesToShow = edgesData;
            
            // Filter large graphs first (most impactful)
            if (nodesWithStats.length >= Constants.LARGE_GRAPH.NODE_THRESHOLD) {
                Logger.info('CallGraphViewer', 'Applying large graph filter', { nodeCount: nodesWithStats.length });
                const filtered = this.getFilteredGraphData(nodesWithStats, edgesData);
                nodesToShow = filtered.nodes;
                edgesToShow = filtered.edges;
                this.isLargeGraphFiltered = true;
                this.showLargeGraphWarning();
            } else {
                this.isLargeGraphFiltered = false;
                this.hideLargeGraphWarning();
            }
            
            // Filter isolated nodes if needed
            if (!this.showIsolatedNodes) {
                const allEdges = edgesToShow;
                nodesToShow = nodesToShow.filter(node => {
                    const hasIncoming = allEdges.some(e => e.to === node.id);
                    const hasOutgoing = allEdges.some(e => e.from === node.id);
                    return hasIncoming || hasOutgoing;
                });
            }
            
            // NOW create the UI DataSets with only the filtered nodes
            this.nodes = new vis.DataSet(nodesToShow);
            this.edges = new vis.DataSet(edgesToShow);
            
            // Apply styling to filtered nodes only
            this.applyDefaultStyling();
            
            this.renderGraph();
            this.updateStats();
        } catch (error) {
            Logger.error('CallGraphViewer', 'Error in parseDotFile', { 
                error: error.message,
                stack: error.stack,
                contentLength: dotContent.length 
            });
            ErrorHandler.handle(
                error,
                'CallGraphViewer.parseDotFile',
                'Failed to parse DOT file. Please check that the file is in valid DOT format.',
                { contentLength: dotContent.length, errorMessage: error.message }
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
            
            // Store in original data (always update originalData)
            this.originalData.nodes.update({
                id: node.id,
                longestIncomingChain: longestIncoming,
                longestOutgoingChain: longestOutgoing
            });
            
            // Update visible nodes if they exist (this.nodes may not be created yet during initial parse)
            if (this.nodes && this.nodes.get(node.id)) {
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

    // Returns filtered nodes and edges as plain arrays (for initial load)
    // Can work with raw arrays or DataSets
    getFilteredGraphData(nodesInput, edgesInput) {
        // If no parameters provided, use originalData (for reset operations)
        const allEdges = edgesInput || this.originalData.edges.get();
        const allNodes = nodesInput || this.originalData.nodes.get();

        // Find all root nodes (nodes with no incoming calls but have outgoing calls)
        const rootNodes = [];
        allNodes.forEach(node => {
            const hasIncoming = allEdges.some(e => e.to === node.id);
            const hasOutgoing = allEdges.some(e => e.from === node.id);
            
            if (!hasIncoming && hasOutgoing) {
                rootNodes.push(node.id);
            }
        });

        Logger.info('CallGraphViewer', 'Found root nodes', { 
            totalRoots: rootNodes.length 
        });

        // Take first 10 root nodes
        const selectedRoots = rootNodes.slice(0, Constants.LARGE_GRAPH.TOP_NODES_COUNT);

        // Find all nodes reachable from these root nodes (BFS)
        const visibleNodeIds = new Set();
        selectedRoots.forEach(rootId => {
            const queue = [rootId];
            visibleNodeIds.add(rootId);
            
            while (queue.length > 0) {
                const currentId = queue.shift();
                
                // Add all outgoing nodes
                allEdges.forEach(edge => {
                    if (edge.from === currentId && !visibleNodeIds.has(edge.to)) {
                        visibleNodeIds.add(edge.to);
                        queue.push(edge.to);
                    }
                });
            }
        });

        // Filter nodes and edges
        const filteredNodes = allNodes.filter(node => visibleNodeIds.has(node.id));
        const filteredEdges = allEdges.filter(edge => 
            visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)
        );

        // Track hidden nodes/edges for later operations
        this.hiddenNodes.clear();
        this.hiddenEdges.clear();
        
        allNodes.forEach(node => {
            if (!visibleNodeIds.has(node.id)) {
                this.hiddenNodes.add(node.id);
            }
        });

        allEdges.forEach(edge => {
            const edgeId = `${edge.from}-${edge.to}`;
            if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) {
                this.hiddenEdges.add(edgeId);
            }
        });

        Logger.info('CallGraphViewer', 'Large graph filtered', { 
            visibleNodes: filteredNodes.length,
            hiddenNodes: this.hiddenNodes.size,
            showingRoots: selectedRoots.length
        });

        return { nodes: filteredNodes, edges: filteredEdges };
    }

    // For reset operations (works with existing DataSets)
    filterLargeGraph() {
        Logger.info('CallGraphViewer', 'Filtering large graph for reset', { 
            totalNodes: this.originalData.nodes.length 
        });

        const filtered = this.getFilteredGraphData();
        
        this.isLargeGraphFiltered = true;
        this.showLargeGraphWarning();

        // Remove hidden nodes and edges from the DataSets
        const nodesToRemove = Array.from(this.hiddenNodes);
        if (nodesToRemove.length > 0) {
            this.nodes.remove(nodesToRemove);
        }

        // Remove hidden edges
        // Match edges by from-to, but remove by their DataSet ID
        const allVisEdges = this.edges.get();
        const edgesToRemove = allVisEdges
            .filter(edge => {
                const edgeId = `${edge.from}-${edge.to}`;
                return this.hiddenEdges.has(edgeId);
            })
            .map(edge => edge.id);
        
        if (edgesToRemove.length > 0) {
            this.edges.remove(edgesToRemove);
        }

        Logger.info('CallGraphViewer', 'Large graph filter applied to DataSets', { 
            visibleNodes: filtered.nodes.length,
            hiddenNodes: this.hiddenNodes.size
        });
    }

    showLargeGraphWarning() {
        const warning = document.getElementById('large-graph-warning');
        if (warning) {
            warning.style.display = 'flex';
            warning.classList.remove('fadeout');
            
            // Add window-level click handler to dismiss the warning
            const dismissHandler = (e) => {
                this.hideLargeGraphWarning();
                window.removeEventListener('click', dismissHandler);
            };
            
            // Use setTimeout to avoid immediate dismissal from the same click event
            setTimeout(() => {
                window.addEventListener('click', dismissHandler, { once: true });
            }, 100);
        }
    }

    hideLargeGraphWarning() {
        const warning = document.getElementById('large-graph-warning');
        if (warning) {
            warning.classList.add('fadeout');
            setTimeout(() => {
                warning.style.display = 'none';
                warning.classList.remove('fadeout');
            }, 300); // Match the CSS transition duration
        }
    }

    revealNodePath(nodeId) {
        if (!this.isLargeGraphFiltered) return;

        Logger.info('CallGraphViewer', 'Revealing node path', { nodeId });

        const allEdges = this.originalData.edges.get();
        
        // Find all nodes connected to this node (both incoming and outgoing)
        const nodesToReveal = new Set([nodeId]);
        const queue = [nodeId];
        
        // BFS to find all connected nodes
        while (queue.length > 0) {
            const currentId = queue.shift();
            
            allEdges.forEach(edge => {
                // Add outgoing connections
                if (edge.from === currentId && !nodesToReveal.has(edge.to)) {
                    nodesToReveal.add(edge.to);
                    queue.push(edge.to);
                }
                // Add incoming connections
                if (edge.to === currentId && !nodesToReveal.has(edge.from)) {
                    nodesToReveal.add(edge.from);
                    queue.push(edge.from);
                }
            });
        }

        // Remove nodes from hiddenNodes
        nodesToReveal.forEach(id => {
            this.hiddenNodes.delete(id);
        });

        // Update hidden edges
        allEdges.forEach(edge => {
            const edgeId = `${edge.from}-${edge.to}`;
            if (!this.hiddenNodes.has(edge.from) && !this.hiddenNodes.has(edge.to)) {
                this.hiddenEdges.delete(edgeId);
            }
        });

        // Re-render graph with new visibility
        this.updateGraphVisibility();
        this.updateStats();

        Logger.info('CallGraphViewer', 'Node path revealed', { 
            revealedCount: nodesToReveal.size 
        });
    }

    // Extract the package name (deepest folder) from a file path
    getFolderFromPath(filePath) {
        if (!filePath) return null;
        
        // Split by / or \
        const parts = filePath.split(/[/\\]/);
        
        // Get the package name (everything except the last part which is the filename)
        if (parts.length <= 1) return null;
        
        // Return the package name (second to last part)
        return parts[parts.length - 2];
    }

    // Generate a consistent color from a package name
    getFolderColor(folderName) {
        if (!folderName) return '#4a90e2'; // Default blue
        
        // Simple hash function to generate a number from the folder name
        let hash = 0;
        for (let i = 0; i < folderName.length; i++) {
            hash = folderName.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        // Generate HSL color (hue from hash, medium saturation and lightness for visibility)
        const hue = Math.abs(hash) % 360;
        const saturation = 65; // Medium saturation for good visibility
        const lightness = 45;  // Medium lightness for contrast
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    applyDefaultStyling() {
        const nodeDefaults = GraphConfig.getNodeDefaults();
        const edgeDefaults = GraphConfig.getEdgeDefaults();
        
        const packageColorMap = new Map();
        
        this.nodes.forEach((node) => {
            const styling = { ...nodeDefaults };
            
            // Apply package-based border color
            const filePath = node.file || node.path || node.filepath || node.location;
            const packageName = this.getFolderFromPath(filePath);
            
            if (packageName) {
                const color = this.getFolderColor(packageName);
                styling.color = {
                    ...nodeDefaults.color,
                    border: color
                };
                
                // Track unique packages for logging
                if (!packageColorMap.has(packageName)) {
                    packageColorMap.set(packageName, color);
                }
            }
            
            this.nodes.update({ id: node.id, ...styling });
        });

        this.edges.forEach((edge) => {
            this.edges.update({ id: edge.id, ...edgeDefaults });
        });
        
        if (packageColorMap.size > 0) {
            Logger.info('CallGraphViewer', 'Applied package-based colors', { 
                packageCount: packageColorMap.size,
                packages: Array.from(packageColorMap.keys())
            });
        }
    }

    // Calculate node depths within a package based on call graph
    // Depth 0 = root nodes (no incoming calls within package)
    // Depth increases as we go deeper into the call chain
    calculateNodeDepthsInPackage(nodes, edges) {
        const nodeIds = new Set(nodes.map(n => n.id));
        const depths = new Map();
        
        // Filter edges to only those within this package
        const internalEdges = edges.filter(e => nodeIds.has(e.from) && nodeIds.has(e.to));
        
        // Build adjacency list for BFS
        const incomingCount = new Map();
        const outgoing = new Map();
        
        nodes.forEach(node => {
            incomingCount.set(node.id, 0);
            outgoing.set(node.id, []);
        });
        
        internalEdges.forEach(edge => {
            incomingCount.set(edge.to, (incomingCount.get(edge.to) || 0) + 1);
            outgoing.get(edge.from).push(edge.to);
        });
        
        // BFS from root nodes (nodes with no incoming edges)
        const queue = [];
        nodes.forEach(node => {
            if (incomingCount.get(node.id) === 0) {
                queue.push({ id: node.id, depth: 0 });
                depths.set(node.id, 0);
            }
        });
        
        // Process queue
        while (queue.length > 0) {
            const { id, depth } = queue.shift();
            
            outgoing.get(id).forEach(targetId => {
                if (!depths.has(targetId) || depths.get(targetId) < depth + 1) {
                    depths.set(targetId, depth + 1);
                    queue.push({ id: targetId, depth: depth + 1 });
                }
            });
        }
        
        // Set depth for any unvisited nodes (cycles or disconnected)
        nodes.forEach(node => {
            if (!depths.has(node.id)) {
                depths.set(node.id, 0);
            }
        });
        
        return depths;
    }

    // Calculate package positions and cluster nodes by package
    // NOTE: This works on this.nodes (filtered DataSet), not this.originalData
    calculatePackageLevels() {
        const allNodes = this.nodes.get();  // FILTERED nodes only
        const allEdges = this.edges.get();  // FILTERED edges only
        
        Logger.debug('CallGraphViewer', 'Starting package clustering on filtered nodes', {
            nodeCount: allNodes.length,
            edgeCount: allEdges.length
        });
        
        // Build package dependency graph and group nodes
        const packageDeps = new Map(); // package -> Set of packages being called
        const packageNodes = new Map(); // package -> array of nodes
        
        // Group nodes by package
        allNodes.forEach(node => {
            const filePath = node.file || node.path || node.filepath || node.location;
            const packageName = this.getFolderFromPath(filePath) || 'unknown';
            
            if (!packageNodes.has(packageName)) {
                packageNodes.set(packageName, []);
                packageDeps.set(packageName, new Set());
            }
            packageNodes.get(packageName).push(node);
        });
        
        // Build package dependencies: A calls B means A depends on B, B should be RIGHT of A
        allEdges.forEach(edge => {
            const fromNode = allNodes.find(n => n.id === edge.from);
            const toNode = allNodes.find(n => n.id === edge.to);
            
            if (fromNode && toNode) {
                const fromPackage = this.getFolderFromPath(fromNode.file || fromNode.path || fromNode.filepath || fromNode.location) || 'unknown';
                const toPackage = this.getFolderFromPath(toNode.file || toNode.path || toNode.filepath || toNode.location) || 'unknown';
                
                // If different packages, fromPackage calls toPackage
                if (fromPackage !== toPackage) {
                    packageDeps.get(fromPackage).add(toPackage);
                }
            }
        });
        
        // Topological sort to determine package order (left to right)
        const packageOrder = [];
        const visited = new Set();
        const visiting = new Set();
        
        const visit = (pkg) => {
            if (visited.has(pkg)) return;
            if (visiting.has(pkg)) return; // Cycle detected, skip
            
            visiting.add(pkg);
            
            // Visit dependencies first (packages being called should be visited first, placed right)
            const deps = packageDeps.get(pkg) || new Set();
            deps.forEach(depPkg => {
                if (packageNodes.has(depPkg)) {
                    visit(depPkg);
                }
            });
            
            visiting.delete(pkg);
            visited.add(pkg);
            packageOrder.push(pkg); // This package goes LEFT of its dependencies
        };
        
        // Visit all packages
        packageNodes.forEach((nodes, pkg) => {
            visit(pkg);
        });
        
        // Reverse to get left-to-right order
        packageOrder.reverse();
        
        // Log package ordering for debugging
        Logger.info('CallGraphViewer', 'Initial package order (left to right)', { 
            packageOrder: packageOrder,
            dependencies: Array.from(packageDeps.entries()).map(([pkg, deps]) => ({
                package: pkg,
                callsPackages: Array.from(deps)
            }))
        });
        
        // Assign X positions to packages (clusters)
        const packageSpacing = 500; // Space between package cluster centers
        const nodeSpacing = 120; // Initial vertical spacing between nodes
        const nodeHorizontalSpacing = 80; // Horizontal spacing within package based on depth
        
        packageOrder.forEach((pkg, pkgIndex) => {
            const packageLeft = pkgIndex * packageSpacing;
            const nodes = packageNodes.get(pkg);
            
            // Calculate node depths within this package (left to right based on call graph)
            const nodeDepths = this.calculateNodeDepthsInPackage(nodes, allEdges);
            
            // Position nodes based on their depth within the package
            nodes.forEach((node) => {
                const depth = nodeDepths.get(node.id) || 0;
                const x = packageLeft + (depth * nodeHorizontalSpacing);
                const y = nodes.indexOf(node) * nodeSpacing;
                
                this.nodes.update({
                    id: node.id,
                    x: x,
                    y: y,
                    fixed: false, // Allow free movement - physics will arrange based on connections
                    level: pkgIndex // Use level to maintain package ordering
                });
            });
        });
    }

    renderGraph() {
        const container = document.getElementById('graph-canvas');
        const data = { nodes: this.nodes, edges: this.edges };
        
        // Use custom options with hierarchical repulsion to maintain package ordering
        const options = {
            ...GraphConfig.getOptions(),
            layout: {
                hierarchical: {
                    enabled: false // We set initial positions and levels manually
                }
            },
            physics: {
                enabled: true,
                solver: 'hierarchicalRepulsion', // Use hierarchical repulsion to respect levels
                hierarchicalRepulsion: {
                    centralGravity: 0.0,
                    springLength: 150,
                    springConstant: 0.02,
                    nodeDistance: 150,
                    damping: 0.09,
                    avoidOverlap: 0.8
                },
                stabilization: {
                    enabled: true,
                    iterations: 300
                }
            }
        };

        if (this.network) {
            this.network.destroy();
        }
        
        this.network = new vis.Network(container, data, options);
        
        // Calculate package-based clustering and positions after network creation
        this.calculatePackageLevels();

        this.network.once('stabilizationIterationsDone', () => {
            // Re-apply package positions after physics stabilization
            this.calculatePackageLevels();
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
        // Apply package clustering to visible nodes (same as initial render)
        const visibleNodes = this.nodes.get();
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
        
        // Build package dependency graph for visible nodes
        const packageDeps = new Map();
        const packageNodes = new Map();
        
        // Group visible nodes by package
        visibleNodes.forEach(node => {
            const filePath = node.file || node.path || node.filepath || node.location;
            const packageName = this.getFolderFromPath(filePath) || 'unknown';
            
            if (!packageNodes.has(packageName)) {
                packageNodes.set(packageName, []);
                packageDeps.set(packageName, new Set());
            }
            packageNodes.get(packageName).push(node);
        });
        
        // Build package dependencies from ORIGINAL edges (not just visible)
        // This ensures consistent package ordering based on the full graph structure
        const allOriginalEdges = this.originalData.edges.get();
        allOriginalEdges.forEach(edge => {
            // Only consider edges where both nodes are visible
            if (visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)) {
                const fromNode = visibleNodes.find(n => n.id === edge.from);
                const toNode = visibleNodes.find(n => n.id === edge.to);
                
                if (fromNode && toNode) {
                    const fromPackage = this.getFolderFromPath(fromNode.file || fromNode.path || fromNode.filepath || fromNode.location) || 'unknown';
                    const toPackage = this.getFolderFromPath(toNode.file || toNode.path || toNode.filepath || toNode.location) || 'unknown';
                    
                    if (fromPackage !== toPackage) {
                        packageDeps.get(fromPackage).add(toPackage);
                    }
                }
            }
        });
        
        // Topological sort for package order
        const packageOrder = [];
        const visited = new Set();
        const visiting = new Set();
        
        const visit = (pkg) => {
            if (visited.has(pkg)) return;
            if (visiting.has(pkg)) return;
            
            visiting.add(pkg);
            
            const deps = packageDeps.get(pkg) || new Set();
            deps.forEach(depPkg => {
                if (packageNodes.has(depPkg)) {
                    visit(depPkg);
                }
            });
            
            visiting.delete(pkg);
            visited.add(pkg);
            packageOrder.push(pkg);
        };
        
        packageNodes.forEach((nodes, pkg) => {
            visit(pkg);
        });
        
        packageOrder.reverse();
        
        // Log package ordering for debugging
        Logger.info('CallGraphViewer', 'Reorganize package order (left to right)', { 
            packageOrder: packageOrder,
            dependencies: Array.from(packageDeps.entries()).map(([pkg, deps]) => ({
                package: pkg,
                callsPackages: Array.from(deps)
            }))
        });
        
        // Position nodes in package clusters based on call depth
        const packageSpacing = 500;
        const nodeSpacing = 120;
        const nodeHorizontalSpacing = 80;
        
        packageOrder.forEach((pkg, pkgIndex) => {
            const packageLeft = pkgIndex * packageSpacing;
            const nodes = packageNodes.get(pkg);
            
            // Calculate node depths within this package (left to right based on call graph)
            const nodeDepths = this.calculateNodeDepthsInPackage(nodes, allOriginalEdges);
            
            // Position nodes based on their depth within the package
            nodes.forEach((node) => {
                const depth = nodeDepths.get(node.id) || 0;
                const x = packageLeft + (depth * nodeHorizontalSpacing);
                const y = nodes.indexOf(node) * nodeSpacing;
                
                this.nodes.update({
                    id: node.id,
                    x: x,
                    y: y,
                    fixed: false,
                    level: pkgIndex
                });
            });
        });
        
        // Apply physics for positioning within clusters (respects level for package ordering)
        this.network.setOptions({
            physics: {
                enabled: true,
                solver: 'hierarchicalRepulsion',
                hierarchicalRepulsion: {
                    centralGravity: 0.0,
                    springLength: 150,
                    springConstant: 0.02,
                    nodeDistance: 150,
                    damping: 0.09,
                    avoidOverlap: 0.8
                },
                stabilization: {
                    enabled: true,
                    iterations: 300
                }
            }
        });
        
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
                
                this.network.redraw();
                
                // Fit to view and select node
                setTimeout(() => {
                    this.network.selectNodes([nodeId]);
                    this.network.fit({
                        animation: {
                            duration: 500,
                            easingFunction: 'easeInOutQuad'
                        }
                    });
                }, 100);
            }, 100);
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
        }, 1500);
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
        
        // Apply package-based border color if not collapsed
        let borderColor = colors.border;
        if (!collapseState || (!collapseState.outgoing && !collapseState.incoming)) {
            const filePath = node.file || node.path || node.filepath || node.location;
            const packageName = this.getFolderFromPath(filePath);
            if (packageName) {
                borderColor = this.getFolderColor(packageName);
            }
        }
        
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
                border: borderColor,
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
        
        // Apply package-based border color for isolated nodes
        let borderColor = colors.border;
        const filePath = node.file || node.path || node.filepath || node.location;
        const packageName = this.getFolderFromPath(filePath);
        if (packageName) {
            borderColor = this.getFolderColor(packageName);
        }
        
        this.nodes.add({
            ...node,
            x: position.x,
            y: position.y,
            font: { size: 14, color: colors.fontColor },
            color: {
                background: colors.background,
                border: borderColor,
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

        // Apply large graph filtering if needed
        if (this.originalData.nodes.length >= Constants.LARGE_GRAPH.NODE_THRESHOLD) {
            this.filterLargeGraph();
        } else {
            this.isLargeGraphFiltered = false;
            this.hideLargeGraphWarning();
        }

        // Restore all nodes
        this.nodes.clear();
        this.edges.clear();

        this.originalData.nodes.forEach((node) => {
            if (this.hiddenNodes.has(node.id)) return;
            
            const originalPos = this.layoutManager.originalPositions.get(node.id);
            const nodeDefaults = GraphConfig.getNodeDefaults();
            
            // Apply package-based border color
            const filePath = node.file || node.path || node.filepath || node.location;
            const packageName = this.getFolderFromPath(filePath);
            let borderColor = nodeDefaults.color.border;
            
            if (packageName) {
                borderColor = this.getFolderColor(packageName);
            }
            
            this.nodes.add({
                ...node,
                ...nodeDefaults,
                color: {
                    ...nodeDefaults.color,
                    border: borderColor
                },
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
