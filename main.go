package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

var appVersion = "v0.1.0"

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Avnac",
		Width:  1024,
		Height: 768,
		MinWidth: 600,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets:     assets,
			Middleware: app.MediaProxyMiddleware(),
		},
		BackgroundColour:         &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		EnableDefaultContextMenu: false,
		OnStartup:                app.startup,
		OnDomReady:               app.domReady,
		Bind: []interface{}{
			app,
			app.ioManager,
			app.Unsplash,
			app.Config,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
