package main

import (
	"context"
	"log"

	avnacconfig "Avnac/avnac-system/config"
	avnacio "Avnac/avnac-system/io"
	avnacserver "Avnac/avnac-system/server"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx        context.Context
	Config     *avnacconfig.ConfigManager
	ioManager  *avnacio.IOManager
	Unsplash   *avnacserver.UnsplashService
	mediaProxy *avnacserver.MediaProxy
}

// NewApp creates a new App application struct
func NewApp() *App {
	cfgMgr := avnacconfig.NewConfigManager()
	unsplash := avnacserver.NewUnsplashService(cfgMgr.Get())
	proxy := avnacserver.NewMediaProxy(cfgMgr.Get())
	cfgMgr.AddWatcher(unsplash.UpdateConfig)
	cfgMgr.AddWatcher(proxy.UpdateConfig)
	return &App{
		Config:     cfgMgr,
		ioManager:  avnacio.NewIOManager(),
		Unsplash:   unsplash,
		mediaProxy: proxy,
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
	a.Config.Startup(appDir)
}

// domReady is called after the frontend DOM is ready and the Wails IPC
// channel is fully connected. We emit "avnac:ready" so the frontend knows
// it is safe to make Go IPC calls. This fires on every page load/reload.
func (a *App) domReady(ctx context.Context) {
	runtime.EventsEmit(ctx, "avnac:ready")
}

// GetVersion returns the current application version string.
func (a *App) GetVersion() string {
	return appVersion
}
