// Command kubeclaw-broker is a public HTTP service that fronts OpenClaw agent
// gateways and exposes them as a safe, abuse-bounded, embeddable web surface.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/zacxdev/kubeclaw-broker/internal/broker"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	cfg, err := broker.LoadConfig()
	if err != nil {
		log.Error("configuration error", "err", err)
		os.Exit(1)
	}

	srv, err := broker.New(cfg, log)
	if err != nil {
		log.Error("server init failed", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if err := srv.Run(ctx); err != nil {
		log.Error("server exited with error", "err", err)
		os.Exit(1)
	}
	log.Info("server stopped cleanly")
}
