## 7. Document Serving

[← Back to API Directory](API-Documentation) · [Security Considerations](Security-Considerations)

Streams and caches official government Terms of Reference (TOR) specification PDFs collected from the Bangkok Metropolitan Administration (BMA) and National e-GP portals.

---

### `GET /api/documents/[projectId]/[fileName]`
Securely streams or downloads cached government TOR PDF files stored in `./storage/documents/`.

- **Access Policy**:
  - **Public TOR Documents**: Openly accessible for published procurement announcements.
  - **Internal / Sensitive Files**: Require an authenticated session (`getAuthSessionFromRequest`).
  - **Non-Existent Resources**: Return HTTP 404 Not Found to prevent resource enumeration.
- **Defensive Containment Architecture (SEC-08 / ASVS V5)**:
  - **Path Traversal Defense**: All input parameters are validated with `assertNoPathTraversal()`. Reject sequences containing `../`, `..\`, `%2e%2e`, and null bytes with HTTP 400 Bad Request.
  - **Private Storage Containment**: File paths are strictly resolved against the private document root via `resolvePrivatePath()`, ensuring files cannot escape to public web directories.
  - **Hashed Filenames**: Downloaded and cached files use deterministic SHA-256 content hashes (e.g., `tor_<sha256>.pdf`).
  - **Magic Bytes Validation**: Binary payload headers are verified for `%PDF-` (`0x25 0x50 0x44 0x46`) before streaming.
- **Response Headers**:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="tor_<id>.pdf"` (sanitized per RFC 6266)
  - `X-Content-Type-Options: nosniff`
  - `Cache-Control: private, max-age=86400`
