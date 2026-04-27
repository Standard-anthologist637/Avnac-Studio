package avnacserver

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
)

const (
	maxRedirectHops    = 5
	maxProxyBodyBytes  = 20 << 20 // 20 MiB
)

// isBlockedHost returns true for hostnames and IP addresses that must not be
// reached by the media proxy (SSRF protection).
func isBlockedHost(host string) bool {
	// Strip port if present.
	hostname := host
	if h, _, err := net.SplitHostPort(host); err == nil {
		hostname = h
	}
	hostname = strings.ToLower(strings.TrimSpace(hostname))
	if hostname == "" {
		return true
	}

	// Block well-known local hostname variants.
	if hostname == "localhost" ||
		strings.HasSuffix(hostname, ".localhost") ||
		strings.HasSuffix(hostname, ".local") {
		return true
	}

	ip := net.ParseIP(hostname)
	if ip == nil {
		// Not a raw IP — allow DNS names that aren't obviously local.
		return false
	}

	// Block any IP that is loopback, link-local, private, or unspecified.
	// net.IP.IsPrivate covers RFC 1918 (10/8, 172.16/12, 192.168/16) and
	// RFC 4193 (fc00::/7). Requires Go 1.17+.
	return ip.IsLoopback() ||
		ip.IsLinkLocalUnicast() ||
		ip.IsPrivate() ||
		ip.IsUnspecified() ||
		ip.IsMulticast()
}

// assertAllowedURL returns an error if target should not be fetched.
func assertAllowedURL(target *url.URL) error {
	if target.Scheme != "http" && target.Scheme != "https" {
		return fmt.Errorf("invalid scheme %q", target.Scheme)
	}
	if isBlockedHost(target.Host) {
		return fmt.Errorf("host %q is not allowed", target.Host)
	}
	return nil
}

// fetchImageUpstream follows redirects manually so every hop is SSRF-checked.
func fetchImageUpstream(target *url.URL) (*http.Response, error) {
	// Use the default transport directly without redirect following.
	var transport http.RoundTripper = http.DefaultTransport

	current := target
	for hop := 0; hop < maxRedirectHops; hop++ {
		if err := assertAllowedURL(current); err != nil {
			return nil, fmt.Errorf("blocked URL: %w", err)
		}

		req, err := http.NewRequest(http.MethodGet, current.String(), nil)
		if err != nil {
			return nil, fmt.Errorf("build request: %w", err)
		}
		req.Header.Set("Accept", "image/*,*/*;q=0.8")

		resp, err := transport.RoundTrip(req)
		if err != nil {
			return nil, fmt.Errorf("fetch: %w", err)
		}

		if resp.StatusCode >= 300 && resp.StatusCode < 400 {
			location := resp.Header.Get("Location")
			_ = resp.Body.Close()
			if location == "" {
				return nil, fmt.Errorf("redirect missing Location header")
			}
			next, err := url.Parse(location)
			if err != nil {
				return nil, fmt.Errorf("invalid redirect location: %w", err)
			}
			current = current.ResolveReference(next)
			continue
		}

		return resp, nil
	}

	return nil, fmt.Errorf("too many redirects")
}

// GET /media/proxy?url=<encoded-image-url>
func (m *MediaProxy) handleMediaProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed.")
		return
	}

	rawURL := r.URL.Query().Get("url")
	if rawURL == "" {
		writeError(w, http.StatusBadRequest, "Missing url parameter.")
		return
	}

	target, err := url.Parse(rawURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid image URL.")
		return
	}

	if err := assertAllowedURL(target); err != nil {
		writeError(w, http.StatusBadRequest, "This image host is not allowed.")
		return
	}

	upstream, err := fetchImageUpstream(target)
	if err != nil {
		writeError(w, http.StatusBadGateway, "Could not fetch image.")
		return
	}
	defer upstream.Body.Close()

	if upstream.StatusCode < 200 || upstream.StatusCode >= 300 {
		writeError(w, http.StatusBadGateway,
			fmt.Sprintf("Image fetch failed (%d).", upstream.StatusCode))
		return
	}

	contentType := strings.TrimSpace(upstream.Header.Get("Content-Type"))
	if contentType != "" && !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		writeError(w, http.StatusUnsupportedMediaType,
			"The requested URL did not return an image.")
		return
	}

	body, err := io.ReadAll(io.LimitReader(upstream.Body, maxProxyBodyBytes))
	if err != nil {
		writeError(w, http.StatusBadGateway, "Could not read image.")
		return
	}

	if contentType == "" {
		contentType = "application/octet-stream"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}
