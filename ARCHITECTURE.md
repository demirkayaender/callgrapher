# Callgraph Viewer - Architecture Documentation

## Overview

The application has been refactored into a clean, modular architecture following SOLID principles and best practices. The codebase is now organized into focused modules with clear separation of concerns.

## Module Structure

```
src/
├── main.js                 # Application entry point
├── CallGraphViewer.js      # Main coordinator class
├── DotParser.js            # DOT file parsing
├── GraphConfig.js          # Configuration and constants
├── NodeOperations.js       # Node collapse/expand operations
├── LayoutManager.js        # Layout and positioning logic
├── SearchManager.js        # Search and fuzzy matching
├── ExportManager.js        # Graph export functionality
└── UIManager.js            # UI event handling
```

## Module Responsibilities

### main.js
- Entry point that initializes the application
- Minimal code, just instantiates CallGraphViewer

### CallGraphViewer.js
**The main coordinator** that composes all other modules.

**Responsibilities:**
- Manages core application state (network, nodes, edges, visibility)
- Coordinates between different managers
- Implements high-level operations (parseGraph, hideOthers, resetLayout, etc.)
- Handles graph rendering and updates

**Key Methods:**
- `handleFileUpload()` - Process uploaded DOT files
- `handleGenerateFromFolder()` - Generate DOT from Go source
- `parseDotFile()` - Parse DOT content into graph data
- `renderGraph()` - Initialize vis-network instance
- `updateGraphVisibility()` - Refresh visible nodes/edges
- `hideOthers()` - Focus on specific node's connections
- `resetLayout()` - Return to initial state
- `toggleIsolatedNodes()` - Show/hide isolated nodes

### DotParser.js
**Pure parsing logic** for DOT files.

**Responsibilities:**
- Read file contents asynchronously
- Parse DOT format into node/edge data structures
- Extract node attributes (labels, file paths, etc.)

**Methods:**
- `readFile(file)` - Async file reading
- `parseDotFile(content)` - Parse DOT text into data

### GraphConfig.js
**Static configuration** for graph visualization.

**Responsibilities:**
- Centralize all visualization settings
- Provide consistent styling across the app
- Define color schemes and visual states

**Static Methods:**
- `getOptions()` - vis-network configuration
- `getCompactPhysicsOptions()` - Physics for reorganization
- `getNodeDefaults()` - Default node styling
- `getEdgeDefaults()` - Default edge styling
- `getNodeColors(collapseState)` - Colors based on state
- `getFlashColors()` - Colors for node highlighting
- `getIsolatedNodeColors()` - Colors for isolated nodes

### NodeOperations.js
**Node state management** and operations.

**Responsibilities:**
- Track collapsed/expanded state
- Implement collapse/expand logic
- Manage node appearance and animations
- Handle flash animations

**Key Properties:**
- `collapsedNodes` - Map of node states
- `flashTimeouts` - Animation timers
- `lastActionNode` - Last interacted node

**Methods:**
- `collapseNode(id, mode)` - Collapse node connections
- `expandNode(id, mode)` - Expand node connections
- `toggleNodeCollapse(id)` - Toggle state
- `collapseAll()` - Collapse to entry points
- `expandAll()` - Show entire graph
- `updateNodeAppearance(id)` - Update visual state
- `flashNode(id)` - Animated highlight
- `isNodeReferenced()` - Check if node should stay visible

### LayoutManager.js
**Layout and positioning** logic.

**Responsibilities:**
- Store and manage node positions
- Prevent node overlaps
- Calculate hierarchical levels
- Position isolated nodes

**Key Properties:**
- `originalPositions` - Map of stored positions

**Methods:**
- `storeOriginalPositions()` - Save initial layout
- `fixHorizontalOverlaps()` - Prevent node overlaps
- `calculateNodeLevels()` - BFS hierarchy calculation
- `positionIsolatedNodes()` - Arrange isolated nodes in circle
- `resetToOriginalPositions()` - Restore saved positions
- `groupOverlaps()` - Group overlapping nodes for redistribution

### SearchManager.js
**Search and matching** functionality.

**Responsibilities:**
- Implement prefix and fuzzy matching
- Find and navigate to nodes
- Center view on matched nodes

**Methods:**
- `searchNode(query)` - Search and jump to node
- `findMatchingNode(query)` - Find best match
- `fuzzyMatch(str, pattern)` - Fuzzy string matching
- `getNodePosition(id)` - Get node coordinates

### ExportManager.js
**Export** functionality.

**Responsibilities:**
- Export graph to PNG format

**Methods:**
- `exportToPNG()` - Generate and download PNG

### UIManager.js
**UI event handling** and user interactions.

**Responsibilities:**
- Set up all event listeners
- Handle keyboard shortcuts
- Manage context menus
- Display detail panels and help overlays

**Key Properties:**
- `contextMenuNode` - Currently selected menu node

**Methods:**
- `initializeEventListeners()` - Wire up all UI events
- `setupFileHandlers()` - File upload handlers
- `setupButtonHandlers()` - Button click handlers
- `setupSearchHandlers()` - Search input handlers
- `setupKeyboardShortcuts()` - Keyboard event handlers
- `setupContextMenu()` - Right-click menu handlers
- `showContextMenu()` - Display context menu
- `buildContextMenuItems()` - Dynamic menu generation
- `handleContextMenuAction()` - Process menu actions
- `showNodeDetails()` - Display node information
- `showHelpOverlay()` / `hideHelpOverlay()` - Help modal

## Design Patterns Used

### 1. **Composition over Inheritance**
CallGraphViewer composes functionality from multiple manager classes rather than inheriting behavior.

```javascript
this.nodeOps = new NodeOperations(this);
this.layoutManager = new LayoutManager(this);
this.searchManager = new SearchManager(this);
// etc.
```

### 2. **Dependency Injection**
Each manager receives the main viewer instance, allowing access to shared state without tight coupling.

```javascript
constructor(viewer) {
    this.viewer = viewer;
}
```

### 3. **Single Responsibility Principle**
Each module has one clear purpose:
- DotParser: parsing only
- NodeOperations: node state only
- LayoutManager: positioning only
- etc.

### 4. **Static Configuration**
GraphConfig uses static methods to provide configuration, avoiding unnecessary instantiation.

### 5. **Event-Driven Architecture**
UIManager centralizes all event handling, keeping the main class focused on business logic.

## Data Flow

1. **User Action** → UIManager captures event
2. **UIManager** → Calls appropriate method on CallGraphViewer or managers
3. **Manager** → Performs operation, updates state
4. **CallGraphViewer** → Coordinates updates across modules
5. **vis-network** → Renders updated graph

## Key Improvements

### Before (app.js)
- ❌ Single 2154-line file
- ❌ Mixed concerns (UI, logic, layout, state)
- ❌ Difficult to test individual components
- ❌ Hard to maintain and extend

### After (Modular)
- ✅ 9 focused modules, largest ~450 lines
- ✅ Clear separation of concerns
- ✅ Each module independently testable
- ✅ Easy to extend (e.g., add new layout algorithms)
- ✅ Reusable components
- ✅ Better code organization and readability
- ✅ Follows ES6 module system
- ✅ Consistent coding style

## Adding New Features

### Example: Adding a new layout algorithm

1. **Add method to LayoutManager**:
   ```javascript
   applyCircularLayout() {
       // implementation
   }
   ```

2. **Add button in index.html**:
   ```html
   <button id="circular-layout-button">Circular</button>
   ```

3. **Wire up in UIManager**:
   ```javascript
   document.getElementById('circular-layout-button')
       .addEventListener('click', () => 
           this.viewer.layoutManager.applyCircularLayout()
       );
   ```

### Example: Adding a new export format

1. **Add method to ExportManager**:
   ```javascript
   exportToSVG() {
       // implementation
   }
   ```

2. **Call from UIManager**:
   ```javascript
   this.viewer.exportManager.exportToSVG();
   ```

## Testing Strategy

Each module can be tested independently:

```javascript
// Example: Testing SearchManager
import { SearchManager } from './src/SearchManager.js';

const mockViewer = {
    network: mockNetwork,
    originalData: mockData,
    hiddenNodes: new Set()
};

const searchManager = new SearchManager(mockViewer);
const result = searchManager.fuzzyMatch("hello", "hlo");
assert(result > 0);
```

## Performance Considerations

- **Lazy Initialization**: Managers only do work when called
- **Efficient Data Structures**: Maps and Sets for O(1) lookups
- **Event Delegation**: Single listeners instead of per-node listeners
- **Debouncing**: Search input could be debounced (future enhancement)

## Future Enhancements

1. **Testing**: Add unit tests for each module
2. **TypeScript**: Convert to TypeScript for type safety
3. **WebWorkers**: Move heavy computations (overlap detection) to workers
4. **State Management**: Consider using a state management library
5. **Plugin System**: Allow third-party layout/export plugins

## Conclusion

The refactored architecture provides a solid foundation for future development. Each module is focused, testable, and maintainable. The composition-based approach makes it easy to extend functionality without modifying existing code.

