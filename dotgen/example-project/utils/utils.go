package utils

import (
	"fmt"
	"strings"
)

// ReadFile reads a file
func ReadFile(path string) string {
	fmt.Printf("Reading file: %s\n", path)
	return "file content"
}

// ExecuteSQL executes a SQL query
func ExecuteSQL(query string) {
	fmt.Printf("Executing SQL: %s\n", query)
}

// LoadFromFile loads data from a file
func LoadFromFile(path string) []string {
	content := ReadFile(path)
	return parseContent(content)
}

// SaveToFile saves data to a file
func SaveToFile(path string, data []string) {
	content := formatContent(data)
	writeFile(path, content)
}

// Validate validates a data item
func Validate(item string) bool {
	fmt.Printf("Validating: %s\n", item)
	return len(item) > 0
}

// Transform transforms a data item
func Transform(item string) string {
	fmt.Printf("Transforming: %s\n", item)
	return strings.ToUpper(item)
}

func parseContent(content string) []string {
	return strings.Split(content, "\n")
}

func formatContent(data []string) string {
	return strings.Join(data, "\n")
}

func writeFile(path string, content string) {
	fmt.Printf("Writing to file: %s\n", path)
}

