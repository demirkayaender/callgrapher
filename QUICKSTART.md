# Quick Start Guide

Get up and running with the Callgraph Viewer in 5 minutes!

## Option 1: Try the Web Viewer (Fastest)

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Load an example:**
   - Click "Choose DOT File"
   - Select `example.dot` or `example-go-callgraph.dot`

3. **Explore:**
   - Drag nodes to move them
   - Double-click nodes to collapse/expand
   - Click nodes to see details

That's it! 🎉

## Option 2: Generate from Your Go Code

### Build the Generator

```bash
cd dotgen
make build
```

### Generate a Callgraph

From your Go project:
```bash
./dotgen -path /path/to/your/go/project -output ../my-callgraph.dot -verbose
```

Or try the example:
```bash
make example
cp example-callgraph.dot ..
```

### Visualize

```bash
cd ..
npm start
```

Then load your generated `.dot` file!

## What You Can Do

### Interactive Features

- **🖱️ Drag nodes**: Click and hold to reposition
- **🔍 Zoom**: Mouse wheel up/down
- **👆 Pan**: Drag empty space
- **👁️ View details**: Single-click a node
- **📦 Collapse Options**: Right-click a node for:
  - ⬇️ Collapse Outgoing Calls only
  - ⬆️ Collapse Incoming Calls only
  - 📦 Collapse All Connections
  - 📂 Expand All
- **⚡ Quick Collapse**: Double-click to collapse all connections
- **🎯 Fit view**: Click "Fit to View" button
- **🔄 Reset**: Click "Reset Layout" to restore
- **💾 Export**: Click "Export PNG" to save

### Node Colors

- **White with blue border**: Normal expanded nodes
- **Light blue with blue border**: Outgoing calls collapsed
- **Light green with green border**: Incoming calls collapsed
- **Yellow with orange border**: All connections collapsed

## Tips

1. **For large graphs**: Double-click high-level functions to collapse details
2. **Lost in the graph?**: Click "Fit to View"
3. **Want to start over?**: Click "Reset Layout"
4. **Exploring Go code?**: Use `-exclude vendor,testdata` to skip large directories

## Examples

### Generate from Go Standard Library Package

```bash
cd dotgen
./dotgen -path $GOROOT/src/net/http -output http-callgraph.dot -exclude testdata
cd ..
npm start
# Load http-callgraph.dot
```

### Generate from Your Project

```bash
cd dotgen
./dotgen -path ~/projects/myapp -output myapp.dot -verbose -exclude vendor,node_modules
cd ..
npm start
# Load myapp.dot
```

## Troubleshooting

### Port 3000 already in use?

Edit `package.json` and change the port:
```json
"start": "npx http-server -p 8000 -o"
```

### dotgen build fails?

Ensure you have Go 1.21+:
```bash
go version
```

### Graph doesn't render?

Check the browser console (F12) for errors. Ensure your DOT file syntax is valid.

## Next Steps

- Read the [main README](README.md) for complete documentation
- Check out [dotgen README](dotgen/README.md) for advanced options
- Create callgraphs for your own projects!

## Support

Found an issue or have a question? Check the documentation or create an issue on GitHub.

Happy visualizing! 🚀

