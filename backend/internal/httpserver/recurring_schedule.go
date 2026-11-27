package httpserver

import (
	"fmt"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata" // serverless images may lack /usr/share/zoneinfo
)

// defaultTimezone is used when a user has no valid timezone stored.
const defaultTimezone = "Asia/Jakarta"

// maxOccurrencesPerRun bounds how many missed occurrences one run books for a rule. The rest
// are booked by the next run, so nothing is lost and one run cannot explode.
const maxOccurrencesPerRun = 12

type scheduleKind int

const (
	scheduleDaily scheduleKind = iota
	scheduleWeekly
	scheduleMonthly
)

// recurringSchedule is a parsed daily, weekly or monthly cron_expression. Hour and minute are
// wall-clock time in the user's timezone.
type recurringSchedule struct {
	kind    scheduleKind
	minute  int
	hour    int
	day     int          // monthly: 1-31, clamped to the month's last day
	weekday time.Weekday // weekly
}

// parseRecurringSchedule accepts the same shapes as validateRecurringCron.
func parseRecurringSchedule(cron string) (recurringSchedule, error) {
	normalized, err := validateRecurringCron(cron)
	if err != nil {
		return recurringSchedule{}, err
	}
	f := strings.Fields(normalized)
	minute, _ := strconv.Atoi(f[0])
	hour, _ := strconv.Atoi(f[1])
	sc := recurringSchedule{minute: minute, hour: hour}
	switch {
	case f[2] != "*":
		sc.kind = scheduleMonthly
		sc.day, _ = strconv.Atoi(f[2])
	case f[4] != "*":
		sc.kind = scheduleWeekly
		wd, _ := strconv.Atoi(f[4])
		sc.weekday = time.Weekday(wd)
	default:
		sc.kind = scheduleDaily
	}
	return sc, nil
}

// next returns the first occurrence strictly after `after`, computed in loc.
func (sc recurringSchedule) next(after time.Time, loc *time.Location) time.Time {
	local := after.In(loc)
	switch sc.kind {
	case scheduleMonthly:
		for offset := 0; offset < 14; offset++ {
			first := time.Date(local.Year(), local.Month()+time.Month(offset), 1, 0, 0, 0, 0, loc)
			day := sc.day
			if last := daysInMonth(first.Year(), first.Month()); day > last {
				day = last
			}
			candidate := time.Date(first.Year(), first.Month(), day, sc.hour, sc.minute, 0, 0, loc)
			if candidate.After(after) {
				return candidate
			}
		}
	case scheduleWeekly:
		candidate := time.Date(local.Year(), local.Month(), local.Day(), sc.hour, sc.minute, 0, 0, loc)
		candidate = candidate.AddDate(0, 0, (int(sc.weekday)-int(local.Weekday())+7)%7)
		for !candidate.After(after) {
			candidate = candidate.AddDate(0, 0, 7)
		}
		return candidate
	default:
		candidate := time.Date(local.Year(), local.Month(), local.Day(), sc.hour, sc.minute, 0, 0, loc)
		for !candidate.After(after) {
			candidate = candidate.AddDate(0, 0, 1)
		}
		return candidate
	}
	// Unreachable for valid schedules; keep the run moving.
	return after.Add(24 * time.Hour)
}

// occurrences lists occurrences in (after, until], oldest first, at most limit of them.
func (sc recurringSchedule) occurrences(after, until time.Time, loc *time.Location, limit int) []time.Time {
	var out []time.Time
	cursor := after
	for len(out) < limit {
		occ := sc.next(cursor, loc)
		if occ.After(until) {
			break
		}
		out = append(out, occ)
		cursor = occ
	}
	return out
}

// loadLocationOrDefault resolves an IANA timezone name, falling back to Asia/Jakarta.
func loadLocationOrDefault(name string) *time.Location {
	if strings.TrimSpace(name) != "" {
		if loc, err := time.LoadLocation(strings.TrimSpace(name)); err == nil {
			return loc
		}
	}
	loc, err := time.LoadLocation(defaultTimezone)
	if err != nil {
		return time.FixedZone("WIB", 7*60*60)
	}
	return loc
}

func (sc recurringSchedule) String() string {
	switch sc.kind {
	case scheduleMonthly:
		return fmt.Sprintf("monthly day %d %02d:%02d", sc.day, sc.hour, sc.minute)
	case scheduleWeekly:
		return fmt.Sprintf("weekly %s %02d:%02d", sc.weekday, sc.hour, sc.minute)
	default:
		return fmt.Sprintf("daily %02d:%02d", sc.hour, sc.minute)
	}
}
