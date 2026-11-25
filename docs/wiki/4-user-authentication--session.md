## 4. User Authentication & Session

### `GET /api/auth/google`
Redirects the user to Google OAuth 2.0 authorization endpoint.

### `GET /api/auth/callback/google`
Handles OAuth 2.0 redirect, exchanges code for user profile, upserts user in MongoDB, and establishes an HTTP-only session cookie.

### `GET /api/auth/me`
Retrieves identity and role information for the currently authenticated user.

- **Access**: Authenticated
- **Response (`200 OK`)**:
  ```json
  {
    "user": {
      "id": "671fb8a1...",
      "email": "vendor@enterprise.co.th",
      "name": "Somchai Jaidee",
      "role": "user",
      "avatar": "https://lh3.googleusercontent.com/..."
    }
  }
  ```

### `POST /api/auth/logout`
Clears session cookies and invalidates the session.
