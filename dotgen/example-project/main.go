package main

import (
	"fmt"
	"github.com/callgraph/dotgen/example-project/utils"
)

func main() {
	fmt.Println("Example Go Project")
	initialize()
	processData()
	cleanup()
}

func initialize() {
	fmt.Println("Initializing...")
	loadConfig()
	setupDatabase()
}

func loadConfig() {
	fmt.Println("Loading configuration...")
	utils.ReadFile("config.json")
}

func setupDatabase() {
	fmt.Println("Setting up database...")
	db := &Database{}
	db.Connect()
	db.Migrate()
}

func processData() {
	fmt.Println("Processing data...")
	
	processor := NewProcessor()
	processor.Process()
}

func cleanup() {
	fmt.Println("Cleaning up...")
	closeConnections()
}

func closeConnections() {
	fmt.Println("Closing connections...")
}

// Database represents a database connection
type Database struct {
	connected bool
}

func (db *Database) Connect() {
	fmt.Println("Connecting to database...")
	db.connected = true
}

func (db *Database) Migrate() {
	fmt.Println("Running migrations...")
	if db.connected {
		utils.ExecuteSQL("CREATE TABLE...")
	}
}

// Processor handles data processing
type Processor struct {
	data []string
}

func NewProcessor() *Processor {
	return &Processor{
		data: make([]string, 0),
	}
}

func (p *Processor) Process() {
	p.loadData()
	p.validateData()
	p.transformData()
	p.saveData()
}

func (p *Processor) loadData() {
	fmt.Println("Loading data...")
	p.data = utils.LoadFromFile("data.txt")
}

func (p *Processor) validateData() {
	fmt.Println("Validating data...")
	for _, item := range p.data {
		utils.Validate(item)
	}
}

func (p *Processor) transformData() {
	fmt.Println("Transforming data...")
	for i, item := range p.data {
		p.data[i] = utils.Transform(item)
	}
}

func (p *Processor) saveData() {
	fmt.Println("Saving data...")
	utils.SaveToFile("output.txt", p.data)
}

