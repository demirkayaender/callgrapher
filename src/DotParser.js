// DOT file parsing functionality

export class DotParser {
    constructor(viewer) {
        this.viewer = viewer;
    }

    async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    async parseDotFile(fileContent) {
        const lines = fileContent.split('\n');
        const nodes = new Map();
        const edges = [];

        let insideGraph = false;

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('digraph') || trimmed.startsWith('graph')) {
                insideGraph = true;
                continue;
            }

            if (!insideGraph) continue;

            if (trimmed === '}') {
                insideGraph = false;
                break;
            }

            // Parse node definitions: "nodeId" [label="Label", ...]
            const nodeMatch = trimmed.match(/"([^"]+)"\s*\[([^\]]+)\]/);
            if (nodeMatch) {
                const nodeId = nodeMatch[1];
                const attributes = nodeMatch[2];
                
                const labelMatch = attributes.match(/label="([^"]+)"/);
                const label = labelMatch ? labelMatch[1] : nodeId;

                // Extract file attribute if present
                const fileMatch = attributes.match(/file="([^"]+)"/);
                const file = fileMatch ? fileMatch[1] : null;

                nodes.set(nodeId, { id: nodeId, label, file });
                continue;
            }

            // Parse edges: "from" -> "to"
            const edgeMatch = trimmed.match(/"([^"]+)"\s*->\s*"([^"]+)"/);
            if (edgeMatch) {
                const from = edgeMatch[1];
                const to = edgeMatch[2];
                
                // Ensure both nodes exist
                if (!nodes.has(from)) {
                    nodes.set(from, { id: from, label: from });
                }
                if (!nodes.has(to)) {
                    nodes.set(to, { id: to, label: to });
                }
                
                edges.push({ from, to });
            }
        }

        return {
            nodes: Array.from(nodes.values()),
            edges
        };
    }
}

