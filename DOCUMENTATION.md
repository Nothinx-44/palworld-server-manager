# 📖 Full Documentation

Advanced setup, API reference, development guide.

## Table of Contents

1. [Installation](#installation)
2. [Setup Guide](#setup-guide)
3. [Configuration](#configuration)
4. [Features in Detail](#features)
5. [API Reference](#api-reference)
6. [Security](#security)
7. [Development](#development)
8. [Troubleshooting](#troubleshooting)

---

## Installation

### Option 1: Desktop App (Easiest)

1. Download [PalLauncherServerManager-Setup.exe](https://github.com/Nothinx-44/palworld-launcher-server-manager/releases) from Releases
2. Double-click the .exe
3. Windows shows UAC prompt → Click "Yes"
4. Follow the setup wizard
5. Done! Dashboard runs automatically

**Note:** SmartScreen may warn on first run (unsigned .exe). Click "More info" → "Run anyway".

### Option 2: Manual Install (Command Line)

**Prerequisites:**
- Windows 10+
- [Node.js LTS](https://nodejs.org) installed
- [NSSM](https://nssm.cc/download) extracted to `C:\nssm\` (or edit path in `.env`)

**Steps:**

```powershell
# Clone the repo
git clone https://github.com/Nothinx-44/palworld-launcher-server-manager-source.git
cd palworld-launcher-server-manager-source

# Install dependencies
npm install

# Copy config template
Copy-Item .env.example .env

# Edit .env (at minimum: SESSION_SECRET, NSSM_PATH)
notepad .env

# Create your admin account
npm run create-user -- your_username your_password admin

# Test locally
node server.js
# Visit http://localhost:3000
# Press Ctrl+C to stop

# Install as Windows service (optional)
nssm install PalworldDashboard "C:\Program Files\nodejs\node.exe" "C:\path\to\server.js"
nssm start PalworldDashboard
```

---

## Setup Guide

### 1. Initial Configuration

Edit `.env` file with these critical values:

```env
# Session encryption (generate: openssl rand -base64 32)
SESSION_SECRET=your_random_secret_here

# Windows service manager path
NSSM_PATH=C:\nssm\nssm.exe

# Server installation directory (leave empty to configure later)
PALWORLD_INSTALL_DIR=

# SteamCMD directory (leave empty to auto-download)
STEAMCMD_PATH=

# API password (used for Palworld REST API + PalDefender)
PALWORLD_API_PASSWORD=your_strong_password

# Backup location
BACKUP_DIR=D:\Backups

# Dashboard port
PORT=3000

# Discord webhook (optional)
DISCORD_WEBHOOK_URL=https://discordapp.com/api/webhooks/YOUR_WEBHOOK_HERE
```

### 2. Create Admin Account

```powershell
npm run create-user -- admin_name admin_password admin
# Optional: create viewer-only account
npm run create-user -- friend_name friend_password viewer
```

### 3. Install Server via Dashboard

1. Log in to dashboard (http://localhost:3000)
2. Go to **Settings** → **Install Server**
3. Fill in server details (name, password, ports, etc.)
4. Click **Install**
5. Wait for download + setup (12-15 GB, 15-30 minutes)
6. Done! Server runs automatically

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3000 | Dashboard web port |
| `SESSION_SECRET` | (required) | Session encryption key |
| `PALWORLD_API_PASSWORD` | (required) | Admin password + API auth |
| `NSSM_PATH` | C:\nssm\nssm.exe | Windows service manager |
| `PALWORLD_INSTALL_DIR` | (auto) | Palworld server folder |
| `STEAMCMD_PATH` | (auto) | SteamCMD folder |
| `SAVE_PATH` | (auto) | World save folder |
| `BACKUP_DIR` | (auto) | Backup folder |
| `DISCORD_WEBHOOK_URL` | (optional) | Discord notifications |
| `RESTART_CRON` | (empty) | Restart schedule (cron syntax) |
| `BACKUP_CRON` | 0 4 * * * | Daily 4 AM backup |
| `WATCHDOG_INTERVAL_MS` | 60000 | Server health check interval |
| `WATCHDOG_FAIL_THRESHOLD` | 3 | Auto-restart after N failures |

### World Settings

Edit `PalWorldSettings.ini` directly from dashboard (**Settings** tab):

- **Difficulty:** Difficulty enum
- **PvP:** true/false
- **WorkSpeed:** XP multiplier
- **Player Counts:** Min/max players
- **Build:** Building speed
- **Drop Rates:** Item drop rates

⚠️ Changes apply **only after next restart**.

---

## Features in Detail

### Server Control

- **Start/Stop/Restart:** One-click server management
- **Graceful Shutdown:** Saves world before stopping
- **Scheduled Restart:** Configure recurring restarts with player warnings
- **Watchdog:** Auto-restart if server crashes (3 failures = restart)

### Backup System

- **Manual Backup:** Click to backup anytime
- **Scheduled Backups:** Cron-based automation
- **Auto-Cleanup:** Delete old backups automatically (keep last 14)
- **One-Click Restore:** Select backup → restore (creates safety backup first)

### Player Management

- **Real-Time List:** Who's online now
- **Kick/Ban:** Remove players instantly
- **Player History:** Join/leave times + playtime tracking
- **Live Map:** Player positions (updates every 60s)

### Admin Commands

- **Broadcast:** Message all players
- **Kick/Ban/Unban:** Manage troublemakers
- **World Settings:** Difficulty, PvP, drop rates
- **Server Metrics:** FPS, uptime, in-game days

### Discord Integration

Auto-post to Discord webhook:
- Server start/stop/restart
- Player joins/leaves
- Backup completion
- Watchdog auto-restart alerts
- Admin commands

Enable by setting `DISCORD_WEBHOOK_URL`.

---

## API Reference

### Authentication

All requests require `PALWORLD_API_PASSWORD` as Basic Auth:

```bash
curl -H "Authorization: Basic $(echo -n 'admin:password' | base64)" \
  http://localhost:3000/api/...
```

### Endpoints

#### Server Control

```
POST /api/start       # Start server
POST /api/stop        # Stop server
POST /api/restart     # Restart server
POST /api/save        # Save world
GET  /api/status      # Server status
```

#### Backups

```
GET  /api/backups           # List backups
POST /api/backup            # Create backup
POST /api/backups/restore   # Restore backup
```

#### Players

```
GET  /api/players           # Online players
GET  /api/players/history   # Player history
POST /api/kick              # Kick player
POST /api/ban               # Ban player
POST /api/unban             # Unban player
```

#### Admin Commands

```
POST /api/paldefender/command  # Execute admin command
```

Body example:
```json
{
  "command": "kick",
  "target": "user_id",
  "fields": {"Reason": "Spam"}
}
```

---

## Security

### Port Configuration

| Port | Protocol | Exposure | Security |
|------|----------|----------|----------|
| 3000 | TCP | Dashboard | HTTP, requires login |
| 8211 | UDP | Game server | Exposed (game play) |
| 8212 | TCP | REST API | **DO NOT EXPOSE** |
| 25575 | TCP | RCON | **DO NOT EXPOSE** |

### Recommendations

- ✅ Use **non-standard port** (e.g., 51234) for dashboard
- ✅ Use **strong passwords** for all accounts
- ✅ **Never forward** port 8212 or 25575
- ✅ Use **Discord webhooks** to monitor alerts
- ❌ Don't reuse dashboard password elsewhere
- ❌ Don't disable rate limiting

---

## Development

### Running Locally

```powershell
# Mock mode (fake Palworld API)
npm run mock
node server.js

# Test mode
npm test

# Dev mode
npm run electron:dev

# Build installer
npm run dist
```

### File Structure

```
├── server.js              # Express API server
├── public/                # Web dashboard
│  ├── app.js              # Frontend logic
│  ├── index.html          # Main dashboard
│  └── style.css           # Styling
├── lib/                   # Backend modules
│  ├── palworldClient.js   # Game API integration
│  ├── plugins.js          # Plugin management
│  ├── bans.js             # Ban list tracking
│  └── ...
├── electron/              # Desktop app
│  ├── main.js             # Electron window + IPC
│  ├── renderer/           # Setup wizard UI
│  └── preload.js          # Security context bridge
├── test/                  # Test suite
├── .env.example           # Config template
└── package.json           # Dependencies
```

### Running Tests

```powershell
npm test
# Runs 94+ test cases covering:
# - Account & role management
# - Activity logging
# - Session persistence
# - Backup/restore workflow
# - Settings file parsing
```

---

## Troubleshooting

### Q: Dashboard won't start
**A:** Check `.env` settings:
- `PALWORLD_API_PASSWORD` is set
- `SESSION_SECRET` is set
- Port 3000 is not in use: `netstat -ano | findstr 3000`

### Q: Server install fails
**A:** Ensure:
- Administrator rights enabled (UAC prompt shown)
- 50+ GB free space
- SteamCMD can reach steam.cmddownloads.com

### Q: "Smart Screen blocked this"
**A:** Normal for unsigned .exe. Click "More info" → "Run anyway". 
(Signing costs $; it's on the roadmap for v2.0)

### Q: Players can't join
**A:** Verify port forwarding on your router:
- External port → internal IP:8211 (UDP)
- Test with: `telnet your.ip.public 8211`

### Q: Backups aren't running
**A:** Check `BACKUP_CRON` format (default: `0 4 * * *` = daily 4 AM)
Cron reference: https://crontab.guru

### Q: Admin commands don't work
**A:** Verify:
- Server is running
- PalDefender installed (if using PalDefender commands)
- RCON enabled in `PalWorldSettings.ini`

---

## FAQ

**Q: What's the difference between free & Pro versions?**  
A: There's only one version. It's 100% free & open source forever.

**Q: Can I run multiple servers?**  
A: No, this dashboard runs one server. Clone the repo + change port + `.env` for multiple.

**Q: Does it work on Linux/Mac?**  
A: Desktop app requires Windows. Web dashboard can run on Linux with manual setup.

**Q: Can I use this commercially?**  
A: Yes, MIT license allows commercial use, modification, distribution.

**Q: Does it auto-update?**  
A: Check GitHub for updates manually. Auto-updates coming in v2.0.

---

## Support

- **Issues:** https://github.com/Nothinx-44/palworld-launcher-server-manager/issues
- **Discussions:** https://github.com/Nothinx-44/palworld-launcher-server-manager/discussions
- **Contributing:** PRs welcome!

---

Last updated: 2026-07-08
