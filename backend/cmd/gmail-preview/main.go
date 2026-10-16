// Offline format validation only; headers in a local file do not prove authenticity.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"zero-friction-erp/backend/internal/gmail"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/gmail-preview <local-email.eml>")
		os.Exit(2)
	}
	b, err := os.ReadFile(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, "cannot read email file")
		os.Exit(1)
	}
	receipt, err := gmail.Parse(b, false)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	_ = json.NewEncoder(os.Stdout).Encode(map[string]any{"receipt": receipt, "authentication_verified": false, "writes_transaction": false})
}
