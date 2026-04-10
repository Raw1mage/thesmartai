# Spec: Published Web Sidebar

## Purpose

- Allow OpenCode web users to discover, open, and manage their published web app routes directly from the sidebar, without needing CLI access.

## Requirements

### Requirement: List user's published routes

The system SHALL display a list of web routes owned by the current user when the Published Web sidebar panel is opened.

#### Scenario: User has published routes

- **GIVEN** the user (UID 1000) has published /cecelearn and /cecelearn/api via the gateway
- **WHEN** the user clicks the globe icon in the sidebar
- **THEN** the sidebar panel shows one grouped entry "cecelearn" (deduplicating the /api sub-route)

#### Scenario: User has no published routes

- **GIVEN** the user has no routes registered in the gateway
- **WHEN** the user clicks the globe icon
- **THEN** the sidebar panel shows an empty state with hint text about using webctl.sh

#### Scenario: Gateway is unreachable

- **GIVEN** the C gateway process is not running
- **WHEN** the sidebar panel loads
- **THEN** the panel shows an empty list (no crash, no error modal)

### Requirement: Open a published route

The system SHALL open the published web app URL in a new browser tab when the user clicks a route entry.

#### Scenario: Click route item

- **GIVEN** the sidebar shows a route entry for /cecelearn
- **WHEN** the user clicks the entry
- **THEN** a new tab opens at the URL https://cms.thesmart.cc/cecelearn/

### Requirement: Route management via dropdown menu

The system SHALL provide a dropdown menu on each route entry with open, copy URL, and remove actions.

#### Scenario: Copy URL

- **GIVEN** the sidebar shows a route entry for /cecelearn
- **WHEN** the user opens the "..." menu and clicks "Copy URL"
- **THEN** the full URL is copied to the clipboard

#### Scenario: Remove route with confirmation

- **GIVEN** the sidebar shows a route entry for /cecelearn
- **WHEN** the user opens the "..." menu and clicks "Remove route"
- **THEN** a browser confirm dialog appears asking for confirmation
- **AND** if confirmed, the route is removed from the gateway and the list refreshes
- **AND** if the route had a /api sub-route, that is also removed

### Requirement: UID-based route isolation

The system SHALL only show routes owned by the current user, not routes published by other users.

#### Scenario: Multi-user filtering

- **GIVEN** user A (UID 1000) published /cecelearn and user B (UID 1001) published /myapp
- **WHEN** user A opens the Published Web sidebar
- **THEN** only /cecelearn is shown, not /myapp

## Acceptance Checks

- Globe icon is visible in the sidebar utility bar
- Clicking globe opens sidebar panel at /system/web-routes
- Route list shows grouped entries (no /api duplicates)
- Clicking a route opens a new tab with the correct URL
- Dropdown menu shows Open, Copy URL, Remove options
- Remove requires confirmation and refreshes the list
- Empty state is shown when no routes exist
- No errors when gateway is unreachable
- Routes from other users are not visible
