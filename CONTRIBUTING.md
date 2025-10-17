# Contributing to Callgraph Viewer

Thank you for contributing to the Callgraph Viewer project! This guide will help you get started.

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ 
- npm v9+
- Modern browser (Chrome, Firefox, Edge, Safari)

### Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/callgraph-viewer.git
cd callgraph-viewer

# Install dependencies
npm install

# Start development server
npm start

# The app will open at http://localhost:3000
```

## 📁 Project Structure

```
callgraph/
├── src/                      # Source code (modular architecture)
│   ├── main.js              # Entry point
│   ├── CallGraphViewer.js   # Main coordinator
│   ├── NodeOperations.js    # Node state management
│   ├── LayoutManager.js     # Layout algorithms
│   ├── SearchManager.js     # Search functionality
│   ├── UIManager.js         # UI event handling
│   ├── DotParser.js         # DOT file parsing
│   ├── GraphConfig.js       # Configuration
│   ├── ExportManager.js     # Export handlers
│   ├── Constants.js         # App constants
│   ├── ErrorHandler.js      # Error management
│   └── Logger.js            # Logging system
├── go-parser.js             # Go code parser
├── styles.css               # Styling
├── index.html               # Main HTML
├── ARCHITECTURE.md          # Architecture docs
└── CONTRIBUTING.md          # This file
```

## 🔧 Development Workflow

### 1. Pick an Issue
- Check [GitHub Issues](https://github.com/yourusername/callgraph-viewer/issues)
- Comment on the issue to claim it
- Get clarification if needed

### 2. Create a Branch
```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# Or for bug fixes:
git checkout -b fix/bug-description
```

### 3. Make Changes
- Write clean, readable code
- Follow the [Coding Standards](#-coding-standards)
- Add JSDoc comments to public methods
- Test your changes manually

### 4. Commit Changes
```bash
# Stage your changes
git add .

# Commit with descriptive message
git commit -m "feat: add search history feature"

# Or for fixes:
git commit -m "fix: prevent crash on empty graph"
```

**Commit Message Format:**
```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

### 5. Push and Create PR
```bash
# Push to your branch
git push origin feature/your-feature-name

# Create Pull Request on GitHub
# - Fill out the PR template
# - Link related issues
# - Request review from maintainers
```

## 📝 Coding Standards

### General Principles
1. **DRY** - Don't Repeat Yourself
2. **KISS** - Keep It Simple, Stupid
3. **YAGNI** - You Aren't Gonna Need It
4. **Single Responsibility** - One job per class/method

### Naming Conventions

```javascript
// Classes: PascalCase
class NodeOperations { }

// Methods and variables: camelCase
function collapseNode() { }
const visibleNodes = [];

// Constants: UPPER_SNAKE_CASE
const MAX_NODE_COUNT = 1000;

// Private methods: prefix with _
_internalHelper() { }

// Boolean variables: use is/has/can prefix
const isVisible = true;
const hasConnections = false;
const canExpand = true;
```

### File Organization

```javascript
// 1. Imports at top
import { GraphConfig } from './GraphConfig.js';
import { Logger } from './Logger.js';

// 2. Class declaration
export class MyClass {
    // 3. Constructor
    constructor(viewer) {
        this.viewer = viewer;
    }
    
    // 4. Public methods
    publicMethod() { }
    
    // 5. Private methods (prefixed with _)
    _privateHelper() { }
}

// 6. Helper functions (if not in class)
function helperFunction() { }
```

### Documentation

Use JSDoc for all public methods:

```javascript
/**
 * Collapse a node's connections in the graph
 * 
 * @param {string} nodeId - The unique identifier of the node to collapse
 * @param {'outgoing'|'incoming'|'both'} mode - Which connections to collapse
 * @throws {Error} If nodeId doesn't exist in the graph
 * @returns {void}
 * 
 * @example
 * nodeOps.collapseNode('main.go:main', 'outgoing');
 */
collapseNode(nodeId, mode = 'both') {
    // Implementation
}
```

### Error Handling

**Always use ErrorHandler:**
```javascript
// ❌ BAD
try {
    riskyOperation();
} catch (error) {
    alert('Something went wrong!');
    console.error(error);
}

// ✅ GOOD
try {
    riskyOperation();
} catch (error) {
    ErrorHandler.handle(
        error,
        'ClassName.methodName',
        'Failed to complete operation. Please try again.',
        { nodeId, additionalContext }
    );
}
```

### Logging

**Use Logger instead of console.log:**
```javascript
// ❌ BAD
console.log('Processing nodes:', nodes.length);

// ✅ GOOD
Logger.debug('NodeOperations', 'Processing nodes', { count: nodes.length });
Logger.info('LayoutManager', 'Layout complete', { nodeCount, duration });
Logger.warn('SearchManager', 'No matches found', { query });
```

### Constants

**Use Constants.js for magic numbers:**
```javascript
// ❌ BAD
const spacing = 200;
setTimeout(() => { }, 5000);

// ✅ GOOD
const spacing = Constants.LAYOUT.LEVEL_SPACING;
setTimeout(() => { }, Constants.TIMING.FLASH_DURATION_MS);
```

## 🧪 Testing (Future)

When test suite is added:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

**Test Structure:**
```javascript
// src/__tests__/SearchManager.test.js
import { SearchManager } from '../SearchManager.js';

describe('SearchManager', () => {
    describe('fuzzyMatch', () => {
        it('should match consecutive characters', () => {
            const search = new SearchManager(mockViewer);
            expect(search.fuzzyMatch('hello', 'hlo')).toBeGreaterThan(0);
        });
        
        it('should return 0 for non-matches', () => {
            const search = new SearchManager(mockViewer);
            expect(search.fuzzyMatch('hello', 'xyz')).toBe(0);
        });
    });
});
```

## 📋 Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code follows the [Coding Standards](#-coding-standards)
- [ ] All public methods have JSDoc comments
- [ ] No `console.log` statements (use Logger)
- [ ] No `alert()` statements (use ErrorHandler.showNotification)
- [ ] Constants extracted to Constants.js
- [ ] Error handling uses ErrorHandler
- [ ] Manual testing completed
- [ ] No linter errors (when linter is set up)
- [ ] Documentation updated (if needed)
- [ ] ARCHITECTURE.md updated (for major changes)
- [ ] Commit messages follow convention

## 🐛 Reporting Bugs

**Use the Bug Report template:**

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Load file '...'
2. Click on '....'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Browser: [e.g. Chrome 120]
- OS: [e.g. macOS 14]
- Version: [e.g. 1.2.0]

**Additional context**
Any other relevant information.
```

## 💡 Suggesting Features

**Use the Feature Request template:**

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Additional context**
Any other relevant information.
```

## 🔍 Code Review Process

1. **Automated Checks** (when CI/CD is set up)
   - Linting passes
   - Tests pass
   - Build succeeds

2. **Peer Review**
   - At least one approval required
   - Address all comments
   - Resolve all conversations

3. **Maintainer Review**
   - Final review by tech lead
   - Verify architecture alignment
   - Check for security issues

## 📚 Additional Resources

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [TECH_LEAD_ASSESSMENT.md](./TECH_LEAD_ASSESSMENT.md) - Code quality guidelines
- [vis-network docs](https://visjs.github.io/vis-network/docs/network/) - Graph library docs

## 🤝 Getting Help

- **Questions?** Open a [Discussion](https://github.com/yourusername/callgraph-viewer/discussions)
- **Stuck?** Ask in the PR comments
- **Found a bug?** Open an [Issue](https://github.com/yourusername/callgraph-viewer/issues)

## 📜 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing! 🎉**

