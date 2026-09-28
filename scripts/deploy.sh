#!/usr/bin/env bash
# Smart-FinManager: one-command redeploy ("пыщь").
#
#   scripts/deploy.sh          pull new commits, back up DB, rebuild, restart, check
#   scripts/deploy.sh --force  same, even if there are no new commits
#
# Settings come from .env in the project root (DOMAIN, APP_PORT, ...).
# Optional overrides via environment:
#   PROXY_MODE=hysteria|none   how the host reverse proxy is managed (default: hysteria
#                              if the Hysteria panel Caddyfile exists, otherwise none)
#   BACKUP_DIR=/path           where DB dumps go (default: /opt/smart-finmanager-backups)
#   BACKUP_KEEP=10             how many dumps to keep
#
# Everything runs inside main(), so bash parses the whole file before
# executing: `git pull` may safely update this very script mid-run.

main() {
  set -Eeuo pipefail

  local FORCE=0
  [[ "${1:-}" == "--force" || "${1:-}" == "-f" ]] && FORCE=1

  local SCRIPT_PATH APP_DIR
  SCRIPT_PATH="$(readlink -f "${BASH_SOURCE[0]}")"
  APP_DIR="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd)"
  cd "$APP_DIR"

  local C_OK=$'\e[32m' C_ERR=$'\e[31m' C_STEP=$'\e[36m' C_OFF=$'\e[0m'
  step() { echo "${C_STEP}==> $*${C_OFF}"; }
  ok()   { echo "${C_OK}✔ $*${C_OFF}"; }
  die()  { echo "${C_ERR}✘ $*${C_OFF}" >&2; exit 1; }
  trap 'echo "${C_ERR}✘ Ошибка в строке $LINENO: $BASH_COMMAND${C_OFF}" >&2' ERR

  # One deploy at a time.
  exec 9>/tmp/smart-finmanager-deploy.lock
  flock -n 9 || die "Деплой уже запущен в другом окне."

  [[ -f .env ]] || die "Нет файла .env в $APP_DIR"
  # shellcheck disable=SC1091
  set -a; source .env; set +a
  local DOMAIN="${DOMAIN:-}"
  local APP_PORT="${APP_PORT:-3000}"
  local BACKUP_DIR="${BACKUP_DIR:-/opt/smart-finmanager-backups}"
  local BACKUP_KEEP="${BACKUP_KEEP:-10}"
  local PANEL_CADDYFILE=/etc/hysteria/core/scripts/webpanel/Caddyfile
  local SITES_DIR=/etc/caddy/sites
  local SITE_FILE="$SITES_DIR/finmanager.caddy"
  local PROXY_MODE="${PROXY_MODE:-}"
  if [[ -z "$PROXY_MODE" ]]; then
    [[ -f "$PANEL_CADDYFILE" ]] && PROXY_MODE=hysteria || PROXY_MODE=none
  fi

  # ---------------------------------------------------------------- 1. code
  step "Проверяю обновления в GitHub"
  git diff --quiet && git diff --cached --quiet \
    || die "В $APP_DIR есть локальные правки файлов проекта (git status). Уберите их или закоммитьте."
  local BRANCH OLD_REV NEW_REV
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  git fetch --quiet origin "$BRANCH"
  OLD_REV="$(git rev-parse --short HEAD)"
  NEW_REV="$(git rev-parse --short "origin/$BRANCH")"

  if [[ "$OLD_REV" == "$NEW_REV" && $FORCE -eq 0 ]]; then
    ok "Ветка $BRANCH: новых коммитов нет ($OLD_REV). Для принудительной пересборки: $0 --force"
    exit 0
  fi
  if [[ "$OLD_REV" != "$NEW_REV" ]]; then
    echo "Новые коммиты в $BRANCH:"
    git --no-pager log --oneline "HEAD..origin/$BRANCH"
    git merge --ff-only --quiet "origin/$BRANCH"
    ok "Код обновлён: $OLD_REV → $NEW_REV"
  fi

  # -------------------------------------------------------------- 2. backup
  if docker compose ps --status running --services 2>/dev/null | grep -qx db; then
    step "Бэкап базы перед миграциями"
    mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
    local DUMP
    DUMP="$BACKUP_DIR/db-$(date +%Y%m%d-%H%M%S)-$OLD_REV.sql.gz"
    docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$DUMP"
    [[ -s "$DUMP" ]] || die "Бэкап пустой: $DUMP"
    ls -1t "$BACKUP_DIR"/db-*.sql.gz | tail -n +$((BACKUP_KEEP + 1)) | xargs -r rm --
    ok "Бэкап: $DUMP ($(du -h "$DUMP" | cut -f1))"
  fi

  # ------------------------------------------------------- 3. build & start
  step "Собираю образ (старая версия пока работает)"
  docker compose build app
  step "Перезапускаю контейнеры (миграции применятся при старте)"
  docker compose up -d --remove-orphans

  step "Жду, пока приложение ответит на 127.0.0.1:$APP_PORT"
  local code=000
  for _ in $(seq 1 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/" || true)"
    [[ "$code" == "200" ]] && break
    sleep 3
  done
  if [[ "$code" != "200" ]]; then
    docker compose ps
    docker compose logs --tail 60 app
    echo
    echo "Откат кода к предыдущей версии (база уже могла мигрировать, бэкап выше):"
    echo "  git -C $APP_DIR reset --hard $OLD_REV && docker compose -f $APP_DIR/docker-compose.yml up -d --build"
    die "Приложение не поднялось (HTTP $code)."
  fi
  ok "Приложение отвечает (HTTP 200)"

  # ------------------------------------------------------------- 4. proxy
  if [[ "$PROXY_MODE" == "hysteria" ]]; then
    [[ -n "$DOMAIN" ]] || die "DOMAIN не задан в .env"
    step "Проверяю Caddy (панель Hysteria) для $DOMAIN"
    local changed=0 want
    want="$(printf '%s {\n    encode zstd gzip\n    reverse_proxy 127.0.0.1:%s\n}\n' "$DOMAIN" "$APP_PORT")"
    mkdir -p "$SITES_DIR"
    if [[ "$(cat "$SITE_FILE" 2>/dev/null)" != "$want" ]]; then
      printf '%s\n' "$want" > "$SITE_FILE"; changed=1
      echo "Обновлён $SITE_FILE"
    fi
    if ! grep -q '^import /etc/caddy/sites/\*.caddy' "$PANEL_CADDYFILE"; then
      cp "$PANEL_CADDYFILE" "$PANEL_CADDYFILE.bak.$(date +%Y%m%d-%H%M%S)"
      printf '\nimport /etc/caddy/sites/*.caddy\n' >> "$PANEL_CADDYFILE"; changed=1
      echo "Строка import возвращена в $PANEL_CADDYFILE (панель перезаписала конфиг)"
    fi
    if [[ $changed -eq 1 ]]; then
      caddy validate --config "$PANEL_CADDYFILE" --adapter caddyfile >/dev/null 2>&1 \
        || die "Caddyfile не прошёл проверку: caddy validate --config $PANEL_CADDYFILE --adapter caddyfile"
      systemctl restart hysteria-caddy
      sleep 10
      ok "hysteria-caddy перезапущен"
    else
      ok "Конфиг Caddy в порядке"
    fi
  fi

  # ------------------------------------------------------------- 5. check
  if [[ -n "$DOMAIN" && "$DOMAIN" != "localhost" ]]; then
    step "Проверяю https://$DOMAIN"
    for _ in $(seq 1 10); do
      code="$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)"
      [[ "$code" == "200" ]] && break
      sleep 3
    done
    [[ "$code" == "200" ]] || die "https://$DOMAIN отвечает HTTP $code (приложение локально работает — проблема в прокси/сертификате)"
    ok "https://$DOMAIN — HTTP 200"
  fi

  # ----------------------------------------------------------- 6. cleanup
  docker image prune -f >/dev/null
  docker builder prune -f --filter until=168h >/dev/null 2>&1 || true

  echo
  ok "Пыщь! Версия $(git rev-parse --short HEAD) на ветке $BRANCH опубликована."
}

main "$@"
