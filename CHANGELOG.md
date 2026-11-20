# Changelog

## 2026-11-20

- [eb889eb](https://github.com/lankeami/change-blogger/commit/eb889ebafc660e2d1756d7e6509ef4e2b3274390) Add right sidebar with developer list to layout (#24)
  Add a <aside class="sidebar-right"> after .main-area in layout.eta that lists developers alphabetically with avatars, linking to developer feed pages. Add CSS for .sidebar-right mirroring the left sidebar's sticky positioning. On mobile, collapse it into a horizontal scrollable strip matching the left sidebar's behavior. Pass the developers list into every renderPage() call via extractDevelopers() helper.

## 2026-11-19

- [4e8906c](https://github.com/lankeami/change-blogger/commit/4e8906cdd67b48e137eb51cd0ad83ac2465662d9) release: v0.2.1
  Fix user pill visibility in release bodies, add search by author login, and invert pill colors (dark default, light on hover).
