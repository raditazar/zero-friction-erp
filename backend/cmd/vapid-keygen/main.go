// Command vapid-keygen prints a fresh VAPID key pair for Web Push.
//
//	cd backend && go run ./cmd/vapid-keygen
package main

import (
	"fmt"
	"os"

	"github.com/SherClockHolmes/webpush-go"
)

func main() {
	private, public, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		fmt.Fprintln(os.Stderr, "generate VAPID keys:", err)
		os.Exit(1)
	}
	fmt.Println("# Backend (Vercel project zero-friction-erp-api)")
	fmt.Println("VAPID_PUBLIC_KEY=" + public)
	fmt.Println("VAPID_PRIVATE_KEY=" + private)
	fmt.Println("VAPID_SUBJECT=mailto:you@example.com")
	fmt.Println("# Keep the private key secret. Rotating keys invalidates every existing subscription.")
}
