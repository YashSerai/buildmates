# Agent Plugins schema validation evidence

Validation snapshot: **2026-10-02**.

This evidence covers the repository files at the time of the check. The canonical package is `plugin/`; `plugins/buildmates/` is the generated beta mirror. Both manifests in both locations were validated against the live versioned Agent Plugins schemas with an AJV Draft 2020-12 validator (Ajv 8.20.0).

## Schema inputs

The validator fetched these schema documents directly over HTTPS. The hashes below are SHA-256 hashes of the response bytes returned during this check.

| Schema | Version | HTTP | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` | 1.0.0 | 200 | 1,805 | `0a4aad95ce337878ad38802ebf0daa3fde76abe3f65400c86bcbb1ec0b3ab883` |
| `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json` | 1.0.0 | 200 | 3,408 | `6539175bfcdf43085855183e86da40ea94b166547a72b47ae9a0a390516d3acb` |

The schemas were fetched for validation only and are not vendored in this repository. `node plugin/scripts/package-plugin.mjs --check` performs the local package contract, transport, asset, skill, and canonical-to-beta checks; it intentionally does not fetch the official schemas. A future check must record a new snapshot if either schema URL returns different bytes.

## Manifest results

All four manifests passed the full fetched schemas:

| Manifest | Result | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `plugin/plugin.json` | valid | 1,797 | `a4b1622d9af16cb445e16fe1fbd47bbc9d9c3f1110cce01437857b7c59f53515` |
| `plugin/mcp.json` | valid | 222 | `7764d162249410937fdb2de83a1201aa85442fb41f9d5e1e6b315caead0a8c5c` |
| `plugins/buildmates/plugin.json` | valid | 1,797 | `a4b1622d9af16cb445e16fe1fbd47bbc9d9c3f1110cce01437857b7c59f53515` |
| `plugins/buildmates/mcp.json` | valid | 222 | `7764d162249410937fdb2de83a1201aa85442fb41f9d5e1e6b315caead0a8c5c` |

The local package check also passed:

```text
Buildmates plugin package is valid (4 skills; canonical and beta agree).
```

This is schema and package evidence only. It does not prove live MCP deployment, OAuth behavior, host installation, directory publication, or account-level QA.
