package main

import (
	"context"
	"log"

	avnacconfig "Avnac/avnac-system/config"
	avnacio "Avnac/avnac-system/io"
	avnacserver "Avnac/avnac-system/server"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

// App struct
type App struct {
	ctx        context.Context
	ioManager  *avnacio.IOManager
	Unsplash   *avnacserver.UnsplashService
	mediaProxy *avnacserver.MediaProxy
}

// NewApp creates a new App application struct
func NewApp() *App {
	empty := &avnacconfig.AppConfig{}
	return &App{
		ioManager:  avnacio.NewIOManager(),
		Unsplash:   avnacserver.NewUnsplashService(empty),
		mediaProxy: avnacserver.NewMediaProxy(empty),
	}
}

// MediaProxyMiddleware returns the Wails asset-server middleware that handles
// GET /media/proxy?url=... requests from the webview. This is the only place
// where middleware is used because <img src> and Fabric.js fromURL load images
// by URL — they cannot go through Wails IPC.
func (a *App) MediaProxyMiddleware() assetserver.Middleware {
	return a.mediaProxy.Middleware()
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

	cfg, err := avnacconfig.Load(appDir)
	if err != nil {
		log.Printf("[avnac] could not load config: %v", err)
		cfg = &avnacconfig.AppConfig{}
	}

	a.Unsplash.UpdateConfig(cfg)
	a.mediaProxy.UpdateConfig(cfg)
}
