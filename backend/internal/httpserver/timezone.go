package httpserver

import (
	"context"
	"net/http"
	"strings"
	"time"
)

// validTimezone reports whether name is an IANA zone this binary (and therefore the
// database, which shares the same names) can resolve. Offsets like "+07:00" and the
// "Local" pseudo-zone are refused so stored values stay portable.
func validTimezone(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || name == "Local" || (!strings.Contains(name, "/") && name != "UTC") {
		return false
	}
	_, err := time.LoadLocation(name)
	return err == nil
}

// userLocation returns the user's timezone (see the package-level userLocation).
func (s *Server) userLocation(ctx context.Context, uid string) *time.Location {
	if s.db == nil || uid == "" {
		return loadLocationOrDefault("")
	}
	return userLocation(ctx, s.db, uid)
}

func (s *Server) requestLocation(r *http.Request) *time.Location {
	return s.userLocation(r.Context(), userID(r))
}

// monthBounds returns [start, end) of a YYYY-MM period in loc.
func monthBounds(period string, loc *time.Location) (time.Time, time.Time, error) {
	parsed, err := time.Parse("2006-01", period)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}
	start := time.Date(parsed.Year(), parsed.Month(), 1, 0, 0, 0, 0, loc)
	return start, start.AddDate(0, 1, 0), nil
}

// localDay parses YYYY-MM-DD as midnight in loc.
func localDay(value string, loc *time.Location) (time.Time, error) {
	return time.ParseInLocation("2006-01-02", value, loc)
}
