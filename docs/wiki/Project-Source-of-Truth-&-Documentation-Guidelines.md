# Project Source of Truth & Documentation Guidelines

## 1. Purpose

This page establishes the official sources of information and documentation guidelines for the TORBIDD project.

It helps all team members understand where to find project requirements, technical information, implementation details, and development progress.

The main objectives are to:

- Maintain a shared understanding of the project.
- Ensure that system development follows the approved requirements.
- Keep requirements, prototypes, implementation, and tests aligned.
- Track development progress transparently.
- Maintain consistent and reliable project documentation.

This page also defines how the team handles conflicting information and maintains requirement traceability throughout development.

---

## 2. Official Project Sources

TORBIDD uses the following sources as its main project references.

| Source | Purpose | What It Defines |
|---|---|---|
| **Course Syllabus** | Academic reference | Course expectations, deliverables, and assessment requirements |
| **Software Requirements Specification (SRS)** | System requirements reference | Project scope, functional requirements, non-functional requirements, constraints, and test cases |
| **GitHub Repository** | Implementation reference | Actual source code, application structure, APIs, and implementation |
| **GitHub Project Board** | Development progress reference | Tasks, assignments, issues, and development status |
| **GitHub Wiki** | Documentation reference | Technical guides, architecture explanations, development instructions, and project decisions |

Each source has a different responsibility. They should be used together rather than treated as interchangeable documents.

### 2.1 Course Syllabus - Academic Requirements

The Course Syllabus is the primary reference for academic and course-related requirements.

It defines what the team must deliver throughout the course, including:

- Required project deliverables.
- Documentation expectations.
- Development activities.
- Testing and project submission expectations.
- Academic milestones and assessment requirements.

All academic project activities should remain aligned with the Course Syllabus.

### 2.2 Software Requirements Specification (SRS)

The SRS is the main source of truth for what TORBIDD is supposed to do. (System Requirements)

It defines:

- Project objectives and scope.
- Functional requirements.
- Non-functional requirements.
- System constraints.
- Acceptance criteria and test cases.
- Requirement traceability information.

Any proposed feature or system change should be checked against the approved SRS.

The SRS describes the intended system. However, documenting a feature in the SRS does not automatically mean that the feature has been implemented.

### 2.3 GitHub Repository, Actual Implementation

The GitHub Repository is the reference for what has actually been developed.

It contains the project's implementation, including source code and application logic.

The repository should be inspected to verify whether a feature exists and how it works.

Implementation status should be supported by appropriate evidence, such as:

- Relevant source code.
- API implementation.
- Database operations.
- Application behavior.
- Test results.

The SRS defines what should be built, while the repository shows what has actually been built.

### 2.4 GitHub Project Board, Development Progress

The GitHub Project Board is used to manage and track development activities.

It helps the team monitor:

- Major features.
- Use cases.
- Development subtasks.
- Task assignments.
- Bugs and outstanding issues.
- Work in progress.
- Completed tasks.

The Project Board represents the team's reported development progress. A task marked as completed should still be checked against the actual implementation and relevant tests before claiming that a requirement is fully satisfied.

### 2.5 GitHub Wiki, Shared Project Knowledge

The GitHub Wiki is the central location for supporting project documentation.

It may contain:

- System architecture documentation.
- Technology stack information.
- Database design explanations.
- Development environment setup.
- API documentation.
- Testing instructions.
- Requirement traceability guidelines.
- Technical decisions and their reasons.

The Wiki supports the SRS, repository, and Project Board. It does not replace the approved SRS or the actual implementation.

---

## 3. Technology Stack

TORBIDD uses the following core technologies as its stated project technology stack.

| Component | Technology | Purpose |
|---|---|---|
| Frontend | Next.js | Building the user interface and frontend application |
| Backend | Node.js | Handling server-side logic and application functionality |
| Database | MongoDB Atlas | Storing and managing application data |
| AI Integration | Google Cloud Vertex AI | Providing AI capabilities for the system |

### 3.1 Technology Guidelines

The team should:

- Follow the existing project architecture.
- Reuse existing dependencies and components where possible.
- Keep database operations and sensitive AI operations on the server where appropriate.
- Store credentials and API keys in server-side environment variables.
- Never expose database credentials, API keys, or tokens in source code.
- Validate AI-generated structured responses before using them in the application.
- Handle database, API, and AI service failures appropriately.

### 3.2 Architecture Documentation Note

There is currently a technology-stack discrepancy that needs to be resolved.

The team's stated stack specifies **Next.js and Node.js**, while the current SRS Section 2.5 (CON-3) specifies a **Django backend**.

These descriptions are inconsistent.

The team should confirm the approved backend architecture and update the SRS through an approved revision if necessary. Until then, this discrepancy should remain documented rather than silently assuming that both descriptions are correct.

---

## 4. Requirement Traceability

The TORBIDD team uses requirement traceability to connect customer needs to stakeholders, user stories, testing, prototypes, and development tasks.

The purpose is to ensure that every important feature has a clear reason for existing and can be traced from its original requirement to its implementation.

### 4.1 Requirement Traceability Workflow

The team's workflow is:

**Customer Requirements → Stakeholders → User Stories → SRS Test Cases → Prototype → GitHub Project Tasks**

Each stage has a different purpose.

| Stage | Description | Reference / Location |
|---|---|---|
| **1. Customer Requirements** | Identify customer needs, expectations, and problems that the system should address. | Customer requirements and project discussions |
| **2. Stakeholders** | Identify people or groups involved in, affected by, or interested in the system and their relevant needs. | Stakeholder documentation |
| **3. User Stories** | Translate stakeholder needs into user-focused descriptions of desired functionality. | Supporting project documentation |
| **4. SRS Test Cases** | Identify how expected system behavior will be verified through testing. | Software Requirements Specification (SRS) |
| **5. Prototype** | Represent the proposed user interface and interactions to help the team review and validate the intended experience. | UI/UX prototype |
| **6. GitHub Project Tasks** | Break down development work into manageable tasks and track implementation progress. | GitHub Project Board and Issues |

**Note:** User stories are part of the team's supporting requirement documentation and are not formally included in the current SRS. They help clarify stakeholder needs but do not replace the approved SRS requirements.

### 4.2 GitHub Task Structure

After identifying the requirements and intended functionality, the team organizes implementation work using a hierarchical task structure:

**Big Feature → Use Case (UC) → Subtasks**

Each level has a different responsibility.

#### Big Feature

- Represents a major system capability or development area.
- Groups related use cases together.
- Provides an overview of a larger development objective.

#### Use Case (UC)

- Represents a specific user interaction or system function within a major feature.
- Describes what the user or system needs to accomplish.
- Helps connect development work to the intended functionality.

#### Subtasks

- Represent smaller development activities required to complete a use case.
- May cover frontend, backend, database, integration, or testing work.
- Help the team divide responsibilities and track progress.

This structure helps the team understand how individual development tasks contribute to a larger feature.

### 4.3 Traceability Example

The following is an illustrative example of how a requirement can be traced through the development process.

| Stage | Example |
|---|---|
| Customer Requirement | Users need to find relevant procurement information. |
| Stakeholder | Users who need to search for procurement information. |
| User Story | As a user, I want to search for procurement information so that I can find relevant records. |
| SRS Test Case | Use the corresponding SRS test case to verify the expected search behavior. |
| Prototype | Design the search interface and demonstrate the expected user interaction. |
| Big Feature | Search Functionality |
| Use Case | Search Procurement Information |
| Subtasks | Implement the relevant frontend, backend, database operations, and tests. |

*This example illustrates the workflow. It does not claim that these exact user stories or task names currently exist in the project.*

### 4.4 Traceability Guidelines

The team should follow these guidelines:

- Customer requirements should be connected to relevant stakeholders.
- User stories should reflect stakeholder needs and clarify expected functionality.
- User stories are supporting documentation and do not replace approved SRS requirements.
- SRS test cases should be used as the testing reference.
- Prototypes should reflect intended functionality and user interactions.
- GitHub tasks should be organized so major features can be traced to their use cases and subtasks.
- Important requirements should have corresponding verification activities.
- Development progress must be checked against the actual implementation and relevant tests.

The team should maintain these connections throughout development to keep requirements, design, testing, and implementation aligned.

---

## 5. Handling Conflicting Information

If two project sources contain different or inconsistent information, the team must not silently assume that one version is correct.

The following process should be followed:

1. **Identify the conflict:** Describe the inconsistent information and identify the affected sources.
2. **Check the source of truth:** Determine which source is authoritative for the type of information involved.
3. **Discuss the issue:** Review the conflict with relevant team members and the supervisor when necessary.
4. **Agree on a resolution:** Obtain the necessary agreement or approval before changing official requirements or architecture.
5. **Update affected sources:** Revise the relevant documentation, tasks, or implementation.
6. **Record the decision:** Document important decisions in the GitHub Wiki so the team has a shared reference.

### Example: Requirement Exists but Is Not Implemented

If the SRS specifies a feature but the source code does not contain that feature:

- The SRS remains the reference for the intended requirement.
- The repository shows that the feature is not currently implemented.
- The GitHub Project Board should reflect its actual development status.
- The team must not claim that the feature is implemented until it has been developed and verified.

### Example: Conflicting Technology Information

If the project documentation specifies Node.js but the SRS specifies Django:

- Identify the conflicting architecture descriptions.
- Confirm the intended architecture with the team and supervisor.
- Update the approved documentation.
- Ensure subsequent implementation and documentation follow the agreed architecture.

---

## 6. Implementation Status Definitions

The following status definitions should be used consistently when reporting feature progress.

| Status | Meaning |
|---|---|
| **Implemented** | The feature has been developed and its expected behavior has been verified. |
| **Partially Implemented** | Some parts of the feature are developed, but other required parts remain incomplete. |
| **Not Implemented** | The feature is required or planned but has not been developed. |
| **Needs Verification** | There is insufficient evidence to confirm whether the feature works as required. |

These statuses should be used in project reports, task updates, and demonstrations.

A feature should not be marked as fully implemented based only on its presence in the SRS, prototype, or GitHub Project Board.

---

## 7. Documentation Maintenance

To keep project information consistent, all team members should follow these guidelines:

- Update the SRS when approved system requirements change.
- Update the GitHub Project Board when task progress changes.
- Keep the Wiki updated when architecture, development instructions, or important technical decisions change.
- Ensure implementation changes follow the approved requirements.
- Add or update tests when implementing or modifying important features.
- Do not document planned functionality as completed functionality.
- Record important technical decisions and their reasons.
- Ensure that documentation reflects the actual state of the project.
- Review inconsistencies between project sources and resolve them through the agreed process.

Every team member is responsible for keeping the information they maintain accurate and up to date.

---

## 8. Guiding Principle

The TORBIDD team follows this principle:

> **The Course Syllabus defines academic expectations. The SRS defines what the system should do. The source code shows what has actually been built. Tests provide evidence of system behavior. The GitHub Project Board tracks development progress. The GitHub Wiki documents shared project knowledge and decisions.**

All project activities should remain aligned with these sources to maintain consistency, transparency, and traceability throughout the development lifecycle.