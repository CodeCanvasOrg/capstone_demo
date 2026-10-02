# UI redesign architecture

The shared layout owns MotionConfig with reducedMotion=user alongside the existing theme, tooltip, and toast providers. Navigation remains auth-aware and uses the typed route registry; mobile navigation uses the existing Radix dropdown.

Reveal owns presentational entrance motion and disables it for reduced-motion users. PageIntro provides consistent workspace headings. AuthShell provides the authentication page composition. These components own no server or form state.

Pages retain their existing data contracts, processing polling, and feature components. The homepage illustration contains clearly labelled example content and owns no interactive product state. The editor content and citations remain outside motion wrappers.

No data model, backend, or route changes. Rollback is reverting the UI commit and the Framer Motion dependency/lockfile changes.
