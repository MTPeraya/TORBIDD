Issue: [#138](https://github.com/users/MTPeraya/projects/2/views/1?filterQuery=Procurement+Notifications&pane=issue&itemId=248568093&issue=MTPeraya%7CTORBIDD%7C138) 

## Use Case

 **UC-6: Configure and Receive Opportunity Alerts**

 ### Description

 The system shall allow registered users to configure notification criteria for procurement opportunities.

 The system shall notify users through in-app notifications, email notifications, or both when a new procurement opportunity matches their configured criteria.

 ### Actors

 - **Registered User**
- **Data Collection Service**
- **Email Delivery Service**

 ### Preconditions

 - The user is authenticated.
- The user has a valid email address for email notifications.
- The system is able to collect and classify procurement opportunities.

 ### Main Flow

 1. The user opens the notification preferences.
2. The system displays the available notification criteria.
3. The user configures one or more matching criteria:
   - Keywords
   - Software-project categories
   - Budget range
   - Issuing agencies
4. The user selects one or more notification channels:
   - In-app notification
   - Email notification
   - Both channels
5. The user saves the notification preferences.
6. The Data Collection Service detects and classifies a new procurement opportunity.
7. The system compares the procurement opportunity against the user's saved preferences.
8. The system identifies that the opportunity matches the user's criteria.
9. The system creates an in-app notification if in-app notifications are enabled.
10. The Email Delivery Service sends an email notification if email notifications are enabled.
11. The user opens the notification.
12. The system provides access to the matching procurement opportunity.

 ### Alternative / Exception Flows

 **A1. Procurement opportunity does not match the user's criteria**

 1. A new procurement opportunity is detected.
2. The system compares the opportunity against the user's saved preferences.
3. The opportunity does not match the user's criteria.
4. No notification is created or sent.

 **A2. In-app notifications are disabled**

 1. A new procurement opportunity matches the user's criteria.
2. The system checks the user's selected notification channels.
3. In-app notifications are not enabled.
4. The system does not create an in-app notification.
5. If email notifications are enabled, the Email Delivery Service sends an email notification.

 **A3. Email notifications are disabled**

 1. A new procurement opportunity matches the user's criteria.
2. The system checks the user's selected notification channels.
3. Email notifications are not enabled.
4. The Email Delivery Service does not send an email notification.
5. If in-app notifications are enabled, the system creates an in-app notification.

 ### Postconditions

 - The user's notification preferences are stored in their account.
- The system evaluates future procurement opportunities against the user's saved criteria.
- Users receive notifications for procurement opportunities that match their configured criteria through their selected notification channels.
- Users can access matching procurement opportunities from their notifications.

 ### Related User Stories

 - **US-1:** As a registered user, I want to configure notification criteria for procurement opportunities, so that I can receive alerts that are relevant to my interests.
- **US-2:** As a registered user, I want to receive in-app or email notifications when a procurement opportunity matches my criteria, so that I can discover relevant opportunities without continuously monitoring the platform.

 ### Acceptance Criteria

 - [ ] The system allows authenticated users to open and configure notification preferences.
- [ ] The system allows users to configure keywords as notification criteria.
- [ ] The system allows users to configure software-project categories as notification criteria.
- [ ] The system allows users to configure a budget range as notification criteria.
- [ ] The system allows users to configure issuing agencies as notification criteria.
- [ ] The system allows users to select in-app notifications, email notifications, or both.
- [ ] The system stores the user's notification preferences.
- [ ] The system evaluates new procurement opportunities against saved user preferences.
- [ ] The system creates an in-app notification when a matching opportunity is found and in-app notifications are enabled.
- [ ] The Email Delivery Service sends an email when a matching opportunity is found and email notifications are enabled.
- [ ] The system does not send notifications when a procurement opportunity does not match the user's criteria.
- [ ] The user can access the matching procurement opportunity from the notification.