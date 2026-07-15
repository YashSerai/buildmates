---
name: buildmates-surfaces
description: Generate or revise governed Buildmates profile, room, and Circle surfaces.
---

# Buildmates surfaces

Call `get_surface_generation_brief` before every generation. Use its exact Design Policy version, allowed modules, authorized bindings, governance, base revision, accessibility requirements, and privacy boundary.

Generate only a valid trusted SurfaceSpec. Decorative regions may contain HTML/CSS, but no scripts, forms, imports, popups, top navigation, same-origin access, or arbitrary network requests. Never place private fields in markup and hide them with CSS; use only server-authorized bindings.

Submit as a private preview or personal view first. Shared room changes require the configured member approvals. Circle changes follow current admin or voting governance. Use the current base version, surface history, explicit confirmation, and rollback rather than overwriting concurrent revisions.
