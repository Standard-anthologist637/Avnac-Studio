package main

import (
	"context"
	"log"

	avnacio "Avnac/avnac-system/io"
)

// App struct
type App struct {
	ctx       context.Context
	ioManager *avnacio.IOManager
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		ioManager: avnacio.NewIOManager(),
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	appDir, err := avnacio.EnsureAppDirs()
	if err != nil {
		log.Printf("[avnac] could not create app directories: %v", err)
	}

	a.ioManager.Startup(ctx, appDir)
}
