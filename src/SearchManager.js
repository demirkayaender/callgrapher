// Search and fuzzy matching functionality
import { Logger } from './Logger.js';
import { Constants } from './Constants.js';

export class SearchManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.lastSearchedNode = null;
        this.suggestions = [];
        this.selectedSuggestionIndex = -1;
        this.suggestionsContainer = null;
    }
    
    initializeSuggestions() {
        this.suggestionsContainer = document.getElementById('search-suggestions');
    }
    
    showSuggestions(query) {
        if (!query || query.trim() === '' || !this.viewer.originalData) {
            this.hideSuggestions();
            return;
        }
        
        this.suggestions = this.findSuggestions(query);
        this.selectedSuggestionIndex = -1;
        
        if (this.suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        this.renderSuggestions();
        
        // Disable vis-network keyboard handling while suggestions are shown
        if (this.viewer.network) {
            this.viewer.network.setOptions({
                interaction: { keyboard: { enabled: false } }
            });
        }
    }
    
    findSuggestions(query) {
        const searchTerm = query.trim().toLowerCase();
        const allNodes = this.viewer.originalData.nodes.get();
        
        const visibleExactMatches = [];
        const hiddenExactMatches = [];
        const visiblePrefixMatches = [];
        const hiddenPrefixMatches = [];
        const visibleFuzzyMatches = [];
        const hiddenFuzzyMatches = [];
        
        allNodes.forEach(node => {
            let label = node.label || node.id || '';
            label = label.replace(/<[^>]*>/g, ''); // Strip HTML tags
            const lowerLabel = label.toLowerCase();
            const isVisible = !this.viewer.hiddenNodes.has(node.id);
            
            // Get package info for prioritization
            const filePath = node.file || node.path || node.filepath || node.location;
            const packageName = this.viewer.getFolderFromPath(filePath) || 'unknown';
            const packageLevel = this.getPackageLevel(filePath);
            
            if (lowerLabel === searchTerm) {
                // Exact match (case-insensitive)
                if (isVisible) {
                    visibleExactMatches.push({ node, label, isVisible, packageLevel, packageName, filePath });
                } else {
                    hiddenExactMatches.push({ node, label, isVisible, packageLevel, packageName, filePath });
                }
            } else if (lowerLabel.startsWith(searchTerm)) {
                // Prefix match
                if (isVisible) {
                    visiblePrefixMatches.push({ node, label, isVisible, packageLevel, packageName, filePath });
                } else {
                    hiddenPrefixMatches.push({ node, label, isVisible, packageLevel, packageName, filePath });
                }
            } else {
                // Try fuzzy match
                const fuzzyScore = this.fuzzyMatch(label, searchTerm);
                if (fuzzyScore > 0) {
                    if (isVisible) {
                        visibleFuzzyMatches.push({ node, label, isVisible, fuzzyScore, packageLevel, packageName, filePath });
                    } else {
                        hiddenFuzzyMatches.push({ node, label, isVisible, fuzzyScore, packageLevel, packageName, filePath });
                    }
                }
            }
        });
        
        // Sort each category: package level first, then package alphabetically, then label
        const sortByPackageThenLabel = (a, b) => {
            // 1. Package depth (shallower first)
            if (a.packageLevel !== b.packageLevel) return a.packageLevel - b.packageLevel;
            // 2. Package/path alphabetically
            const pathA = a.filePath || '';
            const pathB = b.filePath || '';
            if (pathA !== pathB) return pathA.localeCompare(pathB);
            // 3. Function label alphabetically
            return a.label.localeCompare(b.label);
        };
        
        visibleExactMatches.sort(sortByPackageThenLabel);
        hiddenExactMatches.sort(sortByPackageThenLabel);
        visiblePrefixMatches.sort(sortByPackageThenLabel);
        hiddenPrefixMatches.sort(sortByPackageThenLabel);
        
        visibleFuzzyMatches.sort((a, b) => {
            // 1. Package depth (shallower first)
            if (a.packageLevel !== b.packageLevel) return a.packageLevel - b.packageLevel;
            // 2. Fuzzy score (higher first)
            if (b.fuzzyScore !== a.fuzzyScore) return b.fuzzyScore - a.fuzzyScore;
            // 3. Package/path alphabetically
            const pathA = a.filePath || '';
            const pathB = b.filePath || '';
            if (pathA !== pathB) return pathA.localeCompare(pathB);
            // 4. Function label alphabetically
            return a.label.localeCompare(b.label);
        });
        hiddenFuzzyMatches.sort((a, b) => {
            // 1. Package depth (shallower first)
            if (a.packageLevel !== b.packageLevel) return a.packageLevel - b.packageLevel;
            // 2. Fuzzy score (higher first)
            if (b.fuzzyScore !== a.fuzzyScore) return b.fuzzyScore - a.fuzzyScore;
            // 3. Package/path alphabetically
            const pathA = a.filePath || '';
            const pathB = b.filePath || '';
            if (pathA !== pathB) return pathA.localeCompare(pathB);
            // 4. Function label alphabetically
            return a.label.localeCompare(b.label);
        });
        
        // Combine in priority order:
        // 1. ALL exact matches (visible first)
        // 2. Then prefix matches (up to 10 total minus exact matches)
        // 3. Then fuzzy matches (up to 10 total minus exact and prefix matches)
        const allExactMatches = [
            ...visibleExactMatches,
            ...hiddenExactMatches
        ];
        
        // If we have exact matches, show ALL of them
        if (allExactMatches.length > 0) {
            // Show all exact matches + up to 10 more from other categories
            const remainingSlots = Math.max(0, 10 - allExactMatches.length);
            const otherMatches = [
                ...visiblePrefixMatches,
                ...hiddenPrefixMatches,
                ...visibleFuzzyMatches,
                ...hiddenFuzzyMatches
            ].slice(0, remainingSlots);
            
            const results = [...allExactMatches, ...otherMatches];
            Logger.debug('SearchManager', 'Search suggestions sorted', { 
                query: searchTerm,
                results: results.map(r => ({
                    label: r.label,
                    depth: r.packageLevel,
                    package: r.packageName,
                    path: r.filePath,
                    visible: r.isVisible
                }))
            });
            return results;
        }
        
        // No exact matches, show top 10 from other categories
        const allSuggestions = [
            ...visiblePrefixMatches,
            ...hiddenPrefixMatches,
            ...visibleFuzzyMatches,
            ...hiddenFuzzyMatches
        ];
        
        const results = allSuggestions.slice(0, 10);
        Logger.debug('SearchManager', 'Search suggestions sorted', { 
            query: searchTerm,
            results: results.map(r => ({
                label: r.label,
                depth: r.packageLevel,
                package: r.packageName,
                path: r.filePath,
                visible: r.isVisible
            }))
        });
        return results;
    }
    
    getPackageLevel(filePath) {
        if (!filePath) {
            return 999; // Unknown packages go last
        }
        
        // Calculate folder depth based on path separators in the file path
        // Less depth = higher priority = lower level number
        // Examples:
        //   "main/server.go" → 1 slash → level 1
        //   "api/handlers.go" → 1 slash → level 1
        //   "api/handlers/users.go" → 2 slashes → level 2
        //   "api/handlers/users/auth.go" → 3 slashes → level 3
        
        // Count slashes (folder separators)
        const depth = (filePath.match(/\//g) || []).length;
        
        // Files at root level (no folders) get highest priority
        // Files one folder deep get next priority, etc.
        return depth;
    }
    
    renderSuggestions() {
        if (!this.suggestionsContainer) return;
        
        this.suggestionsContainer.innerHTML = '';
        this.suggestionsContainer.classList.remove('hidden');
        
        this.suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'search-suggestion-item';
            if (index === this.selectedSuggestionIndex) {
                item.classList.add('selected');
            }
            
            // Create content container for label and file info
            const contentContainer = document.createElement('div');
            contentContainer.className = 'search-suggestion-content';
            
            const label = document.createElement('div');
            label.className = 'search-suggestion-label';
            label.textContent = suggestion.label;
            
            contentContainer.appendChild(label);
            
            // Add file and line info if available
            const node = suggestion.node;
            const filePath = node.file || node.path || node.filepath || node.location;
            const lineNumber = node.line || node.lineNumber;
            
            if (filePath || lineNumber) {
                const fileInfo = document.createElement('div');
                fileInfo.className = 'search-suggestion-file';
                
                if (filePath && lineNumber) {
                    fileInfo.textContent = `${filePath}:${lineNumber}`;
                } else if (filePath) {
                    fileInfo.textContent = filePath;
                } else if (lineNumber) {
                    fileInfo.textContent = `Line ${lineNumber}`;
                }
                
                contentContainer.appendChild(fileInfo);
            }
            
            const badge = document.createElement('span');
            badge.className = `search-suggestion-badge ${suggestion.isVisible ? 'badge-visible' : 'badge-hidden'}`;
            badge.textContent = suggestion.isVisible ? 'Visible' : 'Hidden';
            
            item.appendChild(contentContainer);
            item.appendChild(badge);
            
            item.addEventListener('click', () => {
                this.selectSuggestion(index);
            });
            
            this.suggestionsContainer.appendChild(item);
        });
    }
    
    hideSuggestions() {
        if (this.suggestionsContainer) {
            this.suggestionsContainer.classList.add('hidden');
        }
        this.suggestions = [];
        this.selectedSuggestionIndex = -1;
        
        // Re-enable vis-network keyboard handling when suggestions are hidden
        if (this.viewer.network) {
            this.viewer.network.setOptions({
                interaction: { keyboard: { enabled: true } }
            });
        }
    }
    
    navigateSuggestions(direction) {
        if (this.suggestions.length === 0) return;
        
        if (direction === 'down') {
            this.selectedSuggestionIndex = Math.min(
                this.selectedSuggestionIndex + 1,
                this.suggestions.length - 1
            );
        } else if (direction === 'up') {
            this.selectedSuggestionIndex = Math.max(
                this.selectedSuggestionIndex - 1,
                -1
            );
        }
        
        this.renderSuggestions();
        this.scrollToSelected();
    }
    
    scrollToSelected() {
        if (!this.suggestionsContainer || this.selectedSuggestionIndex < 0) return;
        
        const items = this.suggestionsContainer.querySelectorAll('.search-suggestion-item');
        const selectedItem = items[this.selectedSuggestionIndex];
        
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    
    selectSuggestion(index) {
        if (index < 0 || index >= this.suggestions.length) return;
        
        const suggestion = this.suggestions[index];
        this.performHideOthers(suggestion.node.id);
        this.hideSuggestions();
    }
    
    autocompleteFromSuggestion() {
        if (this.selectedSuggestionIndex < 0 || this.selectedSuggestionIndex >= this.suggestions.length) {
            return null;
        }
        
        const suggestion = this.suggestions[this.selectedSuggestionIndex];
        return suggestion.label;
    }
    
    performHideOthers(nodeId) {
        // Reveal node if hidden
        if (this.viewer.isLargeGraphFiltered && this.viewer.hiddenNodes.has(nodeId)) {
            this.viewer.revealNodePath(nodeId);
        }
        
        // Perform hide others
        this.viewer.hideOthers(nodeId);
        this.viewer.updateStats();
    }

    searchNode(query) {
        if (!this.viewer.network || !this.viewer.originalData) return;

        if (!query || query.trim() === '') {
            this.viewer.network.unselectAll();
            this.lastSearchedNode = null;
            return;
        }

        const targetNode = this.findMatchingNode(query);
        
        if (!targetNode) {
            this.viewer.network.unselectAll();
            this.lastSearchedNode = null;
            Logger.debug('SearchManager', 'No match found', { query });
            return;
        }
        
        this.lastSearchedNode = targetNode.id;
        Logger.debug('SearchManager', 'Node found and selected', { query, nodeId: targetNode.id });
        
        const nodePosition = this.getNodePosition(targetNode.id);
        if (!nodePosition) {
            this.viewer.network.unselectAll();
            return;
        }

        // Calculate zoom for readable text
        const minTextSize = Constants.SEARCH.MIN_TEXT_SIZE_PX;
        const nodeFontSize = Constants.SEARCH.NODE_FONT_SIZE_PX;
        const targetScale = minTextSize / nodeFontSize;

        this.viewer.network.moveTo({
            position: nodePosition,
            scale: targetScale,
            animation: {
                duration: Constants.TIMING.ANIMATION_DURATION_MS,
                easingFunction: 'easeInOutQuad'
            }
        });

        this.viewer.network.selectNodes([targetNode.id]);
    }

    findMatchingNode(query) {
        if (!this.viewer.originalData) return null;
        if (!query || query.trim() === '') return null;

        const searchTerm = query.trim().toLowerCase();

        // Filter visible nodes only
        const visibleNodes = this.viewer.originalData.nodes.get({
            filter: (node) => !this.viewer.hiddenNodes.has(node.id)
        });

        const prefixMatches = [];
        const fuzzyMatches = [];
        
        visibleNodes.forEach(node => {
            let label = node.label || '';
            label = label.replace(/<[^>]*>/g, ''); // Strip HTML tags
            const lowerLabel = label.toLowerCase();
            
            if (lowerLabel.startsWith(searchTerm)) {
                prefixMatches.push({ node, label });
            } else {
                const fuzzyScore = this.fuzzyMatch(label, searchTerm);
                if (fuzzyScore > 0) {
                    fuzzyMatches.push({ node, label, fuzzyScore });
                }
            }
        });

        let allMatches = [];
        
        if (prefixMatches.length > 0) {
            prefixMatches.sort((a, b) => a.label.localeCompare(b.label));
            allMatches = prefixMatches.map(m => m.node);
        }
        
        if (allMatches.length === 0 && fuzzyMatches.length > 0) {
            fuzzyMatches.sort((a, b) => {
                if (b.fuzzyScore !== a.fuzzyScore) {
                    return b.fuzzyScore - a.fuzzyScore;
                }
                return a.label.localeCompare(b.label);
            });
            allMatches = fuzzyMatches.map(m => m.node);
        }

        if (allMatches.length === 0) return null;

        // Find first match with position data
        for (const match of allMatches) {
            if (this.getNodePosition(match.id)) {
                return match;
            }
        }

        return null;
    }

    getNodePosition(nodeId) {
        // Try visible network
        try {
            if (this.viewer.network) {
                const positions = this.viewer.network.getPositions([nodeId]);
                if (positions && positions[nodeId]) {
                    return positions[nodeId];
                }
            }
        } catch (e) {}
        
        // Try originalPositions
        if (this.viewer.layoutManager?.originalPositions?.has(nodeId)) {
            return this.viewer.layoutManager.originalPositions.get(nodeId);
        }
        
        // Try node data
        if (this.viewer.nodes) {
            const nodeData = this.viewer.nodes.get(nodeId);
            if (nodeData && nodeData.x !== undefined && nodeData.y !== undefined) {
                return { x: nodeData.x, y: nodeData.y };
            }
        }
        
        return null;
    }

    fuzzyMatch(str, pattern) {
        str = str.toLowerCase();
        pattern = pattern.toLowerCase();
        
        let patternIdx = 0;
        let score = 0;
        let consecutiveMatches = 0;
        
        for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
            if (str[i] === pattern[patternIdx]) {
                score += 1 + consecutiveMatches;
                consecutiveMatches++;
                patternIdx++;
            } else {
                consecutiveMatches = 0;
            }
        }
        
        return patternIdx === pattern.length ? score : 0;
    }
}
