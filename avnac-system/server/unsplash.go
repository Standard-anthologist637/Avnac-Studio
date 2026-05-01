package avnacserver

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	avnacsecrets "Avnac/avnac-system/secrets"
)

const unsplashAPIBase = "https://api.unsplash.com"

// ---- Types returned directly to the Wails frontend ----

// UnsplashUrls holds the size variants for an Unsplash photo.
type UnsplashUrls struct {
	Small   string `json:"small"`
	Regular string `json:"regular"`
	Full    string `json:"full"`
}

// UnsplashLinks holds relevant links for a photo.
type UnsplashLinks struct {
	DownloadLocation string `json:"download_location"`
	Html             string `json:"html"`
}

// UnsplashUserLinks holds a user's profile link.
type UnsplashUserLinks struct {
	Html string `json:"html"`
}

// UnsplashUser is a minimal representation of an Unsplash user.
type UnsplashUser struct {
	Name  string            `json:"name"`
	Links UnsplashUserLinks `json:"links"`
}

// UnsplashPhoto is a single photo as returned by the Unsplash API.
// Only fields used by the frontend are declared; the rest are ignored.
type UnsplashPhoto struct {
	ID             string        `json:"id"`
	Width          int           `json:"width"`
	Height         int           `json:"height"`
	Description    *string       `json:"description"`
	AltDescription *string       `json:"alt_description"`
	Urls           UnsplashUrls  `json:"urls"`
	Links          UnsplashLinks `json:"links"`
	User           UnsplashUser  `json:"user"`
}

// UnsplashFeedResult is returned by Photos and Search.
type UnsplashFeedResult struct {
	Photos  []UnsplashPhoto `json:"photos"`
	HasMore bool            `json:"hasMore"`
}

// ---- Service ----

// UnsplashService exposes Unsplash operations as Wails-bound methods.
//
// The frontend calls these directly via the Wails IPC bridge:
//
//	window.go.UnsplashService.Photos(page, perPage)
//	window.go.UnsplashService.Search(query, page, perPage)
//	window.go.UnsplashService.Download(downloadLocation)
//
// No HTTP fetch or JSON-over-wire is involved on the JS side.
type UnsplashService struct {
	secrets *avnacsecrets.SecretsManager
}

// NewUnsplashService creates an UnsplashService backed by the OS keyring.
func NewUnsplashService(secrets *avnacsecrets.SecretsManager) *UnsplashService {
	return &UnsplashService{secrets: secrets}
}

func (s *UnsplashService) accessKey() (string, error) {
	key, err := s.secrets.GetKey("unsplash")
	if err != nil {
		return "", fmt.Errorf("could not read Unsplash API key: %w", err)
	}
	if key == "" {
		return "", fmt.Errorf("no Unsplash API key found — add one in Settings to enable image search")
	}
	return key, nil
}

func unsplashGet(endpoint, key string) (*http.Response, error) {
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Client-ID "+key)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("invalid Unsplash API key — update it in Settings and try again")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("Unsplash is temporarily unavailable (status %d) — try again in a moment", resp.StatusCode)
	}
	return resp, nil
}

func clamp(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// Photos returns the most popular Unsplash photos for the given page.
func (s *UnsplashService) Photos(page, perPage int) (UnsplashFeedResult, error) {
	key, err := s.accessKey()
	if err != nil {
		return UnsplashFeedResult{}, err
	}
	page = clamp(page, 1, 1<<30)
	perPage = clamp(perPage, 1, 30)

	endpoint := fmt.Sprintf("%s/photos?page=%d&per_page=%d&order_by=popular",
		unsplashAPIBase, page, perPage)

	resp, err := unsplashGet(endpoint, key)
	if err != nil {
		return UnsplashFeedResult{}, err
	}
	defer resp.Body.Close()

	var photos []UnsplashPhoto
	if err := json.NewDecoder(resp.Body).Decode(&photos); err != nil {
		return UnsplashFeedResult{}, fmt.Errorf("decode response: %w", err)
	}

	return UnsplashFeedResult{
		Photos:  photos,
		HasMore: len(photos) >= perPage,
	}, nil
}

// Search returns Unsplash photos matching query.
func (s *UnsplashService) Search(query string, page, perPage int) (UnsplashFeedResult, error) {
	if query == "" {
		return UnsplashFeedResult{Photos: []UnsplashPhoto{}}, nil
	}
	key, err := s.accessKey()
	if err != nil {
		return UnsplashFeedResult{}, err
	}
	page = clamp(page, 1, 1<<30)
	perPage = clamp(perPage, 1, 30)

	endpoint := fmt.Sprintf("%s/search/photos?query=%s&page=%d&per_page=%d",
		unsplashAPIBase, url.QueryEscape(query), page, perPage)

	resp, err := unsplashGet(endpoint, key)
	if err != nil {
		return UnsplashFeedResult{}, err
	}
	defer resp.Body.Close()

	var body struct {
		Results    []UnsplashPhoto `json:"results"`
		TotalPages int             `json:"total_pages"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return UnsplashFeedResult{}, fmt.Errorf("decode response: %w", err)
	}

	totalPages := body.TotalPages
	if totalPages < 1 {
		totalPages = 1
	}

	photos := body.Results
	if photos == nil {
		photos = []UnsplashPhoto{}
	}

	return UnsplashFeedResult{
		Photos:  photos,
		HasMore: page < totalPages,
	}, nil
}

// Download fires the Unsplash download-tracking endpoint as required by the
// Unsplash API guidelines. downloadLocation must be an
// https://api.unsplash.com/... URL.
func (s *UnsplashService) Download(downloadLocation string) error {
	key, err := s.accessKey()
	if err != nil {
		return err
	}

	parsed, err := url.Parse(downloadLocation)
	if err != nil || parsed.Scheme != "https" || parsed.Host != "api.unsplash.com" {
		return fmt.Errorf("invalid download URL")
	}

	resp, err := unsplashGet(downloadLocation, key)
	if err != nil {
		return err
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
	return nil
}

