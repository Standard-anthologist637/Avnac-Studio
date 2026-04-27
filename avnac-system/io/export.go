package avnacio

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// IOManager handles file IO operations exposed to the Wails frontend.
// It must be initialised with a context via Startup before any methods
// that call the Wails runtime are invoked.
type IOManager struct {
	ctx    context.Context
	appDir string
}

// NewIOManager returns an uninitialised IOManager. Call Startup once the
// Wails context is available.
func NewIOManager() *IOManager {
	return &IOManager{}
}

// Startup stores the Wails context and the resolved app data directory.
// This should be called from the main App startup hook.
func (m *IOManager) Startup(ctx context.Context, appDir string) {
	m.ctx = ctx
	m.appDir = appDir
}

// ExportFile opens a native Save File dialog pre-filled with title as the
// suggested filename. The provided data bytes are written to the path the
// user confirms. Returning nil means the operation succeeded; returning nil
// after the user cancels the dialog is also expected behaviour (empty path).
//
// data is received from the frontend as a base64-encoded string which Wails
// automatically deserialises to []byte.
func (m *IOManager) ExportFile(title string, data []byte) error {
	if m.ctx == nil {
		return fmt.Errorf("io manager not initialised")
	}

	path, err := runtime.SaveFileDialog(m.ctx, runtime.SaveDialogOptions{
		Title:           "Export File",
		DefaultFilename: title,
	})
	if err != nil {
		return fmt.Errorf("save dialog: %w", err)
	}

	// User cancelled.
	if path == "" {
		return nil
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create parent directories: %w", err)
	}

	if err := os.WriteFile(path, data, 0o644); err != nil {
		return fmt.Errorf("write file: %w", err)
	}

	return nil
}
