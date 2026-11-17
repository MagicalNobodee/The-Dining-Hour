<div align="center">

<img src="docs/assets/hero-banner.png" alt="The Dining Hour" width="100%" />

<br />

[![Platform](https://img.shields.io/badge/Chrome_%7C_Edge-Manifest_V3-2F3532?style=flat-square)](#installation--usage)
[![Version](https://img.shields.io/badge/Version-0.5.0-5A7254?style=flat-square)](https://github.com/MagicalNobodee/The-Dining-Hour/releases/latest)
[![Clock](https://img.shields.io/badge/Time_Sync-HK_Observatory-9A7B4F?style=flat-square)](#execution-flow)
[![License](https://img.shields.io/badge/License-MIT-6E6A61?style=flat-square)](LICENSE)

<p align="center">
  <a href="README.md">简体中文</a> · <b>English</b>
</p>

<p align="center">
  <a href="#overview">Overview</a> ·
  <a href="#features">Features</a> ·
  <a href="#interface">Interface</a> ·
  <a href="#installation--usage">Installation & Usage</a> ·
  <a href="#execution-flow">Execution Flow</a> ·
  <a href="#privacy--operational-limits">Privacy & Limits</a> ·
  <a href="#development--testing">Testing</a>
</p>

</div>

---

## Overview

Meal ordering at **St. John's College (HKU)** opens at fixed daily times, and limited-quota dishes frequently sell out within seconds. Manual checkout at the opening second is sensitive to local system clock drift, full-page reload latency, and ambiguous confirmation states under network jitter.

**The Dining Hour (准点)** is a zero-dependency Manifest V3 browser extension that runs directly inside the authenticated Dining Hall `/cart/` page. After synchronizing with Hong Kong Observatory Standard Time, it dispatches a same-origin checkout request at the target opening second, performs bounded serial retries only under verified closed-hall responses, and confirms completion by verifying newly created entries on `/order_details/`.

---

## Features

- **Hong Kong Observatory Time Sync**: Samples the official HKO clock endpoint three times, filters out cached or high-RTT responses, and computes local clock offset from the fastest round trip. Automatically re-calibrates 45 seconds before opening during longer waits.
- **In-Page Same-Origin Checkout**: Reuses the active `/cart/` session directly without full-page navigation or background IPC overhead on the critical send path, preceded by a read-only connection warm-up and cart verification 8 seconds before opening.
- **Bounded Closed-Hours Retry**: Retries serially (`100 / 200 / 400 ms` intervals, up to 4 total attempts within 4 seconds of opening) only when the server explicitly returns `The Dining Hall is closed` and both cart items and account balance match the baseline snapshot.
- **Order-List Verification**: Does not rely on HTTP 200 status codes or an empty cart alone; performs up to 3 read-only checks against `/order_details/` to confirm matching new order rows before reporting success.
- **Same-Origin Latency Monitor**: Includes a draggable bottom-left response monitor measuring non-cached same-origin RTT medians across networks, automatically pausing across all tabs 15 seconds before checkout.
- **Single-Run Guards & Rehearsal Mode**: Enforces cross-tab mutex leases and per-meal session guards to prevent accidental duplicate submissions on reload, plus a zero-network 5-second rehearsal mode.

---

## Interface

<p align="center">
  <img src="docs/assets/ui-gallery.png" alt="The Dining Hour Interface" width="100%" />
</p>

### Latency Metrics

| Metric | Measurement Interval | Notes |
| --- | --- | --- |
| **Send Delay (`发送请求延迟`)** | Calibrated opening timestamp → first checkout request dispatch | Measures client timer precision; excludes network transit and server processing time. |
| **Confirmation Delay (`成功确认延迟`)** | Calibrated opening timestamp → verified matching order on `/order_details/` | Includes network round trips, bounded retries, and order-page verification. Shown as `—` on rehearsal, failed, or unconfirmed runs. |

---

## Installation & Usage

### 1. Installation

1. Download `The-Dining-Hour-v0.5.0.zip` from [Releases](https://github.com/MagicalNobodee/The-Dining-Hour/releases/latest) and extract it, or clone this repository:
   ```bash
   git clone https://github.com/MagicalNobodee/The-Dining-Hour.git
   ```
2. Open `chrome://extensions` in Chrome, Edge, or Arc and enable **Developer mode**.
3. Click **Load unpacked** and select the `extension` directory.

### 2. Daily Workflow

1. Sign in at `https://dh.stjohns.hk/cart/`, add your selected dishes to the cart, and stay on the cart page.
2. Select the target meal slot in the floating panel:

   | Meal | Service Window (HKT) | Trigger Time |
   | --- | --- | --- |
   | Breakfast | `07:40 – 09:30` | `07:40:00` |
   | Lunch | `12:20 – 13:45` | `12:20:00` |
   | Dinner | `18:50 – 20:00` | `18:50:00` |

3. Within **30 minutes before opening**, click **校准 (Calibrate)** until the status reads `香港天文台 · 已同步`.
4. Check the confirmation box and click **准备就绪 (Arm)**.
5. Keep your computer awake and the `/cart/` tab visible in the foreground. Once the countdown completes, the extension submits and verifies your order automatically.

> You can click **演练 5 秒 · 不下单** at the bottom of the panel anytime to preview the countdown and state transitions without sending any network requests.

---

## Execution Flow

| Stage | Window | Behavior & Safeguards |
| --- | --- | --- |
| **01 Calibration & Baseline** | Within 30 min before opening | Computes local clock offset against HKO; records read-only cart fingerprint, account balance, and existing orders when armed. |
| **02 Re-Sync & Pre-Warm** | `T - 45s / 15s / 8s` | Optional re-calibration at `T - 45s`; pauses background latency probes across tabs at `T - 15s`; verifies unchanged remote cart at `T - 8s`. |
| **03 Dispatch & Bounded Retry** | `0s` to `+4s` | Triggers via monotonic timer (`performance.now()`); aborts unsent runs if sleep, clock jump, backgrounding, or >1s lateness is detected. |
| **04 Order Verification** | Up to `12s` post-send | Queries `/order_details/` (up to 3 read-only checks) to match new order items and empty cart; halts immediately on auth expiry, insufficient balance, sold-out items, or network errors. |

---

## Privacy & Operational Limits

- **Minimal Local Storage**: Zero external dependencies, remote scripts, or analytics. `chrome.storage.local` stores only panel coordinates, probe summaries, and the latest 20 status timestamps—never credentials, cookies, balances, or dish histories.
- **Non-Idempotent Checkout Endpoint**: Because the site executes checkout via `GET /ordered/`, Chromium's network stack may retry an aborted connection once at the transport layer. If an attempt finishes in an unconfirmed state, check `/order_details/` before manually clicking checkout elsewhere.
- **Network & Inventory Constraints**: Actual fulfillment remains subject to network routing, server queuing, and dish availability.

---

## Development & Testing

All automated tests run against a local ephemeral HTTPS mock server and dedicated proxy without contacting the live dining hall server:

```bash
npm install
npm test
npm run pack
```

---

## License

Released under the [MIT License](LICENSE).
