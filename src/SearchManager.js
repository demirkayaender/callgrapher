// Search and fuzzy matching functionality
import { Logger } from './Logger.js';
import { Constants } from './Constants.js';

export class SearchManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.lastSearchedNode = null;
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
