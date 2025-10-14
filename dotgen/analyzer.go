package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// Function represents a function in the codebase
type Function struct {
	Name       string
	Package    string
	File       string
	Receiver   string // For methods
	IsExported bool
}

// Call represents a function call
type Call struct {
	From string // Caller function
	To   string // Callee function
}

// CallGraph represents the complete callgraph
type CallGraph struct {
	Functions map[string]*Function
	Calls     []Call
	Packages  map[string]bool
}

// Analyzer analyzes Go code to extract callgraph information
type Analyzer struct {
	rootPath    string
	excludeDirs []string
	verbose     bool
	fset        *token.FileSet
	packages    map[string]*ast.Package
	callGraph   *CallGraph
}

// NewAnalyzer creates a new analyzer
func NewAnalyzer(rootPath string, excludeDirs string, verbose bool) *Analyzer {
	var excludeList []string
	if excludeDirs != "" {
		excludeList = strings.Split(excludeDirs, ",")
		for i := range excludeList {
			excludeList[i] = strings.TrimSpace(excludeList[i])
		}
	}

	return &Analyzer{
		rootPath:    rootPath,
		excludeDirs: excludeList,
		verbose:     verbose,
		fset:        token.NewFileSet(),
		packages:    make(map[string]*ast.Package),
		callGraph: &CallGraph{
			Functions: make(map[string]*Function),
			Calls:     make([]Call, 0),
			Packages:  make(map[string]bool),
		},
	}
}

// Analyze performs the analysis
func (a *Analyzer) Analyze() (*CallGraph, error) {
	// Walk through the directory tree
	err := filepath.Walk(a.rootPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip excluded directories
		if info.IsDir() {
			baseName := filepath.Base(path)
			for _, exclude := range a.excludeDirs {
				if baseName == exclude {
					return filepath.SkipDir
				}
			}
			// Skip hidden directories
			if strings.HasPrefix(baseName, ".") && baseName != "." {
				return filepath.SkipDir
			}
		}

		// Parse Go files
		if !info.IsDir() && strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, "_test.go") {
			return a.parseFile(path)
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return a.callGraph, nil
}

// parseFile parses a single Go file
func (a *Analyzer) parseFile(filePath string) error {
	if a.verbose {
		fmt.Printf("  Parsing: %s\n", filePath)
	}

	file, err := parser.ParseFile(a.fset, filePath, nil, parser.AllErrors)
	if err != nil {
		// Log but don't fail on parse errors
		if a.verbose {
			fmt.Printf("    Warning: %v\n", err)
		}
		return nil
	}

	pkgName := file.Name.Name
	a.callGraph.Packages[pkgName] = true

	// Extract functions and methods
	ast.Inspect(file, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.FuncDecl:
			a.extractFunction(node, pkgName, filePath)
		}
		return true
	})

	return nil
}

// extractFunction extracts function information and calls
func (a *Analyzer) extractFunction(funcDecl *ast.FuncDecl, pkgName, filePath string) {
	funcName := funcDecl.Name.Name
	receiver := ""
	fullName := pkgName + "." + funcName

	// Handle methods with receivers
	if funcDecl.Recv != nil && len(funcDecl.Recv.List) > 0 {
		recvType := a.getTypeName(funcDecl.Recv.List[0].Type)
		receiver = recvType
		fullName = pkgName + "." + recvType + "." + funcName
	}

	// Store function
	a.callGraph.Functions[fullName] = &Function{
		Name:       funcName,
		Package:    pkgName,
		File:       filePath,
		Receiver:   receiver,
		IsExported: ast.IsExported(funcName),
	}

	// Extract function calls
	if funcDecl.Body != nil {
		a.extractCalls(funcDecl.Body, fullName, pkgName)
	}
}

// extractCalls extracts function calls from a statement block
func (a *Analyzer) extractCalls(node ast.Node, caller, callerPkg string) {
	ast.Inspect(node, func(n ast.Node) bool {
		if callExpr, ok := n.(*ast.CallExpr); ok {
			callee := a.getCallTarget(callExpr, callerPkg)
			if callee != "" {
				a.callGraph.Calls = append(a.callGraph.Calls, Call{
					From: caller,
					To:   callee,
				})
			}
		}
		return true
	})
}

// getCallTarget determines the target of a function call
func (a *Analyzer) getCallTarget(callExpr *ast.CallExpr, currentPkg string) string {
	switch fun := callExpr.Fun.(type) {
	case *ast.Ident:
		// Simple function call: foo()
		return currentPkg + "." + fun.Name

	case *ast.SelectorExpr:
		// Method call or package-qualified call: pkg.Foo() or obj.Method()
		if ident, ok := fun.X.(*ast.Ident); ok {
			// Could be package.Function or var.Method
			// For simplicity, we'll treat it as package.Function
			return ident.Name + "." + fun.Sel.Name
		}
		// For more complex expressions, use the selector name
		return currentPkg + "." + fun.Sel.Name

	default:
		return ""
	}
}

// getTypeName extracts type name from an expression
func (a *Analyzer) getTypeName(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.StarExpr:
		return a.getTypeName(t.X)
	case *ast.SelectorExpr:
		if ident, ok := t.X.(*ast.Ident); ok {
			return ident.Name + "." + t.Sel.Name
		}
		return t.Sel.Name
	default:
		return "Unknown"
	}
}

