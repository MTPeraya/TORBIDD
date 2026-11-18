# SEC-23: WebRTC Architectural Scope Exclusion & Threat Model Analysis (ASVS V17)

## Executive Summary
This document establishes the official architectural boundary, threat modeling justification, and network verification confirming that **WebRTC, TURN/STUN relay servers, real-time audio/video streaming, and DTLS-SRTP protocols are completely excluded from the TORBIDD platform**.

By explicitly excluding real-time peer-to-peer and media streaming protocols, TORBIDD eliminates the entire attack surface associated with **OWASP ASVS v4.0.3 Chapter 17 (WebRTC Security Verification Requirements)**, achieving **zero residual risk** across all 12 requirement areas.

---

## 1. System Architecture & Scope Boundary

### 1.1 Application Mission and Domain
TORBIDD (Terms of Reference Bidding Intelligence & Document Discovery) is an automated open procurement monitoring, analysis, and notification system for Thai government procurement projects (e-GP and GovSpending CKAN APIs).

The system operates strictly as a transactional web and analytical system:
- **Client Tier**: Next.js 16 (React 19) browser interface communicating with backend servers exclusively via HTTPS REST endpoints and Next.js Server Actions.
- **Backend Tier**: Node.js 22 runtime providing RESTful APIs, data ingestion workers, and AI classification pipelines (Google Cloud Vertex AI).
- **Data Tier**: MongoDB Atlas multi-tenant document database with TLS 1.3 encryption.
- **Notification Services**: SMTP email delivery via TLS and Web Push notifications.

### 1.2 Explicit Architectural Exclusion
The following technologies and protocols are **NOT implemented, deployed, or supported** anywhere within TORBIDD:
1. **WebRTC Protocols**:
   - WebRTC PeerConnection (`RTCPeerConnection`)
   - Interactive Connectivity Establishment (ICE / RFC 8445)
   - Session Description Protocol (SDP / RFC 8866)
   - WebRTC Data Channels (SCTP / RFC 8831)
2. **Media Relays & NAT Traversal**:
   - Traversal Using Relays around NAT (TURN / RFC 8656)
   - Session Traversal Utilities for NAT (STUN / RFC 8489)
3. **Real-Time Media Transport & Encryption**:
   - Real-time Transport Protocol (RTP / RFC 3550)
   - Secure Real-time Transport Protocol (SRTP / RFC 3711)
   - Datagram Transport Layer Security for SRTP (DTLS-SRTP / RFC 5764)
4. **Hardware Capture & Media Streaming**:
   - Browser Media Capture Streams (`navigator.mediaDevices.getUserMedia`)
   - Browser Screen Capture (`navigator.mediaDevices.getDisplayMedia`)
   - Video/Audio decoding engines and media streaming servers (Kurento, Janus, Mediasoup, etc.)

---

## 2. Threat Modeling & Attack Surface Elimination

Because WebRTC and media streaming capabilities are excluded from the system architecture, the corresponding threat vectors are eliminated:

| Threat Category | Potential Attack Vector in WebRTC Systems | TORBIDD Defense & Architectural State | Residual Risk |
| :--- | :--- | :--- | :---: |
| **Relay Abuse & SSRF** | Attacker abuses open TURN server to scan internal networks or pivot to protected services (ASVS V17.1.1). | **No TURN server operated or configured.** Zero UDP relay endpoints exist. | **NONE (0%)** |
| **TURN Resource Exhaustion** | Denial-of-Service via TURN bandwidth allocation floods (ASVS V17.1.2). | **No TURN servers deployed.** All external requests pass through rate-limited HTTPS endpoints. | **NONE (0%)** |
| **Media Stream Interception** | Eavesdropping on unencrypted or weakly encrypted RTP packets (ASVS V17.2.2, V17.2.3). | **No RTP media streams exist.** All communication is strictly TLS 1.3 encrypted HTTPS. | **NONE (0%)** |
| **Internal IP Address Leak** | ICE candidate gathering revealing client internal/private LAN IPs (ASVS V17.2.5). | **No ICE negotiation.** Web browsers never gather or exchange ICE candidates on TORBIDD. | **NONE (0%)** |
| **Codec Exploitation & Overflow**| Buffer overflows in native C/C++ audio/video codec libraries (ASVS V17.2.7). | **Zero media codecs in runtime.** Node.js backend processes only structured JSON and bounded PDFs. | **NONE (0%)** |
| **Signaling Flood / Hijack** | WebRTC signaling hijacking or SDP injection over WebSockets (ASVS V17.3.1, V17.3.2). | **No WebRTC signaling channels.** Authentication and data transport use secure HTTPS with CSRF and rate limiting. | **NONE (0%)** |

---

## 3. ASVS Chapter 17 Traceability & Justification Matrix

All 12 requirements in OWASP ASVS v4.0.3 Chapter 17 are officially designated as **Plan = FALSE (Non-Applicable)**:

| ASVS ID | ASVS Requirement Description | Plan | Status | Architectural Justification |
| :--- | :--- | :---: | :---: | :--- |
| **V17.1.1** | Verify that TURN servers restrict relaying to permitted IP addresses and ports. | **FALSE** | **N/A** | TORBIDD does not operate, deploy, or connect to TURN/STUN relay servers. |
| **V17.1.2** | Verify that TURN servers enforce bandwidth and allocation quotas to protect against DoS. | **FALSE** | **N/A** | No TURN servers operated. Standard HTTP rate limiting protects REST endpoints. |
| **V17.2.1** | Verify that media servers enforce peer authentication and authorization before negotiating media. | **FALSE** | **N/A** | No media servers operated. User authentication handled via Google OAuth 2.0. |
| **V17.2.2** | Verify that DTLS-SRTP is enforced for real-time media encryption with strong cipher suites. | **FALSE** | **N/A** | No real-time media streams exist. Web transport enforced via TLS 1.3 / HTTPS. |
| **V17.2.3** | Verify that media servers reject unencrypted RTP and enforce SRTP integrity. | **FALSE** | **N/A** | No RTP media streams exist in architecture. |
| **V17.2.4** | Verify that ephemeral encryption keys used in DTLS-SRTP are properly regenerated and discarded. | **FALSE** | **N/A** | No DTLS-SRTP key exchanges occur. Session tokens managed via AES-GCM encrypted cookies. |
| **V17.2.5** | Verify that media streams do not leak private network addresses via unprotected ICE host candidates. | **FALSE** | **N/A** | No ICE negotiation or STUN binding requests initiated. Zero client IP leakage risk. |
| **V17.2.6** | Verify that WebRTC data channels enforce end-to-end encryption, integrity, and rate limiting. | **FALSE** | **N/A** | No WebRTC data channels implemented. Data exchange uses HTTPS JSON APIs. |
| **V17.2.7** | Verify that media processing pipelines protect against malformed codec payloads and buffer overflows. | **FALSE** | **N/A** | No audio/video codec pipelines exist. Input validation enforced with Zod schemas. |
| **V17.2.8** | Verify that recording or archiving of real-time streams complies with data protection policies. | **FALSE** | **N/A** | No real-time recording, surveillance, or media archiving capabilities exist. |
| **V17.3.1** | Verify that WebRTC signaling channels use secure communication (TLS/WSS) and validate messages. | **FALSE** | **N/A** | No WebRTC signaling or SDP exchange channels operated. |
| **V17.3.2** | Verify that signaling endpoints implement rate limiting and authentication. | **FALSE** | **N/A** | No signaling endpoints exist. Standard API endpoints protected by TokenBucket rate limiter. |

---

## 4. Network Port Allocation & Container Hardening Verification

### 4.1 Production Port Verification
In accordance with least-privilege network architecture:
- **Web Tier**: Next.js binds to TCP port `3000` (mapped `3000:3000` in `docker-compose.yml`), fronted by reverse proxy on TCP port `443` (HTTPS) / TCP port `80` (redirect to HTTPS).
- **Database Tier**: MongoDB Atlas accessible strictly over TLS 1.3 on TCP port `27017`.
- **Zero UDP Ports**: No UDP port mappings exist in `docker-compose.yml`, `Dockerfile`, or container deployment manifests. Specifically:
  - Standard WebRTC UDP media port ranges (e.g., `10000-20000/udp`) are **NOT mapped or permitted**.
  - TURN relay ports (`3478/udp`, `5349/udp`) are **NOT mapped or permitted**.

### 4.2 Codebase Dependency & Binary Audit
- **Zero WebRTC npm Packages**: `package.json` contains zero WebRTC libraries (`wrtc`, `werift`, `node-webrtc`, `simple-peer`, `peerjs`, `mediasoup`).
- **Zero WebRTC Browser APIs**: Client-side bundles contain zero calls to `RTCPeerConnection`, `RTCIceCandidate`, `RTCSessionDescription`, `navigator.mediaDevices.getUserMedia`, or `navigator.mediaDevices.getDisplayMedia`.

---

## 5. Architectural References
1. **TORBIDD SRS** (`docs/TORBIDD SRS.pdf`): Section 2.1 & 3.2 — Defines web browser information retrieval and analysis scope.
2. **TORBIDD System Architecture and Data Flow** (`docs/TORBIDD System Architecture and Data Flow.png`): Confirms client-server HTTPS REST communication flow without P2P media channels.
3. **Container Orchestration Specification** (`docker-compose.yml`): Restricts mapped ports to TCP 3000.
