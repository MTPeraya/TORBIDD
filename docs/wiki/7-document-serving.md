## 7. Document Serving

### `GET /api/documents/[projectId]/[fileName]`
Securely streams or downloads cached government TOR PDF files stored in `./storage/documents/`.

- **Access**: Public / Authenticated
- **Response**: Binary stream with headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="tor_100234.pdf"`

