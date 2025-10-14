# Makefile for dotgen - Go Callgraph Generator

.PHONY: all build install clean test example help

# Binary name
BINARY=dotgen
OUTPUT_DIR=bin

all: build

# Build the binary
build:
	@echo "Building $(BINARY)..."
	@go build -o $(BINARY) .
	@echo "✓ Build complete: ./$(BINARY)"

# Install to GOPATH/bin
install:
	@echo "Installing $(BINARY)..."
	@go install
	@echo "✓ Installed to $(GOPATH)/bin/$(BINARY)"

# Build for multiple platforms
build-all:
	@echo "Building for multiple platforms..."
	@mkdir -p $(OUTPUT_DIR)
	@GOOS=darwin GOARCH=amd64 go build -o $(OUTPUT_DIR)/$(BINARY)-darwin-amd64 .
	@GOOS=darwin GOARCH=arm64 go build -o $(OUTPUT_DIR)/$(BINARY)-darwin-arm64 .
	@GOOS=linux GOARCH=amd64 go build -o $(OUTPUT_DIR)/$(BINARY)-linux-amd64 .
	@GOOS=windows GOARCH=amd64 go build -o $(OUTPUT_DIR)/$(BINARY)-windows-amd64.exe .
	@echo "✓ Built all platforms in $(OUTPUT_DIR)/"

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -f $(BINARY)
	@rm -f $(BINARY).exe
	@rm -f *.dot
	@rm -rf $(OUTPUT_DIR)
	@echo "✓ Clean complete"

# Run tests
test:
	@echo "Running tests..."
	@go test -v ./...

# Generate example callgraph
example: build
	@echo "Generating example callgraph..."
	@./$(BINARY) -path ./example-project -output example-callgraph.dot -verbose
	@echo "✓ Example generated: example-callgraph.dot"

# Show help
help:
	@echo "dotgen - Go Callgraph Generator"
	@echo ""
	@echo "Usage:"
	@echo "  make build       - Build the binary"
	@echo "  make install     - Install to GOPATH/bin"
	@echo "  make build-all   - Build for all platforms"
	@echo "  make clean       - Remove build artifacts"
	@echo "  make test        - Run tests"
	@echo "  make example     - Generate example callgraph"
	@echo "  make help        - Show this help"

