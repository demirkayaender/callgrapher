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
    }
    
    findSuggestions(query) {
        const searchTerm = query.trim().toLowerCase();
        const allNodes = this.viewer.originalData.nodes.get();
        
        const visiblePrefixMatches = [];
        const hiddenPrefixMatches = [];
        const visibleFuzzyMatches = [];
        const hiddenFuzzyMatches = [];
        
        allNodes.forEach(node => {
            let label = node.label || node.id || '';
            label = label.replace(/<[^>]*>/g, ''); // Strip HTML tags
            const lowerLabel = label.toLowerCase();
            const isVisible = !this.viewer.hiddenNodes.has(node.id);
            
            if (lowerLabel.startsWith(searchTerm)) {
                // Exact prefix match
                if (isVisible) {
                    visiblePrefixMatches.push({ node, label, isVisible });
                } else {
                    hiddenPrefixMatches.push({ node, label, isVisible });
                }
            } else {
                // Try fuzzy match
                const fuzzyScore = this.fuzzyMatch(label, searchTerm);
                if (fuzzyScore > 0) {
                    if (isVisible) {
                        visibleFuzzyMatches.push({ node, label, isVisible, fuzzyScore });
                    } else {
                        hiddenFuzzyMatches.push({ node, label, isVisible, fuzzyScore });
                    }
                }
            }
        });
        
        // Sort each category
        visiblePrefixMatches.sort((a, b) => a.label.localeCompare(b.label));
        hiddenPrefixMatches.sort((a, b) => a.label.localeCompare(b.label));
        visibleFuzzyMatches.sort((a, b) => {
            if (b.fuzzyScore !== a.fuzzyScore) return b.fuzzyScore - a.fuzzyScore;
            return a.label.localeCompare(b.label);
        });
        hiddenFuzzyMatches.sort((a, b) => {
            if (b.fuzzyScore !== a.fuzzyScore) return b.fuzzyScore - a.fuzzyScore;
            return a.label.localeCompare(b.label);
        });
        
        // Combine in priority order and take top 10
        const allSuggestions = [
            ...visiblePrefixMatches,
            ...hiddenPrefixMatches,
            ...visibleFuzzyMatches,
            ...hiddenFuzzyMatches
        ];
        
        return allSuggestions.slice(0, 10);
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
            
            const label = document.createElement('span');
            label.className = 'search-suggestion-label';
            label.textContent = suggestion.label;
            
            const badge = document.createElement('span');
            badge.className = `search-suggestion-badge ${suggestion.isVisible ? 'badge-visible' : 'badge-hidden'}`;
            badge.textContent = suggestion.isVisible ? 'Visible' : 'Hidden';
            
            item.appendChild(label);
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
