package broker

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"
)

// Config holds runtime configuration sourced from the environment.
type Config struct {
	Addr            string
	JWTSecret       []byte
	SecretKey       string // the full sk_live_ value
	SessionTTL      time.Duration
	UpstreamTimeout time.Duration
	EmbedsSeedPath  string

	// In-cluster agent_ref resolution (reads HOOKS_TOKEN from the agent's Secret).
	KubeMode       string // "auto" (default) | "on" | "off"
	KubeSecretName string // default "devpod-secrets"
	KubeSecretKey  string // default "HOOKS_TOKEN"
	KubeSecretTTL  time.Duration

	// DatabaseURL, when set, persists daily spend caps in Postgres (durable
	// across restarts). Empty = in-memory (resets on restart).
	DatabaseURL string
}

// LoadConfig reads broker configuration from the environment, applying defaults
// and validating required fields.
func LoadConfig() (Config, error) {
	cfg := Config{
		Addr:            getEnv("BROKER_ADDR", ":8090"),
		SecretKey:       os.Getenv("BROKER_SK"),
		EmbedsSeedPath:  os.Getenv("BROKER_EMBEDS_SEED"),
		SessionTTL:      getEnvDuration("BROKER_SESSION_TTL", 900*time.Second),
		UpstreamTimeout: getEnvDuration("BROKER_UPSTREAM_TIMEOUT", 120*time.Second),
		KubeMode:        getEnv("BROKER_KUBE", "auto"),
		KubeSecretName:  getEnv("BROKER_SECRET_NAME", "devpod-secrets"),
		KubeSecretKey:   getEnv("BROKER_SECRET_KEY", "HOOKS_TOKEN"),
		KubeSecretTTL:   getEnvDuration("BROKER_SECRET_TTL", 5*time.Minute),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
	}
	secret := os.Getenv("BROKER_JWT_SECRET")
	if secret == "" {
		return cfg, errors.New("BROKER_JWT_SECRET is required")
	}
	cfg.JWTSecret = []byte(secret)
	if cfg.SecretKey == "" {
		return cfg, errors.New("BROKER_SK is required")
	}
	return cfg, nil
}

// Server is the broker HTTP application.
type Server struct {
	cfg             Config
	log             *slog.Logger
	store           Store
	minter          *TokenMinter
	quotas          *Quotas
	gateway         *GatewayClient
	resolver        GatewayResolver
	hist            *history
	secretKey       string
	upstreamTimeout time.Duration

	// nowFn overrides time.Now in tests.
	nowFn func() time.Time
}

// New constructs a Server from config and a logger. Defaults are wired for
// production; tests may override fields after construction.
func New(cfg Config, log *slog.Logger) (*Server, error) {
	store := NewMemStore()
	if cfg.EmbedsSeedPath != "" {
		if err := store.SeedFromFile(cfg.EmbedsSeedPath); err != nil {
			return nil, fmt.Errorf("seed embeds: %w", err)
		}
		log.Info("seeded embeds", "path", cfg.EmbedsSeedPath)
	}

	gwClient := &GatewayClient{
		HTTP: &http.Client{
			// No client-level timeout: streaming is bounded by per-request context.
			Timeout: 0,
		},
	}

	// Daily spend cap: durable in Postgres when DATABASE_URL is set (a public
	// embed spends real money, so the cap must survive restarts), else in-memory.
	var spend SpendBackend
	if cfg.DatabaseURL != "" {
		ps, err := newPgSpend(context.Background(), cfg.DatabaseURL)
		if err != nil {
			return nil, fmt.Errorf("spend store (postgres): %w", err)
		}
		spend = ps
		log.Info("spend persistence: postgres (durable daily caps)")
	} else {
		spend = newMemSpend(time.Now)
		log.Info("spend persistence: in-memory (caps reset on restart)")
	}

	// Wire the agent_ref fallback resolver. In "auto" mode we use the in-cluster
	// Kubernetes resolver when SA credentials are present, otherwise a stub that
	// returns a clear error for agent_ref embeds (explicit gateway_url embeds
	// still work). "on" requires the cluster client; "off" disables it.
	var fallback GatewayResolver = &InClusterResolver{KubeConfigured: false}
	if cfg.KubeMode != "off" {
		kc, err := newInClusterKubeClient()
		switch {
		case err == nil:
			fallback = NewKubeSecretResolver(kc, cfg.KubeSecretName, cfg.KubeSecretKey, cfg.KubeSecretTTL)
			log.Info("in-cluster agent_ref resolver enabled",
				"secret", cfg.KubeSecretName, "key", cfg.KubeSecretKey, "ttl", cfg.KubeSecretTTL.String())
		case cfg.KubeMode == "on":
			return nil, fmt.Errorf("BROKER_KUBE=on but no in-cluster Kubernetes client: %w", err)
		default:
			log.Info("in-cluster resolver disabled (not in cluster); agent_ref embeds will error",
				"reason", err.Error())
		}
	}

	s := &Server{
		cfg:             cfg,
		log:             log,
		store:           store,
		minter:          NewTokenMinter(cfg.JWTSecret, cfg.SessionTTL),
		quotas:          NewQuotas(spend, log),
		gateway:         gwClient,
		resolver:        &ExplicitResolver{Fallback: fallback},
		hist:            newHistory(),
		secretKey:       cfg.SecretKey,
		upstreamTimeout: cfg.UpstreamTimeout,
	}
	return s, nil
}

// Handler returns the root HTTP handler with all routes wired.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/v1/embed/session", s.handleSession)
	mux.HandleFunc("/v1/embed/chat", s.handleChat)
	mux.HandleFunc("/v1/embeds", s.handleEmbeds)
	mux.HandleFunc("/v1/embeds/", s.handleEmbeds)
	mux.HandleFunc("/embed/agent.js", s.handleAgentJS)
	mux.HandleFunc("/demo", s.handleDemo)
	mux.HandleFunc("/", s.handleRoot)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Top-level wrapper: handle CORS preflight for any path before routing.
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			s.handlePreflight(w, r)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

// handlePreflight answers CORS OPTIONS requests. For embed-scoped paths the
// Origin is reflected only if it appears in some enabled embed's allowed list;
// the publishable key is not available on preflight, so we accept an origin that
// is allowed by ANY enabled embed. Browsers re-validate against the per-embed
// check on the actual POST.
func (s *Server) handlePreflight(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	h := w.Header()
	h.Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	h.Set("Access-Control-Max-Age", "600")
	h.Set("Vary", "Origin")

	if origin != "" && s.originKnown(origin) {
		h.Set("Access-Control-Allow-Origin", origin)
	}
	w.WriteHeader(http.StatusNoContent)
}

// originKnown reports whether origin is in the allowed list of any enabled embed.
func (s *Server) originKnown(origin string) bool {
	embeds, err := s.store.List()
	if err != nil {
		return false
	}
	for _, e := range embeds {
		if e.Status != "enabled" {
			continue
		}
		if originAllowed(origin, e.AllowedOrigins) {
			return true
		}
	}
	return false
}

// Run starts the HTTP server and blocks until ctx is cancelled, then shuts down
// gracefully.
func (s *Server) Run(ctx context.Context) error {
	srv := &http.Server{
		Addr:              s.cfg.Addr,
		Handler:           s.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		// No global WriteTimeout: SSE responses are long-lived and bounded by
		// the per-request upstream context timeout instead.
		IdleTimeout: 60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		s.log.Info("broker listening", "addr", s.cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		s.log.Info("shutting down")
		shutCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		return srv.Shutdown(shutCtx)
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// getEnvDuration parses an env var as seconds (integer) or a Go duration string.
// Bare integers are interpreted as seconds.
func getEnvDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	if secs, err := strconv.Atoi(v); err == nil {
		return time.Duration(secs) * time.Second
	}
	if d, err := time.ParseDuration(v); err == nil {
		return d
	}
	return def
}
