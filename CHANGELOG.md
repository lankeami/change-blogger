# Changelog

## 2026-11-20

- [60925c9](https://github.com/lankeami/change-blogger/commit/60925c91c5cb9fe0a746ad4098fe44395258cce1) Fix developer sidebar: use pill design, show display names, include mentioned releases
  - Use user-pill design for developer sidebar links (light default, dark active) - Resolve and display developer names from GitHub profile cache - Add developer sections to report.eta with name/login header layout - Include releases where developer is @mentioned (not just authored) - Fix mention matching in report template to check data-login attribute in rendered HTML (since @mentions become pill elements) - Update developer.eta header: larger avatar, name as title, login subtitle - Update tests for new class names and layout
- [eb889eb](https://github.com/lankeami/change-blogger/commit/eb889ebafc660e2d1756d7e6509ef4e2b3274390) Add right sidebar with developer list to layout (#24)
  Add a <aside class="sidebar-right"> after .main-area in layout.eta that lists developers alphabetically with avatars, linking to developer feed pages. Add CSS for .sidebar-right mirroring the left sidebar's sticky positioning. On mobile, collapse it into a horizontal scrollable strip matching the left sidebar's behavior. Pass the developers list into every renderPage() call via extractDevelopers() helper.
- [8abc7a9](https://github.com/lankeami/change-blogger/commit/8abc7a9cca34f990b1fb2dfb63d7f671a883bafc) Add developer.eta template for developer-specific release feed (#24)
  Build the developer page template with a header block (avatar, display name, GitHub link) followed by the release cards list, matching the structure of repo.eta. Includes repo badges for cross-repo context.

## 2026-11-19

- [4e8906c](https://github.com/lankeami/change-blogger/commit/4e8906cdd67b48e137eb51cd0ad83ac2465662d9) release: v0.2.1
  Fix user pill visibility in release bodies, add search by author login, and invert pill colors (dark default, light on hover).
