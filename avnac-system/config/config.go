package avnacconfig

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const configFileName = "config.json"

// AppConfig holds user-editable application settings persisted to disk.
type AppConfig struct {
	// UnsplashAccessKey is the Unsplash API "Access Key" for the client-side
	// API. When empty, Unsplash endpoints return 503.
	UnsplashAccessKey string `json:"unsplash_access_key,omitempty"`
	// SnapIntensity controls global snapping strength (0.0–1.0). Defaults to 1.
	SnapIntensity float64 `json:"snap_intensity"`
	// DeveloperMode hides scene footer diagnostics when enabled.
	DeveloperMode bool `json:"developer_mode"`
}

// Load reads the config file from <appDir>/config/config.json. If the file
// does not exist an empty config is returned without error.
func Load(appDir string) (*AppConfig, error) {
	path := filepath.Join(appDir, "config", configFileName)
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return &AppConfig{}, nil
	}
	if err != nil {
		return nil, err
	}
	var cfg AppConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// Save writes cfg to <appDir>/config/config.json, creating the file if
// necessary. Permissions are set to 0600 so only the owning user can read it.
func Save(appDir string, cfg *AppConfig) error {
	path := filepath.Join(appDir, "config", configFileName)
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}
