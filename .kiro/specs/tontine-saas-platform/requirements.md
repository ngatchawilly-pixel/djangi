# Requirements Document

## Introduction

Le système de gestion de tontines (Tontine_Platform) est une application web SaaS permettant à plusieurs administrateurs de gérer de manière indépendante et sécurisée des groupes de cotisation (tontines), des saisons de cotisation, des réunions, des paiements et l'ordre des bénéficiaires. Chaque administrateur gère uniquement ses propres groupes avec une isolation complète des données via Row Level Security.

## Glossary

- **Tontine_Platform**: Le système SaaS complet de gestion de tontines
- **Super_Admin**: Utilisateur avec privilèges d'administration globale sur toute la plateforme
- **Admin**: Utilisateur pouvant gérer uniquement ses propres groupes de cotisation
- **Member**: Utilisateur membre d'un ou plusieurs groupes de cotisation
- **Tontine_Group**: Groupe de cotisation regroupant plusieurs membres
- **Season**: Cycle complet de cotisation avec un nombre défini de réunions
- **Meeting**: Rencontre périodique d'un groupe lors d'une saison
- **Beneficiary_Order**: Ordre dans lequel les membres reçoivent les fonds collectés
- **Payment**: Cotisation effectuée par un membre pour une réunion
- **Sanction**: Amende ou pénalité appliquée à un membre
- **Auth_System**: Système d'authentification Supabase
- **RLS_Policy**: Politique de sécurité au niveau des lignes de la base de données
- **Drawing**: Tirage aléatoire d'un numéro de bénéficiaire
- **Attendance**: Enregistrement de la présence d'un membre à une réunion
- **Notification_System**: Système de notifications et rappels
- **Dashboard**: Tableau de bord affichant les statistiques et indicateurs
- **Audit_Log**: Journal d'audit des actions effectuées dans le système

## Requirements

### Requirement 1: Authentification des Utilisateurs

**User Story:** En tant qu'utilisateur, je veux pouvoir m'authentifier de manière sécurisée, afin de gérer mes groupes de cotisation ou consulter mes informations.

#### Acceptance Criteria

1. THE Auth_System SHALL authenticate users using Supabase Auth with email and password
2. WHEN authentication succeeds, THE Auth_System SHALL create a user session with appropriate role assignment
3. WHEN authentication fails, THE Auth_System SHALL return a descriptive error message
4. THE Tontine_Platform SHALL provide password reset functionality via email
5. THE Tontine_Platform SHALL allow authenticated users to change their password
6. THE Tontine_Platform SHALL allow authenticated users to update their profile information
7. THE Tontine_Platform SHALL allow authenticated users to upload and manage an avatar image

### Requirement 2: Gestion des Rôles et Permissions

**User Story:** En tant que Super_Admin, je veux pouvoir gérer les rôles des utilisateurs, afin de contrôler les permissions d'accès.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL support three role levels: Super_Admin, Admin, and Member
2. THE Super_Admin SHALL have access to all groups and administrative functions across the platform
3. THE Admin SHALL have access only to groups they created or manage
4. THE Member SHALL have read-only access to groups they belong to
5. THE RLS_Policy SHALL enforce data isolation so Admins can only access their own data
6. THE RLS_Policy SHALL prevent Members from accessing administrative functions
7. WHEN a user attempts an unauthorized action, THE Tontine_Platform SHALL deny access and log the attempt

### Requirement 3: Création et Gestion des Groupes de Cotisation

**User Story:** En tant qu'Admin, je veux créer et gérer mes groupes de cotisation, afin d'organiser les activités de mes tontines.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL allow Admins to create new Tontine_Groups with name, description, contribution amount, frequency, location, time, currency, and status
2. THE Tontine_Platform SHALL support contribution frequencies: weekly, biweekly, monthly, quarterly, and custom
3. THE Tontine_Platform SHALL allow Admins to update Tontine_Group information
4. THE Tontine_Platform SHALL allow Admins to delete Tontine_Groups they own
5. THE RLS_Policy SHALL ensure Admins can only view and modify their own Tontine_Groups
6. THE Tontine_Platform SHALL validate that contribution amount is a positive number
7. THE Tontine_Platform SHALL validate that all required fields are provided before creating a Tontine_Group

### Requirement 4: Gestion des Membres d'un Groupe

**User Story:** En tant qu'Admin, je veux gérer les membres de mes groupes, afin de maintenir une liste à jour des participants.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL allow Admins to add Members to their Tontine_Groups with photo, first name, last name, phone, email, gender, birth date, profession, entry date, and status
2. THE Tontine_Platform SHALL allow Admins to update Member information within their groups
3. THE Tontine_Platform SHALL allow Admins to remove Members from their groups
4. THE Tontine_Platform SHALL support Member statuses: active, suspended, excluded, and left
5. THE Tontine_Platform SHALL allow Admins to suspend and reactivate Members
6. THE RLS_Policy SHALL prevent Admins from accessing Members of other Admins' groups
7. THE Tontine_Platform SHALL validate email format and phone number format before saving Member information

### Requirement 5: Création et Gestion des Saisons de Cotisation

**User Story:** En tant qu'Admin, je veux créer des saisons de cotisation, afin de structurer les cycles de contribution et de distribution.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL allow Admins to create Seasons with name, year, start date, end date, associated Tontine_Group, number of meetings, and status
2. THE Tontine_Platform SHALL automatically calculate the number of meetings based on active Members in the group
3. THE Tontine_Platform SHALL validate that end date is after start date
4. THE Tontine_Platform SHALL validate that a Season is associated with an existing Tontine_Group
5. THE Tontine_Platform SHALL allow Admins to update Season information before it starts
6. THE Tontine_Platform SHALL prevent modification of a Season's Beneficiary_Order after it has been finalized
7. THE RLS_Policy SHALL ensure Admins can only manage Seasons for their own Tontine_Groups

### Requirement 6: Attribution de l'Ordre des Bénéficiaires - Mode Aléatoire avec Tirage Individuel

**User Story:** En tant que Member, je veux tirer moi-même mon numéro de bénéficiaire, afin de participer activement et équitablement à l'attribution de l'ordre.

#### Acceptance Criteria

1. WHERE individual drawing mode is selected, THE Tontine_Platform SHALL allow each Member to draw their own beneficiary number once
2. WHEN a Member initiates a Drawing, THE Tontine_Platform SHALL assign a unique random number from the available pool
3. THE Tontine_Platform SHALL prevent duplicate number assignments across all Members in the Season
4. THE Tontine_Platform SHALL prevent Members from drawing more than once per Season
5. THE Tontine_Platform SHALL prevent Members from modifying their drawn number
6. THE Tontine_Platform SHALL maintain a complete Audit_Log of all Drawing actions with timestamps
7. THE Tontine_Platform SHALL display to Admins in real-time which Members have completed their Drawing
8. WHEN all Members have completed their Drawing, THE Tontine_Platform SHALL automatically generate and finalize the Beneficiary_Order
9. THE Tontine_Platform SHALL validate that the final Beneficiary_Order contains no duplicates and no missing numbers

### Requirement 7: Attribution de l'Ordre des Bénéficiaires - Mode Aléatoire avec Mélange Automatique

**User Story:** En tant qu'Admin, je veux que le système génère automatiquement un ordre aléatoire, afin de gagner du temps lors de la création d'une saison.

#### Acceptance Criteria

1. WHERE automatic shuffle mode is selected, THE Tontine_Platform SHALL retrieve all active Members of the Tontine_Group
2. THE Tontine_Platform SHALL generate a cryptographically secure random Beneficiary_Order
3. THE Tontine_Platform SHALL ensure the generated Beneficiary_Order contains all Members exactly once
4. THE Tontine_Platform SHALL validate that no Member number is duplicated in the generated order
5. THE Tontine_Platform SHALL validate that no Member is omitted from the generated order
6. THE Tontine_Platform SHALL immediately finalize the Beneficiary_Order after generation
7. THE Tontine_Platform SHALL log the automatic generation in the Audit_Log

### Requirement 8: Attribution de l'Ordre des Bénéficiaires - Mode Manuel

**User Story:** En tant qu'Admin, je veux définir manuellement l'ordre des bénéficiaires, afin de respecter des accords spécifiques du groupe.

#### Acceptance Criteria

1. WHERE manual mode is selected, THE Tontine_Platform SHALL provide a drag-and-drop interface for ordering Members
2. THE Tontine_Platform SHALL allow Admins to reorder Members before finalizing the Beneficiary_Order
3. THE Tontine_Platform SHALL validate that all active Members are included in the manual order
4. THE Tontine_Platform SHALL prevent finalizing the order if any Member is missing
5. THE Tontine_Platform SHALL prevent finalizing the order if any Member appears more than once
6. WHEN the Admin finalizes the manual order, THE Tontine_Platform SHALL lock the Beneficiary_Order
7. THE Tontine_Platform SHALL log the manual order creation in the Audit_Log

### Requirement 9: Attribution de l'Ordre des Bénéficiaires - Mode Rotation Intelligente

**User Story:** En tant qu'Admin, je veux que le système applique une rotation basée sur la saison précédente, afin d'assurer une équité entre les saisons.

#### Acceptance Criteria

1. WHERE intelligent rotation mode is selected, THE Tontine_Platform SHALL retrieve the Beneficiary_Order from the previous Season
2. WHEN a previous Season exists, THE Tontine_Platform SHALL apply a rotation algorithm to generate the new order
3. THE Tontine_Platform SHALL rotate the order so the last beneficiary becomes first
4. THE Tontine_Platform SHALL handle additions of new Members by placing them at the end of the rotated order
5. THE Tontine_Platform SHALL handle removals of Members by excluding them from the rotated order
6. IF no previous Season exists, THEN THE Tontine_Platform SHALL display an error message and prevent using rotation mode
7. THE Tontine_Platform SHALL log the rotation generation in the Audit_Log

### Requirement 10: Création et Gestion des Réunions

**User Story:** En tant qu'Admin, je veux créer et gérer les réunions de mes groupes, afin de planifier et documenter les rencontres.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL allow Admins to create Meetings within a Season with date, time, location, and observations
2. THE Tontine_Platform SHALL automatically assign the beneficiary for each Meeting based on the Season's Beneficiary_Order
3. WHEN creating Meeting number N, THE Tontine_Platform SHALL assign the Nth Member from the Beneficiary_Order as beneficiary
4. THE Tontine_Platform SHALL validate that the Meeting date falls within the Season's date range
5. THE Tontine_Platform SHALL allow Admins to update Meeting details before it occurs
6. THE Tontine_Platform SHALL prevent changing the assigned beneficiary of a Meeting
7. THE RLS_Policy SHALL ensure Admins can only manage Meetings for their own Seasons

### Requirement 11: Gestion des Présences aux Réunions

**User Story:** En tant qu'Admin, je veux enregistrer les présences des membres aux réunions, afin de maintenir un historique de participation.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL allow Admins to record Attendance for each Member at each Meeting
2. THE Tontine_Platform SHALL support Attendance statuses: present, absent, late, and excused
3. THE Tontine_Platform SHALL maintain a complete historical record of all Attendance entries
4. THE Tontine_Platform SHALL allow Admins to update Attendance status after a Meeting
5. THE Tontine_Platform SHALL display Attendance history for each Member
6. THE Tontine_Platform SHALL calculate attendance statistics per Member
7. THE RLS_Policy SHALL ensure Admins can only record Attendance for their own Meetings

### Requirement 12: Gestion des Paiements

**User Story:** En tant qu'Admin, je veux enregistrer et suivre les paiements des membres, afin de gérer les cotisations et identifier les retards.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL allow Admins to record Payments with expected amount, paid amount, remaining amount, date, payment method, and status
2. THE Tontine_Platform SHALL support Payment statuses: paid, partially paid, unpaid, and late
3. THE Tontine_Platform SHALL automatically calculate the remaining amount as expected minus paid
4. THE Tontine_Platform SHALL validate that paid amount is not negative
5. THE Tontine_Platform SHALL maintain a complete historical record of all Payments
6. THE Tontine_Platform SHALL allow filtering and searching Payments by Member, status, and date range
7. THE RLS_Policy SHALL ensure Admins can only manage Payments for their own Tontine_Groups

### Requirement 13: Gestion des Sanctions

**User Story:** En tant qu'Admin, je veux enregistrer des sanctions appliquées aux membres, afin d'appliquer les règles du groupe de manière transparente.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL allow Admins to create Sanctions with type, amount, justification, date, and associated Member
2. THE Tontine_Platform SHALL support Sanction types: fine, penalty, and interest
3. THE Tontine_Platform SHALL require a textual justification for each Sanction
4. THE Tontine_Platform SHALL maintain a complete historical record of all Sanctions
5. THE Tontine_Platform SHALL allow Admins to view Sanction history per Member
6. THE Tontine_Platform SHALL validate that Sanction amount is positive
7. THE RLS_Policy SHALL ensure Admins can only manage Sanctions for their own Tontine_Groups

### Requirement 14: Tableau de Bord et Statistiques

**User Story:** En tant qu'Admin, je veux visualiser des statistiques et indicateurs clés, afin de suivre l'activité de mes groupes en un coup d'œil.

#### Acceptance Criteria

1. THE Dashboard SHALL display the total number of Tontine_Groups for the authenticated Admin
2. THE Dashboard SHALL display the total number of Members across all groups
3. THE Dashboard SHALL display the total amount collected across all groups
4. THE Dashboard SHALL display the next beneficiary for each active Season
5. THE Dashboard SHALL display the date and time of the next Meeting for each active group
6. THE Dashboard SHALL display a list of Members with late Payments
7. THE Dashboard SHALL display a list of absent Members from recent Meetings
8. THE Dashboard SHALL display a graphical chart of contributions over time
9. THE Dashboard SHALL display recent activity history
10. THE RLS_Policy SHALL ensure the Dashboard displays only data for the authenticated Admin's groups

### Requirement 15: Système de Notifications

**User Story:** En tant qu'utilisateur, je veux recevoir des notifications et rappels, afin de ne pas manquer d'événements importants.

#### Acceptance Criteria

1. THE Notification_System SHALL send meeting reminders to all Members before a scheduled Meeting
2. THE Notification_System SHALL send payment reminders to Members with unpaid or late Payments
3. THE Notification_System SHALL send confirmation notifications to beneficiaries when it is their turn to receive funds
4. WHERE individual drawing mode is active, THE Notification_System SHALL notify Members when drawing begins
5. WHERE individual drawing mode is active, THE Notification_System SHALL notify the Admin when all Members have completed their Drawing
6. THE Tontine_Platform SHALL allow users to configure their notification preferences
7. THE Tontine_Platform SHALL support notification delivery via email and in-app notifications

### Requirement 16: Export de Données

**User Story:** En tant qu'Admin, je veux exporter des rapports et données, afin de les partager ou les analyser hors de la plateforme.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL allow Admins to export Tontine_Group data to PDF format
2. THE Tontine_Platform SHALL allow Admins to export Payment records to Excel format
3. THE Tontine_Platform SHALL allow Admins to export Member lists to CSV format
4. THE Tontine_Platform SHALL allow Admins to export Meeting attendance records to PDF format
5. THE Tontine_Platform SHALL include relevant metadata in all exported documents
6. THE Tontine_Platform SHALL validate that exports contain only data the Admin has permission to access
7. THE RLS_Policy SHALL enforce data isolation in all export operations

### Requirement 17: Audit et Historique des Actions

**User Story:** En tant que Super_Admin, je veux consulter un journal d'audit complet, afin de tracer toutes les actions importantes effectuées dans le système.

#### Acceptance Criteria

1. THE Audit_Log SHALL record all Tontine_Group creation, modification, and deletion actions
2. THE Audit_Log SHALL record all Member addition, modification, and removal actions
3. THE Audit_Log SHALL record all Season creation and Beneficiary_Order finalization actions
4. THE Audit_Log SHALL record all Payment creation and modification actions
5. THE Audit_Log SHALL record all user authentication events including login and logout
6. THE Audit_Log SHALL record all Drawing actions with timestamps and Member identifiers
7. THE Audit_Log SHALL record all Sanction creation actions
8. THE Audit_Log SHALL include timestamp, user identifier, action type, and affected entity for each entry
9. THE Audit_Log SHALL be immutable and prevent modification or deletion of entries
10. THE Super_Admin SHALL have access to the complete Audit_Log across all Admins

### Requirement 18: Sécurité et Isolation des Données

**User Story:** En tant qu'Admin, je veux que mes données soient complètement isolées des autres administrateurs, afin de garantir la confidentialité et la sécurité.

#### Acceptance Criteria

1. THE RLS_Policy SHALL enforce complete data isolation between different Admins
2. THE RLS_Policy SHALL prevent Admins from reading data belonging to other Admins
3. THE RLS_Policy SHALL prevent Admins from modifying data belonging to other Admins
4. THE RLS_Policy SHALL prevent Admins from deleting data belonging to other Admins
5. THE RLS_Policy SHALL allow Members to read only data for Tontine_Groups they belong to
6. THE RLS_Policy SHALL prevent Members from modifying any administrative data
7. THE Auth_System SHALL enforce authentication for all data access operations
8. THE Tontine_Platform SHALL use parameterized queries to prevent SQL injection attacks
9. THE Tontine_Platform SHALL validate and sanitize all user inputs before processing

### Requirement 19: Interface Utilisateur Responsive

**User Story:** En tant qu'utilisateur, je veux accéder à la plateforme depuis différents appareils, afin de gérer mes tontines partout et à tout moment.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL provide a responsive user interface that adapts to desktop, tablet, and mobile screen sizes
2. THE Tontine_Platform SHALL maintain full functionality on mobile devices
3. THE Tontine_Platform SHALL use touch-friendly interface elements on mobile devices with minimum touch target size of 44x44 pixels
4. THE Tontine_Platform SHALL optimize layout and navigation for each device category
5. THE Tontine_Platform SHALL ensure text remains readable without horizontal scrolling on all devices
6. THE Tontine_Platform SHALL support both light and dark display modes
7. THE Tontine_Platform SHALL persist the user's display mode preference

### Requirement 20: Accessibilité et Standards Web

**User Story:** En tant qu'utilisateur, je veux utiliser une plateforme accessible, afin que tous puissent participer indépendamment de leurs capacités.

#### Acceptance Criteria

1. THE Tontine_Platform SHALL provide proper semantic HTML markup for all interface elements
2. THE Tontine_Platform SHALL ensure all interactive elements are keyboard accessible
3. THE Tontine_Platform SHALL provide appropriate ARIA labels and roles for screen readers
4. THE Tontine_Platform SHALL maintain a minimum contrast ratio of 4.5:1 for normal text
5. THE Tontine_Platform SHALL provide visible focus indicators for all interactive elements
6. THE Tontine_Platform SHALL support browser zoom up to 200 percent without loss of functionality
7. THE Tontine_Platform SHALL provide descriptive error messages that are announced to screen readers

### Requirement 21: Performance et Optimisation

**User Story:** En tant qu'utilisateur, je veux une plateforme rapide et réactive, afin d'accomplir mes tâches efficacement.

#### Acceptance Criteria

1. WHEN a user navigates to a page, THE Tontine_Platform SHALL render initial content within 2 seconds on a standard broadband connection
2. WHEN a user submits a form, THE Tontine_Platform SHALL provide feedback within 500 milliseconds
3. THE Tontine_Platform SHALL implement pagination for lists exceeding 50 items
4. THE Tontine_Platform SHALL implement lazy loading for images and non-critical resources
5. THE Tontine_Platform SHALL cache frequently accessed data to reduce database queries
6. THE Tontine_Platform SHALL optimize database queries using appropriate indexes
7. THE Tontine_Platform SHALL minify and compress all CSS and JavaScript assets

### Requirement 22: Gestion des Erreurs et Validation

**User Story:** En tant qu'utilisateur, je veux recevoir des messages d'erreur clairs et utiles, afin de corriger mes erreurs rapidement.

#### Acceptance Criteria

1. WHEN validation fails on form submission, THE Tontine_Platform SHALL display field-specific error messages
2. WHEN a server error occurs, THE Tontine_Platform SHALL display a user-friendly error message without exposing technical details
3. WHEN a network error occurs, THE Tontine_Platform SHALL inform the user and provide retry options
4. THE Tontine_Platform SHALL validate all user inputs on the client side before submission
5. THE Tontine_Platform SHALL validate all user inputs on the server side regardless of client-side validation
6. THE Tontine_Platform SHALL log all server errors with sufficient context for debugging
7. IF an operation fails, THEN THE Tontine_Platform SHALL roll back any partial changes to maintain data consistency

### Requirement 23: Configuration de Parseur JSON pour les Données Structurées

**User Story:** En tant que développeur, je veux parser et formater les configurations JSON de manière fiable, afin de garantir l'intégrité des données structurées.

#### Acceptance Criteria

1. WHEN a valid JSON configuration is provided, THE JSON_Parser SHALL parse it into a Configuration object
2. WHEN an invalid JSON configuration is provided, THE JSON_Parser SHALL return a descriptive error message indicating the location and nature of the error
3. THE JSON_Pretty_Printer SHALL format Configuration objects back into valid JSON strings
4. FOR ALL valid Configuration objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
5. THE JSON_Parser SHALL validate JSON schema compliance before parsing
6. THE JSON_Parser SHALL reject JSON exceeding maximum nesting depth of 10 levels
7. THE JSON_Pretty_Printer SHALL use consistent indentation of 2 spaces

