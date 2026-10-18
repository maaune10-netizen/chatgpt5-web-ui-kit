#!/usr/bin/env bash
# يشغّل الوسيط والتطبيق، ويُعيد تشغيلهما إن سقطا.
# الخادمان ليسا خدمة نظام، فسقوطهما صامت — وهذا ما حدث أكثر من مرة.
set -u
cd "$(dirname "$0")/.."

start_proxy() {
  if ! curl -sf -o /dev/null http://127.0.0.1:5199/api/health; then
    echo "[serve] starting the proxy"
    setsid nohup node server/proxy.mjs > /tmp/proxy.log 2>&1 < /dev/null &
    sleep 2
  fi
}

start_app() {
  if ! curl -sf -o /dev/null http://127.0.0.1:5180/; then
    echo "[serve] starting the app"
    setsid nohup npx vite --host 0.0.0.0 --port 5180 > /tmp/vite5180.log 2>&1 < /dev/null &
    sleep 6
  fi
}

# HTTPS عبر tailscale — المتصفحات الحديثة تفرض HTTPS، والمنفذ المجرّد يفشل عندها
expose() {
  if command -v tailscale >/dev/null 2>&1; then
    if ! tailscale serve status 2>/dev/null | grep -q ':8446'; then
      echo "[serve] exposing https://<host>:8446 → 127.0.0.1:5180"
      sudo tailscale serve --bg --https=8446 http://127.0.0.1:5180 >/dev/null 2>&1 || \
        echo "[serve] could not add the HTTPS mapping — run: sudo tailscale serve --bg --https=8446 http://127.0.0.1:5180"
    fi
  fi
}

if [ "${1:-}" = "--watch" ]; then
  while true; do start_proxy; start_app; sleep 15; done
else
  start_proxy; start_app; expose
  curl -s http://127.0.0.1:5199/api/health; echo
  echo "[serve] http://127.0.0.1:5180          التطبيق"
  echo "[serve] https://<host>.ts.net:8446/     التطبيق (HTTPS)"
  echo "[serve] .../#design                     الشاشات"
  echo "[serve] .../diag.html                   التشخيص"
fi
