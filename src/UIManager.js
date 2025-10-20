// UI event handling and control management
import { Logger } from './Logger.js';

export class UIManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.contextMenuNode = null;
    }

    initializeEventListeners() {
        this.setupFileHandlers();
        this.setupButtonHandlers();
        this.setupSearchHandlers();
        this.setupHelpOverlayHandlers();
        this.setupKeyboardShortcuts();
        this.setupContextMenu();
        this.setupDetailPanel();
    }

    setupFileHandlers() {
        const fileInput = document.getElementById('file-input');
        fileInput.addEventListener('change', (e) => this.viewer.handleFileUpload(e));

        document.getElementById('generate-button').addEventListener('click', () => 
            this.viewer.handleGenerateFromFolder()
        );
    }

    setupButtonHandlers() {
        document.getElementById('collapse-all-button').addEventListener('click', () => 
            this.viewer.nodeOps.collapseAll()
        );
        document.getElementById('expand-all-button').addEventListener('click', () => 
            this.viewer.nodeOps.expandAll()
        );
        document.getElementById('toggle-isolated-button').addEventListener('click', () => 
            this.viewer.toggleIsolatedNodes()
        );
        document.getElementById('help-button').addEventListener('click', () => 
            this.toggleHelpOverlay()
        );
        document.getElementById('fit-button').addEventListener('click', () => 
            this.viewer.fitGraph()
        );
        document.getElementById('zoom-text-button').addEventListener('click', () => 
            this.viewer.zoomToText()
        );
        document.getElementById('reset-button').addEventListener('click', () => 
            this.viewer.resetLayout()
        );
        document.getElementById('export-button').addEventListener('click', () => 
            this.viewer.exportManager.exportToPNG()
        );
    }

    setupSearchHandlers() {
        const searchInput = document.getElementById('node-search');
        
        // Initialize suggestions container
        this.viewer.searchManager.initializeSuggestions();
        
        // Show suggestions on input
        searchInput.addEventListener('input', (e) => {
            this.viewer.searchManager.showSuggestions(e.target.value);
        });
        
        // Handle keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            const query = e.target.value;
            
            // Up/Down arrow navigation
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.viewer.searchManager.navigateSuggestions('down');
                return;
            }
            
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.viewer.searchManager.navigateSuggestions('up');
                return;
            }
            
            // Right arrow for autocomplete
            if (e.key === 'ArrowRight') {
                const autocomplete = this.viewer.searchManager.autocompleteFromSuggestion();
                if (autocomplete) {
                    e.preventDefault();
                    searchInput.value = autocomplete;
                    searchInput.focus();
                    // Move cursor to end
                    searchInput.setSelectionRange(autocomplete.length, autocomplete.length);
                    // Update suggestions
                    this.viewer.searchManager.showSuggestions(autocomplete);
                }
                return;
            }
            
            // Enter key
            if (e.key === 'Enter') {
                e.preventDefault();
                
                // If empty, reset layout
                if (!query || query.trim() === '') {
                    this.viewer.resetLayout();
                    this.viewer.searchManager.hideSuggestions();
                    return;
                }
                
                // If a suggestion is selected, use it
                if (this.viewer.searchManager.selectedSuggestionIndex >= 0) {
                    this.viewer.searchManager.selectSuggestion(
                        this.viewer.searchManager.selectedSuggestionIndex
                    );
                    searchInput.blur();
                    return;
                }
                
                // Otherwise, use first suggestion if available
                if (this.viewer.searchManager.suggestions.length > 0) {
                    this.viewer.searchManager.selectSuggestion(0);
                    searchInput.blur();
                }
            }
            
            // Escape key to hide suggestions
            if (e.key === 'Escape') {
                this.viewer.searchManager.hideSuggestions();
                searchInput.blur();
            }
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && 
                !document.getElementById('search-suggestions')?.contains(e.target)) {
                this.viewer.searchManager.hideSuggestions();
            }
        });
    }

    setupHelpOverlayHandlers() {
        document.getElementById('close-help').addEventListener('click', () => 
            this.hideHelpOverlay()
        );
        
        document.getElementById('help-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'help-overlay') {
                this.hideHelpOverlay();
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts in input fields (except Escape)
            if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && 
                e.key !== 'Escape' && e.key !== 'Esc') {
                return;
            }
            
            // Close help overlay with Esc
            if (e.key === 'Escape' || e.key === 'Esc') {
                const overlay = document.getElementById('help-overlay');
                if (overlay && !overlay.classList.contains('hidden')) {
                    this.hideHelpOverlay();
                }
            }
            
            // Hide others with 'H'
            if (e.key === 'h' || e.key === 'H') {
                if (this.viewer.network) {
                    const selectedNodes = this.viewer.network.getSelectedNodes();
                    if (selectedNodes.length === 1) {
                        this.viewer.nodeOps.lastActionNode = selectedNodes[0];
                        this.viewer.hideOthers(selectedNodes[0]);
                        this.viewer.updateStats();
                    }
                }
            }
            
            // Reset with 'R'
            if (e.key === 'r' || e.key === 'R') {
                const searchInput = document.getElementById('node-search');
                if (searchInput) {
                    searchInput.value = '';
                }
                this.viewer.resetLayout();
            }
            
            // Focus search with '/'
            if (e.key === '/') {
                e.preventDefault();
                const searchInput = document.getElementById('node-search');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
        });
    }

    setupContextMenu() {
        this.createContextMenu();
        
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('context-menu');
            if (menu && !menu.contains(e.target)) {
                this.hideContextMenu();
            }
        });
    }

    setupDetailPanel() {
        document.getElementById('close-detail').addEventListener('click', () => 
            this.hideDetailPanel()
        );
    }

    createContextMenu() {
        const menu = document.createElement('div');
        menu.id = 'context-menu';
        menu.className = 'context-menu';
        document.body.appendChild(menu);
    }

    showContextMenu(x, y, nodeId) {
        this.contextMenuNode = nodeId;
        const menu = document.getElementById('context-menu');
        
        const collapseState = this.viewer.nodeOps.collapsedNodes.get(nodeId) || 
                            { outgoing: false, incoming: false };
        
        const allEdges = this.viewer.originalData?.edges.get() || [];
        const hasOutgoing = allEdges.some(edge => edge.from === nodeId);
        const hasIncoming = allEdges.some(edge => edge.to === nodeId);
        
        const menuItems = this.buildContextMenuItems(collapseState, hasOutgoing, hasIncoming);
        menu.innerHTML = menuItems.join('');
        
        // Attach event listeners
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

    buildContextMenuItems(collapseState, hasOutgoing, hasIncoming) {
        let items = [];
        
        // Collapse options
        if (!collapseState.outgoing && hasOutgoing) {
            items.push('<div class="context-menu-item" data-action="collapse-outgoing"><i class="fas fa-arrow-down"></i> Collapse Outgoing Calls</div>');
        }
        if (!collapseState.incoming && hasIncoming) {
            items.push('<div class="context-menu-item" data-action="collapse-incoming"><i class="fas fa-arrow-up"></i> Collapse Incoming Calls</div>');
        }
        if ((!collapseState.outgoing && hasOutgoing) || (!collapseState.incoming && hasIncoming)) {
            items.push('<div class="context-menu-item" data-action="collapse-all"><i class="fas fa-compress"></i> Collapse All Connections</div>');
        }
        
        // Separator
        const hasCollapseOptions = items.length > 0;
        const hasExpandOptions = (collapseState.outgoing && hasOutgoing) || (collapseState.incoming && hasIncoming);
        if (hasCollapseOptions && hasExpandOptions) {
            items.push('<div class="context-menu-separator"></div>');
        }
        
        // Expand options
        if ((collapseState.outgoing && hasOutgoing) || (collapseState.incoming && hasIncoming)) {
            items.push('<div class="context-menu-item" data-action="expand-all"><i class="fas fa-expand"></i> Expand All</div>');
        }
        if (collapseState.outgoing && hasOutgoing) {
            items.push('<div class="context-menu-item" data-action="expand-outgoing"><i class="fas fa-arrow-down"></i> Expand Outgoing Calls</div>');
        }
        if (collapseState.incoming && hasIncoming) {
            items.push('<div class="context-menu-item" data-action="expand-incoming"><i class="fas fa-arrow-up"></i> Expand Incoming Calls</div>');
        }
        
        // No connections message
        if (items.length === 0) {
            items.push('<div class="context-menu-item" style="color: #9ca3af; cursor: default; pointer-events: none;"><i class="fas fa-ban"></i> No Connections</div>');
        }
        
        // Hide others
        if (items.length > 0 && items[items.length - 1].indexOf('No Connections') === -1) {
            items.push('<div class="context-menu-separator"></div>');
        }
        items.push('<div class="context-menu-item" data-action="hide-others"><i class="fas fa-eye-slash"></i> Hide Others</div>');
        
        return items;
    }

    handleContextMenuAction(action) {
        if (!this.contextMenuNode) return;

        const nodeId = this.contextMenuNode;
        this.viewer.nodeOps.lastActionNode = nodeId;
        
        Logger.debug('UIManager', 'Context menu action', { nodeId, action });
        
        switch (action) {
            case 'collapse-outgoing':
                this.viewer.nodeOps.collapseNode(nodeId, 'outgoing');
                break;
            case 'collapse-incoming':
                this.viewer.nodeOps.collapseNode(nodeId, 'incoming');
                break;
            case 'collapse-all':
                this.viewer.nodeOps.collapseNode(nodeId, 'both');
                break;
            case 'expand-all':
                this.viewer.nodeOps.expandNode(nodeId, 'both');
                break;
            case 'expand-outgoing':
                this.viewer.nodeOps.expandNode(nodeId, 'outgoing');
                break;
            case 'expand-incoming':
                this.viewer.nodeOps.expandNode(nodeId, 'incoming');
                break;
            case 'hide-others':
                this.viewer.hideOthers(nodeId);
                break;
        }
        
        this.viewer.updateStats();
    }

    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu) {
            menu.style.display = 'none';
        }
        this.contextMenuNode = null;
    }

    showHelpOverlay() {
        const overlay = document.getElementById('help-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            void overlay.offsetWidth;
        }
    }

    hideHelpOverlay() {
        const overlay = document.getElementById('help-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
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

    showNodeDetails(nodeId) {
        const node = this.viewer.nodes.get(nodeId);
        const detailPanel = document.getElementById('detail-panel');
        const detailContent = document.getElementById('detail-content');

        const connectedEdges = this.viewer.edges.get({
            filter: (edge) => edge.from === nodeId || edge.to === nodeId
        });

        const incomingCalls = connectedEdges.filter(e => e.to === nodeId).length;
        const outgoingCalls = connectedEdges.filter(e => e.from === nodeId).length;

        const collapseState = this.viewer.nodeOps.collapsedNodes.get(nodeId);
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
        `;
        
        const filePath = node.file || node.path || node.filepath || node.location;
        const lineNumber = node.line || node.lineNumber;
        
        if (filePath) {
            const fileDisplay = lineNumber ? `${filePath}:${lineNumber}` : filePath;
            html += `
                <div class="property">
                    <span class="property-label">File:</span>
                    <div class="property-value" style="word-break: break-all;">${fileDisplay}</div>
                </div>
            `;
        }
        
        html += `
            <div class="property">
                <span class="property-label">Incoming Calls:</span>
                <div class="property-value">${incomingCalls}</div>
            </div>
            <div class="property">
                <span class="property-label">Outgoing Calls:</span>
                <div class="property-value">${outgoingCalls}</div>
            </div>
        `;
        
        // Add chain statistics if available
        const longestIncoming = node.longestIncomingChain;
        const longestOutgoing = node.longestOutgoingChain;
        
        if (longestIncoming !== undefined) {
            html += `
                <div class="property">
                    <span class="property-label">Longest Incoming Chain:</span>
                    <div class="property-value">${longestIncoming}</div>
                </div>
            `;
        }
        
        if (longestOutgoing !== undefined) {
            html += `
                <div class="property">
                    <span class="property-label">Longest Outgoing Chain:</span>
                    <div class="property-value">${longestOutgoing}</div>
                </div>
            `;
        }
        
        html += `
            <div class="property">
                <span class="property-label">Status:</span>
                <div class="property-value">${statusText}</div>
            </div>
        `;

        // Add custom attributes
        Object.keys(node).forEach((key) => {
            if (!['id', 'label', 'x', 'y', 'font', 'color', 'shape', 'margin', 'widthConstraint', 
                  'borderWidth', 'file', 'path', 'filepath', 'location', 'line', 'lineNumber', 
                  'longestIncomingChain', 'longestOutgoingChain', 'fixed', 'physics', 
                  'shapeProperties', 'originalLabel', 'originalFontColor'].includes(key)) {
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

    hideDetailPanel() {
        document.getElementById('detail-panel').classList.remove('active');
    }
}

