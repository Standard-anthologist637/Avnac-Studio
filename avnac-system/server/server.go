// Package avnacserver contains the Go-side services for the Avnac desktop app.
//
// There are two distinct pieces:
//
//   - UnsplashService — a struct bound to the Wails runtime so the frontend
//     JavaScript calls its methods directly via window.go.UnsplashService.*
//     (no HTTP, no fetch, no JSON-over-wire).
//
//   - MediaProxy — a Wails asset-server middleware that handles
//     GET /media/proxy?url=... requests. Middleware is the right tool here
//     because Fabric.js and <img> tags load images by URL; the browser webview
//     makes a real HTTP-style request that cannot be replaced with an IPC call.
package avnacserver

import (
	"net/http"
	"strings"

	avnacconfig "Avnac/avnac-system/config"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

// MediaProxy intercepts GET /media/proxy?url=... from the Wails webview and
// returns the fetched image bytes with SSRF protection applied.
type MediaProxy struct {
	cfg *avnacconfig.AppConfig
}

// NewMediaProxy creates a MediaProxy. cfg may be updated later via UpdateConfig.
func NewMediaProxy(cfg *avnacconfig.AppConfig) *MediaProxy {
	return &MediaProxy{cfg: cfg}
}

// UpdateConfig replaces the runtime configuration. Call this from the Wails
// startup hook after the persisted config has been loaded.
func (m *MediaProxy) UpdateConfig(cfg *avnacconfig.AppConfig) {
	m.cfg = cfg
}

// Middleware returns the Wails asset-server middleware. Only /media/proxy
// requests are handled here; everything else is passed to the next handler.
func (m *MediaProxy) Middleware() assetserver.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/media/proxy") {
				m.handleMediaProxy(w, r)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// writeError sends a plain-text error message with the given status code.
// Used only by the media proxy middleware path.
func writeError(w http.ResponseWriter, status int, msg string) {
	http.Error(w, msg, status)
}

