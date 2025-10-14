# Callgraph Viewer Features

## ✨ Enhanced Collapse System

The callgraph viewer now supports **granular collapse control** for each node, allowing you to hide specific types of connections.

### How It Works

#### Context Menu (Right-Click)

Right-click any node to open a context menu with these options:

**Collapse Options:**

1. **⬇️ Collapse Outgoing Calls**
   - Hides all functions that this node calls
   - Useful for hiding implementation details
   - Node turns light blue

2. **⬆️ Collapse Incoming Calls**
   - Hides all functions that call this node
   - Useful for simplifying caller chains
   - Node turns light green

3. **📦 Collapse All Connections**
   - Hides both incoming and outgoing calls
   - Maximum simplification
   - Node turns yellow/orange

**Expand Options:**

4. **📂 Expand All**
   - Restores all connections for this node
   - Node returns to white

5. **⬇️ Expand Outgoing Calls**
   - Shows only the outgoing calls
   - Keeps incoming calls collapsed if they were collapsed
   - Node color updates accordingly

6. **⬆️ Expand Incoming Calls**
   - Shows only the incoming calls
   - Keeps outgoing calls collapsed if they were collapsed
   - Node color updates accordingly

#### Quick Actions

- **Double-click**: Quickly collapse/expand all connections (same as "Collapse All")
- **Single-click**: View node details in the side panel

### Visual Indicators

Nodes use **independent visual cues** for each collapse state:
- **Border** = Outgoing calls state
- **Background** = Incoming calls state

| Background | Border | Border Width | Meaning |
|------------|--------|--------------|---------|
| White | Blue | 2px | Fully expanded (all connections visible) |
| White | Dark Gray | **4px (thick)** | Outgoing collapsed (children hidden) |
| Gray | Blue | 2px | Incoming collapsed (parents hidden) |
| Gray | Dark Gray | **4px (thick)** | Both collapsed (all hidden) |
| Yellow (flash) | Yellow | 4px | Just acted on (fades in 3 seconds) |

### Use Cases

#### 1. Understanding High-Level Flow
Collapse outgoing calls on high-level functions to see just the main program flow without getting lost in implementation details.

**Example:**
```
main() → initialize()
     → processData()
     → cleanup()
```
Right-click each function and "Collapse Outgoing Calls" to hide their internal calls.

#### 2. Finding Who Calls a Function
Collapse incoming calls on utility functions to hide all the callers and focus on what the function does.

**Example:**
If `parseJSON()` is called from 20 places, collapse its incoming calls to see just its outgoing logic.

#### 3. Simplifying Complex Graphs
For functions with many connections in both directions, collapse all to create a cleaner view, then selectively expand what you need.

#### 4. Comparing Call Patterns
Collapse outgoing calls on similar functions to compare their calling patterns side by side.

### Smart Visibility Management

The system intelligently manages node visibility:

- Nodes remain visible if referenced by other visible nodes
- Collapsing is tracked per-node, allowing complex collapse combinations
- Expanding a node only shows connections not hidden by other collapses
- State is preserved when dragging nodes around

### Keyboard-Free Navigation

All collapse features are accessible via mouse only:
- Right-click for precise control
- Double-click for quick all-or-nothing collapse
- No keyboard shortcuts to remember!

### Technical Implementation

- Uses a `Map` to track collapse state per node: `{outgoing: bool, incoming: bool}`
- Dynamically updates graph visibility based on collapse states
- Color-codes nodes using different hues for each collapse type
- Context menu is positioned at cursor location
- Handles edge cases like circular dependencies and multiple collapse states

### Performance

- Instant collapse/expand even for large graphs
- No performance degradation with multiple collapsed nodes
- Efficient visibility calculations using Set operations

## Other Features

### Interactive Controls
- **Drag & Drop**: Move nodes freely
- **Zoom**: Mouse wheel to zoom in/out
- **Pan**: Drag canvas to move around
- **Details Panel**: Click nodes for detailed information

### Graph Management
- **Fit to View**: Auto-zoom to see entire graph
- **Reset Layout**: Restore original positions and states
- **Export PNG**: Save current view as image

### File Support
- Load any DOT/Graphviz file
- Automatic layout with hierarchical arrangement
- Package-aware color coding (if using dotgen)

### Modern UI
- Gradient backgrounds
- Smooth animations
- Responsive design
- Context-sensitive help
- Real-time statistics

---

**Tip**: Try right-clicking on the main entry point of your callgraph and selecting "Collapse Outgoing Calls" - you'll instantly see the high-level program structure!

