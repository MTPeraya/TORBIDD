# Procurement PDF Handling Policy

> ASVS coverage: **V5.1.1, V5.2.1, V5.2.2, V5.3.1, V5.3.2, V5.4.1, V5.4.2, V5.4.3** — SEC-17

## Permitted Files

TORBIDD accepts procurement documents only when all of these conditions pass:

| Control | Policy |
|---|---|
| Extension | Final extension must be `.pdf` (case-insensitive); alternate extensions are rejected |
| Content signature | First five bytes must be `%PDF-` (`25 50 44 46 2D`) |
| Maximum size | 25 MiB (`26,214,400` bytes) for an archive, extracted PDF, remote PDF, or decoded base64 PDF |
| Active content | JavaScript, launch actions, embedded files, XFA, rich media, form submission/import, and automatic open actions are rejected |
| Paths | Literal, backslash, percent-encoded, and double-encoded `..` traversal forms are rejected |

Validation and scanning happen before a PDF is written to its final location or sent to Google AI Studio/Vertex AI. Remote response bodies are read with a byte counter so a missing or dishonest `Content-Length` cannot bypass the limit. Redirects are followed manually and every destination is rechecked against the outbound-domain allowlist.

## Private Storage

Documents are stored under `DOCUMENT_STORAGE_PATH` (default `./storage/documents`), which must resolve outside the Next.js `public/` directory. Real-path checks prevent symlinks from escaping the configured private root.

The source filename is metadata only. The storage key is generated from document content:

```text
tor_<lowercase SHA-256 content hash>.pdf
```

Files are created with mode `0600`. Their names cannot select an executable extension, and the storage directory is not directly web-served.

## Download Responses

`GET /api/documents/[projectId]/[fileName]` treats both route parameters as untrusted. It rejects traversal with HTTP 400 and oversized stored files with HTTP 413, then revalidates the selected PDF before responding.

Responses use:

- `Content-Type: application/pdf`
- `X-Content-Type-Options: nosniff`
- an application-controlled `TOR_<projectId>.pdf` filename
- both RFC 6266 `filename` and UTF-8 `filename*` parameters in `Content-Disposition`

The submitted filename is never copied into a response header.

## Implementation

The shared policy is implemented in `src/lib/secure-pdf.ts` and applied by the ingestion extractor, e-GP client, AI TOR extractor, ingestion endpoint, and document download endpoint. Infrastructure antivirus should remain enabled as an additional layer; the application scan is deliberately fail-closed for active PDF features that TOR documents do not require.

