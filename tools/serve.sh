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

if [ "${1:-}" = "--watch" ]; then
  while true; do start_proxy; start_app; sleep 15; done
else
  start_proxy; start_app
  curl -s http://127.0.0.1:5199/api/health; echo
  echo "[serve] app on http://127.0.0.1:5180  design on /#design"
fi
