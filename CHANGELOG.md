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

### Planned - Phase 3
- Message signing and verification integration
- UI components for WebAuthn and verification
- Full E2E encryption chat flow

---

## [0.2.0] - 2024-12-10

### Added - Phase 1: 基礎通訊

**Rust WASM Crypto Core**
- `IdentityKeyPair` - Ed25519 signing keys for identity verification
- `X25519KeyPair` - Elliptic curve Diffie-Hellman key exchange
- `X3DH` - Extended Triple Diffie-Hellman initial key agreement
- `RatchetSession` - Double Ratchet protocol for forward secrecy
- `AesGcmCipher` - AES-256-GCM symmetric encryption
- `PreKeyBundle` - Key distribution format for async communication
- `signPreKey` - PreKey signing helper
- `createPreKeyBundleJson` - WASM-friendly bundle serialization

**Backend Infrastructure**
- VPS deployment via Hostinger (31.97.71.140)
- EMQX 5.3.2 MQTT broker for WebSocket signaling
- Coturn 4.6.3 STUN/TURN server for NAT traversal
- Caddy reverse proxy with Let's Encrypt SSL
- Domain: mqtt.alwaysbefound.com (temporary)

**Frontend Services**
- `crypto.ts` - TypeScript wrapper for Rust WASM crypto module
- `mqtt.ts` - MQTT over WebSocket signaling service
- `webrtc.ts` - WebRTC P2P connection management

**React Hooks**
- `useCrypto` - Crypto module integration with key persistence
- `useMqtt` - MQTT connection state and messaging
- `useWebRTC` - P2P connection management

---

## [0.2.1] - 2024-12-10

### Added - Phase 2: 安全認證與好友驗證

**WebAuthn 生物辨識認證**
- Platform authenticator support (指紋、Face ID)
- Credential registration and authentication
- Secure credential storage
- `useWebAuthn` React Hook

**好友驗證系統**
- QR Code 面對面驗證 (🟢 已驗證)
- 一次性邀請連結 (🟡 未驗證)
- 分層信任機制 (TrustLevel)
- Ed25519 數位簽章驗證
- `useVerification` React Hook

**Type Declarations**
- QRCode module type declaration
