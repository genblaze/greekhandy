PORT := 4321

.PHONY: dev

dev:
	@lsof -ti :$(PORT) | xargs -r kill -9 2>/dev/null || true
	@echo "Starting dev server on port $(PORT)..."
	@npx astro dev --host --port $(PORT) &
	@sleep 3
	@tailscale funnel --bg $(PORT) 2>/dev/null || true
	@echo ""
	@echo "Tailscale public URL:"
	@tailscale funnel status 2>&1 | grep 'https://' | head -1
	@wait
