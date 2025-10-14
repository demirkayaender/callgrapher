package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	// Define command-line flags
	var (
		inputPath  = flag.String("path", ".", "Path to Go codebase to analyze")
		outputFile = flag.String("output", "callgraph.dot", "Output DOT file path")
		maxDepth   = flag.Int("depth", -1, "Maximum call depth to analyze (-1 for unlimited)")
		verbose    = flag.Bool("verbose", false, "Enable verbose output")
		excludeDirs = flag.String("exclude", "", "Comma-separated list of directories to exclude (e.g., vendor,testdata)")
	)

	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "DOT Callgraph Generator for Go\n\n")
		fmt.Fprintf(os.Stderr, "Usage: %s [options]\n\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
		fmt.Fprintf(os.Stderr, "\nExample:\n")
		fmt.Fprintf(os.Stderr, "  %s -path ./myproject -output callgraph.dot -verbose\n", os.Args[0])
	}

	flag.Parse()

	// Validate input path
	absPath, err := filepath.Abs(*inputPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error resolving path: %v\n", err)
		os.Exit(1)
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "Error: Path does not exist: %s\n", absPath)
		os.Exit(1)
	}

	if *verbose {
		fmt.Printf("Analyzing Go codebase at: %s\n", absPath)
		fmt.Printf("Output file: %s\n", *outputFile)
		if *maxDepth >= 0 {
			fmt.Printf("Max depth: %d\n", *maxDepth)
		}
	}

	// Create analyzer
	analyzer := NewAnalyzer(absPath, *excludeDirs, *verbose)

	// Analyze the codebase
	if *verbose {
		fmt.Println("Parsing Go files...")
	}

	callGraph, err := analyzer.Analyze()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error analyzing codebase: %v\n", err)
		os.Exit(1)
	}

	if *verbose {
		fmt.Printf("Found %d functions and %d calls\n", 
			len(callGraph.Functions), len(callGraph.Calls))
	}

	// Generate DOT file
	if *verbose {
		fmt.Println("Generating DOT file...")
	}

	generator := NewDOTGenerator(callGraph, *maxDepth)
	dotContent := generator.Generate()

	// Write to file
	err = os.WriteFile(*outputFile, []byte(dotContent), 0644)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error writing output file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("✓ Callgraph successfully generated: %s\n", *outputFile)
	if *verbose {
		fmt.Printf("  Functions: %d\n", len(callGraph.Functions))
		fmt.Printf("  Calls: %d\n", len(callGraph.Calls))
	}
}

