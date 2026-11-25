## 5. Bookmarks & User Settings

### `GET /api/bookmarks`
Returns the list of project IDs bookmarked by the current authenticated session.

### `POST /api/bookmarks`
Saves an opportunity to the user's watchlist.

- **Request Body**:
  ```json
  {
    "projectId": "6724a8f9b93e5a201f8d9b12"
  }
  ```

### `DELETE /api/bookmarks/[id]`
Removes the specified project from the user's bookmarks.

---

### `GET /api/settings`
Retrieves user alert criteria, daily digest preferences, and budget ranges.

### `PUT /api/settings`
Updates user alert settings.

- **Request Body**:
  ```json
  {
    "emailNotif": true,
    "dailyDigest": true,
    "closingAlert": true,
    "newProjectAlert": true,
    "interestTags": ["AI", "Website", "Database"],
    "budgetMin": 5000000,
    "budgetMax": 30000000,
    "language": "th"
  }
  ```