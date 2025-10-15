// Callgraph Viewer Application
// Main application logic for interactive DOT file visualization

class CallgraphViewer {
    constructor() {
        this.network = null;
        this.nodes = null;
        this.edges = null;
        this.collapsedNodes = new Map(); // nodeId -> {outgoing: bool, incoming: bool}
        this.hiddenNodes = new Set();
        this.hiddenEdges = new Set();
        this.originalPositions = new Map();
        this.contextMenuNode = null;
        this.lastActionNode = null; // Track last interacted node for highlighting
        this.flashTimeouts = new Map(); // Track flash animation timeouts
        this.showIsolatedNodes = false; // By default, hide isolated nodes (nodes with no connections)
        
        this.initializeEventListeners();
        this.createContextMenu();
        this.showHelpOverlay();
    }

    initializeEventListeners() {
        // File input
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Generate from folder button
        document.getElementById('generate-button').addEventListener('click', () => this.handleGenerateFromFolder());

        // Control buttons
        document.getElementById('collapse-all-button').addEventListener('click', () => this.collapseAllNodes());
        document.getElementById('expand-all-button').addEventListener('click', () => this.expandAllNodes());
        document.getElementById('toggle-isolated-button').addEventListener('click', () => this.toggleIsolatedNodes());
        document.getElementById('help-button').addEventListener('click', () => this.toggleHelpOverlay());
        document.getElementById('fit-button').addEventListener('click', () => this.fitGraph());
        document.getElementById('zoom-text-button').addEventListener('click', () => this.zoomToText());
        document.getElementById('reset-button').addEventListener('click', () => this.resetLayout());
        document.getElementById('export-button').addEventListener('click', () => this.exportGraph());
        
        // Search input
        document.getElementById('node-search').addEventListener('input', (e) => this.searchNode(e.target.value));
        
        // Search input - Enter key to hide others
        document.getElementById('node-search').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value;
                const matchedNode = this.findMatchingNode(query);
                if (matchedNode) {
                    this.lastActionNode = matchedNode.id;
                    this.hideOthers(matchedNode.id);
                    this.updateStats();
                }
            }
        });

        // Help overlay
        document.getElementById('close-help').addEventListener('click', () => this.hideHelpOverlay());
        
        // Close help overlay when clicking outside the modal content
        document.getElementById('help-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'help-overlay') {
                this.hideHelpOverlay();
            }
        });
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts if user is typing in an input field (except Escape)
            if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.key !== 'Escape' && e.key !== 'Esc') {
                return;
            }
            
            // Close help overlay with Esc key
            if (e.key === 'Escape' || e.key === 'Esc') {
                const overlay = document.getElementById('help-overlay');
                if (overlay && !overlay.classList.contains('hidden')) {
                    this.hideHelpOverlay();
                }
            }
            
            // Hide others with 'H' key
            if (e.key === 'h' || e.key === 'H') {
                if (this.network) {
                    const selectedNodes = this.network.getSelectedNodes();
                    if (selectedNodes.length === 1) {
                        // Only works with single node selection
                        this.lastActionNode = selectedNodes[0];
                        this.hideOthers(selectedNodes[0]);
                        this.updateStats();
                    }
                }
            }
            
            // Reset layout with 'R' key
            if (e.key === 'r' || e.key === 'R') {
                // Clear search field when resetting
                const searchInput = document.getElementById('node-search');
                if (searchInput) {
                    searchInput.value = '';
                }
                this.resetLayout();
            }
        });

        // Detail panel
        document.getElementById('close-detail').addEventListener('click', () => this.hideDetailPanel());

        // Context menu - close on click outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('context-menu');
            if (menu && !menu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    }

    showHelpOverlay() {
        const overlay = document.getElementById('help-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            // Force a reflow to ensure the change takes effect
            void overlay.offsetWidth;
        } else {
            console.error('Help overlay element not found');
        }
    }

    hideHelpOverlay() {
        const overlay = document.getElementById('help-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        } else {
            console.error('Help overlay element not found');
        }
    }

    toggleHelpOverlay() {
        const overlay = document.getElementById('help-overlay');
        if (overlay) {
            if (overlay.classList.contains('hidden')) {
                this.showHelpOverlay();
            } else {
                this.hideHelpOverlay();
            }
        }
    }

    hideDetailPanel() {
        document.getElementById('detail-panel').classList.remove('active');
    }

    createContextMenu() {
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'context-menu';
        // Initial template (will be dynamically updated in showContextMenu)
        menu.innerHTML = `
            <div class="context-menu-item" data-action="collapse-outgoing">
                <i class="fas fa-arrow-down"></i> Collapse Outgoing Calls
            </div>
            <div class="context-menu-item" data-action="collapse-incoming">
                <i class="fas fa-arrow-up"></i> Collapse Incoming Calls
            </div>
            <div class="context-menu-item" data-action="collapse-all">
                <i class="fas fa-compress"></i> Collapse All Connections
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="expand-all">
                <i class="fas fa-expand"></i> Expand All
            </div>
            <div class="context-menu-item" data-action="expand-outgoing">
                <i class="fas fa-arrow-down"></i> Expand Outgoing Calls
            </div>
            <div class="context-menu-item" data-action="expand-incoming">
                <i class="fas fa-arrow-up"></i> Expand Incoming Calls
            </div>
        `;
        document.body.appendChild(menu);

        // Add click handlers for menu items
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            });
        });
    }

    showContextMenu(x, y, nodeId) {
        this.contextMenuNode = nodeId;
        const menu = document.getElementById('context-menu');
        
        // Get current collapse state
        const collapseState = this.collapsedNodes.get(nodeId) || { outgoing: false, incoming: false };
        
        // Check if node has outgoing and incoming connections
        // Use the ORIGINAL edges to check all possible connections (not the filtered ones)
        const allEdges = this.originalData && this.originalData.edges ? this.originalData.edges.get() : [];
        const hasOutgoing = allEdges.some(edge => edge.from === nodeId);
        const hasIncoming = allEdges.some(edge => edge.to === nodeId);
        
        // Build menu dynamically based on state and available connections
        let menuItems = [];
        
        // Collapse options (only show if not already collapsed AND connections exist)
        if (!collapseState.outgoing && hasOutgoing) {
            menuItems.push('<div class="context-menu-item" data-action="collapse-outgoing"><i class="fas fa-arrow-down"></i> Collapse Outgoing Calls</div>');
        }
        if (!collapseState.incoming && hasIncoming) {
            menuItems.push('<div class="context-menu-item" data-action="collapse-incoming"><i class="fas fa-arrow-up"></i> Collapse Incoming Calls</div>');
        }
        if ((!collapseState.outgoing && hasOutgoing) || (!collapseState.incoming && hasIncoming)) {
            menuItems.push('<div class="context-menu-item" data-action="collapse-all"><i class="fas fa-compress"></i> Collapse All Connections</div>');
        }
        
        // Separator if we have both collapse and expand options
        const hasCollapseOptions = menuItems.length > 0;
        const hasExpandOptions = (collapseState.outgoing && hasOutgoing) || (collapseState.incoming && hasIncoming);
        if (hasCollapseOptions && hasExpandOptions) {
            menuItems.push('<div class="context-menu-separator"></div>');
        }
        
        // Expand options (only show if something is collapsed AND those connections exist)
        if ((collapseState.outgoing && hasOutgoing) || (collapseState.incoming && hasIncoming)) {
            menuItems.push('<div class="context-menu-item" data-action="expand-all"><i class="fas fa-expand"></i> Expand All</div>');
        }
        if (collapseState.outgoing && hasOutgoing) {
            menuItems.push('<div class="context-menu-item" data-action="expand-outgoing"><i class="fas fa-arrow-down"></i> Expand Outgoing Calls</div>');
        }
        if (collapseState.incoming && hasIncoming) {
            menuItems.push('<div class="context-menu-item" data-action="expand-incoming"><i class="fas fa-arrow-up"></i> Expand Incoming Calls</div>');
        }
        
        // If no menu items, show "No Connections" message
        if (menuItems.length === 0) {
            menuItems.push('<div class="context-menu-item" style="color: #9ca3af; cursor: default; pointer-events: none;"><i class="fas fa-ban"></i> No Connections</div>');
        }
        
        // Add separator and "Hide others" option
        if (menuItems.length > 0 && menuItems[menuItems.length - 1].indexOf('No Connections') === -1) {
            menuItems.push('<div class="context-menu-separator"></div>');
        }
        menuItems.push('<div class="context-menu-item" data-action="hide-others"><i class="fas fa-eye-slash"></i> Hide Others</div>');
        
        // Update menu content
        menu.innerHTML = menuItems.join('');
        
        // Re-attach event listeners
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.handleContextMenuAction(action);
                this.hideContextMenu();
            });
        });
        
        menu.style.display = 'block';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    }

    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu) {
            menu.style.display = 'none';
        }
        this.contextMenuNode = null;
    }

    handleContextMenuAction(action) {
        if (!this.contextMenuNode) return;

        const nodeId = this.contextMenuNode;
        this.lastActionNode = nodeId; // Track the node we're acting on
        
        switch (action) {
            case 'collapse-outgoing':
                this.collapseNode(nodeId, 'outgoing');
                break;
            case 'collapse-incoming':
                this.collapseNode(nodeId, 'incoming');
                break;
            case 'collapse-all':
                this.collapseNode(nodeId, 'both');
                break;
            case 'expand-all':
                this.expandNode(nodeId, 'both');
                break;
            case 'expand-outgoing':
                this.expandNode(nodeId, 'outgoing');
                break;
            case 'expand-incoming':
                this.expandNode(nodeId, 'incoming');
                break;
            case 'hide-others':
                this.hideOthers(nodeId);
                break;
        }
        
        this.updateStats();
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Hide help overlay when loading a file
        this.hideHelpOverlay();

        document.getElementById('file-name').textContent = file.name;

        try {
            const content = await this.readFile(file);
            this.parseDotFile(content);
        } catch (error) {
            alert(`Error reading file: ${error.message}`);
            console.error(error);
        }
    }

    async handleGenerateFromFolder() {
        try {
            // Check if File System Access API is supported
            if (!('showDirectoryPicker' in window)) {
                alert('Your browser does not support folder selection. Please use Chrome, Edge, or another Chromium-based browser.');
                return;
            }

            // Hide help overlay
            this.hideHelpOverlay();

            // Prompt user to select a directory (show picker first)
            const dirHandle = await window.showDirectoryPicker({
                mode: 'read'
            });

            // Only update status if user actually selected something
            document.getElementById('generate-status').textContent = 'Scanning folder...';
            
            document.getElementById('generate-status').textContent = `Analyzing: ${dirHandle.name}`;

            // Create parser and parse the directory
            const parser = new GoParser();
            const callGraph = await parser.parseDirectory(dirHandle);

            if (callGraph.functions.length === 0) {
                alert('No Go functions found in the selected folder.');
                document.getElementById('generate-status').textContent = 'No functions found';
                return;
            }

            document.getElementById('generate-status').textContent = `Generating DOT for ${dirHandle.name}...`;

            // Generate DOT format
            const dotContent = parser.generateDOT(callGraph);

            // Update UI
            document.getElementById('generate-status').textContent = `Generated: ${callGraph.functions.length} functions, ${callGraph.edges.length} calls`;

            // Parse and display the generated DOT
            this.parseDotFile(dotContent);

        } catch (error) {
            if (error.name === 'AbortError') {
                // User cancelled the picker - keep the previous value
            } else {
                console.error('Error generating callgraph:', error);
                alert(`Error: ${error.message}`);
                document.getElementById('generate-status').textContent = 'Error generating DOT';
            }
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    parseDotFile(dotContent) {
        try {
            // Use vis.js DOT parser
            const parsedData = vis.parseDOTNetwork(dotContent);
            
            // Store original data
            this.originalData = {
                nodes: new vis.DataSet(parsedData.nodes),
                edges: new vis.DataSet(parsedData.edges)
            };

            // Create working copies
            this.nodes = new vis.DataSet(parsedData.nodes);
            this.edges = new vis.DataSet(parsedData.edges);

            // Filter isolated nodes if needed
            if (!this.showIsolatedNodes) {
                const allEdges = this.edges.get();
                const isolatedNodeIds = [];
                
                this.nodes.forEach(node => {
                    const hasIncoming = allEdges.some(e => e.to === node.id);
                    const hasOutgoing = allEdges.some(e => e.from === node.id);
                    
                    if (!hasIncoming && !hasOutgoing) {
                        isolatedNodeIds.push(node.id);
                    }
                });
                
                // Remove isolated nodes
                this.nodes.remove(isolatedNodeIds);
            }

            // Enhance node styling
            this.nodes.forEach((node) => {
                this.nodes.update({
                    id: node.id,
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
                });
            });

            // Enhance edge styling
            this.edges.forEach((edge) => {
                this.edges.update({
                    id: edge.id,
                    arrows: { to: { enabled: true, scaleFactor: 0.8 } },
                    color: { color: '#94a3b8', highlight: '#4f46e5' },
                    width: 2,
                    smooth: { type: 'cubicBezier', roundness: 0.2 }
                });
            });

            this.renderGraph();
            this.updateStats();
        } catch (error) {
            alert(`Error parsing DOT file: ${error.message}`);
            console.error(error);
        }
    }

    renderGraph() {
        const container = document.getElementById('graph-canvas');
        
        const data = {
            nodes: this.nodes,
            edges: this.edges
        };

        const options = {
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
                physics: false  // Edges don't affect node positions
            }
        };

        // Create network
        if (this.network) {
            this.network.destroy();
        }
        
        this.network = new vis.Network(container, data, options);

        // Store original positions after stabilization
        this.network.once('stabilizationIterationsDone', () => {
            this.storeOriginalPositions();
        });

        // Set up event handlers
        this.setupNetworkEvents();
    }

    storeOriginalPositions() {
        this.originalPositions.clear();
        this.nodes.forEach((node) => {
            const position = this.network.getPositions([node.id])[node.id];
            this.originalPositions.set(node.id, { x: position.x, y: position.y });
        });
        
        // Disable physics and hierarchical constraints after initial layout
        // This allows free movement in both X and Y directions
        this.network.setOptions({ 
            physics: { enabled: false },
            layout: { hierarchical: { enabled: false } }
        });
        
        // Remove any hierarchical constraints from nodes to allow free X movement
        this.nodes.forEach((node) => {
            this.nodes.update({
                id: node.id,
                fixed: false  // Ensure nodes can move freely in all directions
            });
        });
    }

    setupNetworkEvents() {
        // Single click - show details or deselect
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.showNodeDetails(nodeId);
            } else if (params.edges.length === 0) {
                // Clicked on canvas (not on nodes or edges) - deselect all
                this.network.unselectAll();
                this.hideDetailPanel();
            }
        });

        // Double click - collapse/expand all (default behavior)
        this.network.on('doubleClick', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.toggleNodeCollapse(nodeId);
            }
        });

        // Right click - show context menu
        this.network.on('oncontext', (params) => {
            params.event.preventDefault();
            const nodeId = this.network.getNodeAt(params.pointer.DOM);
            if (nodeId) {
                this.showContextMenu(params.event.pageX, params.event.pageY, nodeId);
            }
        });

        // Update position when dragging ends
        this.network.on('dragEnd', (params) => {
            if (params.nodes.length > 0) {
                this.network.storePositions();
            }
        });
    }

    showNodeDetails(nodeId) {
        const node = this.nodes.get(nodeId);
        const detailPanel = document.getElementById('detail-panel');
        const detailContent = document.getElementById('detail-content');

        // Get connected edges
        const connectedEdges = this.edges.get({
            filter: (edge) => edge.from === nodeId || edge.to === nodeId
        });

        const incomingCalls = connectedEdges.filter(e => e.to === nodeId).length;
        const outgoingCalls = connectedEdges.filter(e => e.from === nodeId).length;

        const collapseState = this.collapsedNodes.get(nodeId);
        let statusText = 'Expanded';
        if (collapseState) {
            if (collapseState.outgoing && collapseState.incoming) {
                statusText = 'Collapsed (All)';
            } else if (collapseState.outgoing) {
                statusText = 'Collapsed (Outgoing)';
            } else if (collapseState.incoming) {
                statusText = 'Collapsed (Incoming)';
            }
        }

        let html = `
            <div class="property">
                <span class="property-label">Node ID:</span>
                <div class="property-value">${nodeId}</div>
            </div>
            <div class="property">
                <span class="property-label">Label:</span>
                <div class="property-value">${node.label || nodeId}</div>
            </div>
            <div class="property">
                <span class="property-label">Incoming Calls:</span>
                <div class="property-value">${incomingCalls}</div>
            </div>
            <div class="property">
                <span class="property-label">Outgoing Calls:</span>
                <div class="property-value">${outgoingCalls}</div>
            </div>
            <div class="property">
                <span class="property-label">Status:</span>
                <div class="property-value">${statusText}</div>
            </div>
        `;

        // Add any custom attributes from the DOT file
        Object.keys(node).forEach((key) => {
            if (!['id', 'label', 'x', 'y', 'font', 'color', 'shape', 'margin', 'widthConstraint', 'borderWidth'].includes(key)) {
                html += `
                    <div class="property">
                        <span class="property-label">${key}:</span>
                        <div class="property-value">${node[key]}</div>
                    </div>
                `;
            }
        });

        detailContent.innerHTML = html;
        detailPanel.classList.add('active');
    }

    toggleNodeCollapse(nodeId) {
        this.lastActionNode = nodeId; // Track the node we're acting on
        if (this.collapsedNodes.has(nodeId)) {
            this.expandNode(nodeId, 'both');
        } else {
            this.collapseNode(nodeId, 'both');
        }
        this.updateStats();
    }

    collapseNode(nodeId, mode = 'both') {
        // mode can be: 'outgoing', 'incoming', or 'both'
        
        // Store current view position before collapse
        const viewPosition = this.network.getViewPosition();
        const scale = this.network.getScale();
        
        // Get or create collapse state
        let collapseState = this.collapsedNodes.get(nodeId) || { outgoing: false, incoming: false };
        
        if (mode === 'outgoing' || mode === 'both') {
            collapseState.outgoing = true;
        }
        if (mode === 'incoming' || mode === 'both') {
            collapseState.incoming = true;
        }
        
        this.collapsedNodes.set(nodeId, collapseState);

        // Find all connected nodes and edges
        const connectedEdges = this.originalData.edges.get({
            filter: (edge) => edge.from === nodeId || edge.to === nodeId
        });

        const outgoingNodeIds = new Set();
        const incomingNodeIds = new Set();
        
        connectedEdges.forEach((edge) => {
            if (edge.from === nodeId && collapseState.outgoing) {
                outgoingNodeIds.add(edge.to);
                this.hiddenEdges.add(edge.id);
            }
            if (edge.to === nodeId && collapseState.incoming) {
                incomingNodeIds.add(edge.from);
                this.hiddenEdges.add(edge.id);
            }
        });

        const affectedNodeIds = new Set([...outgoingNodeIds, ...incomingNodeIds]);

        // Hide affected nodes and their edges
        affectedNodeIds.forEach((id) => {
            // Only hide if not already collapsed or being used by another collapsed node
            if (!this.isNodeReferenced(id)) {
                this.hiddenNodes.add(id);
                
                // Find edges connected to this node
                const nodeEdges = this.originalData.edges.get({
                    filter: (edge) => edge.from === id || edge.to === id
                });
                
                nodeEdges.forEach((edge) => {
                    this.hiddenEdges.add(edge.id);
                });
            }
        });

        this.updateGraphVisibility();
        this.updateNodeAppearance(nodeId);
        
        // Center on the node that was acted upon with smooth animation
        this.network.focus(nodeId, {
            scale: scale,
            animation: {
                duration: 300,
                easingFunction: 'easeInOutQuad'
            }
        });
    }

    isNodeReferenced(nodeId) {
        // Check if this node should remain visible because it's referenced by other visible nodes
        const edges = this.originalData.edges.get({
            filter: (edge) => (edge.from === nodeId || edge.to === nodeId)
        });

        for (const edge of edges) {
            const otherNode = edge.from === nodeId ? edge.to : edge.from;
            const collapseState = this.collapsedNodes.get(otherNode);
            
            // If the other node is not collapsed or this connection is not collapsed, keep visible
            if (!collapseState) {
                if (!this.hiddenNodes.has(otherNode)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    expandNode(nodeId, mode = 'both') {
        // mode can be: 'outgoing', 'incoming', or 'both'
        
        // Store current view position before expand
        const viewPosition = this.network.getViewPosition();
        const scale = this.network.getScale();
        
        const collapseState = this.collapsedNodes.get(nodeId);
        
        if (!collapseState) {
            // Nothing to expand
            return;
        }

        // Update collapse state
        if (mode === 'outgoing' || mode === 'both') {
            collapseState.outgoing = false;
        }
        if (mode === 'incoming' || mode === 'both') {
            collapseState.incoming = false;
        }

        // If both are now false, remove from map entirely
        if (!collapseState.outgoing && !collapseState.incoming) {
            this.collapsedNodes.delete(nodeId);
        } else {
            this.collapsedNodes.set(nodeId, collapseState);
        }

        // Find all nodes that were hidden when this node was collapsed
        const connectedEdges = this.originalData.edges.get({
            filter: (edge) => edge.from === nodeId || edge.to === nodeId
        });

        const outgoingNodeIds = new Set();
        const incomingNodeIds = new Set();
        
        connectedEdges.forEach((edge) => {
            if (edge.from === nodeId && (mode === 'outgoing' || mode === 'both')) {
                outgoingNodeIds.add(edge.to);
                this.hiddenEdges.delete(edge.id);
            }
            if (edge.to === nodeId && (mode === 'incoming' || mode === 'both')) {
                incomingNodeIds.add(edge.from);
                this.hiddenEdges.delete(edge.id);
            }
        });

        // Show previously hidden nodes (if they're not hidden by other collapses)
        // For outgoing nodes: auto-collapse their outgoing calls for step-by-step exploration
        outgoingNodeIds.forEach((id) => {
            if (!this.isNodeCollapsedByOthers(id)) {
                this.hiddenNodes.delete(id);
                
                // Automatically collapse outgoing calls for newly revealed child nodes
                // This creates a step-by-step exploration experience
                if (!this.collapsedNodes.has(id)) {
                    const allEdges = this.originalData.edges.get();
                    const hasOutgoing = allEdges.some(e => e.from === id);
                    
                    if (hasOutgoing) {
                        this.collapsedNodes.set(id, {
                            outgoing: true,
                            incoming: false
                        });
                    }
                }
                
                // Show edges for this node if appropriate
                const nodeEdges = this.originalData.edges.get({
                    filter: (edge) => edge.from === id || edge.to === id
                });
                
                nodeEdges.forEach((edge) => {
                    if (!this.isEdgeHiddenByCollapse(edge)) {
                        this.hiddenEdges.delete(edge.id);
                    }
                });
            }
        });
        
        // For incoming nodes: don't auto-collapse, just show them
        incomingNodeIds.forEach((id) => {
            if (!this.isNodeCollapsedByOthers(id)) {
                this.hiddenNodes.delete(id);
                
                // Show edges for this node if appropriate
                const nodeEdges = this.originalData.edges.get({
                    filter: (edge) => edge.from === id || edge.to === id
                });
                
                nodeEdges.forEach((edge) => {
                    if (!this.isEdgeHiddenByCollapse(edge)) {
                        this.hiddenEdges.delete(edge.id);
                    }
                });
            }
        });

        this.updateGraphVisibility();
        this.updateNodeAppearance(nodeId);
        
        // Center on the node that was acted upon with smooth animation
        this.network.focus(nodeId, {
            scale: scale,
            animation: {
                duration: 300,
                easingFunction: 'easeInOutQuad'
            }
        });
    }

    hideOthers(nodeId) {
        // Hide all nodes that are not reachable from this node
        
        // Store current view position
        const viewPosition = this.network.getViewPosition();
        const scale = this.network.getScale();
        
        // Clear previous hidden state
        this.hiddenNodes.clear();
        this.hiddenEdges.clear();
        
        const allEdges = this.originalData.edges.get();
        
        // Find all reachable nodes by following edges in their direction
        const reachableNodes = new Set([nodeId]); // Include the target node itself
        
        // BFS to find all nodes reachable via outgoing edges (downstream)
        const outgoingQueue = [nodeId];
        const visitedOutgoing = new Set([nodeId]);
        
        while (outgoingQueue.length > 0) {
            const currentNode = outgoingQueue.shift();
            
            allEdges.forEach(edge => {
                if (edge.from === currentNode && !visitedOutgoing.has(edge.to)) {
                    visitedOutgoing.add(edge.to);
                    reachableNodes.add(edge.to);
                    outgoingQueue.push(edge.to);
                }
            });
        }
        
        // BFS to find all nodes reachable via incoming edges (upstream)
        const incomingQueue = [nodeId];
        const visitedIncoming = new Set([nodeId]);
        
        while (incomingQueue.length > 0) {
            const currentNode = incomingQueue.shift();
            
            allEdges.forEach(edge => {
                if (edge.to === currentNode && !visitedIncoming.has(edge.from)) {
                    visitedIncoming.add(edge.from);
                    reachableNodes.add(edge.from);
                    incomingQueue.push(edge.from);
                }
            });
        }
        
        // Hide all nodes that are not reachable
        const allNodes = this.originalData.nodes.get();
        allNodes.forEach(node => {
            if (!reachableNodes.has(node.id)) {
                this.hiddenNodes.add(node.id);
            }
        });
        
        // Also hide isolated nodes if they should be hidden
        if (!this.showIsolatedNodes) {
            allNodes.forEach(node => {
                const isIsolated = !allEdges.some(edge => edge.from === node.id || edge.to === node.id);
                if (isIsolated && !this.hiddenNodes.has(node.id)) {
                    this.hiddenNodes.add(node.id);
                }
            });
        }
        
        // Hide all edges that don't connect to/from visible nodes
        allEdges.forEach(edge => {
            if (!reachableNodes.has(edge.from) || !reachableNodes.has(edge.to)) {
                this.hiddenEdges.add(edge.id);
            }
        });
        
        this.updateGraphVisibility();
        this.updateNodeAppearance(nodeId);
        
        // Center on the node that was acted upon with smooth animation
        this.network.focus(nodeId, {
            scale: scale,
            animation: {
                duration: 300,
                easingFunction: 'easeInOutQuad'
            }
        });
    }

    isNodeCollapsedByOthers(nodeId) {
        // Check if this node is hidden because of other collapsed nodes
        for (const [collapsedId, state] of this.collapsedNodes.entries()) {
            if (collapsedId === nodeId) continue;
            
            const edges = this.originalData.edges.get({
                filter: (edge) => 
                    (edge.from === collapsedId && edge.to === nodeId && state.outgoing) ||
                    (edge.to === collapsedId && edge.from === nodeId && state.incoming)
            });
            
            if (edges.length > 0) {
                return true;
            }
        }
        return false;
    }

    isEdgeHiddenByCollapse(edge) {
        // Check if this edge should be hidden due to any collapsed node
        const fromState = this.collapsedNodes.get(edge.from);
        const toState = this.collapsedNodes.get(edge.to);
        
        if (fromState && fromState.outgoing) return true;
        if (toState && toState.incoming) return true;
        
        return false;
    }

    updateNodeAppearance(nodeId) {
        const collapseState = this.collapsedNodes.get(nodeId);
        const isLastAction = nodeId === this.lastActionNode;
        
        let color, fontColor;
        let borderWidth = 2;
        
        // Start with hot yellow flash for last action node
        if (isLastAction) {
            color = {
                background: '#ffd700', // Hot yellow (gold)
                border: '#f57f17',
                highlight: {
                    background: '#ffeb3b',
                    border: '#f9a825'
                }
            };
            fontColor = '#000000';
            borderWidth = 4;
            
            // Clear any existing timeout for this node
            if (this.flashTimeouts.has(nodeId)) {
                clearTimeout(this.flashTimeouts.get(nodeId));
            }
            
            // Fade to normal color over 3 seconds
            const steps = 30; // Number of steps in the fade
            const stepDuration = 3000 / steps; // 3000ms / 30 steps = 100ms per step
            
            for (let i = 1; i <= steps; i++) {
                const timeoutId = setTimeout(() => {
                    const progress = i / steps;
                    this.applyFadedColor(nodeId, progress);
                    
                    // Clean up timeout reference on last step
                    if (i === steps) {
                        this.flashTimeouts.delete(nodeId);
                    }
                }, stepDuration * i);
                
                // Store the last timeout ID
                if (i === 1) {
                    this.flashTimeouts.set(nodeId, timeoutId);
                }
            }
        } else {
            // Normal appearance for non-last-action nodes
            // Background indicates incoming state, border indicates outgoing state
            let background, border, highlightBg, highlightBorder;
            
            // Determine background based on incoming state
            if (collapseState && collapseState.incoming) {
                background = '#d1d5db'; // Gray background = incoming collapsed
                highlightBg = '#e5e7eb';
                fontColor = '#1f2937';
            } else {
                background = '#ffffff'; // White background = incoming expanded
                highlightBg = '#e0e7ff';
                fontColor = '#1e293b';
            }
            
            // Determine border based on outgoing state
            if (collapseState && collapseState.outgoing) {
                border = '#374151'; // Dark gray border = outgoing collapsed
                highlightBorder = '#1f2937';
                borderWidth = 4; // Thick border for outgoing collapsed
            } else {
                border = '#4f46e5'; // Blue border = outgoing expanded
                highlightBorder = '#4338ca';
                borderWidth = 2;
            }
            
            color = {
                background: background,
                border: border,
                highlight: {
                    background: highlightBg,
                    border: highlightBorder
                }
            };
        }

        this.nodes.update({
            id: nodeId,
            color: color,
            borderWidth: borderWidth,
            font: { size: 14, color: fontColor, bold: !!collapseState }
        });
    }

    applyFadedColor(nodeId, progress) {
        const collapseState = this.collapsedNodes.get(nodeId);
        
        // Interpolate from hot yellow to final color
        const startBg = { r: 255, g: 215, b: 0 }; // #ffd700
        const startBorder = { r: 245, g: 127, b: 23 }; // #f57f17
        const startFont = { r: 0, g: 0, b: 0 }; // black
        
        let endBg, endBorder, endFont;
        
        // Background indicates incoming state
        if (collapseState && collapseState.incoming) {
            endBg = { r: 209, g: 213, b: 219 }; // #d1d5db - gray for incoming collapsed
            endFont = { r: 31, g: 41, b: 55 }; // #1f2937
        } else {
            endBg = { r: 255, g: 255, b: 255 }; // #ffffff - white for incoming expanded
            endFont = { r: 30, g: 41, b: 59 }; // #1e293b
        }
        
        // Border indicates outgoing state
        if (collapseState && collapseState.outgoing) {
            endBorder = { r: 55, g: 65, b: 81 }; // #374151 - dark gray for outgoing collapsed
        } else {
            endBorder = { r: 79, g: 70, b: 229 }; // #4f46e5 - blue for outgoing expanded
        }
        
        // Linear interpolation
        const lerp = (start, end, t) => Math.round(start + (end - start) * t);
        
        const bgColor = `rgb(${lerp(startBg.r, endBg.r, progress)}, ${lerp(startBg.g, endBg.g, progress)}, ${lerp(startBg.b, endBg.b, progress)})`;
        const borderColor = `rgb(${lerp(startBorder.r, endBorder.r, progress)}, ${lerp(startBorder.g, endBorder.g, progress)}, ${lerp(startBorder.b, endBorder.b, progress)})`;
        const fontColor = `rgb(${lerp(startFont.r, endFont.r, progress)}, ${lerp(startFont.g, endFont.g, progress)}, ${lerp(startFont.b, endFont.b, progress)})`;
        
        // Fade border width - from 4 to final width (4 for outgoing collapsed, 2 otherwise)
        let finalBorderWidth = 2;
        if (collapseState && collapseState.outgoing) {
            finalBorderWidth = 4; // Keep thick border whenever outgoing is collapsed, regardless of incoming state
        }
        const borderWidth = Math.round(4 - ((4 - finalBorderWidth) * progress));
        
        this.nodes.update({
            id: nodeId,
            color: {
                background: bgColor,
                border: borderColor,
                highlight: {
                    background: bgColor,
                    border: borderColor
                }
            },
            borderWidth: borderWidth,
            font: { 
                size: 14, 
                color: fontColor, 
                bold: !!collapseState 
            }
        });
    }

    updateGraphVisibility() {
        // Store positions of currently visible nodes before update
        const currentPositions = {};
        this.nodes.forEach((node) => {
            const pos = this.network.getPositions([node.id])[node.id];
            if (pos) {
                currentPositions[node.id] = { x: pos.x, y: pos.y };
            }
        });
        
        // Get all edges for checking isolated nodes
        const allEdges = this.originalData.edges.get();
        
        // Helper function to check if a node is isolated (no connections)
        const isIsolated = (nodeId) => {
            return !allEdges.some(edge => edge.from === nodeId || edge.to === nodeId);
        };
        
        // Update nodes dataset
        const visibleNodes = this.originalData.nodes.get({
            filter: (node) => {
                // Check if node is hidden by collapse
                if (this.hiddenNodes.has(node.id)) return false;
                
                // Check if node is isolated and should be hidden
                if (!this.showIsolatedNodes && isIsolated(node.id)) return false;
                
                return true;
            }
        });

        // Update edges dataset
        const visibleEdges = this.originalData.edges.get({
            filter: (edge) => !this.hiddenEdges.has(edge.id) && 
                              !this.hiddenNodes.has(edge.from) && 
                              !this.hiddenNodes.has(edge.to)
        });

        this.nodes.clear();
        this.edges.clear();
        
        // Separate isolated nodes from connected nodes
        const connectedNodes = [];
        const isolatedNodes = [];
        
        visibleNodes.forEach((node) => {
            if (isIsolated(node.id)) {
                isolatedNodes.push(node);
            } else {
                connectedNodes.push(node);
            }
        });
        
        // Calculate bounding box of connected nodes
        let maxY = 0;
        let minX = Infinity;
        let maxX = -Infinity;
        connectedNodes.forEach((node) => {
            const position = currentPositions[node.id] || this.originalPositions.get(node.id) || {};
            if (position.y !== undefined && position.y > maxY) {
                maxY = position.y;
            }
            if (position.x !== undefined) {
                if (position.x < minX) minX = position.x;
                if (position.x > maxX) maxX = position.x;
            }
        });
        
        // Position for the center of the circle (below the graph)
        const circleX = (minX + maxX) / 2; // Center horizontally
        const circleY = maxY + 500; // 500px below the lowest node
        const circleRadius = Math.max(200, Math.sqrt(isolatedNodes.length) * 80); // Dynamic radius based on count
        
        // Collect all existing node positions for collision detection
        const existingPositions = [];
        connectedNodes.forEach((node) => {
            const position = currentPositions[node.id] || this.originalPositions.get(node.id) || {};
            if (position.x !== undefined && position.y !== undefined) {
                existingPositions.push({ x: position.x, y: position.y });
            }
        });
        
        // Helper function to check if a position overlaps with existing nodes
        const checkOverlap = (x, y, minDistance = 150) => {
            return existingPositions.some(pos => {
                const dx = pos.x - x;
                const dy = pos.y - y;
                return Math.sqrt(dx * dx + dy * dy) < minDistance;
            });
        };
        
        // Generate positions within the circle area using Poisson-like distribution
        const isolatedPositions = [];
        for (let i = 0; i < isolatedNodes.length; i++) {
            let attempts = 0;
            let x, y, foundValidPosition = false;
            
            while (attempts < 100 && !foundValidPosition) {
                // Random position within circle
                const angle = Math.random() * 2 * Math.PI;
                const r = Math.sqrt(Math.random()) * circleRadius; // sqrt for uniform distribution in circle area
                x = circleX + r * Math.cos(angle);
                y = circleY + r * Math.sin(angle);
                
                // Check for overlaps with both existing nodes and other isolated nodes
                const overlapWithExisting = checkOverlap(x, y, 150);
                const overlapWithIsolated = isolatedPositions.some(pos => {
                    const dx = pos.x - x;
                    const dy = pos.y - y;
                    return Math.sqrt(dx * dx + dy * dy) < 120; // Minimum distance between isolated nodes
                });
                
                if (!overlapWithExisting && !overlapWithIsolated) {
                    foundValidPosition = true;
                }
                attempts++;
            }
            
            // If we couldn't find a valid position after many attempts, use a fallback
            if (!foundValidPosition) {
                const fallbackAngle = (i / isolatedNodes.length) * 2 * Math.PI;
                x = circleX + circleRadius * Math.cos(fallbackAngle);
                y = circleY + circleRadius * Math.sin(fallbackAngle);
            }
            
            isolatedPositions.push({ x, y });
        }
        
        // Re-add visible nodes with their styling and preserved positions
        connectedNodes.forEach((node) => {
            const collapseState = this.collapsedNodes.get(node.id);
            const isLastAction = node.id === this.lastActionNode;
            let color, fontColor;
            let borderWidth = 2;
            
            // Background indicates incoming state, border indicates outgoing state
            let background, border, highlightBg, highlightBorder;
            
            // Determine background based on incoming state
            if (collapseState && collapseState.incoming) {
                background = '#d1d5db'; // Gray background = incoming collapsed
                highlightBg = '#e5e7eb';
                fontColor = '#1f2937';
            } else {
                background = '#ffffff'; // White background = incoming expanded
                highlightBg = '#e0e7ff';
                fontColor = '#1e293b';
            }
            
            // Determine border based on outgoing state
            if (collapseState && collapseState.outgoing) {
                border = isLastAction ? '#1f2937' : '#374151'; // Dark gray = outgoing collapsed
                highlightBorder = '#1f2937';
                borderWidth = 4; // Thick border for outgoing collapsed
            } else {
                border = isLastAction ? '#4338ca' : '#4f46e5'; // Blue = outgoing expanded
                highlightBorder = '#4338ca';
                borderWidth = 2;
            }
            
            color = {
                background: background,
                border: border,
                highlight: {
                    background: highlightBg,
                    border: highlightBorder
                }
            };
            
            // Use stored position if available, otherwise use original
            const position = currentPositions[node.id] || this.originalPositions.get(node.id) || {};
            
            this.nodes.add({
                ...node,
                x: position.x,
                y: position.y,
                font: { 
                    size: 14, 
                    color: fontColor,
                    bold: !!collapseState
                },
                color: color,
                borderWidth: borderWidth,
                shape: 'box',
                margin: 10,
                widthConstraint: { minimum: 100, maximum: 200 }
            });
        });
        
        // Add isolated nodes using the calculated positions
        isolatedNodes.forEach((node, index) => {
            const position = isolatedPositions[index];
            
            // Use a distinct color for isolated nodes
            const color = {
                background: '#f3f4f6',
                border: '#9ca3af',
                highlight: {
                    background: '#e5e7eb',
                    border: '#6b7280'
                }
            };
            
            this.nodes.add({
                ...node,
                x: position.x,
                y: position.y,
                font: { 
                    size: 14, 
                    color: '#6b7280'
                },
                color: color,
                borderWidth: 1,
                shape: 'box',
                margin: 10,
                widthConstraint: { minimum: 100, maximum: 200 }
            });
        });

        // Re-add visible edges with styling
        visibleEdges.forEach((edge) => {
            this.edges.add({
                ...edge,
                arrows: { to: { enabled: true, scaleFactor: 0.8 } },
                color: { color: '#94a3b8', highlight: '#4f46e5' },
                width: 2,
                smooth: { type: 'cubicBezier', roundness: 0.5 }
            });
        });
        
        // Ensure physics and hierarchical layout remain disabled after update
        // This prevents non-selected nodes from moving when dragging selected ones
        this.network.setOptions({ 
            physics: { enabled: false },
            layout: { hierarchical: { enabled: false } }
        });
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
            alert('No graph loaded. Please load a DOT file first.');
            return;
        }

        // Node font size is 14px, we want text to be at least 12px readable
        // So we need: 14 * scale >= 12
        // Therefore: scale >= 12/14 ≈ 0.857
        const minTextSize = 12;
        const nodeFontSize = 14;
        const targetScale = minTextSize / nodeFontSize;

        // Get current position to maintain center
        const viewPosition = this.network.getViewPosition();

        // Zoom to the calculated scale
        this.network.moveTo({
            position: viewPosition,
            scale: targetScale,
            animation: {
                duration: 500,
                easingFunction: 'easeInOutQuad'
            }
        });
    }

    findMatchingNode(query) {
        if (!this.originalData) {
            return null;
        }

        // If query is empty, return null
        if (!query || query.trim() === '') {
            return null;
        }

        const searchTerm = query.trim().toLowerCase();

        // Get all nodes (from original data to search even hidden nodes)
        const allNodes = this.originalData.nodes.get();

        // Filter nodes whose labels match the prefix (case-insensitive)
        const matches = allNodes.filter(node => {
            const label = node.label ? node.label.toLowerCase() : '';
            return label.startsWith(searchTerm);
        });

        // If no matches, return null
        if (matches.length === 0) {
            return null;
        }

        // Sort alphabetically by label
        matches.sort((a, b) => {
            const labelA = a.label ? a.label.toLowerCase() : '';
            const labelB = b.label ? b.label.toLowerCase() : '';
            return labelA.localeCompare(labelB);
        });

        // Find the first match that has position data available
        for (const match of matches) {
            // Try to get position from visible network
            try {
                if (this.network) {
                    const positions = this.network.getPositions([match.id]);
                    if (positions && positions[match.id]) {
                        return match;
                    }
                }
            } catch (e) {
                // Continue to next check
            }
            
            // Try originalPositions
            if (this.originalPositions && this.originalPositions.has(match.id)) {
                return match;
            }
            
            // Try node data itself
            if (this.nodes) {
                const nodeData = this.nodes.get(match.id);
                if (nodeData && nodeData.x !== undefined && nodeData.y !== undefined) {
                    return match;
                }
            }
        }

        // If no match with position data found, return null
        return null;
    }

    searchNode(query) {
        if (!this.network || !this.originalData) {
            return;
        }

        // If query is empty, do nothing
        if (!query || query.trim() === '') {
            return;
        }

        const searchTerm = query.trim().toLowerCase();

        // Get all nodes (from original data to search even hidden nodes)
        const allNodes = this.originalData.nodes.get();

        // Filter nodes whose labels match the prefix (case-insensitive)
        const matches = allNodes.filter(node => {
            const label = node.label ? node.label.toLowerCase() : '';
            return label.startsWith(searchTerm);
        });

        // If no matches, do nothing
        if (matches.length === 0) {
            return;
        }

        // Sort alphabetically by label
        matches.sort((a, b) => {
            const labelA = a.label ? a.label.toLowerCase() : '';
            const labelB = b.label ? b.label.toLowerCase() : '';
            return labelA.localeCompare(labelB);
        });

        // Find the first match that has position data available
        let targetNode = null;
        let nodePosition = null;
        
        for (const match of matches) {
            // Try to get position from visible network
            try {
                const positions = this.network.getPositions([match.id]);
                if (positions && positions[match.id]) {
                    targetNode = match;
                    nodePosition = positions[match.id];
                    break;
                }
            } catch (e) {
                // Continue to next method
            }
            
            // Try originalPositions
            if (this.originalPositions && this.originalPositions.has(match.id)) {
                targetNode = match;
                nodePosition = this.originalPositions.get(match.id);
                break;
            }
            
            // Try node data itself
            if (this.nodes) {
                const nodeData = this.nodes.get(match.id);
                if (nodeData && nodeData.x !== undefined && nodeData.y !== undefined) {
                    targetNode = match;
                    nodePosition = { x: nodeData.x, y: nodeData.y };
                    break;
                }
            }
        }

        // If no match with position found, return
        if (!targetNode || !nodePosition) {
            return;
        }

        // Calculate zoom level for 12px text (same as zoomToText)
        const minTextSize = 12;
        const nodeFontSize = 14;
        const targetScale = minTextSize / nodeFontSize;

        // Center and zoom to the node
        this.network.moveTo({
            position: nodePosition,
            scale: targetScale,
            animation: {
                duration: 500,
                easingFunction: 'easeInOutQuad'
            }
        });

        // Optionally select the node to highlight it
        this.network.selectNodes([targetNode.id]);
    }

    resetLayout() {
        if (!this.network || !this.originalData) return;

        // Clear collapsed state
        this.collapsedNodes.clear();
        this.hiddenNodes.clear();
        this.hiddenEdges.clear();

        // Re-hide isolated nodes if they should be hidden (preserve the setting)
        if (!this.showIsolatedNodes) {
            const allEdges = this.originalData.edges.get();
            this.originalData.nodes.forEach((node) => {
                const isIsolated = !allEdges.some(edge => edge.from === node.id || edge.to === node.id);
                if (isIsolated) {
                    this.hiddenNodes.add(node.id);
                }
            });
        }

        // Restore all nodes and edges (excluding hidden ones)
        this.nodes.clear();
        this.edges.clear();

        this.originalData.nodes.forEach((node) => {
            // Skip hidden nodes (isolated nodes if they should be hidden)
            if (this.hiddenNodes.has(node.id)) {
                return;
            }
            
            this.nodes.add({
                ...node,
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
                margin: 10,
                widthConstraint: { minimum: 100, maximum: 200 }
            });
        });

        this.originalData.edges.forEach((edge) => {
            this.edges.add({
                ...edge,
                arrows: { to: { enabled: true, scaleFactor: 0.8 } },
                color: { color: '#94a3b8', highlight: '#4f46e5' },
                width: 2,
                smooth: { type: 'cubicBezier', roundness: 0.5 }
            });
        });

        // Re-enable hierarchical layout and physics to redistribute nodes
        this.network.setOptions({
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
            }
        });

        // Wait for stabilization, then disable physics and store new positions
        this.network.once('stabilizationIterationsDone', () => {
            this.originalPositions.clear();
            this.nodes.forEach((node) => {
                const position = this.network.getPositions([node.id])[node.id];
                if (position) {
                    this.originalPositions.set(node.id, position);
                }
            });

            // Disable physics and hierarchical layout after layout is complete
            this.network.setOptions({
                physics: { enabled: false },
                layout: { hierarchical: { enabled: false } }
            });
            
            // Remove any hierarchical constraints from nodes to allow free X movement
            this.nodes.forEach((node) => {
                this.nodes.update({
                    id: node.id,
                    fixed: false  // Ensure nodes can move freely in all directions
                });
            });

            this.fitGraph();
        });

        this.updateStats();
    }

    exportGraph() {
        if (!this.network) {
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

    collapseAllNodes() {
        if (!this.network || !this.originalData) {
            return;
        }

        // Find entry functions (nodes with no incoming edges)
        const allEdges = this.originalData.edges.get();
        const nodesWithIncoming = new Set(allEdges.map(e => e.to));
        const allNodes = this.originalData.nodes.get();
        const entryFunctions = allNodes.filter(node => !nodesWithIncoming.has(node.id));
        const entryFunctionIds = new Set(entryFunctions.map(n => n.id));

        console.log(`Found ${entryFunctions.length} entry function(s):`, entryFunctions.map(n => n.label || n.id));

        // Clear existing collapse states
        this.collapsedNodes.clear();
        this.hiddenNodes.clear();
        this.hiddenEdges.clear();

        // Hide all non-entry nodes
        allNodes.forEach(node => {
            if (!entryFunctionIds.has(node.id)) {
                this.hiddenNodes.add(node.id);
            }
        });

        // Hide ALL edges (we want entry functions as isolated nodes)
        allEdges.forEach(edge => {
            this.hiddenEdges.add(edge.id);
        });

        // Mark entry functions as having outgoing collapsed (for visual indicator)
        entryFunctions.forEach(node => {
            const nodeId = node.id;
            const hasOutgoing = allEdges.some(e => e.from === nodeId);
            
            if (hasOutgoing) {
                this.collapsedNodes.set(nodeId, { 
                    outgoing: true, 
                    incoming: false 
                });
            }
        });

        // Update the graph
        this.updateGraphVisibility();
        this.fitGraph();
    }

    expandAllNodes() {
        if (!this.network) {
            return;
        }

        // Clear all collapsed states
        this.collapsedNodes.clear();
        this.hiddenNodes.clear();
        this.hiddenEdges.clear();
        this.lastActionNode = null;

        // Update the graph
        this.updateGraphVisibility();
        this.fitGraph();
    }

    toggleIsolatedNodes() {
        if (!this.network || !this.originalData) {
            return;
        }

        // Toggle the state
        this.showIsolatedNodes = !this.showIsolatedNodes;

        // Update button appearance to show current state
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

        // Update the graph
        this.updateGraphVisibility();
        this.fitGraph();
    }

    updateStats() {
        const nodeCount = this.nodes ? this.nodes.length : 0;
        const edgeCount = this.edges ? this.edges.length : 0;

        document.getElementById('node-count').textContent = nodeCount;
        document.getElementById('edge-count').textContent = edgeCount;
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.callgraphViewer = new CallgraphViewer();
});

