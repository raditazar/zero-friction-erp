package httpserver

import (
	"testing"
	"time"
)

func mustLoc(t *testing.T, name string) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation(name)
	if err != nil {
		t.Fatal(err)
	}
	return loc
}

func TestScheduleUsesUserTimezone(t *testing.T) {
	jkt := mustLoc(t, "Asia/Jakarta")
	sc, err := parseRecurringSchedule("0 9 * * *")
	if err != nil {
		t.Fatal(err)
	}
	// 08:00 WIB: today's 09:00 WIB has not happened yet.
	after := time.Date(2026, 11, 20, 8, 0, 0, 0, jkt)
	got := sc.next(after, jkt)
	want := time.Date(2026, 11, 20, 9, 0, 0, 0, jkt)
	if !got.Equal(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	// 09:00 WIB is 02:00 UTC, not 09:00 UTC (the old scheduler's bug).
	if got.UTC().Hour() != 2 {
		t.Fatalf("09:00 WIB should be 02:00 UTC, got %v", got.UTC())
	}
}

func TestScheduleMonthlyClampsToMonthEnd(t *testing.T) {
	jkt := mustLoc(t, "Asia/Jakarta")
	sc, err := parseRecurringSchedule("0 7 31 * *")
	if err != nil {
		t.Fatal(err)
	}
	got := sc.occurrences(time.Date(2026, 1, 31, 8, 0, 0, 0, jkt), time.Date(2026, 5, 1, 0, 0, 0, 0, jkt), jkt, 12)
	want := []time.Time{
		time.Date(2026, 2, 28, 7, 0, 0, 0, jkt),
		time.Date(2026, 3, 31, 7, 0, 0, 0, jkt),
		time.Date(2026, 4, 30, 7, 0, 0, 0, jkt),
	}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if !got[i].Equal(want[i]) {
			t.Fatalf("occurrence %d: got %v, want %v", i, got[i], want[i])
		}
	}
}

func TestScheduleWeekly(t *testing.T) {
	jkt := mustLoc(t, "Asia/Jakarta")
	sc, err := parseRecurringSchedule("30 18 * * 5") // Friday 18:30
	if err != nil {
		t.Fatal(err)
	}
	// Friday 2026-11-20 19:00: this week's slot has passed, next is 27 Nov.
	got := sc.next(time.Date(2026, 11, 20, 19, 0, 0, 0, jkt), jkt)
	want := time.Date(2026, 11, 27, 18, 30, 0, 0, jkt)
	if !got.Equal(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}

func TestOccurrencesAreCappedAndExclusiveOfCursor(t *testing.T) {
	jkt := mustLoc(t, "Asia/Jakarta")
	sc, _ := parseRecurringSchedule("0 9 * * *")
	start := time.Date(2026, 1, 1, 9, 0, 0, 0, jkt) // exactly an occurrence: already booked
	got := sc.occurrences(start, start.AddDate(0, 0, 100), jkt, maxOccurrencesPerRun)
	if len(got) != maxOccurrencesPerRun {
		t.Fatalf("want %d occurrences, got %d", maxOccurrencesPerRun, len(got))
	}
	if !got[0].Equal(start.AddDate(0, 0, 1)) {
		t.Fatalf("first occurrence must be after the cursor, got %v", got[0])
	}
}

func TestPlanRuleKeepsRuleDueWhenCatchUpIsCapped(t *testing.T) {
	jkt := mustLoc(t, "Asia/Jakarta")
	now := time.Date(2026, 11, 20, 12, 0, 0, 0, jkt)
	last := now.AddDate(0, 0, -30)
	rule := recurringRuleRow{CronExpression: "0 9 * * *", LastScheduledFor: &last, CreatedAt: last}
	_, occ, next, err := planRule(rule, jkt, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(occ) != maxOccurrencesPerRun {
		t.Fatalf("want capped catch-up, got %d", len(occ))
	}
	if !next.Before(now) {
		t.Fatalf("next run must stay due to continue the catch-up, got %v", next)
	}

	recent := time.Date(2026, 11, 19, 9, 0, 0, 0, jkt)
	rule.LastScheduledFor = &recent
	_, occ, next, _ = planRule(rule, jkt, now)
	if len(occ) != 1 || !occ[0].Equal(time.Date(2026, 11, 20, 9, 0, 0, 0, jkt)) {
		t.Fatalf("want only today's 09:00, got %v", occ)
	}
	if !next.Equal(time.Date(2026, 11, 21, 9, 0, 0, 0, jkt)) {
		t.Fatalf("next run = %v, want tomorrow 09:00 WIB", next)
	}
}

func TestPlanRuleRejectsInvalidCron(t *testing.T) {
	if _, _, _, err := planRule(recurringRuleRow{CronExpression: "*/5 * * * *"}, mustLoc(t, "Asia/Jakarta"), time.Now()); err == nil {
		t.Fatal("invalid cron must be rejected so the rule gets paused")
	}
}

func TestLoadLocationOrDefault(t *testing.T) {
	if got := loadLocationOrDefault("").String(); got != defaultTimezone {
		t.Fatalf("empty: got %s", got)
	}
	if got := loadLocationOrDefault("Not/AZone").String(); got != defaultTimezone {
		t.Fatalf("invalid: got %s", got)
	}
	if got := loadLocationOrDefault("Asia/Makassar").String(); got != "Asia/Makassar" {
		t.Fatalf("valid: got %s", got)
	}
}
