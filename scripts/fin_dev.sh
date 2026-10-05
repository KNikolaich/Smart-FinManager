#!/usr/bin/env bash
# Smart-FinManager: local dev run in WSL from the local Windows clone.
#
#   scripts/fin_dev.sh                 update the current branch and start (dev mode, hot reload)
#   scripts/fin_dev.sh try/feature     switch to a branch from the local clone and start
#   scripts/fin_dev.sh --prod [branch] production build + start, like on the server
#
# Run it in the WSL clone ~/Smart-FinManager, or from Windows with
# scripts\fin_dev.bat (double-click; branch main unless one is given).
#
# The WSL clone is view-only: its "origin" is the Windows clone
# (git clone /mnt/f/Docs/Git/Smart-FinManager ~/Smart-FinManager), so unpushed
# commits are visible here, uncommitted changes are not.
# The database is not touched, except: if schema.prisma is ahead of the local DB,
# the script asks before syncing it (prisma db push). The in-app
# «Обновление БД» cannot do that when the users table changes.
#
# Everything runs inside main(), so bash parses the whole file before
# executing: updating the code may safely change this very script mid-run.

main() {
  set -Eeuo pipefail

  local MODE=dev BRANCH=""
  for arg in "$@"; do
    case "$arg" in
      --prod) MODE=prod ;;
      -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}"; exit 0 ;;
      *) BRANCH="$arg" ;;
    esac
  done

  local APP_DIR
  APP_DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
  cd "$APP_DIR"

  local C_OK=$'\e[32m' C_ERR=$'\e[31m' C_WARN=$'\e[33m' C_STEP=$'\e[36m' C_OFF=$'\e[0m'
  step() { echo "${C_STEP}==> $*${C_OFF}"; }
  ok()   { echo "${C_OK}✔ $*${C_OFF}"; }
  warn() { echo "${C_WARN}! $*${C_OFF}"; }
  die()  { echo "${C_ERR}✘ $*${C_OFF}" >&2; exit 1; }

  [[ -f .env ]] || die "Нет файла .env в $APP_DIR (см. инструкцию: блок cat > .env)"
  local PORT
  PORT="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2 | tr -d '"' || true)"
  PORT="${PORT:-5000}"

  # ------------------------------------------------------------ 1. code
  step "Забираю изменения из $(git remote get-url origin)"
  git diff --quiet && git diff --cached --quiet \
    || die "В WSL-клоне есть локальные правки (git status). Этот клон только для просмотра: git stash или git checkout -- ."
  git fetch --quiet --prune origin
  [[ -n "$BRANCH" ]] || BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  git rev-parse --verify --quiet "origin/$BRANCH" >/dev/null \
    || die "Ветки '$BRANCH' нет в локальном репозитории. Доступные: $(git branch -r | grep -v HEAD | sed 's#origin/##' | xargs)"

  local OLD_REV NEW_REV SELF_BEFORE
  OLD_REV="$(git rev-parse --short HEAD)"
  SELF_BEFORE="$(sha1sum scripts/fin_dev.sh | cut -c1-40)"
  # Follow the source exactly, even if a branch there was rewritten.
  git checkout --quiet -B "$BRANCH" "origin/$BRANCH"
  NEW_REV="$(git rev-parse --short HEAD)"
  if [[ "$OLD_REV" == "$NEW_REV" ]]; then
    ok "$BRANCH @ $NEW_REV — без изменений"
  else
    ok "$BRANCH: $OLD_REV → $NEW_REV"
    git --no-pager log --oneline -10 "$OLD_REV..$NEW_REV" 2>/dev/null || true
  fi
  if [[ "$(sha1sum scripts/fin_dev.sh | cut -c1-40)" != "$SELF_BEFORE" ]]; then
    step "Скрипт обновился — перезапускаю его новую версию"
    exec "$APP_DIR/scripts/fin_dev.sh" "$@"
  fi

  # ---------------------------------------------------- 2. dependencies
  local LOCK_STAMP=node_modules/.fin_dev_lock SCHEMA_STAMP=node_modules/.fin_dev_schema
  local LOCK_NOW SCHEMA_NOW SCHEMA_WAS=""
  LOCK_NOW="$(sha1sum package-lock.json | cut -c1-40)"
  SCHEMA_NOW="$(sha1sum prisma/schema.prisma | cut -c1-40)"
  [[ -f "$SCHEMA_STAMP" ]] && SCHEMA_WAS="$(cat "$SCHEMA_STAMP")"

  if [[ ! -d node_modules || "$(cat "$LOCK_STAMP" 2>/dev/null)" != "$LOCK_NOW" ]]; then
    step "Устанавливаю зависимости (npm ci, заодно prisma generate)"
    npm ci --no-audit --no-fund
    echo "$LOCK_NOW" > "$LOCK_STAMP"
  elif [[ "$SCHEMA_WAS" != "$SCHEMA_NOW" ]]; then
    step "Схема изменилась — обновляю Prisma Client"
    npx prisma generate >/dev/null
  else
    ok "Зависимости актуальны"
  fi
  echo "$SCHEMA_NOW" > "$SCHEMA_STAMP"

  # ------------------------------------------------------ 3. database up?
  if ! pg_isready -q -h localhost 2>/dev/null; then
    step "PostgreSQL не запущен — запускаю (нужен sudo)"
    sudo service postgresql start >/dev/null
    for _ in $(seq 1 10); do pg_isready -q -h localhost && break; sleep 1; done
    pg_isready -q -h localhost || die "PostgreSQL не отвечает"
  fi

  # ------------------------------------------- 3b. schema vs local database
  # The in-app «Обновление БД» cannot help when the users table changed:
  # every request (login included) reads that table and fails first.
  # So compare here and offer to sync; nothing is changed without "y".
  local DB_URL
  DB_URL="$(grep -E '^DATABASE_URL=' .env | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
  local DRIFT=0
  npx prisma migrate diff --from-url "$DB_URL" --to-schema-datamodel prisma/schema.prisma --exit-code \
    >/dev/null 2>&1 || DRIFT=$?
  if [[ $DRIFT -eq 2 ]]; then
    warn "Локальная БД отстаёт от schema.prisma (новые таблицы/поля)."
    local ANSWER=n
    if [[ -t 0 ]]; then
      read -r -p "Синхронизировать локальную БД сейчас (prisma db push)? [Y/n] " ANSWER || ANSWER=n
      ANSWER="${ANSWER:-y}"
    fi
    if [[ "$ANSWER" =~ ^[YyДд] ]]; then
      npx prisma db push --skip-generate
      ok "Локальная БД синхронизирована"
    else
      warn "Пропущено. Если изменилась таблица users — вход работать не будет, пока не синхронизируешь."
    fi
  elif [[ $DRIFT -ne 0 ]]; then
    warn "Не удалось сравнить схему с БД (prisma migrate diff, код $DRIFT) — продолжаю"
  fi

  # --------------------------------------------- 4. stop previous instance
  local PIDS
  PIDS="$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K\d+' || true)"
  if [[ -n "$PIDS" ]]; then
    step "Останавливаю предыдущий запуск на порту $PORT"
    # shellcheck disable=SC2086
    kill $PIDS 2>/dev/null || true
    for _ in $(seq 1 10); do
      ss -ltnH "sport = :$PORT" | grep -q . || break
      sleep 1
    done
    ss -ltnH "sport = :$PORT" | grep -q . && die "Порт $PORT всё ещё занят"
  fi

  # --------------------------------------------------------------- 5. run
  echo
  if [[ "$MODE" == "prod" ]]; then
    step "Production-сборка (npm run build)"
    npm run build
    ok "Запуск production: http://localhost:$PORT  (Ctrl+C — остановить)"
    NODE_ENV=production exec npx tsx server.ts
  else
    ok "Запуск dev-режима: http://localhost:$PORT  (Ctrl+C — остановить, фронтенд обновляется сам)"
    NODE_ENV=development exec npx tsx server.ts
  fi
}

main "$@"
