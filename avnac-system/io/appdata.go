package avnacio

import (
	"os"
	"path/filepath"
)

const appDirName = "avnac-studio"

// EnsureAppDirs creates the application data directories under the OS user
// config directory if they do not already exist. It returns the root app
// directory path.
//
// Layout:
//
//	<UserConfigDir>/avnac-studio/
//	<UserConfigDir>/avnac-studio/config/
func EnsureAppDirs() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	appDir := filepath.Join(configDir, appDirName)

	for _, dir := range []string{
		appDir,
		filepath.Join(appDir, "config"),
		filepath.Join(appDir, "documents"),
	} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return "", err
		}
	}

	return appDir, nil
}
