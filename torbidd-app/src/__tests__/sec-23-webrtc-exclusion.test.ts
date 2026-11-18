/**
 * SEC-23: WebRTC Architectural Scope Exclusion & Verification (OWASP ASVS Chapter 17)
 *
 * Verifies that WebRTC, TURN/STUN relay servers, DTLS-SRTP protocols, and real-time
 * media streaming infrastructure are completely excluded from the TORBIDD platform,
 * confirming zero residual risk across all 12 requirements of ASVS Chapter V17.
 *
 * ASVS Requirements Covered:
 * - V17.1.1: TURN server IP filtering (Plan=FALSE; no TURN server operated)
 * - V17.1.2: TURN resource exhaustion protection (Plan=FALSE; no TURN server operated)
 * - V17.2.1 - V17.2.8: DTLS, SRTP, and media server protections (Plan=FALSE; no media servers operated)
 * - V17.3.1 - V17.3.2: Signaling server rate limiting and message handling (Plan=FALSE; no signaling server operated)
 */

import fs from 'fs';
import path from 'path';

describe('SEC-23: WebRTC Architectural Scope Exclusion (ASVS Chapter 17)', () => {
  const rootDir = path.resolve(__dirname, '../../../');
  const appDir = path.resolve(__dirname, '../../');

  // ── 1. Architectural Scope Boundary & Documentation (ASVS V17.1 - V17.3) ──
  describe('1. Architectural Scope Boundary & Threat Model (ASVS Chapter 17)', () => {
    it('dedicated WebRTC scope exclusion documentation exists with full threat model analysis', () => {
      const docPath = path.join(appDir, 'docs/security/webrtc-architectural-scope-exclusion.md');
      expect(fs.existsSync(docPath)).toBe(true);

      const content = fs.readFileSync(docPath, 'utf-8');

      // Must explicitly record exclusion of WebRTC, TURN, STUN, DTLS, and SRTP
      expect(content).toContain('WebRTC');
      expect(content).toContain('TURN');
      expect(content).toContain('STUN');
      expect(content).toContain('DTLS');
      expect(content).toContain('SRTP');

      // Threat model must classify risk as zero
      expect(content).toMatch(/zero residual risk|NONE \(0%\)/i);
    });

    it('asvs-security-features-mapping.md explicitly maps Chapter V17 as SEC-23 with Plan = FALSE for all 12 requirements', () => {
      const mappingPath = path.join(rootDir, 'docs/asvs-security-features-mapping.md');
      expect(fs.existsSync(mappingPath)).toBe(true);

      const content = fs.readFileSync(mappingPath, 'utf-8');

      expect(content).toContain('# SEC-23: WebRTC Architectural Scope Exclusion (ASVS V17)');
      expect(content).toContain('Chapter V17 (WebRTC)');

      // Verify all 12 requirements are documented as Plan=FALSE
      const asvsV17Ids = [
        'V17.1.1',
        'V17.1.2',
        'V17.2.1',
        'V17.2.2',
        'V17.2.3',
        'V17.2.4',
        'V17.2.5',
        'V17.2.6',
        'V17.2.7',
        'V17.2.8',
        'V17.3.1',
        'V17.3.2',
      ];

      for (const reqId of asvsV17Ids) {
        expect(content).toContain(reqId);
      }
    });

    it('threat model classifies all 12 ASVS V17 requirements with zero residual risk', () => {
      const docPath = path.join(appDir, 'docs/security/webrtc-architectural-scope-exclusion.md');
      const content = fs.readFileSync(docPath, 'utf-8');

      const asvsV17Ids = [
        'V17.1.1',
        'V17.1.2',
        'V17.2.1',
        'V17.2.2',
        'V17.2.3',
        'V17.2.4',
        'V17.2.5',
        'V17.2.6',
        'V17.2.7',
        'V17.2.8',
        'V17.3.1',
        'V17.3.2',
      ];

      for (const reqId of asvsV17Ids) {
        expect(content).toContain(reqId);
        // Each requirement must be marked with FALSE / N/A
        const regex = new RegExp(`\\*\\*${reqId}\\*\\*.*\\*\\*FALSE\\*\\*.*\\*\\*N\\/A\\*\\*`, 'i');
        expect(content).toMatch(regex);
      }
    });
  });

  // ── 2. Network Port Allocations & Container Hardening (DoD) ─────────────────
  describe('2. Network Port Allocation & Container Hardening', () => {
    it('docker-compose.yml maps only HTTP web port (TCP 3000) and zero UDP media ports', () => {
      const dockerComposePath = path.join(rootDir, 'docker-compose.yml');
      expect(fs.existsSync(dockerComposePath)).toBe(true);

      const content = fs.readFileSync(dockerComposePath, 'utf-8');

      // Look for port definitions
      const portLines = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('- "') || l.startsWith('- \''))
        .filter((l) => /\d+:\d+/.test(l));

      expect(portLines.length).toBeGreaterThan(0);

      // Verify no UDP port specifications exist
      for (const line of portLines) {
        expect(line.toLowerCase()).not.toContain('/udp');
        // Standard WebRTC/TURN ports must never be mapped
        expect(line).not.toContain('3478');
        expect(line).not.toContain('5349');
        expect(line).not.toContain('10000');
        expect(line).not.toContain('20000');
      }

      // Check specifically that only 3000:3000 (TCP default) is mapped
      expect(portLines.some((p) => p.includes('3000:3000'))).toBe(true);
    });

    it('Dockerfile exposes only TCP 3000 and zero UDP ports or media relay servers', () => {
      const dockerfilePath = path.join(appDir, 'Dockerfile');
      expect(fs.existsSync(dockerfilePath)).toBe(true);

      const content = fs.readFileSync(dockerfilePath, 'utf-8');
      const exposeLines = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('EXPOSE'));

      expect(exposeLines.length).toBeGreaterThan(0);

      for (const expose of exposeLines) {
        expect(expose.toLowerCase()).not.toContain('/udp');
        expect(expose).not.toContain('3478');
        expect(expose).not.toContain('5349');
        expect(expose).toContain('3000');
      }
    });
  });

  // ── 3. Codebase Dependency & API Verification ───────────────────────────────
  describe('3. Codebase Dependency & API Verification', () => {
    it('package.json contains zero WebRTC or real-time media dependencies', () => {
      const pkgPath = path.join(appDir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      const prohibitedPackages = [
        'wrtc',
        'werift',
        'node-webrtc',
        'simple-peer',
        'peerjs',
        'mediasoup',
        'kurento-client',
        'janus-gateway',
        'socket.io-p2p',
      ];

      for (const dep of prohibitedPackages) {
        expect(allDeps[dep]).toBeUndefined();
      }
    });

    it('source code contains no invocations of WebRTC media capture or peer connection APIs', () => {
      const srcDir = path.join(appDir, 'src');

      function scanDir(dir: string): string[] {
        const results: string[] = [];
        const files = fs.readdirSync(dir, { withFileTypes: true });

        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          if (file.isDirectory()) {
            if (file.name !== 'node_modules' && file.name !== '.next') {
              results.push(...scanDir(fullPath));
            }
          } else if (/\.(ts|tsx|js|jsx)$/.test(file.name) && !file.name.includes('test')) {
            results.push(fullPath);
          }
        }
        return results;
      }

      const sourceFiles = scanDir(srcDir);
      expect(sourceFiles.length).toBeGreaterThan(50);

      const prohibitedApis = [
        'new RTCPeerConnection',
        'new RTCIceCandidate',
        'new RTCSessionDescription',
        'navigator.mediaDevices.getUserMedia',
        'navigator.mediaDevices.getDisplayMedia',
      ];

      for (const filePath of sourceFiles) {
        const code = fs.readFileSync(filePath, 'utf-8');
        for (const api of prohibitedApis) {
          expect(code).not.toContain(api);
        }
      }
    });
  });
});
