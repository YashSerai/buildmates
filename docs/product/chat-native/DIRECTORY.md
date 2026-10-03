# Directory release

Checked October 3, 2026. This file owns the directory recommendation and submission boundaries. Runtime release status belongs in [Current checkpoint](CURRENT.md).

## Recommended route

Keep Buildmates as one MCP-backed plugin with its four skills. OpenAI's current public directory serves both ChatGPT and Codex. The portable package already declares a direct MCP connection, so it does not need a second product or a new paid model service. Workspace sharing and a local ZIP do not establish public availability. [OpenAI package guide](https://developers.openai.com/plugins/build/plugins)

The directory is useful for reaching people already using ChatGPT or Codex. Reliable tools, accurate descriptions and useful starter prompts matter. OpenAI describes stronger distribution opportunities for useful, reliable plugins, but does not promise placement. [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)

## SEO finding

There is no verified basis for calling a directory listing a Google ranking boost. Product discovery inside ChatGPT and Google search visibility are separate outcomes. Good tool metadata can improve relevant invocation within the host; it is not website SEO. [Metadata guidance](https://developers.openai.com/plugins/guides/optimize-metadata)

Google does not guarantee crawling, indexing or rankings. Measure website discovery in Search Console and directory discovery through actual installations and completed journeys. A sitemap helps discovery, but does not prove indexing. [Google crawling and indexing FAQ](https://developers.google.com/search/help/crawling-index-faq)

A read-only check of the existing live website returned 200 for the landing page, installation guide, privacy policy, terms, support, robots and sitemap. The sitemap contained nine URLs. Robots permits public pages and blocks private workflow paths. These checks establish public fetchability only. No Search Console property, Google index coverage, listing backlink attributes, rankings or acquisition figures were verified. The candidate was still undeployed during this check.

## Public review boundary

The submission flow requires an owning organization/project, verified publisher identity, ZIP validation, MCP domain verification and authenticated tool scans, then review and owner-controlled publication. The portal supplies the exact domain challenge token; it must never be guessed. Reviewer credentials stay outside the package. Review materials include five positive cases, three negative cases, a working reviewer account and a walkthrough. [Submission guide](https://developers.openai.com/plugins/deploy/submission)

Buildmates has an existing endpoint, icons, starter prompts and support/privacy/terms links. Package preparation can proceed locally. A no-MFA reviewer account with sample data, actual runs of the review cases, an accessible current walkthrough, publisher verification and dashboard scans remain unproven. The hackathon demo is not assumed to cover this release. See [Review cases](DIRECTORY_REVIEW_CASES.md) for the intended acceptance scenarios.

Plugin Management search returned no Buildmates result for this account. That is an account-scoped discovery result, not proof that no private draft or listing exists elsewhere. Brave disconnected before the submission dashboard could be inspected. Reuse an existing owned plugin if the dashboard shows one; do not create a duplicate from the search result alone.

Submission includes policy attestations. Complete the concrete package, live checks and review materials before the owner reviews those attestations. Approval and publication must be recorded separately. No public upload, submission, approval or publication occurred in this research pass.

## Cost boundary

Cloudflare's dashboard showed the existing Workers Free plan at $0. Reuse `buildmates-mcp` and its existing D1 database. No plan upgrade, additional paid resource, paid model API or further conversation batch is authorized. The website remains on its existing ChatGPT Sites project; current beta hosting usage is included within plan limits. Availability can stop at free limits. [Cloudflare pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Sites limits](https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites)

Invalidate this assessment when OpenAI submission rules, the package, live authentication, provider plans or host capabilities change.
