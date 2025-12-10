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

### Added - Phase 1 (In Progress)

**Rust WASM Crypto Core** (2024-12-10)
- `IdentityKeyPair` - Ed25519 signing keys for identity verification
- `X25519KeyPair` - Elliptic curve Diffie-Hellman key exchange
- `X3DH` - Extended Triple Diffie-Hellman initial key agreement
- `RatchetSession` - Double Ratchet protocol for forward secrecy
- `AesGcmCipher` - AES-256-GCM symmetric encryption
- `PreKeyBundle` - Key distribution format for async communication
- `signPreKey` - PreKey signing helper
- `createPreKeyBundleJson` - WASM-friendly bundle serialization

**Backend Infrastructure** (2024-12-10)
- VPS deployment via Hostinger (31.97.71.140)
- EMQX 5.3.2 MQTT broker for WebSocket signaling
- Coturn 4.6.3 STUN/TURN server for NAT traversal
- Caddy reverse proxy with Let's Encrypt SSL
- Domain: mqtt.alwaysbefound.com (temporary)

### Planned
- Frontend WASM integration
- MQTT connection service
- WebRTC P2P connection
