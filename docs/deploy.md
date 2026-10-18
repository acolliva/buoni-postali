# Running it on a Raspberry Pi

The Pi runs a small Node.js server (`server/server.mjs`, no dependencies). It serves the app and keeps your data in `data/state.json`, so every device on your home network sees the same buoni and the same rimborsi.

## What you need

- A Raspberry Pi 3, 4 or 5 with Raspberry Pi OS 64-bit (Bookworm or later). The Pi Zero and Pi 1 are too old for current Node.js.
- Node.js 22. The version in the Raspberry Pi OS repositories is too old to build the app, so install it from NodeSource:

  ```sh
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs git
  node -v   # v22.x
  ```

## Install

```sh
cd ~
git clone https://github.com/acolliva/buoni-postali.git
cd buoni-postali
npm ci
npm run build
mkdir -p data
npm run serve            # try it: http://<pi-name>.local:9999, Ctrl+C to stop
```

## Start automatically

The unit file assumes the user `pi` and the repo in `/home/pi/buoni-postali`. Edit it first if yours differ.

```sh
sudo cp deploy/buoni-postali.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now buoni-postali
systemctl status buoni-postali      # should say "active (running)"
```

Open `http://<pi-name>.local:9999` from any device on the network. If `.local` names don't resolve on your network, use the Pi's IP address (`hostname -I` on the Pi).

The first browser that opens the app and already has buoni loaded will copy them to the server. Otherwise import the spreadsheet once from any device.

## Update

```sh
cd ~/buoni-postali
git pull
npm ci
npm run build
sudo systemctl restart buoni-postali
```

## Your data

- Everything lives in `data/state.json`. Before each save the previous version is kept in `data/backups/`, and the last 50 are kept.
- `data/` is git-ignored, so updates never touch it.
- Copy `data/state.json` somewhere else from time to time, for example to a USB stick or your laptop with `scp pi@<pi-name>.local:buoni-postali/data/state.json .`.

## Security

There is no login. Anyone on your home network who opens the address can see and change the data.

- Do not forward port 9999 on your router or expose the Pi to the internet.
- To reach it from outside the house, use a private VPN such as Tailscale or WireGuard instead.

If two devices edit at the same time, the second save is refused and that page asks you to reload, so changes are never silently overwritten.
