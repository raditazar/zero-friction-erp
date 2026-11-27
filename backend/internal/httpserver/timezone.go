package httpserver

import (
	"context"
	"net/http"
	"strings"
	"time"
	// Embed the IANA database: serverless images do not always ship /usr/share/zoneinfo.
	_ "time/tzdata"
)

// defaultTimezone is used for users without a profile row and whenever a stored name
// cannot be loaded.
const defaultTimezone = "Asia/Jakarta"

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

// userLocation returns the requesting user's timezone, falling back to Asia/Jakarta.
func (s *Server) userLocation(ctx context.Context, uid string) *time.Location {
	name := defaultTimezone
	if s.db != nil && uid != "" {
		var stored *string
		if err := s.db.QueryRow(ctx, `select timezone from profiles where id = $1`, uid).Scan(&stored); err == nil && stored != nil && validTimezone(*stored) {
			name = *stored
		}
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		loc, _ = time.LoadLocation(defaultTimezone)
	}
	return loc
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
