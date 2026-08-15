# Twitch Captain - Bicycle Racing 🚴‍♂️💨

A 3D low-poly bicycle racing game built with **Three.js**. Race through a procedurally generated track with loops, jumps, and high-speed corners. Every millisecond counts.

## 🎮 Play

👉 **[twitchcaptain.github.io/racing](https://twitchcaptain.github.io/racing)**

## 🕹️ Controls

| Key | Action |
|-----|--------|
| `↑` / `W` | Pedal Forward |
| `↓` / `S` | Brake / Reverse |
| `←` / `A` | Steer Left |
| `→` / `D` | Steer Right |
| `Shift` | Sprint (Boost) |
| `` ` `` | Toggle debug panel (camera & lighting) |

On mobile, on-screen touch buttons appear in the bottom corners: left/right to steer, up to pedal, down to brake.

## 🏗️ Features

- 3D low-poly track with elevation changes, loops, and jumps
- Countdown start (3-2-1-GO)
- 3-lap race against **3 AI opponents** (distinct bikes, skill levels, boost bursts) with live position/rank HUD
- Lap progress bar and per-lap split times, best-lap tracking
- Third-person camera following your bike
- Speed, lap, time, and position HUD
- Minimap showing all racers
- Boost mechanic with energy management
- Off-track penalty (riding off the road slows you down)
- Particle effects at high speeds
- Mobile touch controls (on-screen buttons)
- Debug panel (press `` ` `` to tweak camera and lighting)

## 🚫 Known Limitations

- No ghost replay of your best lap
- No audio
- Track is regenerated procedurally on every page load

## 🚀 Running Locally

```bash
git clone https://github.com/TwitchCaptain/racing.git
cd racing
# Serve with any HTTP server, e.g.:
python3 -m http.server 8080
# Open http://localhost:8080
```

## 🛠️ Built With

- [Three.js](https://threejs.org/) - 3D graphics library
- Vanilla JavaScript - no frameworks needed
- Procedural track generation

## 📄 License

MIT
