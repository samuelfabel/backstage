---
id: document-history-demo
title: Document History Demo
description: Try the optional TechDocs document history addon with the built-in example docs site.
---

# Document History Demo

This walkthrough uses the **Example Docs** entity (`documented-component`) that ships
with the Backstage example app. Its MkDocs site already defines a GitHub
`edit_uri`, so the Document History addon can map each page back to a source file
in the [Backstage repository](https://github.com/backstage/backstage).

## Prerequisites

- Docker (TechDocs local builder runs MkDocs in a container)
- Node.js and Yarn (same versions as the rest of Backstage)
- A GitHub personal access token exported as `GITHUB_TOKEN` (recommended for API
  rate limits; public-repo read access is enough for this demo)

## 1. Enable document history locally

Copy the example override file:

```bash
cp app-config.local.yaml.example app-config.local.yaml
```

Set your token before starting Backstage:

```bash
export GITHUB_TOKEN=ghp_your_token_here   # macOS / Linux
# set GITHUB_TOKEN=ghp_your_token_here  # Windows PowerShell
```

The example app already registers `techDocsDocumentHistoryAddonModule` in
`packages/app/src/App.tsx`. No frontend code changes are required for this demo.

## 2. Start the example app

From the repository root:

```bash
yarn install
yarn start
```

Wait for the frontend (`http://localhost:3000`) and backend (`http://localhost:7007`)
to finish starting. The first TechDocs page load may take a little longer while
MkDocs generates the site.

## 3. Open the example documentation

TechDocs uses the same URL pattern as Catalog: a **short path for the list** and a
**long path for a specific document site**.

| Screen                     | Example URL                                                         |
| -------------------------- | ------------------------------------------------------------------- |
| Docs list (table)          | `http://localhost:3000/docs?filters[user]=all`                      |
| Docs reader (Example Docs) | `http://localhost:3000/docs/default/component/documented-component` |

Go directly to the reader:

```
http://localhost:3000/docs/default/component/documented-component
```

Or in the UI:

1. **Docs** → click **Example Docs** in the table (URL should change from `/docs?...` to `/docs/default/component/...`)
2. Or **Catalog** → **Example Docs** → **Docs** tab

If clicking a row in the docs table does not navigate, paste the reader URL above
into your browser address bar, or use the Catalog path instead.

## 4. Use the Document History controls

Below the page header you should see four buttons:

| Button      | What it shows                                  |
| ----------- | ---------------------------------------------- |
| **History** | Commits that touched the current Markdown file |
| **Tags**    | Git tags in the documentation repository       |
| **Compare** | Unified diff between two revisions of the file |
| **Blame**   | Line-by-line last-change information           |

These buttons appear only when all of the following are true:

- `techdocs.history.enabled` is `true`
- The page has an **Edit this page** link (from MkDocs `edit_uri`)
- The link points at a GitHub or GitLab repository configured under
  `integrations`

### View an older revision

1. Open **History**.
2. Choose a commit and click **View version**.
3. The reader switches to the Markdown source at that revision. A banner and
   chip show the selected ref.
4. Navigate to another page in the same docs site — the selected revision stays
   active (stored in the URL query parameter `docsRef` and session storage).

Click the chip’s delete icon or clear the revision to return to the latest
generated HTML.

## 5. What this demo is backed by

The example entity lives at
`plugins/techdocs-backend/examples/documented-component/`. Its `mkdocs.yml`
contains:

```yaml
repo_url: https://github.com/backstage/backstage
edit_uri: edit/master/plugins/techdocs-backend/examples/documented-component/docs
```

History API calls therefore read real commit data from the public Backstage
monorepo — you do not need to push docs to your own fork for this demo.

## Troubleshooting

| Symptom                                     | Likely cause                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| No History / Tags / Compare / Blame buttons | `techdocs.history.enabled` is not `true`, or the page has no edit link          |
| Empty history or API errors                 | Missing or invalid `GITHUB_TOKEN`, or GitHub rate limiting                      |
| TechDocs page fails to load                 | Docker not running (required for `techdocs.builder: local`)                     |
| Buttons appear but blame/history fails      | Repository host not listed under `integrations.github` or `integrations.gitlab` |

For configuration details see [Document History Configuration](./configuration.md#document-history-configuration)
and [TechDocs Addons](./addons.md).
