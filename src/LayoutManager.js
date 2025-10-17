// Layout management, positioning, and overlap prevention
import { GraphConfig } from './GraphConfig.js';
import { Logger } from './Logger.js';
import { Constants } from './Constants.js';

export class LayoutManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.originalPositions = new Map();
    }

    storeOriginalPositions() {
        this.originalPositions.clear();
        this.viewer.nodes.forEach((node) => {
            const position = this.viewer.network.getPositions([node.id])[node.id];
            this.originalPositions.set(node.id, { x: position.x, y: position.y });
        });
        
        // Disable physics and hierarchical constraints
        this.viewer.network.setOptions({ 
            physics: { enabled: false },
            layout: { hierarchical: { enabled: false } }
        });
        
        // Enable free movement
        this.viewer.nodes.forEach((node) => {
            this.viewer.nodes.update({
                id: node.id,
                fixed: false,
                physics: false
            });
        });
        
        this.viewer.network.redraw();
        this.fixHorizontalOverlaps();
    }

    fixHorizontalOverlaps() {
        const allNodes = this.viewer.nodes.get();
        if (allNodes.length === 0) return;

        Logger.debug('LayoutManager', 'Fixing horizontal overlaps', { nodeCount: allNodes.length });

        const start = performance.now();
        
        const nodeWidth = Constants.LAYOUT.NODE_WIDTH;
        const nodeHeight = Constants.LAYOUT.NODE_HEIGHT;
        const minSpacing = Constants.LAYOUT.MIN_SPACING;
        
        const nodeIds = allNodes.map(n => n.id);
        const positions = this.viewer.network.getPositions(nodeIds);
        
        const nodesWithPos = allNodes.map(node => ({
            id: node.id,
            x: positions[node.id] ? positions[node.id].x : (node.x || 0),
            y: positions[node.id] ? positions[node.id].y : (node.y || 0)
        })).filter(n => n.x !== 0 || n.y !== 0);
        
        nodesWithPos.sort((a, b) => a.x - b.x);
        
        // Find overlapping pairs
        const needsFixing = [];
        for (let i = 0; i < nodesWithPos.length; i++) {
            for (let j = i + 1; j < nodesWithPos.length; j++) {
                const node1 = nodesWithPos[i];
                const node2 = nodesWithPos[j];
                
                const xDist = Math.abs(node2.x - node1.x);
                if (xDist > nodeWidth * 1.5) break;
                
                // Bounding box collision detection
                const halfWidth = nodeWidth / 2;
                const halfHeight = nodeHeight / 2;
                const spacing = minSpacing / 2;
                
                const overlaps = !(
                    (node1.x + halfWidth + spacing) < (node2.x - halfWidth - spacing) || 
                    (node1.x - halfWidth - spacing) > (node2.x + halfWidth + spacing) || 
                    (node1.y + halfHeight + spacing) < (node2.y - halfHeight - spacing) || 
                    (node1.y - halfHeight - spacing) > (node2.y + halfHeight + spacing)
                );
                
                if (overlaps) {
                    needsFixing.push({ node1, node2 });
                }
            }
        }
        
        // Fix overlaps by moving nodes vertically
        if (needsFixing.length > 0) {
            const groups = this.groupOverlaps(needsFixing);
            
            for (const group of groups) {
                group.sort((a, b) => a.y - b.y);
                
                for (let i = 1; i < group.length; i++) {
                    const prev = group[i - 1];
                    const curr = group[i];
                    const requiredY = prev.y + nodeHeight + minSpacing;
                    
                    if (curr.y < requiredY) {
                        curr.y = requiredY;
                        
                        this.viewer.nodes.update({
                            id: curr.id,
                            y: curr.y
                        });
                        
                        if (this.originalPositions.has(curr.id)) {
                            const pos = this.originalPositions.get(curr.id);
                            this.originalPositions.set(curr.id, { x: pos.x, y: curr.y });
                        }
                    }
                }
            }
        }

        const duration = performance.now() - start;
        Logger.perf('LayoutManager', 'fixHorizontalOverlaps', duration, { 
            nodeCount: allNodes.length,
            overlapCount: needsFixing.length 
        });
    }

    groupOverlaps(overlaps) {
        const groups = [];
        const processed = new Set();
        
        for (const overlap of overlaps) {
            if (processed.has(overlap.node1.id) || processed.has(overlap.node2.id)) continue;
            
            const group = new Set([overlap.node1.id, overlap.node2.id]);
            let changed = true;
            
            while (changed) {
                changed = false;
                for (const check of overlaps) {
                    const hasNode1 = group.has(check.node1.id);
                    const hasNode2 = group.has(check.node2.id);
                    
                    if (hasNode1 && !hasNode2) {
                        group.add(check.node2.id);
                        changed = true;
                    } else if (hasNode2 && !hasNode1) {
                        group.add(check.node1.id);
                        changed = true;
                    }
                }
            }
            
            const allNodes = this.viewer.nodes.get();
            groups.push(Array.from(group).map(id => allNodes.find(n => n.id === id)));
            group.forEach(id => processed.add(id));
        }
        
        return groups;
    }

    calculateNodeLevels(nodeIds, edges) {
        const nodeLevels = new Map();
        const incomingCount = new Map();
        const outgoingEdges = new Map();
        
        nodeIds.forEach(id => {
            incomingCount.set(id, 0);
            outgoingEdges.set(id, []);
            nodeLevels.set(id, 0);
        });
        
        edges.forEach(edge => {
            if (nodeIds.includes(edge.from) && nodeIds.includes(edge.to)) {
                incomingCount.set(edge.to, incomingCount.get(edge.to) + 1);
                outgoingEdges.get(edge.from).push(edge.to);
            }
        });
        
        // BFS from entry nodes
        const queue = [];
        nodeIds.forEach(id => {
            if (incomingCount.get(id) === 0) {
                queue.push({ id, level: 0 });
                nodeLevels.set(id, 0);
            }
        });
        
        while (queue.length > 0) {
            const { id, level } = queue.shift();
            
            outgoingEdges.get(id).forEach(childId => {
                const currentLevel = nodeLevels.get(childId);
                const newLevel = level + 1;
                
                if (newLevel > currentLevel) {
                    nodeLevels.set(childId, newLevel);
                    queue.push({ id: childId, level: newLevel });
                }
            });
        }
        
        return nodeLevels;
    }

    positionIsolatedNodes(isolatedNodes, connectedNodes) {
        const existingPositions = connectedNodes.map(node => {
            const pos = this.viewer.network.getPositions([node.id])[node.id] || 
                       this.originalPositions.get(node.id) || 
                       { x: node.x || 0, y: node.y || 0 };
            return pos;
        });
        
        // Calculate bounding box
        let maxY = 0, minX = Infinity, maxX = -Infinity;
        existingPositions.forEach(pos => {
            if (pos.y > maxY) maxY = pos.y;
            if (pos.x < minX) minX = pos.x;
            if (pos.x > maxX) maxX = pos.x;
        });
        
        const circleX = (minX + maxX) / 2;
        const circleY = maxY + Constants.LAYOUT.ISOLATED_OFFSET_Y;
        const circleRadius = Math.max(
            Constants.LAYOUT.CIRCLE_BASE_RADIUS, 
            Math.sqrt(isolatedNodes.length) * Constants.LAYOUT.CIRCLE_RADIUS_MULTIPLIER
        );
        
        const checkOverlap = (x, y, minDistance = 150) => {
            return existingPositions.some(pos => {
                const dx = pos.x - x;
                const dy = pos.y - y;
                return Math.sqrt(dx * dx + dy * dy) < minDistance;
            });
        };
        
        const isolatedPositions = [];
        for (let i = 0; i < isolatedNodes.length; i++) {
            let attempts = 0;
            let x, y, foundValidPosition = false;
            
            while (attempts < 100 && !foundValidPosition) {
                const angle = Math.random() * 2 * Math.PI;
                const r = Math.sqrt(Math.random()) * circleRadius;
                x = circleX + r * Math.cos(angle);
                y = circleY + r * Math.sin(angle);
                
                const overlapWithExisting = checkOverlap(x, y, 150);
                const overlapWithIsolated = isolatedPositions.some(pos => {
                    const dx = pos.x - x;
                    const dy = pos.y - y;
                    return Math.sqrt(dx * dx + dy * dy) < 120;
                });
                
                if (!overlapWithExisting && !overlapWithIsolated) {
                    foundValidPosition = true;
                }
                attempts++;
            }
            
            if (!foundValidPosition) {
                const fallbackAngle = (i / isolatedNodes.length) * 2 * Math.PI;
                x = circleX + circleRadius * Math.cos(fallbackAngle);
                y = circleY + circleRadius * Math.sin(fallbackAngle);
            }
            
            isolatedPositions.push({ x, y });
        }
        
        return isolatedPositions;
    }

    resetToOriginalPositions() {
        Logger.info('LayoutManager', 'Resetting to original positions');

        this.viewer.nodes.get().forEach((node) => {
            const originalPos = this.originalPositions.get(node.id);
            if (originalPos) {
                this.viewer.nodes.update({
                    id: node.id,
                    x: originalPos.x,
                    y: originalPos.y,
                    fixed: { x: false, y: false },
                    physics: false
                });
            }
        });
        
        this.viewer.network.setOptions({
            physics: { enabled: false },
            layout: { hierarchical: { enabled: false } }
        });
        
        this.viewer.network.redraw();
        this.fixHorizontalOverlaps();
    }
}

