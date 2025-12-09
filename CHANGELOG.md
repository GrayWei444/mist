# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.1.0] - 2024-12-09

### Added - Phase 0 Demo

**UI/UX**
- Weather disguise page (long press sun icon 3 seconds to enter chat)
- LINE-style chat interface with responsive design
- Purple Mist theme (`#A855F7`)
- Friend list with avatar support

**Privacy Features**
- Message blur protection (long press to reveal)
- Burn-after-read (tap flame icon to destroy)
- TTL auto-destruct (10 second countdown after viewing)
- 30-second inactivity auto-return to disguise page

**Media**
- Image message support
- Image avatar for contacts

**PWA**
- Service worker for offline support
- Installable on mobile devices
- Custom Mist icon

**Deployment**
- GitHub Pages deployment via GitHub Actions
- Live demo at https://graywei444.github.io/mist/

### Fixed
- React hooks order violation causing black screen on burn button click

---

## [Unreleased]

### Planned - Phase 1
- Rust WASM core integration
- X3DH key exchange
- Double Ratchet encryption
- WebRTC P2P connection
- MQTT signaling
