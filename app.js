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
        
        this.initializeEventListeners();
        this.createContextMenu();
        this.showHelpOverlay();
    }

    initializeEventListeners() {
        // File input
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Control buttons
        document.getElementById('help-button').addEventListener('click', () => this.showHelpOverlay());
        document.getElementById('fit-button').addEventListener('click', () => this.fitGraph());
        document.getElementById('reset-button').addEventListener('click', () => this.resetLayout());
        document.getElementById('export-button').addEventListener('click', () => this.exportGraph());

        // Help overlay
        document.getElementById('close-help').addEventListener('click', () => this.hideHelpOverlay());
        
        // Close help overlay when clicking outside the modal content
        document.getElementById('help-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'help-overlay') {
                this.hideHelpOverlay();
            }
        });
        
        // Close help overlay with Esc key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                const overlay = document.getElementById('help-overlay');
                if (overlay && !overlay.classList.contains('hidden')) {
                    this.hideHelpOverlay();
                }
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

    hideDetailPanel() {
        document.getElementById('detail-panel').classList.remove('active');
    }

    createContextMenu() {
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" data-action="collapse-outgoing">
                ⬇️ Collapse Outgoing Calls
            </div>
            <div class="context-menu-item" data-action="collapse-incoming">
                ⬆️ Collapse Incoming Calls
            </div>
            <div class="context-menu-item" data-action="collapse-all">
                📦 Collapse All Connections
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="expand-all">
                📂 Expand All
            </div>
            <div class="context-menu-item" data-action="expand-outgoing">
                ⬇️ Expand Outgoing Calls
            </div>
            <div class="context-menu-item" data-action="expand-incoming">
                ⬆️ Expand Incoming Calls
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
            menuItems.push('<div class="context-menu-item" data-action="collapse-outgoing">⬇️ Collapse Outgoing Calls</div>');
        }
        if (!collapseState.incoming && hasIncoming) {
            menuItems.push('<div class="context-menu-item" data-action="collapse-incoming">⬆️ Collapse Incoming Calls</div>');
        }
        if ((!collapseState.outgoing && hasOutgoing) || (!collapseState.incoming && hasIncoming)) {
            menuItems.push('<div class="context-menu-item" data-action="collapse-all">📦 Collapse All Connections</div>');
        }
        
        // Separator if we have both collapse and expand options
        const hasCollapseOptions = menuItems.length > 0;
        const hasExpandOptions = (collapseState.outgoing && hasOutgoing) || (collapseState.incoming && hasIncoming);
        if (hasCollapseOptions && hasExpandOptions) {
            menuItems.push('<div class="context-menu-separator"></div>');
        }
        
        // Expand options (only show if something is collapsed AND those connections exist)
        if ((collapseState.outgoing && hasOutgoing) || (collapseState.incoming && hasIncoming)) {
            menuItems.push('<div class="context-menu-item" data-action="expand-all">📂 Expand All</div>');
        }
        if (collapseState.outgoing && hasOutgoing) {
            menuItems.push('<div class="context-menu-item" data-action="expand-outgoing">⬇️ Expand Outgoing Calls</div>');
        }
        if (collapseState.incoming && hasIncoming) {
            menuItems.push('<div class="context-menu-item" data-action="expand-incoming">⬆️ Expand Incoming Calls</div>');
        }
        
        // If no menu items, show "No Connections" message
        if (menuItems.length === 0) {
            menuItems.push('<div class="context-menu-item" style="color: #9ca3af; cursor: default; pointer-events: none;">📭 No Connections</div>');
        }
        
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
                    margin: 10,
                    widthConstraint: { minimum: 100, maximum: 200 }
                });
            });

            // Enhance edge styling
            this.edges.forEach((edge) => {
                this.edges.update({
                    id: edge.id,
                    arrows: { to: { enabled: true, scaleFactor: 0.8 } },
                    color: { color: '#94a3b8', highlight: '#4f46e5' },
                    width: 2,
                    smooth: { type: 'cubicBezier', roundness: 0.5 }
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
                    springLength: 150,
                    springConstant: 0.01,
                    nodeDistance: 200,
                    damping: 0.09
                },
                stabilization: {
                    enabled: true,
                    iterations: 200
                }
            },
            layout: {
                hierarchical: {
                    enabled: true,
                    direction: 'UD',
                    sortMethod: 'directed',
                    levelSeparation: 150,
                    nodeSpacing: 150
                }
            },
            interaction: {
                dragNodes: true,
                dragView: true,
                zoomView: true,
                hover: true,
                navigationButtons: true,
                keyboard: true
            },
            manipulation: {
                enabled: false
            },
            edges: {
                smooth: {
                    enabled: true,
                    type: 'cubicBezier',
                    roundness: 0.5
                }
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
        
        // Disable physics after initial layout to prevent wiggles
        this.network.setOptions({ physics: { enabled: false } });
    }

    setupNetworkEvents() {
        // Single click - show details
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.showNodeDetails(nodeId);
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

        const affectedNodeIds = new Set([...outgoingNodeIds, ...incomingNodeIds]);

        // Show previously hidden nodes (if they're not hidden by other collapses)
        affectedNodeIds.forEach((id) => {
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
        
        // Update nodes dataset
        const visibleNodes = this.originalData.nodes.get({
            filter: (node) => !this.hiddenNodes.has(node.id)
        });

        // Update edges dataset
        const visibleEdges = this.originalData.edges.get({
            filter: (edge) => !this.hiddenEdges.has(edge.id) && 
                              !this.hiddenNodes.has(edge.from) && 
                              !this.hiddenNodes.has(edge.to)
        });

        this.nodes.clear();
        this.edges.clear();
        
        // Re-add visible nodes with their styling and preserved positions
        visibleNodes.forEach((node) => {
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

    resetLayout() {
        if (!this.network || !this.originalData) return;

        // Clear collapsed state
        this.collapsedNodes.clear();
        this.hiddenNodes.clear();
        this.hiddenEdges.clear();

        // Restore all nodes and edges
        this.nodes.clear();
        this.edges.clear();

        this.originalData.nodes.forEach((node) => {
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

        // Restore original positions if available
        if (this.originalPositions.size > 0) {
            const positions = {};
            this.originalPositions.forEach((pos, nodeId) => {
                positions[nodeId] = pos;
            });
            this.network.setPositions(positions);
        }

        this.fitGraph();
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

