# Flash AnZan – classroom edition

A lightweight flash-anzan (mental arithmetic) trainer for teachers to screen-share with a class.
Numbers flash one at a time; the class works out the total; the teacher reveals the answer.

- Operations: add, subtract, multiply, divide (mix any combination; division is always whole-number)
- Teacher-built **setting profiles** (e.g. per age group): digits, how many numbers, speed, blank pause,
  countdown, questions per session, multiplier size, negatives, sound
- Four starter profiles are created on first run (ages 5–7, 8–10, 11–13, 14+)
- No logins, scores or leaderboards. Only the profiles are stored (PostgreSQL).

## Run on your school network (Docker)

```bash
docker compose up -d --build
```

Open `http://<this-computer's-IP>:3000` (e.g. `http://192.168.1.20:3000`) from any device on the network.
Data lives in the `anzan-data` Docker volume and survives restarts and rebuilds.

Stop: `docker compose down` (add `-v` to also wipe the profiles).

## Presenting tips

- Press **F** (or the Fullscreen button) before screen-sharing so only the stage is visible.
- Shortcuts: **Space/Enter** start / show answer / next, **R** replay, **Esc** stop.
- Use the speed slider above the stage to slow down or speed up live without editing the profile.
- Online meeting tools compress video, so use ≥ 0.8 s per number for screen-shared sessions.

## Development

```bash
npm install
# DATABASE_URL in .env, e.g. postgresql://postgres:postgres@127.0.0.1:5432/app_db
npm run dev
```

Tables are created automatically on first request. Stack: Next.js (standalone output), Tailwind, Drizzle ORM, PostgreSQL.
