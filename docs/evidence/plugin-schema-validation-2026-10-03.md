# Agent Plugins schema validation evidence

Validation snapshot: **2026-10-03**. This record supersedes the manifest-byte results in [`plugin-schema-validation-2026-10-02.md`](plugin-schema-validation-2026-10-02.md), which remains a historical snapshot from before the current onboarding and publication metadata.

## Method and schema inputs

The two versioned schemas were fetched directly over HTTPS and validated with Python 3.11.9, `jsonschema` 4.26.0, and `Draft202012Validator`. The schemas are not vendored in the repository.

| Schema | HTTP | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` | 200 | 1,805 | `0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883` |
| `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json` | 200 | 3,408 | `6539175bfcdf43085855183e86da40ea94b166547a72b47ae9a0a390516d3acb` |

## Current manifest results

Each file was parsed as JSON and validated against its corresponding live schema. All four portable files are valid.

| File | Schema | Bytes | SHA-256 | Result |
| --- | --- | ---: | --- | --- |
| `plugin/plugin.json` | plugin 1.0.0 | 2,152 | `e87f05fe8c457d339377bc98ed98c6060c39f4d936029285fa0d979c9ce8eebc` | valid |
| `plugin/mcp.json` | MCP 1.0.0 | 222 | `7764d162249410937fdb2de83a1201aa85442fb41f9d5e1e6b315caead0a8c5c` | valid |
| `plugins/buildmates/plugin.json` | plugin 1.0.0 | 2,152 | `e87f05fe8c457d339377bc98ed98c6060c39f4d936029285fa0d979c9ce8eebc` | valid |
| `plugins/buildmates/mcp.json` | MCP 1.0.0 | 222 | `7764d162249410937fdb2de83a1201aa85442fb41f9d5e1e6b315caead0a8c5c` | valid |

## Evidence boundary

This snapshot proves only structural conformance of the four portable files to the fetched schemas. It does not validate the Codex compatibility overlays (`.codex-plugin/plugin.json` and `.mcp.json`), the repository's additional package rules, beta-file parity, asset dimensions, URL reachability, live MCP deployment, OAuth, host installation, directory review cases, reviewer credentials, walkthrough access, or publication readiness. The local package checker intentionally does not fetch these official schemas; this snapshot is a separate read-only validation.
