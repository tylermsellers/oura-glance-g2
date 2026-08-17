# Oura Glance G2

A G2 smart glasses app built with [even-toolkit](https://www.npmjs.com/package/even-toolkit) that surfaces your [Oura Ring](https://ouraring.com) Readiness, Sleep, and Activity data — right on your glasses and in a companion phone-app view.

## Features

- Activity, Sleep, and Readiness scores on the glasses home screen, with drill-down detail screens showing raw units (heart rate, HRV, sleep stage durations, calories, steps, distance) instead of just the 0–100 score
- Goal progress (active calories / distance vs. target) for Activity
- Imperial/Metric unit toggle (distance and temperature deviation)
- Modern iOS-style companion phone app for managing your Oura token and unit preference

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Test with Simulator

```bash
npx @evenrealities/evenhub-simulator@latest http://localhost:5173
```

## Install without any local dev server or shared Wi-Fi

Grab the latest packaged build from [**GitHub Releases**](https://github.com/tylermsellers/oura-glance-g2/releases/latest) — download the `oura-glance-g2.ehpk` asset directly to your phone, then use the Even Realities app's sideload/developer-install option to import it. The app runs entirely from the installed bundle plus the hosted Cloudflare Worker API proxy — no PC, no dev server, no shared network required.

## Sideload while developing (QR code)

With `npm run dev` running, generate a QR code pointing at your local dev server:

```bash
npx evenhub qr
```

Scan the QR code with the Even Realities companion app on your phone (same Wi-Fi network as your dev machine). The app loads onto your G2 glasses with hot reload. This is only for local development/testing — it requires the dev server to stay running and both devices on the same network.

## Build & Package for Even Hub

```bash
npm run build
npx @evenrealities/evenhub-cli pack app.json dist -o oura-glance-g2.ehpk
```

This produces `oura-glance-g2.ehpk`, which can be distributed two ways:

1. **Direct sideload (current)** — attach the `.ehpk` file to a [GitHub Release](https://github.com/tylermsellers/oura-glance-g2/releases) for manual import into the Even Realities app's developer/sideload flow. No review required — see "Install" above.
2. **Official Even Hub store (planned)** — submit the `.ehpk` through the [Even Hub developer portal](https://hub.evenrealities.com/docs/ship/app-submission) for review and public listing, giving users a one-tap install from the official catalog.

## Configuration

On first launch, open the app on your phone and paste your [Oura Personal Access Token](https://cloud.ouraring.com/personal-access-tokens) into the Connection section. The token is stored locally on-device only.

## License

Personal project — not officially affiliated with Oura Health Oy or Even Realities.
