// Go Parser Module
// Parses Go source files to extract function definitions and calls

class GoParser {
    constructor() {
        this.functions = new Map(); // functionName -> { file, calls: Set }
        this.fileContents = new Map(); // fileName -> content
    }

    /**
     * Parse a directory of Go files
     * @param {FileSystemDirectoryHandle} dirHandle - Directory handle from File System Access API
     */
    async parseDirectory(dirHandle) {
        this.functions.clear();
        this.fileContents.clear();
        
        await this.scanDirectory(dirHandle, '');
        
        // Build call graph
        return this.buildCallGraph();
    }

    /**
     * Recursively scan directory for .go files
     */
    async scanDirectory(dirHandle, relativePath) {
        for await (const entry of dirHandle.values()) {
            const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
            
            if (entry.kind === 'file' && entry.name.endsWith('.go') && !entry.name.endsWith('_test.go')) {
                await this.parseGoFile(entry, entryPath);
            } else if (entry.kind === 'directory' && !this.shouldSkipDir(entry.name)) {
                await this.scanDirectory(entry, entryPath);
            }
        }
    }

    /**
     * Check if directory should be skipped
     */
    shouldSkipDir(name) {
        const skipDirs = ['vendor', 'node_modules', '.git', 'testdata'];
        return skipDirs.includes(name) || name.startsWith('.');
    }

    /**
     * Parse a single Go file
     */
    async parseGoFile(fileHandle, filePath) {
        try {
            const file = await fileHandle.getFile();
            const content = await file.text();
            this.fileContents.set(filePath, content);
            
            // Extract package name
            const packageMatch = content.match(/^\s*package\s+(\w+)/m);
            const packageName = packageMatch ? packageMatch[1] : 'main';
            
            // Find all function definitions using a more robust approach
            // Split by lines and look for function declarations
            const lines = content.split('\n');
            let currentPos = 0;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                // Skip comments and blank lines
                if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*') || trimmedLine === '') {
                    currentPos += line.length + 1; // +1 for newline
                    continue;
                }
                
                // Match function declarations
                // Handles: func name(), func (r Receiver) name(), func name[T any]()
                const funcMatch = trimmedLine.match(/^func\s+(?:\([^)]+\)\s+)?(\w+)(?:\[[^\]]+\])?\s*\(/);
                
                if (funcMatch) {
                    const funcName = funcMatch[1];
                    const fullName = `${packageName}.${funcName}`;
                    const lineNumber = i + 1; // Line numbers are 1-indexed
                    
                    // Find the position in content for this line
                    const funcPos = currentPos + line.indexOf('func');
                    
                    // Find where parameters end - need to handle nested parens
                    let parenDepth = 0;
                    let paramStart = currentPos + line.indexOf('(', line.indexOf(funcName));
                    let paramEnd = paramStart;
                    let inString = false;
                    let stringChar = '';
                    
                    for (let pos = paramStart; pos < content.length; pos++) {
                        const char = content[pos];
                        
                        // Handle strings
                        if ((char === '"' || char === '`') && content[pos - 1] !== '\\') {
                            if (!inString) {
                                inString = true;
                                stringChar = char;
                            } else if (char === stringChar) {
                                inString = false;
                            }
                        }
                        
                        if (!inString) {
                            if (char === '(') parenDepth++;
                            if (char === ')') {
                                parenDepth--;
                                if (parenDepth === 0) {
                                    paramEnd = pos;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Get the function body to analyze calls
                    const funcStart = paramEnd + 1;
                    const funcBody = this.extractFunctionBody(content, funcStart);
                    
                    if (funcBody) {
                        // Extract calls from the main function body
                        const calls = this.extractFunctionCalls(funcBody);
                        
                        // Also extract calls from local/nested functions
                        const localFunctionCalls = this.extractLocalFunctionCalls(funcBody);
                        localFunctionCalls.forEach(call => calls.add(call));
                        
                        this.functions.set(fullName, {
                            name: funcName,
                            package: packageName,
                            file: filePath,
                            line: lineNumber,
                            calls: calls
                        });
                    }
                }
                
                currentPos += line.length + 1; // +1 for newline
            }
            
            console.log(`Parsed ${filePath}: found ${this.functions.size} total functions`);
        } catch (error) {
            console.error(`Error parsing ${filePath}:`, error);
        }
    }

    /**
     * Calculate line number from character position in content
     */
    getLineNumber(content, position) {
        const upToPosition = content.substring(0, position);
        return upToPosition.split('\n').length;
    }

    /**
     * Extract function body from content starting at position
     */
    extractFunctionBody(content, startPos) {
        let braceCount = 0;
        let inBody = false;
        let body = '';
        let inString = false;
        let stringChar = '';
        let inLineComment = false;
        let inBlockComment = false;
        
        for (let i = startPos; i < content.length; i++) {
            const char = content[i];
            const nextChar = i + 1 < content.length ? content[i + 1] : '';
            const prevChar = i > 0 ? content[i - 1] : '';
            
            // Handle comments (only outside strings)
            if (!inString) {
                // Start of block comment
                if (char === '/' && nextChar === '*' && !inLineComment) {
                    inBlockComment = true;
                    i++; // Skip next char
                    continue;
                }
                // End of block comment
                if (char === '*' && nextChar === '/' && inBlockComment) {
                    inBlockComment = false;
                    i++; // Skip next char
                    continue;
                }
                // Start of line comment
                if (char === '/' && nextChar === '/' && !inBlockComment) {
                    inLineComment = true;
                    continue;
                }
                // End of line comment
                if (char === '\n' && inLineComment) {
                    inLineComment = false;
                    continue;
                }
            }
            
            // Skip if in comment
            if (inLineComment || inBlockComment) {
                continue;
            }
            
            // Handle strings
            if ((char === '"' || char === '`') && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }
            
            // Count braces only outside strings and comments
            if (!inString) {
                if (char === '{') {
                    braceCount++;
                    inBody = true;
                } else if (char === '}') {
                    braceCount--;
                }
            }
            
            if (inBody) {
                body += char;
                
                // Stop when we've closed all braces (outside strings)
                if (braceCount === 0 && !inString) {
                    break;
                }
            }
        }
        
        return body;
    }

    /**
     * Extract function calls from function body
     */
    extractFunctionCalls(body) {
        const calls = new Set();
        
        // Remove string literals to avoid false positives
        let cleanBody = body.replace(/"(?:[^"\\]|\\.)*"|`[^`]*`/g, '""');
        
        // Remove comments
        cleanBody = cleanBody.replace(/\/\/[^\n]*/g, '');
        cleanBody = cleanBody.replace(/\/\*[\s\S]*?\*\//g, '');
        
        // Match function calls: identifier.function() or function()
        // This regex matches: optional_receiver.functionName(
        const callRegex = /(?:(\w+)\.)?(\w+)\s*\(/g;
        let match;
        
        while ((match = callRegex.exec(cleanBody)) !== null) {
            const receiver = match[1];
            const funcName = match[2];
            
            // Skip common keywords and built-ins
            if (this.isKeywordOrBuiltin(funcName)) {
                continue;
            }
            
            // If there's a receiver, it's a package.function call
            if (receiver) {
                calls.add(`${receiver}.${funcName}`);
            } else {
                // Local function call - we'll need to resolve the package later
                calls.add(funcName);
            }
        }
        
        return calls;
    }

    /**
     * Extract calls from local/nested functions within a function body
     * Handles: varName := func() { ... } and func() { ... }
     */
    extractLocalFunctionCalls(body) {
        const allCalls = new Set();
        
        // Find all local function definitions
        // Pattern 1: varName := func() { ... }
        // Pattern 2: anonymous functions func() { ... }
        const funcPattern = /func\s*\([^)]*\)\s*(?:\([^)]*\))?\s*\{/g;
        
        let match;
        while ((match = funcPattern.exec(body)) !== null) {
            const funcStart = match.index + match[0].length - 1; // Position of opening brace
            
            // Extract the nested function body
            const nestedBody = this.extractNestedFunctionBody(body, funcStart);
            
            if (nestedBody) {
                // Extract calls from the nested function
                const calls = this.extractFunctionCalls(nestedBody);
                calls.forEach(call => allCalls.add(call));
                
                // Recursively extract from deeper nested functions
                const deeperCalls = this.extractLocalFunctionCalls(nestedBody);
                deeperCalls.forEach(call => allCalls.add(call));
            }
        }
        
        return allCalls;
    }

    /**
     * Extract a nested function body starting from the opening brace
     * Similar to extractFunctionBody but works within an already extracted body
     */
    extractNestedFunctionBody(content, startPos) {
        let braceCount = 0;
        let body = '';
        let inString = false;
        let stringChar = '';
        
        for (let i = startPos; i < content.length; i++) {
            const char = content[i];
            const prevChar = i > 0 ? content[i - 1] : '';
            
            // Handle strings
            if ((char === '"' || char === '`') && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
            }
            
            // Count braces only outside strings
            if (!inString) {
                if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                }
            }
            
            body += char;
            
            // Stop when we've closed all braces
            if (braceCount === 0 && body.length > 1) {
                break;
            }
        }
        
        return body;
    }

    /**
     * Check if a name is a Go keyword or builtin
     */
    isKeywordOrBuiltin(name) {
        const keywords = [
            'if', 'else', 'for', 'switch', 'case', 'default', 'return',
            'break', 'continue', 'goto', 'fallthrough', 'defer', 'go',
            'select', 'range', 'type', 'struct', 'interface', 'map',
            'func', 'var', 'const', 'package', 'import'
        ];
        
        const builtins = [
            'make', 'new', 'len', 'cap', 'append', 'copy', 'delete',
            'panic', 'recover', 'print', 'println', 'close', 'complex',
            'real', 'imag', 'error'
        ];
        
        return keywords.includes(name) || builtins.includes(name);
    }

    /**
     * Build call graph from parsed functions
     */
    buildCallGraph() {
        const edges = [];
        
        console.log(`Building call graph with ${this.functions.size} functions`);
        
        // For each function, resolve its calls
        for (const [callerName, callerData] of this.functions.entries()) {
            const callerPackage = callerData.package;
            
            for (const call of callerData.calls) {
                // Try to resolve the call
                let resolvedCallee = null;
                
                if (call.includes('.')) {
                    // Already has package prefix
                    resolvedCallee = call;
                } else {
                    // Try to find in same package first
                    const samePackageCallee = `${callerPackage}.${call}`;
                    if (this.functions.has(samePackageCallee)) {
                        resolvedCallee = samePackageCallee;
                    } else {
                        // Search in other packages
                        for (const [funcName] of this.functions.entries()) {
                            if (funcName.endsWith(`.${call}`)) {
                                resolvedCallee = funcName;
                                break;
                            }
                        }
                    }
                }
                
                // Add edge if callee was found
                if (resolvedCallee && this.functions.has(resolvedCallee)) {
                    edges.push({
                        from: callerName,
                        to: resolvedCallee
                    });
                }
            }
        }
        
        console.log(`Generated ${edges.length} edges`);
        
        return {
            functions: this.functions,  // Return the full Map, not just keys
            edges: edges
        };
    }

    /**
     * Generate DOT format from call graph
     */
    generateDOT(callGraph) {
        let dot = 'digraph callgraph {\n';
        dot += '    rankdir=LR;\n';
        dot += '    node [shape=box];\n\n';
        
        // Add all nodes
        const nodeIds = new Map();
        let index = 0;
        callGraph.functions.forEach((funcData, funcName) => {
            const nodeId = `n${index}`;
            index++;
            nodeIds.set(funcName, nodeId);
            // Use function name without package for label
            const label = funcName.split('.').pop();
            // Add file path and line number as attributes if available
            const fileAttr = funcData && funcData.file ? ` file="${funcData.file}"` : '';
            const lineAttr = funcData && funcData.line ? ` line="${funcData.line}"` : '';
            dot += `    ${nodeId} [label="${label}"${fileAttr}${lineAttr}];\n`;
        });
        
        dot += '\n';
        
        // Add all edges
        callGraph.edges.forEach(edge => {
            const fromId = nodeIds.get(edge.from);
            const toId = nodeIds.get(edge.to);
            if (fromId && toId) {
                dot += `    ${fromId} -> ${toId};\n`;
            }
        });
        
        dot += '}\n';
        
        return dot;
    }
}

// Make it available globally
window.GoParser = GoParser;

