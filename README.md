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

## Sideload to your glasses (QR code, no store review)

With `npm run dev` running, generate a QR code pointing at your local dev server:

```bash
npx evenhub qr
```

Scan the QR code with the Even Realities companion app on your phone (same Wi-Fi network as your dev machine). The app loads onto your G2 glasses with hot reload — no store submission needed. This is the fastest way to try the app or share a build with testers.

## Build & Package for Even Hub

```bash
npm run build
npx @evenrealities/evenhub-cli pack app.json dist -o oura-glance-g2.ehpk
```

This produces `oura-glance-g2.ehpk`, which can be distributed two ways:

1. **Direct sideload** — share the `.ehpk` file directly (e.g. as a GitHub release asset) for manual import into the Even Realities app's developer/sideload flow. No review required.
2. **Official Even Hub store** — submit the `.ehpk` through the [Even Hub developer portal](https://hub.evenrealities.com/docs/ship/app-submission) for review and public listing.

## Configuration

On first launch, open the app on your phone and paste your [Oura Personal Access Token](https://cloud.ouraring.com/personal-access-tokens) into the Connection section. The token is stored locally on-device only.

## License

Personal project — not officially affiliated with Oura Health Oy or Even Realities.
