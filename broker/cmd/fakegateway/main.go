// Command fakegateway emulates an OpenClaw OpenAI-compatible gateway for local
// development and end-to-end testing of the broker without a real cluster.
//
// It streams the request's last user message back word-by-word as OpenAI-style
// SSE deltas, terminated by `data: [DONE]`. It validates the Authorization
// bearer if FAKE_HOOKS_TOKEN is set (bearer must equal sha256("gw-"+token)).
//
// Usage:
//
//	FAKE_ADDR=:18789 FAKE_HOOKS_TOKEN=dev-secret go run ./cmd/fakegateway
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

func main() {
	addr := os.Getenv("FAKE_ADDR")
	if addr == "" {
		addr = ":18789"
	}
	hooksToken := os.Getenv("FAKE_HOOKS_TOKEN")

	http.HandleFunc("/v1/chat/completions", func(w http.ResponseWriter, r *http.Request) {
		if hooksToken != "" {
			want := "Bearer " + sha256hex("gw-"+hooksToken)
			if r.Header.Get("Authorization") != want {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
		}

		var body struct {
			Messages []struct {
				Role    string `json:"role"`
				Content string `json:"content"`
			} `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&body)

		// Echo the last user message.
		reply := "Hello from the fake gateway."
		for i := len(body.Messages) - 1; i >= 0; i-- {
			if body.Messages[i].Role == "user" {
				reply = "You said: " + body.Messages[i].Content
				break
			}
		}
		log.Printf("fakegateway: session=%s reply=%q", r.Header.Get("X-Openclaw-Session-Key"), reply)

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		flusher, _ := w.(http.Flusher)
		for _, word := range strings.Fields(reply) {
			chunk := map[string]any{
				"choices": []map[string]any{
					{"delta": map[string]any{"content": word + " "}},
				},
			}
			b, _ := json.Marshal(chunk)
			fmt.Fprintf(w, "data: %s\n\n", b)
			if flusher != nil {
				flusher.Flush()
			}
			time.Sleep(40 * time.Millisecond)
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
		if flusher != nil {
			flusher.Flush()
		}
	})

	log.Printf("fakegateway listening on %s (auth=%v)", addr, hooksToken != "")
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

func sha256hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
