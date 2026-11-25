## 3.8 Opportunity Notification

### Description & Priority
Notifies registered users when new procurement opportunities match their saved preferences and criteria.  
**Priority:** `Medium`

### Functional Requirements
- **ON-1**: The system shall notify users when a new procurement matches their interests.
- **ON-2**: The system shall allow users to define, update, or toggle notification criteria and channels.

---

### UC-6: Configure and Receive Opportunity Alerts

| Item | Details |
|---|---|
| **Use Case ID** | **UC-6** |
| **Use Case Name** | Configure and Receive Opportunity Alerts |
| **Primary Actor** | Registered User |
| **Supporting Actor** | Data Collection Service, Email Delivery Service |

#### Preconditions
1. User is authenticated with a verified email.

#### Main Flow
1. User opens notification preferences page (`/settings`).
2. System displays criteria configuration.
3. User selects: Keywords, Categories, Budget Range, Agencies.
4. User selects delivery channels: In-App, Email, or Both.
5. User saves preferences.
6. When Data Collection Service publishes a new opportunity, the notification engine checks matching criteria.
7. On match, system creates an in-app notification.
8. If email is enabled, Email Delivery Service sends an alert digest.
9. User opens notification to view the matching project.

#### Postconditions
- User alert criteria stored; automated notifications sent on new matching tenders.
