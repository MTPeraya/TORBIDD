# TLS certificate deployment

SEC-18 deliberately does not commit private keys or self-signed public certificates.

Provide these files before starting the production Compose stack:

- `fullchain.pem` and `privkey.pem`: a currently valid certificate and key issued by a publicly trusted CA for the deployed hostname (for example, Let's Encrypt or the organization's managed CA service).
- `internal-ca.pem`: the CA certificate used only for the proxy-to-app TLS hop.
- `internal.crt` and `internal.key`: an internal certificate/key whose SAN contains the Compose DNS name `app`.

Paths can be overridden with `TLS_CERT_PATH`, `TLS_KEY_PATH`, `INTERNAL_TLS_CA_PATH`, `INTERNAL_TLS_CERT_PATH`, and `INTERNAL_TLS_KEY_PATH`. Restrict private-key files to the deployment operator and container runtime (for example, mode `0600`). Rotate certificates before expiry.

The application fails closed when the internal certificate or key is absent. Nginx validates the internal certificate against `internal-ca.pem`; external clients validate the public certificate through their normal trust stores.
