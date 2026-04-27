package main

import (
	"context"
	"fmt"
	"log"
	"strings"

	avnacconfig "Avnac/avnac-system/config"
	avnacio "Avnac/avnac-system/io"
	avnacserver "Avnac/avnac-system/server"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

// App struct
type App struct {
	ctx        context.Context
	appDir     string
	config     *avnacconfig.AppConfig
	ioManager  *avnacio.IOManager
	Unsplash   *avnacserver.UnsplashService
	mediaProxy *avnacserver.MediaProxy
}

// NewApp creates a new App application struct
func NewApp() *App {
	empty := &avnacconfig.AppConfig{}
	return &App{
		config:     empty,
		ioManager:  avnacio.NewIOManager(),
		Unsplash:   avnacserver.NewUnsplashService(empty),
		mediaProxy: avnacserver.NewMediaProxy(empty),
	}
}

func cloneAppConfig(cfg *avnacconfig.AppConfig) *avnacconfig.AppConfig {
	if cfg == nil {
		return &avnacconfig.AppConfig{}
	}
	clone := *cfg
	return &clone
}

func normalizeAppConfig(cfg *avnacconfig.AppConfig) *avnacconfig.AppConfig {
	if cfg == nil {
		return &avnacconfig.AppConfig{}
	}
	return &avnacconfig.AppConfig{
		UnsplashAccessKey: strings.TrimSpace(cfg.UnsplashAccessKey),
	}
}

func (a *App) applyConfig(cfg *avnacconfig.AppConfig) {
	next := normalizeAppConfig(cfg)
	a.config = next
	a.Unsplash.UpdateConfig(next)
	a.mediaProxy.UpdateConfig(next)
}

// MediaProxyMiddleware returns the Wails asset-server middleware that handles
// GET /media/proxy?url=... requests from the webview. This is the only place
// where middleware is used because <img src> and Fabric.js fromURL load images
// by URL — they cannot go through Wails IPC.
func (a *App) MediaProxyMiddleware() assetserver.Middleware {
	return a.mediaProxy.Middleware()
}

// GetConfig returns the current persisted app configuration.
func (a *App) GetConfig() *avnacconfig.AppConfig {
	return cloneAppConfig(a.config)
}

// SaveConfig persists the app configuration and refreshes runtime services.
func (a *App) SaveConfig(cfg *avnacconfig.AppConfig) error {
	if a.appDir == "" {
		return fmt.Errorf("app config not initialised")
	}
	next := normalizeAppConfig(cfg)
	if err := avnacconfig.Save(a.appDir, next); err != nil {
		return err
	}
	a.applyConfig(next)
	return nil
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	appDir, err := avnacio.EnsureAppDirs()
	if err != nil {
		log.Printf("[avnac] could not create app directories: %v", err)
	}
	a.appDir = appDir

	a.ioManager.Startup(ctx, appDir)

	cfg, err := avnacconfig.Load(appDir)
	if err != nil {
		log.Printf("[avnac] could not load config: %v", err)
		cfg = &avnacconfig.AppConfig{}
	}

	a.applyConfig(cfg)
}
