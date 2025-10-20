// Centralized constants for the application
// All magic numbers should be defined here with clear documentation

export class Constants {
    // Layout dimensions
    static LAYOUT = {
        // Node dimensions for overlap detection
        NODE_WIDTH: 200,        // Estimated width of node boxes in pixels
        NODE_HEIGHT: 80,        // Estimated height of node boxes in pixels
        MIN_SPACING: 40,        // Minimum space between nodes in pixels
        
        // Hierarchical layout spacing
        LEVEL_SPACING: 200,     // Horizontal distance between hierarchy levels
        VERTICAL_SPACING: 150,  // Vertical distance between nodes in same level
        TREE_SPACING: 130,      // Space between separate trees in forest
        
        // Isolated nodes positioning
        CIRCLE_BASE_RADIUS: 200,           // Base radius for isolated node circle
        CIRCLE_RADIUS_MULTIPLIER: 80,      // Multiplier based on node count
        ISOLATED_OFFSET_Y: 500,            // Distance below main graph
        ISOLATED_MIN_DISTANCE: 120,        // Min distance between isolated nodes
        ISOLATED_OVERLAP_DISTANCE: 150,    // Distance check vs connected nodes
    };
    
    // Animation and timing
    static TIMING = {
        // Layout stabilization
        STABILIZATION_TIMEOUT_MS: 5,       // Fallback if stabilization event doesn't fire
        STABILIZATION_DELAY_MS: 200,       // Delay before post-stabilization actions
        STABILIZATION_FINAL_DELAY_MS: 300, // Final delay before fit/select
        
        // Node flash animation
        FLASH_DURATION_MS: 3000,           // Duration of flash fade-out
        FLASH_STEPS: 30,                   // Number of interpolation steps
        
        // View animations
        ANIMATION_DURATION_MS: 500,        // Duration of zoom/pan animations
        FOCUS_ANIMATION_MS: 300,           // Duration when focusing on node
        
        // UI interactions
        BROWSER_OPEN_DELAY_MS: 2000,       // Delay before opening browser on start
    };
    
    // Search and text rendering
    static SEARCH = {
        MIN_TEXT_SIZE_PX: 12,              // Target readable text size
        NODE_FONT_SIZE_PX: 14,             // Default node font size
        MAX_OVERLAP_ATTEMPTS: 100,         // Max attempts to find non-overlapping position
    };
    
    // Large graph filtering
    static LARGE_GRAPH = {
        NODE_THRESHOLD: 50,                // Node count to trigger filtering
        TOP_NODES_COUNT: 10,               // Number of top chains to show
    };
    
    // Physics simulation parameters
    static PHYSICS = {
        // Hierarchical repulsion (initial layout)
        HIERARCHICAL: {
            CENTRAL_GRAVITY: 0.0,
            SPRING_LENGTH: 90,
            SPRING_CONSTANT: 0.01,
            NODE_DISTANCE: 100,
            DAMPING: 0.09,
            AVOID_OVERLAP: 0.3,
            STABILIZATION_ITERATIONS: 300,
        },
        
        // Force Atlas (compaction)
        FORCE_ATLAS: {
            GRAVITATIONAL_CONSTANT: -35,
            CENTRAL_GRAVITY: 0.005,
            SPRING_LENGTH: 100,
            SPRING_CONSTANT: 0.08,
            DAMPING: 0.4,
            AVOID_OVERLAP: 0.5,
            STABILIZATION_ITERATIONS: 200,
            UPDATE_INTERVAL: 25,
        },
    };
    
    // Visual styling
    static STYLES = {
        // Node constraints
        NODE_MIN_WIDTH: 80,
        NODE_MAX_WIDTH: 150,
        NODE_MIN_WIDTH_DISPLAY: 100,
        NODE_MAX_WIDTH_DISPLAY: 200,
        NODE_MARGIN: 5,
        NODE_MARGIN_DISPLAY: 10,
        
        // Border styling
        BORDER_WIDTH_NORMAL: 2,
        BORDER_WIDTH_COLLAPSED: 2,      // Same as normal, but dashed
        BORDER_DASH_PATTERN: [5, 5],    // 5px dash, 5px gap
        
        // Edge styling
        EDGE_WIDTH: 2,
        EDGE_ARROW_SCALE: 0.8,
        EDGE_ROUNDNESS: 0.2,
        EDGE_ROUNDNESS_DISPLAY: 0.5,
        
        // Isolated node styling
        ISOLATED_BORDER_WIDTH: 1,
    };
}

