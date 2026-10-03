import { buildmatesChatToolGroups } from "../chat-tool-groups";

const BUILD_MATES_CHAT_ACTION_TOOL_MAP = Object.fromEntries(
  buildmatesChatToolGroups.flatMap((group) => group.kinds.map((kind) => [kind, group.name])),
);
const BUILD_MATES_CHAT_ACTION_TOOL_NAMES = buildmatesChatToolGroups.map((group) => group.name);

/**
 * The Buildmates MCP Apps view is deliberately framework-free and self-contained.
 * It is served as an isolated iframe resource, so it receives only the
 * server-authorized structuredContent for the current tool result.
 */
export const BUILD_MATES_CHAT_UI_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Buildmates workspace</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #f3f0e7;
      --paper-raised: #fffdf7;
      --ink: #181b17;
      --ink-soft: #51574e;
      --moss: #244f39;
      --leaf: #a9bc91;
      --signal: #b9481f;
      --rule: #b9b9ab;
      --rule-dark: #667063;
      --error: #8d261f;
      --font-display: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      --font-body: Aptos, "Segoe UI Variable Text", "Segoe UI", sans-serif;
      --font-code: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
    }
    [data-theme="dark"] {
      color-scheme: dark;
      --paper: #1b211b;
      --paper-raised: #242d24;
      --ink: #f3f0e7;
      --ink-soft: #c7cbbd;
      --moss: #a9bc91;
      --leaf: #4b684e;
      --signal: #e07a4d;
      --rule: #667063;
      --rule-dark: #aeb7a4;
      --error: #f09a86;
    }
    * { box-sizing: border-box; }
    html { background: var(--paper); }
    body {
      margin: 0;
      min-width: 0;
      overflow-wrap: break-word;
      background: var(--paper);
      color: var(--ink);
      font-family: var(--font-body);
      line-height: 1.45;
    }
    button, input, textarea { font: inherit; }
    button { min-height: 44px; cursor: pointer; }
    button:disabled { cursor: wait; opacity: .58; }
    button:focus-visible, input:focus-visible, textarea:focus-visible {
      outline: 3px solid var(--signal);
      outline-offset: 3px;
    }
    main:focus { outline: 0; }
    main:focus-visible { outline: 3px solid var(--signal); outline-offset: 3px; }
    main.main-programmatic-focus:focus, main.main-programmatic-focus:focus-visible { outline: 0; }
    a { color: inherit; }
    .skip {
      position: absolute;
      left: .75rem;
      top: .5rem;
      z-index: 4;
      padding: .6rem .8rem;
      border: 2px solid var(--ink);
      background: var(--paper-raised);
      color: var(--ink);
      transform: translateY(-180%);
    }
    .skip:focus { transform: translateY(0); }
    .shell { max-width: 1120px; margin: 0 auto; padding: 1.25rem clamp(1rem, 4vw, 3rem) 2.75rem; }
    .mast {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: .8rem;
      border-bottom: 1px solid var(--ink);
    }
    .brand { display: flex; align-items: center; gap: .65rem; font-family: var(--font-display); font-size: 1.45rem; }
    .mark { display: block; width: 1.5rem; height: 1.2rem; flex: 0 0 auto; }
    .context { max-width: 26rem; margin: 0; color: var(--ink-soft); font-size: .82rem; text-align: right; }
    .nav {
      position: relative;
      display: flex;
      gap: .2rem;
      overflow-x: auto;
      padding: .7rem 0 .8rem;
      border-bottom: 1px solid var(--rule);
      scrollbar-width: thin;
    }
    .nav::after {
      content: "";
      position: absolute;
      top: .7rem;
      right: 0;
      bottom: .8rem;
      width: 2.6rem;
      background: linear-gradient(90deg, transparent, var(--paper));
      pointer-events: none;
    }
    .nav button {
      flex: 0 0 auto;
      min-height: 44px;
      padding: .35rem .7rem;
      border: 0;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--ink-soft);
      text-align: left;
    }
    .nav button:hover, .nav button[aria-selected="true"] { border-bottom-color: var(--signal); color: var(--ink); }
    .nav button[aria-selected="true"] { font-weight: 700; }
    main { padding-top: 1.8rem; }
    .view-head { display: flex; align-items: end; justify-content: space-between; gap: 1.25rem; margin-bottom: 1.35rem; }
    .view-head h1 { max-width: 36rem; margin: 0; font: 500 clamp(2rem, 5vw, 3.6rem)/.98 var(--font-display); letter-spacing: -.045em; }
    .view-head p { max-width: 30rem; margin: 0; color: var(--ink-soft); }
    .kicker { margin: 0 0 .45rem; color: var(--rule-dark); font: 700 .7rem var(--font-code); letter-spacing: .08em; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 1rem; }
    .span-12 { grid-column: span 12; }
    .span-8 { grid-column: span 8; }
    .span-6 { grid-column: span 6; }
    .span-4 { grid-column: span 4; }
    .panel {
      min-width: 0;
      padding: 1rem;
      border-top: 2px solid var(--ink);
      background: var(--paper-raised);
    }
    .panel.soft { background: transparent; }
    [data-theme="dark"] .panel.soft { background: transparent; }
    .panel h2, .panel h3 { margin: 0 0 .7rem; font-family: var(--font-display); font-weight: 500; }
    .panel h2 { font-size: 1.65rem; letter-spacing: -.02em; }
    .panel h3 { font-size: 1.25rem; }
    .panel p { margin: .45rem 0 0; color: var(--ink-soft); }
    .facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .85rem 1rem; margin: 0; }
    .facts div { border-top: 1px solid var(--rule); padding-top: .55rem; }
    .facts dt { color: var(--ink-soft); font-size: .78rem; }
    .facts dd { margin: .18rem 0 0; font-weight: 650; }
    .stack { display: grid; gap: .8rem; }
    .item { padding-top: .8rem; border-top: 1px solid var(--rule); }
    .item:first-child { padding-top: 0; border-top: 0; }
    .item-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
    .item-title { margin: 0; font-family: var(--font-display); font-size: 1.22rem; font-weight: 500; }
    .meta { color: var(--ink-soft); font-size: .82rem; }
    .reason-list { margin: .6rem 0 0; padding-left: 1.1rem; color: var(--ink-soft); }
    .actions { display: flex; flex-wrap: wrap; gap: .55rem; margin-top: .8rem; }
    .action {
      padding: .55rem .75rem;
      border: 1px solid var(--moss);
      background: var(--moss);
      color: #fffdf7;
      text-align: left;
    }
    .action.secondary { border-color: var(--rule-dark); background: transparent; color: var(--ink); }
    .action.danger { border-color: var(--error); background: transparent; color: var(--error); }
    .action:hover { background: #173426; }
    .action.secondary:hover, .action.danger:hover { background: #e8e3d6; }
    .status-wrap { min-height: 2.4rem; margin-top: 1rem; }
    .status { min-height: 1.5rem; margin: 0; color: var(--ink-soft); font-size: .85rem; }
    .status[data-kind="error"] { color: var(--error); }
    .status[data-kind="success"] { color: var(--moss); }
    .status-actions { margin-top: .35rem; }
    .status-actions .action { min-height: 44px; padding: .4rem .65rem; font-size: .86rem; }
    .empty { padding: 1.25rem 0; color: var(--ink-soft); }
    .empty strong { display: block; color: var(--ink); font-family: var(--font-display); font-size: 1.4rem; font-weight: 500; }
    .notice { padding: .85rem 1rem; border-left: 4px solid var(--signal); background: #ebe4d7; }
    [data-theme="dark"] .notice { background: #303a2f; }
    .notice p { margin: 0; color: var(--ink); }
    .message-list { display: grid; gap: .7rem; max-height: 28rem; overflow: auto; padding-right: .35rem; }
    .message { padding: .65rem .7rem; background: #efeadf; }
    .message strong { display: block; font-size: .85rem; }
    .message p { margin: .25rem 0 0; color: var(--ink); }
    .composer { display: flex; gap: .6rem; margin-top: .9rem; }
    .composer textarea { flex: 1 1 auto; min-height: 4.2rem; padding: .65rem; resize: vertical; border: 1px solid var(--rule-dark); background: var(--paper); color: var(--ink); }
    .link-list { display: grid; gap: .35rem; margin: .75rem 0 0; padding: 0; list-style: none; }
    .link-list a { color: var(--moss); text-underline-offset: 3px; }
    .preview-frame { display: block; width: 100%; height: clamp(360px, 65vh, 760px); border: 1px solid var(--rule-dark); background: var(--paper); }
    @media (max-width: 760px) {
      .mast, .view-head { display: block; }
      .context { margin-top: .65rem; text-align: left; }
      .view-head p { margin-top: .65rem; }
      .span-8, .span-6, .span-4 { grid-column: span 12; }
    }
    @media (max-width: 500px) {
      .shell { padding-inline: .85rem; }
      .facts { grid-template-columns: 1fr; }
      .composer { display: grid; }
      .composer .action { width: 100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; }
    }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to workspace</a>
  <div class="shell">
    <header class="mast">
      <div class="brand">
        <svg class="mark" viewBox="0 0 72 56" aria-hidden="true" focusable="false">
          <path d="M13 43 36 11" fill="none" stroke="var(--ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M36 11 59 43" fill="none" stroke="var(--signal)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M13 43h18v-4a9 9 0 0 1 9-9" fill="none" stroke="var(--ink)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M40 30a9 9 0 0 1 9 9v4h10" fill="none" stroke="var(--signal)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="m32 23 4-5 4 5-4 5z" fill="var(--leaf)"/>
          <circle cx="36" cy="11" r="8" fill="var(--ink)"/>
          <circle cx="13" cy="43" r="8" fill="var(--leaf)"/>
          <circle cx="59" cy="43" r="8" fill="var(--signal)"/>
        </svg>
        <span>Buildmates</span>
      </div>
      <p class="context" id="context">Your building network, in the conversation.</p>
    </header>
    <nav class="nav" aria-label="Buildmates workspace views" role="tablist">
      <button type="button" role="tab" aria-selected="true" data-view="home">Overview</button>
      <button type="button" role="tab" aria-selected="false" data-view="profile">Profile</button>
      <button type="button" role="tab" aria-selected="false" data-view="introductions">Introductions</button>
      <button type="button" role="tab" aria-selected="false" data-view="connections">Connections</button>
      <button type="button" role="tab" aria-selected="false" data-view="circles">Circles</button>
      <button type="button" role="tab" aria-selected="false" data-view="activity">Activity</button>
      <button type="button" role="tab" aria-selected="false" data-view="privacy">Privacy</button>
    </nav>
    <main id="main" tabindex="-1" aria-live="polite">
      <section class="empty" aria-label="Buildmates loading">
        <strong>Loading your workspace</strong>
        <span>The latest Buildmates snapshot will appear here.</span>
      </section>
    </main>
    <div class="status-wrap">
      <p class="status" id="status" role="status" aria-live="polite"></p>
      <div class="status-actions" id="status-actions"></div>
    </div>
  </div>
  <script>
    (() => {
      'use strict';

      const RESOURCE_VERSION = 'buildmates-workspace-v1';
      const UI_PROTOCOL_VERSION = '2026-01-26';
      const HOST_ORIGINS = new Set([
        'https://chatgpt.com',
        'https://chat.openai.com',
        'https://codex.openai.com'
      ]);
      const ACTION_TOOLS = new Set([
        ...${JSON.stringify(BUILD_MATES_CHAT_ACTION_TOOL_NAMES)}
      ]);
      const ACTION_KIND_TO_TOOL = ${JSON.stringify(BUILD_MATES_CHAT_ACTION_TOOL_MAP)};
      const READ_TOOLS = new Set(['get_buildmates_workspace']);
      const state = {
        view: 'home',
        subjectId: undefined,
        snapshot: null,
        hostOrigin: undefined,
        nextId: 1,
        pending: new Map(),
        initialized: false,
        actionConfirmations: new Map()
      };

      const main = document.getElementById('main');
      const status = document.getElementById('status');
      const statusActions = document.getElementById('status-actions');
      const context = document.getElementById('context');
      const navButtons = Array.from(document.querySelectorAll('[data-view]'));

      function text(value, fallback) {
        if (value === null || value === undefined) return fallback || '';
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
        return fallback || '';
      }

      function valueText(value, fallback) {
        if (Array.isArray(value)) {
          const parts = value.map((item) => valueText(item)).filter(Boolean);
          return parts.length ? parts.join(', ') : (fallback || '');
        }
        return text(value, fallback);
      }

      function array(value) { return Array.isArray(value) ? value : []; }

      function setStatus(message, kind, options) {
        status.textContent = text(message);
        status.dataset.kind = kind || '';
        statusActions.replaceChildren();
        if (options && options.refresh) {
          const refresh = element('button', 'action secondary', 'Refresh workspace');
          refresh.type = 'button';
          refresh.addEventListener('click', () => {
            refresh.disabled = true;
            loadView(state.view, state.subjectId);
          });
          statusActions.appendChild(refresh);
        }
      }

      function safeId(value) { return /^[a-zA-Z0-9_.:-]{3,128}$/.test(text(value)) ? text(value) : ''; }

      function newId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        return 'ui-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      }

      function trustedMessage(event) {
        if (event.source !== window.parent) return false;
        const origin = event.origin || 'null';
        if (state.hostOrigin === undefined) {
          const sameOrigin = window.location.origin !== 'null' && origin === window.location.origin;
          if (!HOST_ORIGINS.has(origin) && origin !== 'null' && !sameOrigin) return false;
          state.hostOrigin = origin;
        }
        return state.hostOrigin === origin;
      }

      function post(message) {
        const target = state.hostOrigin && state.hostOrigin !== 'null' ? state.hostOrigin : '*';
        window.parent.postMessage(message, target);
      }

      function request(method, params) {
        const id = state.nextId++;
        post({ jsonrpc: '2.0', id, method, params });
        return new Promise((resolve, reject) => {
          const timer = window.setTimeout(() => {
            state.pending.delete(id);
            reject(new Error('The Buildmates host did not respond in time.'));
          }, 15000);
          state.pending.set(id, { resolve, reject, timer });
        });
      }

      function notify(method, params) { post({ jsonrpc: '2.0', method, params }); }

      function element(tag, className, value) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (value !== undefined) node.textContent = text(value);
        return node;
      }

      function panel(title, className) {
        const node = element('section', 'panel' + (className ? ' ' + className : ''));
        if (title) node.appendChild(element('h2', '', title));
        return node;
      }

      function addParagraph(parent, value, fallback) {
        const content = valueText(value) || valueText(fallback);
        if (!content) return;
        parent.appendChild(element('p', '', content));
      }

      function addFacts(parent, values) {
        const dl = element('dl', 'facts');
        Object.entries(values || {}).forEach(([key, value]) => {
          const content = valueText(value);
          if (!content) return;
          const row = element('div');
          row.appendChild(element('dt', '', key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())));
          row.appendChild(element('dd', '', content));
          dl.appendChild(row);
        });
        if (dl.childElementCount) parent.appendChild(dl);
      }

      function actionTool(action) {
        const explicit = text(action && action.tool);
        if (explicit) return explicit;
        const input = action && typeof action.input === 'object' && action.input ? action.input : null;
        const nested = input && typeof input.action === 'object' && input.action ? input.action : null;
        const kind = nested && typeof nested.kind === 'string' ? nested.kind : '';
        return ACTION_KIND_TO_TOOL[kind] || 'perform_buildmates_action';
      }

      function addActions(parent, actions) {
        const valid = array(actions).filter((action) => {
          if (!action || typeof action !== 'object' || !text(action.label)) return false;
          const tool = actionTool(action);
          return ACTION_TOOLS.has(tool) || READ_TOOLS.has(tool);
        });
        if (!valid.length) return;
        const row = element('div', 'actions');
        valid.forEach((action) => {
          const button = element('button', 'action' + (text(action.tone) === 'secondary' ? ' secondary' : text(action.tone) === 'danger' ? ' danger' : ''), action.label);
          button.type = 'button';
          button.dataset.actionId = safeId(action.id) || newId();
          if (action.disabled === true) button.disabled = true;
          button.addEventListener('click', () => runAction(action, button));
          row.appendChild(button);
        });
        parent.appendChild(row);
      }

      function actionWithBody(action, body) {
        const input = action && typeof action.input === 'object' && action.input ? { ...action.input } : {};
        if (input.action && typeof input.action === 'object') input.action = { ...input.action, body };
        else input.body = body;
        return { ...action, input };
      }

      function submitComposer(composer, input, button) {
        const action = actionWithBody(composer.action, input.value);
        const nestedAction = action.input && typeof action.input.action === 'object' ? action.input.action : null;
        const requiresConfirmation = composer.requiresConfirmation === true || nestedAction && (nestedAction.kind === 'send_room_message' || nestedAction.kind === 'send_circle_message');
        if (requiresConfirmation && button.dataset.confirmed !== 'true') {
          button.dataset.confirmed = 'true';
          button.textContent = 'Confirm send';
          setStatus('Review your message, then press Confirm send.', '');
          return;
        }
        if (requiresConfirmation && action.input && typeof action.input.action === 'object') {
          action.input.action = { ...action.input.action, confirmation: 'confirmed' };
        }
        button.textContent = composer.label || 'Send';
        runAction(action, button);
      }

      async function runAction(action, button) {
        const id = text(action.id) || button.dataset.actionId;
        const confirmation = text(action.confirmation);
        if (confirmation && !state.actionConfirmations.has(id)) {
          state.actionConfirmations.set(id, true);
          button.textContent = 'Confirm: ' + text(action.label);
          setStatus(confirmation, '');
          return;
        }
        state.actionConfirmations.delete(id);
        const tool = actionTool(action);
        if (!ACTION_TOOLS.has(tool) && !READ_TOOLS.has(tool)) return;
        const input = action.input && typeof action.input === 'object' ? { ...action.input } : {};
        if (input.workspaceScope === undefined) input.workspaceScope = 'global';
        if (ACTION_TOOLS.has(tool) && input.idempotencyKey === undefined) {
          input.idempotencyKey = button.dataset.idempotencyKey || newId();
          button.dataset.idempotencyKey = text(input.idempotencyKey);
        }
        if (ACTION_TOOLS.has(tool) && input.action && typeof input.action === 'object') {
          const actionInput = { ...input.action };
          if ((actionInput.kind === 'send_room_message' || actionInput.kind === 'send_circle_message') && actionInput.clientMessageId === undefined) {
            actionInput.clientMessageId = button.dataset.clientMessageId || newId();
            button.dataset.clientMessageId = text(actionInput.clientMessageId);
          }
          input.action = actionInput;
        }
        button.disabled = true;
        setStatus('Updating Buildmates…', '');
        try {
          const result = await request('tools/call', { name: tool, arguments: input });
          if (result && result.isError) throw new Error('Buildmates could not complete that action.');
          const next = snapshotFromResult(result);
          if (next && typeof next === 'object' && (next.view || next.data || next.title)) {
            state.snapshot = next;
            renderSnapshot(next);
          } else {
            const refreshed = await loadView(state.view, state.subjectId);
            if (!refreshed) {
              button.disabled = false;
              setStatus('The action may have saved. Check the workspace before trying again.', 'error', { refresh: true });
              return;
            }
          }
          setStatus('Saved.', 'success');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Buildmates could not complete that action.';
          setStatus(message + ' Check the workspace before trying again.', 'error', { refresh: true });
          button.disabled = false;
        }
      }

      function findArray(data, names) {
        for (const name of names) if (Array.isArray(data && data[name])) return data[name];
        return [];
      }

      function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
      }

      function activeRecord(value) {
        const record = object(value) || {};
        const membership = object(record.membership);
        const status = text(record.status || record.state).toLowerCase();
        const membershipStatus = text(record.membershipStatus || record.viewerMembershipStatus || (membership && membership.status)).toLowerCase();
        return (!status || status === 'active') && (!membershipStatus || membershipStatus === 'active');
      }

      function unavailableMessage(value, label) {
        const record = object(value) || {};
        const membership = object(record.membership);
        const status = text(record.status || record.state).toLowerCase();
        const membershipStatus = text(record.membershipStatus || record.viewerMembershipStatus || (membership && membership.status)).toLowerCase();
        if (status && status !== 'active') return text(label, 'This space') + ' is closed. Messaging is unavailable.';
        if (membershipStatus && membershipStatus !== 'active') return 'Messaging is available to active ' + text(label, 'space').toLowerCase() + ' members.';
        return 'Messaging is unavailable in this ' + text(label, 'space').toLowerCase() + '.';
      }

      function knownCount(value, collections) {
        const record = object(value) || {};
        if (record.memberCount !== undefined && record.memberCount !== null) return record.memberCount;
        for (const collection of array(collections)) if (Array.isArray(record[collection])) return record[collection].length;
        return undefined;
      }

      function canonicalView(value) {
        const candidate = text(value, 'home');
        return candidate || 'home';
      }

      /**
       * The read service intentionally returns the smallest useful payload for
       * each view: profile is a record, projects and connections are arrays,
       * and rooms/circles have their own compound shapes. Keep those service
       * boundaries intact while giving renderers one predictable collection
       * key. This also accepts a host wrapper that places a snapshot in result.
       */
      function normalizeSnapshot(snapshot) {
        const outer = object(snapshot) || {};
        const nested = object(outer.result) && (outer.result.view || outer.result.data || outer.result.title)
          ? outer.result
          : outer;
        const view = canonicalView(nested.view || outer.view || state.view);
        const raw = nested.data !== undefined ? nested.data : nested;
        const data = normalizeData(view, raw);
        const rootActions = array(nested.actions || outer.actions);
        if (rootActions.length && !data.actions) data.actions = rootActions;
        return {
          ...nested,
          view,
          ...(nested.subjectId || outer.subjectId ? { subjectId: nested.subjectId || outer.subjectId } : {}),
          data
        };
      }

      function snapshotFromResult(result) {
        const root = result && typeof result === 'object' && result.structuredContent
          ? result.structuredContent
          : result;
        if (!root || typeof root !== 'object') return root;
        const metadata = result && typeof result === 'object' && result._meta && typeof result._meta === 'object' ? result._meta : null;
        const preview = metadata && metadata.surfacePreview && typeof metadata.surfacePreview === 'object'
          ? metadata.surfacePreview
          : null;
        return preview ? { ...root, surfacePreview: preview } : root;
      }

      function normalizeData(view, raw) {
        if (view === 'profile') {
          if (object(raw) && Object.prototype.hasOwnProperty.call(raw, 'profile')) return { ...raw };
          return { profile: raw };
        }
        const payload = Array.isArray(raw) ? { items: raw } : object(raw) ? { ...raw } : {};
        const collectionKeys = {
          projects: 'projects',
          connections: 'connections',
          circles: 'circles',
          activity: 'activity',
          blocked: 'blocked',
          sources: 'sources',
          signals: 'signals'
        };
        const key = collectionKeys[view];
        if (key && Array.isArray(raw)) {
          delete payload.items;
          payload[key] = raw;
        } else if (key && !Array.isArray(raw) && !Array.isArray(payload[key])) {
          payload[key] = [];
        }
        if (view === 'connection' && !Object.prototype.hasOwnProperty.call(payload, 'connection')) payload.connection = raw;
        if (view === 'circle' && !Object.prototype.hasOwnProperty.call(payload, 'circle')) payload.circle = raw;
        if (view === 'room' && !Object.prototype.hasOwnProperty.call(payload, 'room') && object(raw)) payload.room = raw.room || raw;
        if (view === 'circle_messages' && Array.isArray(raw)) payload.messages = raw;
        if (view === 'circle_messages' && !Array.isArray(payload.messages)) payload.messages = [];
        if (view === 'account' || view === 'home' || view === 'privacy') {
          if (Array.isArray(raw)) payload.items = raw;
        }
        return payload;
      }

      function titleFor(snapshot) {
        const labels = {
          home: 'Overview',
          account: 'Account',
          profile: 'Profile',
          introductions: 'Introductions',
          projects: 'Projects',
          project: 'Project',
          project_details: 'Project',
          connections: 'Connections',
          connection: 'Connection',
          room: 'Room',
          room_enhancements: 'Room enhancements',
          circles: 'Circles',
          circle: 'Circle',
          circle_messages: 'Circle conversation',
          activity: 'Activity',
          blocked: 'Blocked builders',
          sources: 'Source preferences',
          signals: 'Work Signals',
          moderation: 'Moderation',
          project_collaborators: 'Project collaborators',
          privacy: 'Privacy',
        };
        return text(snapshot && snapshot.title, labels[canonicalView(snapshot && snapshot.view)] || 'Your Buildmates workspace');
      }

      function renderHeader(snapshot) {
        const subtitle = text(snapshot && (snapshot.subtitle || snapshot.description || snapshot.context));
        context.textContent = subtitle || 'Your building network, in the conversation.';
        navButtons.forEach((button) => {
          const active = button.dataset.view === state.view;
          button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      }

      function renderHome(data) {
        const grid = element('div', 'grid');
        const profile = object(data.profile);
        const profilePanel = panel(profile ? 'Your profile' : 'Finish your profile', 'span-8');
        if (profile) {
          profilePanel.appendChild(element('h3', '', profile.displayName || 'Your Buildmates profile'));
          addParagraph(profilePanel, profile.summary, 'Your profile is ready for a useful introduction.');
          addFacts(profilePanel, {
            handle: profile.handle ? '@' + profile.handle : undefined,
            matching: profile.allowMatching === false ? 'paused' : 'on',
            visibility: profile.publishedAt ? 'published' : 'private',
          });
        } else {
          addParagraph(profilePanel, '', 'Buildmates needs a reviewed profile before it can suggest a useful introduction. Ask in chat to finish signup.');
        }
        grid.appendChild(profilePanel);
        const setup = data.setup && typeof data.setup === 'object' ? data.setup : null;
        if (setup) {
          const next = panel('Next in Buildmates', 'span-8');
          next.appendChild(element('p', '', text(setup.message || setup.nextAction || setup.goal, 'Finish the next small step to get your profile ready.')));
          addFacts(next, { step: setup.step || setup.nextStep, state: setup.state || setup.status });
          addActions(next, setup.actions);
          grid.appendChild(next);
        }
        const counts = data.counts && typeof data.counts === 'object' ? data.counts : null;
        if (counts) {
          const panelNode = panel('Your network', 'span-4');
          addFacts(panelNode, counts);
          grid.appendChild(panelNode);
        }
        if (data.pulse || data.networking || data.watch !== undefined) {
          const pulse = data.pulse || data.networking || {};
          const pulsePanel = panel('Your work pulse', 'span-4');
          addParagraph(pulsePanel, pulse.intentSummary, data.watch ? 'Relevant builder watch is on.' : data.watch === false ? 'Relevant builder watch is off.' : 'Set a temporary networking intention in chat.');
          addFacts(pulsePanel, { expires: pulse.expiresAt, watch: data.watch === true ? 'on' : data.watch === false ? 'off' : undefined });
          grid.appendChild(pulsePanel);
        }
        const recent = findArray(data, ['recent', 'activity', 'items']);
        if (recent.length) grid.appendChild(renderItemsPanel('Recent movement', recent, 'span-8'));
        const intro = findArray(data, ['introductions', 'matches', 'proposals']);
        if (intro.length) grid.appendChild(renderItemsPanel('Introductions waiting for you', intro.slice(0, 3), 'span-4'));
        if (!grid.childElementCount) {
          const empty = element('div', 'empty span-12');
          empty.appendChild(element('strong', '', 'Your workspace is ready when you are.'));
          empty.appendChild(element('span', '', 'Ask Buildmates to finish signup, update your profile, or find a useful introduction.'));
          grid.appendChild(empty);
        }
        return grid;
      }

      function renderProfile(data) {
        const profile = object(data.profile) || array(data.profiles)[0] || (data.displayName || data.handle ? data : null);
        const grid = element('div', 'grid');
        if (!profile) {
          const empty = panel('Profile not started', 'span-12');
          addParagraph(empty, '', 'Buildmates does not have a reviewed profile yet. Ask in chat to finish signup, then return here to review what will be shared.');
          grid.appendChild(empty);
          return grid;
        }
        const identity = panel(text(profile.displayName, 'Profile'), 'span-8');
        addParagraph(identity, profile.builderSummary || profile.summary, 'Your reviewed builder profile.');
        addParagraph(identity, profile.projectOrInterest || profile.currentWork);
        addFacts(identity, { handle: profile.handle, location: profile.coarseLocation, matching: profile.allowMatching === false ? 'paused' : 'on', mode: profile.acceptanceMode });
        const links = array(profile.portfolioLinks || profile.links);
        if (links.length) {
          const list = element('ul', 'link-list');
          links.forEach((link) => {
            const url = text(link);
            if (!/^https:\/\//i.test(url)) return;
            const item = element('li');
            const anchor = element('a', '', url);
            anchor.href = url;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            item.appendChild(anchor);
            list.appendChild(item);
          });
          if (list.childElementCount) identity.appendChild(list);
        }
        addActions(identity, data.actions || profile.actions);
        grid.appendChild(identity);
        const projects = array(profile.projects || data.projects);
        grid.appendChild(renderItemsPanel('Projects and interests', projects, projects.length ? 'span-4' : 'span-4'));
        const fields = array(profile.fields);
        if (fields.length) grid.appendChild(renderItemsPanel('Reviewed profile fields', fields, 'span-12'));
        return grid;
      }

      function renderItemsPanel(title, items, span, navigation) {
        const section = panel(title, span || 'span-12');
        const stack = element('div', 'stack');
        array(items).forEach((item) => {
          if (!item || typeof item !== 'object') return;
          const row = element('article', 'item');
          const head = element('div', 'item-head');
          const payload = object(item.payload);
          head.appendChild(element('h3', 'item-title', item.displayName || item.title || item.name || item.label || item.kind || item.handle || (payload && (payload.title || payload.name)) || 'Buildmate update'));
          if (item.state || item.status) head.appendChild(element('span', 'meta', item.state || item.status));
          row.appendChild(head);
          addParagraph(row, item.summary || item.builderSummary || item.otherSummary || item.connectionReason || item.purpose || item.latestSignal || item.body || item.description || item.value || (payload && (payload.summary || payload.body || payload.message || payload.description)));
          const reasons = array(item.visibleReasons || item.reasons);
          if (reasons.length) {
            const list = element('ul', 'reason-list');
            reasons.slice(0, 6).forEach((reason) => list.appendChild(element('li', '', valueText(reason))));
            row.appendChild(list);
          }
          addFacts(row, {
            project: item.projectTitle || item.project,
            updated: item.updatedAt || item.createdAt,
            read: item.readAt === null ? 'unread' : undefined,
            source: item.displayName || item.sourceDisplayName,
          });
          addActions(row, item.actions);
          if (typeof navigation === 'function') {
            const controls = array(navigation(item));
            const actionRow = element('div', 'actions');
            controls.forEach((control) => {
              if (!control || !text(control.label) || !text(control.view) || !safeId(control.subjectId)) return;
              const button = element('button', 'action secondary', control.label);
              button.type = 'button';
              button.addEventListener('click', () => loadView(control.view, control.subjectId));
              actionRow.appendChild(button);
            });
            if (actionRow.childElementCount) row.appendChild(actionRow);
          }
          stack.appendChild(row);
        });
        if (!stack.childElementCount) {
          const empty = element('div', 'empty');
          empty.appendChild(element('strong', '', 'Nothing here yet.'));
          empty.appendChild(element('span', '', 'Buildmates will show it when there is something you can act on.'));
          stack.appendChild(empty);
        }
        section.appendChild(stack);
        return section;
      }

      function renderIntroductions(data) {
        const items = findArray(data, ['introductions', 'matches', 'proposals', 'candidates']);
        const grid = element('div', 'grid');
        const notice = data.notice || data.explanation;
        if (notice) {
          const n = element('div', 'notice span-12');
          n.appendChild(element('p', '', notice));
          grid.appendChild(n);
        }
        grid.appendChild(renderItemsPanel('Introductions', items, 'span-12'));
        return grid;
      }

      function renderProject(data) {
        const project = data.project || data;
        const grid = element('div', 'grid');
        const overview = panel(text(project.title, 'Project'), 'span-8');
        addParagraph(overview, project.summary, 'A Buildmates project shared with the audience chosen by its owner.');
        addFacts(overview, {
          stage: project.stage,
          status: project.status,
          audience: project.audience,
          owner: project.ownerDisplayName || project.handle,
        });
        const links = array(project.links);
        if (links.length) {
          const list = element('ul', 'link-list');
          links.forEach((link) => {
            if (!link || !/^https?:\/\//i.test(text(link.url))) return;
            const item = element('li');
            const anchor = element('a', '', text(link.label, link.url));
            anchor.href = text(link.url);
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            item.appendChild(anchor);
            list.appendChild(item);
          });
          if (list.childElementCount) overview.appendChild(list);
        }
        addActions(overview, data.actions || project.actions);
        grid.appendChild(overview);
        const updates = array(project.updates);
        if (updates.length) grid.appendChild(renderItemsPanel('Project updates', updates, 'span-12'));
        else grid.appendChild(renderItemsPanel('Project updates', [], 'span-12'));
        return grid;
      }

      function renderConnections(data) {
        const items = findArray(data, ['connections', 'items']);
        const grid = element('div', 'grid');
        grid.appendChild(renderItemsPanel('Connections', items, 'span-8', (item) => [
          { label: 'Open connection', view: 'connection', subjectId: item.id },
          ...(activeRecord(item) ? [{ label: 'Open room', view: 'room', subjectId: item.roomId }] : []),
        ]));
        const watches = findArray(data, ['watches', 'follows']);
        if (watches.length) grid.appendChild(renderItemsPanel('Following and watches', watches, 'span-4'));
        return grid;
      }

      function renderConnection(data) {
        const connection = data.connection || data;
        const grid = element('div', 'grid');
        const overview = panel(text(connection.otherName, 'Connection'), 'span-8');
        addParagraph(overview, connection.otherSummary, 'A Buildmates connection you chose to keep open.');
        addFacts(overview, {
          state: connection.state,
          muted: connection.muted,
          updates: connection.updatesEnabled,
          relevance: connection.renewedRelevanceEnabled
        });
        addActions(overview, connection.actions || data.actions);
        grid.appendChild(overview);
        const context = connection.matchContext;
        if (context && typeof context === 'object') {
          const contextPanel = panel('Why you connected', 'span-4');
          addParagraph(contextPanel, context.reason);
          addParagraph(contextPanel, context.sharedContext);
          grid.appendChild(contextPanel);
        }
        const updates = array(connection.publicUpdates);
        if (updates.length) grid.appendChild(renderItemsPanel('Project updates', updates, 'span-12'));
        const circles = array(connection.circles);
        if (circles.length) grid.appendChild(renderItemsPanel('Shared Circles', circles, 'span-12', (item) => [
          { label: 'Open Circle', view: 'circle', subjectId: item.id },
        ]));
        if (safeId(connection.roomId) && activeRecord(connection)) {
          const actions = element('div', 'actions');
          const button = element('button', 'action secondary', 'Open room');
          button.type = 'button';
          button.addEventListener('click', () => loadView('room', connection.roomId));
          actions.appendChild(button);
          overview.appendChild(actions);
        }
        return grid;
      }

      function renderRoom(data, subjectId) {
        const room = data.room || array(data.rooms)[0] || data;
        const grid = element('div', 'grid');
        const roomTitle = text(room.title) || (text(room.otherName) ? 'Room with ' + text(room.otherName) : 'Room');
        const overview = panel(roomTitle, 'span-4');
        addParagraph(overview, room.summary || room.whyBody || room.description, 'A private Buildmates room for the people who chose to continue the conversation.');
        addFacts(overview, { state: room.state || room.status, members: knownCount(room, ['participants', 'members']), privacy: room.privacyNote || room.privacy });
        addActions(overview, room.actions || data.actions);
        grid.appendChild(overview);
        const messages = array(data.messages || room.messages || room.activity);
        const thread = panel('Shared conversation', 'span-8');
        if (messages.length) {
          const list = element('div', 'message-list');
          messages.forEach((message) => {
            if (!message || typeof message !== 'object') return;
            const row = element('article', 'message');
            row.appendChild(element('strong', '', message.authorLabel || message.author || message.senderName || message.displayName || (message.mine ? 'You' : text(room.otherName, 'Room member'))));
            row.appendChild(element('p', '', message.body || message.summary || ''));
            list.appendChild(row);
          });
          thread.appendChild(list);
        } else addParagraph(thread, '', 'No shared messages yet. Say hello when you are ready.');
        const roomId = safeId(room.id) || safeId(room.roomId) || safeId(subjectId);
        const roomCanSend = activeRecord(room);
        const composer = roomCanSend && data.composer && typeof data.composer === 'object'
          ? data.composer
          : roomCanSend && room.composer && typeof room.composer === 'object'
            ? room.composer
            : roomCanSend && roomId
              ? { label: 'Send message', placeholder: 'Write to the room', requiresConfirmation: true, action: { tool: 'perform_buildmates_relationship_action', input: { action: { kind: 'send_room_message', roomId, body: '' } } } }
              : null;
        if (!roomCanSend) addParagraph(thread, '', unavailableMessage(room, 'Room'));
        if (composer && composer.action && typeof composer.action === 'object') {
          const form = element('form', 'composer');
          const input = document.createElement('textarea');
          input.name = 'body';
          input.setAttribute('aria-label', text(composer.label, 'Message'));
          input.required = true;
          input.maxLength = 4000;
          input.placeholder = text(composer.placeholder, 'Write to the room');
          form.appendChild(input);
          const button = element('button', 'action', composer.label || 'Send');
          button.type = 'submit';
          form.appendChild(button);
          form.addEventListener('submit', (event) => {
            event.preventDefault();
            submitComposer(composer, input, button);
          });
          input.addEventListener('input', () => {
            delete button.dataset.confirmed;
            delete button.dataset.idempotencyKey;
            delete button.dataset.clientMessageId;
            button.textContent = composer.label || 'Send';
          });
          thread.appendChild(form);
        }
        grid.appendChild(thread);
        return grid;
      }

      function renderCircle(data) {
        const circle = data.circle || array(data.circles)[0] || data;
        const grid = element('div', 'grid');
        const overview = panel(text(circle.name || circle.title, 'Circle'), 'span-8');
        addParagraph(overview, circle.purpose || circle.description, 'A Buildmates Circle with a shared reason to exist.');
        addFacts(overview, { members: knownCount(circle, ['members']), governance: circle.governance || circle.adminPolicy, state: circle.state || circle.status });
        addActions(overview, circle.actions || data.actions);
        if (safeId(circle.id) && activeRecord(circle)) {
          const actions = element('div', 'actions');
          const button = element('button', 'action secondary', 'Open conversation');
          button.type = 'button';
          button.addEventListener('click', () => loadView('circle_messages', circle.id));
          actions.appendChild(button);
          overview.appendChild(actions);
        }
        grid.appendChild(overview);
        grid.appendChild(renderItemsPanel('Members and shared tools', array(circle.members || circle.modules), 'span-4'));
        return grid;
      }

      function renderCircleMessages(data, subjectId) {
        const grid = element('div', 'grid');
        const circle = object(data.circle) || data;
        const messages = array(data.messages);
        const thread = panel('Circle conversation', 'span-12');
        if (messages.length) {
          const list = element('div', 'message-list');
          messages.forEach((message) => {
            if (!message || typeof message !== 'object') return;
            const row = element('article', 'message');
            row.appendChild(element('strong', '', message.senderName || message.author || message.displayName || (message.mine ? 'You' : text(circle.name, 'Circle member'))));
            row.appendChild(element('p', '', message.body || ''));
            list.appendChild(row);
          });
          thread.appendChild(list);
        } else {
          addParagraph(thread, '', 'No Circle messages yet.');
        }
        const circleId = safeId(data.circleId) || safeId(circle.circleId) || safeId(circle.id) || safeId(subjectId);
        const circleCanSend = activeRecord(circle) && activeRecord(data);
        const composer = circleCanSend && data.composer && typeof data.composer === 'object'
          ? data.composer
          : circleCanSend && circleId
            ? { label: 'Send message', placeholder: 'Write to the Circle', requiresConfirmation: true, action: { tool: 'perform_buildmates_circle_action', input: { action: { kind: 'send_circle_message', circleId, body: '' } } } }
            : null;
        if (!circleCanSend) addParagraph(thread, '', unavailableMessage(circle, 'Circle'));
        if (composer && composer.action && typeof composer.action === 'object') {
          const form = element('form', 'composer');
          const input = document.createElement('textarea');
          input.name = 'body';
          input.setAttribute('aria-label', text(composer.label, 'Message'));
          input.required = true;
          input.maxLength = 4000;
          input.placeholder = text(composer.placeholder, 'Write to the Circle');
          form.appendChild(input);
          const button = element('button', 'action', composer.label || 'Send');
          button.type = 'submit';
          form.appendChild(button);
          form.addEventListener('submit', (event) => {
            event.preventDefault();
            submitComposer(composer, input, button);
          });
          input.addEventListener('input', () => {
            delete button.dataset.confirmed;
            delete button.dataset.idempotencyKey;
            delete button.dataset.clientMessageId;
            button.textContent = composer.label || 'Send';
          });
          thread.appendChild(form);
        }
        grid.appendChild(thread);
        return grid;
      }

      function renderSurfacePreview(preview) {
        const section = panel(text(preview && (preview.label || preview.title || preview.kind), 'Private preview'), 'span-12');
        addParagraph(section, '', 'This preview stays private until you explicitly approve publication.');
        const frame = document.createElement('iframe');
        frame.className = 'preview-frame';
        frame.title = text(preview && (preview.label || preview.title || preview.kind), 'Buildmates private preview');
        frame.setAttribute('aria-label', frame.title);
        frame.setAttribute('sandbox', '');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        frame.loading = 'lazy';
        const requestedHeight = Number(window.matchMedia('(max-width: 600px)').matches ? preview && preview.phoneMinHeight : preview && preview.desktopMinHeight);
        if (Number.isFinite(requestedHeight)) frame.style.minHeight = Math.max(240, Math.min(1600, requestedHeight)) + 'px';
        frame.srcdoc = text(preview && preview.html, '<p>Preview unavailable.</p>');
        section.appendChild(frame);
        return section;
      }

      function renderPrivacy(data) {
        const grid = element('div', 'grid');
        const overview = panel('What Buildmates can use', 'span-8');
        addParagraph(overview, data.explanation || data.privacyNote, 'Your profile and matching preferences are controlled here. Buildmates uses only the sources and fields you approve.');
        addFacts(overview, data.summary || data.controls || {});
        addActions(overview, data.actions);
        grid.appendChild(overview);
        if (data.holdings && typeof data.holdings === 'object') {
          const holdings = panel('Your Buildmates data', 'span-4');
          addFacts(holdings, data.holdings);
          grid.appendChild(holdings);
        }
        const sources = findArray(data, ['policies', 'sources', 'preferences']);
        if (sources.length) grid.appendChild(renderItemsPanel('Source preferences', sources, 'span-6'));
        const signals = findArray(data, ['signals']);
        if (signals.length) grid.appendChild(renderItemsPanel('Work Signals', signals, 'span-6'));
        const lifecycle = findArray(data, ['lifecycle']);
        if (lifecycle.length) grid.appendChild(renderItemsPanel('Privacy requests', lifecycle, 'span-12'));
        return grid;
      }

      function renderSnapshot(snapshot) {
        const root = normalizeSnapshot(snapshot);
        const data = root.data && typeof root.data === 'object' ? root.data : {};
        state.view = canonicalView(root.view || data.view || state.view);
        state.subjectId = text(root.subjectId) || undefined;
        renderHeader(root);
        main.replaceChildren();
        const head = element('div', 'view-head');
        const heading = element('div');
        heading.appendChild(element('p', 'kicker', 'Buildmates workspace'));
        heading.appendChild(element('h1', '', titleFor(root)));
        head.appendChild(heading);
        if (root.subtitle || root.description) head.appendChild(element('p', '', root.subtitle || root.description));
        main.appendChild(head);
        const preview = root.surfacePreview || data.surfacePreview || (data.profile && data.profile.surfacePreview) || (data.circle && data.circle.surfacePreview);
        if (preview && typeof preview === 'object' && text(preview.html)) main.appendChild(renderSurfacePreview(preview));
        if (state.view === 'profile') main.appendChild(renderProfile(data));
        else if (state.view === 'introductions') main.appendChild(renderIntroductions(data));
        else if (state.view === 'projects') main.appendChild(renderItemsPanel('Projects', findArray(data, ['projects', 'items']), 'span-12', (item) => [
          { label: 'Open project', view: 'project', subjectId: item.slug || item.id },
        ]));
        else if (state.view === 'project' || state.view === 'project_details') main.appendChild(renderProject(data));
        else if (state.view === 'connections') main.appendChild(renderConnections(data));
        else if (state.view === 'connection') main.appendChild(renderConnection(data));
        else if (state.view === 'room') main.appendChild(renderRoom(data, state.subjectId));
        else if (state.view === 'circles') main.appendChild(renderItemsPanel('Circles', findArray(data, ['circles', 'items']), 'span-12', (item) => [
          { label: 'Open Circle', view: 'circle', subjectId: item.id },
          ...(activeRecord(item) ? [{ label: 'Open conversation', view: 'circle_messages', subjectId: item.id }] : []),
        ]));
        else if (state.view === 'circle') main.appendChild(renderCircle(data));
        else if (state.view === 'circle_messages') main.appendChild(renderCircleMessages(data, state.subjectId));
        else if (state.view === 'room_enhancements') main.appendChild(renderItemsPanel('Room enhancements', findArray(data, ['enhancements', 'modules', 'items']), 'span-12'));
        else if (state.view === 'activity') main.appendChild(renderItemsPanel('Activity', findArray(data, ['activity', 'items', 'events']), 'span-12'));
        else if (state.view === 'blocked') main.appendChild(renderItemsPanel('Blocked builders', findArray(data, ['blocked', 'items']), 'span-12'));
        else if (state.view === 'sources') main.appendChild(renderItemsPanel('Source preferences', findArray(data, ['sources', 'policies', 'items']), 'span-12'));
        else if (state.view === 'signals') main.appendChild(renderItemsPanel('Work Signals', findArray(data, ['signals', 'items']), 'span-12'));
        else if (state.view === 'moderation') main.appendChild(renderModeration(data));
        else if (state.view === 'project_collaborators') main.appendChild(renderItemsPanel('Project collaborators', findArray(data, ['collaborators', 'items']), 'span-12'));
        else if (state.view === 'privacy') main.appendChild(renderPrivacy(data));
        else main.appendChild(renderHome(data));
        main.classList.add('main-programmatic-focus');
        main.focus({ preventScroll: true });
      }

      function renderModeration(data) {
        const grid = element('div', 'grid');
        grid.appendChild(renderItemsPanel('Reports', findArray(data, ['reports']), 'span-6'));
        grid.appendChild(renderItemsPanel('Appealable outcomes', findArray(data, ['appealableOutcomes']), 'span-6'));
        return grid;
      }

      async function loadView(view, subjectId) {
        state.view = view;
        state.subjectId = text(subjectId) || undefined;
        navButtons.forEach((button) => button.setAttribute('aria-selected', button.dataset.view === view ? 'true' : 'false'));
        setStatus('Loading ' + view + '…', '');
        try {
          const argumentsValue = { view, workspaceScope: 'global', limit: 20 };
          if (state.subjectId) argumentsValue.subjectId = state.subjectId;
          const result = await request('tools/call', { name: 'get_buildmates_workspace', arguments: argumentsValue });
          if (result && result.isError) throw new Error('Buildmates could not load that view.');
          const snapshot = snapshotFromResult(result);
          const nestedResult = snapshot && typeof snapshot === 'object' && snapshot.result && typeof snapshot.result === 'object'
            ? snapshot.result
            : null;
          const candidate = nestedResult && (nestedResult.view || nestedResult.data || nestedResult.title) ? nestedResult : snapshot;
          if (!candidate || typeof candidate !== 'object' || (!candidate.view && !candidate.data && !candidate.title)) {
            throw new Error('Buildmates returned an invalid workspace snapshot.');
          }
          state.snapshot = snapshot;
          renderSnapshot(state.snapshot);
          setStatus('', '');
          if (window.openai && typeof window.openai.setWidgetState === 'function') window.openai.setWidgetState({ view });
          return true;
        } catch (error) {
          setStatus(error instanceof Error ? error.message : 'Buildmates could not load that view.', 'error');
          return false;
        }
      }

      document.querySelector('.skip').addEventListener('click', (event) => {
        event.preventDefault();
        main.classList.remove('main-programmatic-focus');
        main.focus({ preventScroll: true });
      });
      navButtons.forEach((button) => button.addEventListener('click', () => loadView(button.dataset.view || 'home')));

      window.addEventListener('message', (event) => {
        if (!trustedMessage(event)) return;
        const message = event.data;
        if (!message || message.jsonrpc !== '2.0') return;
        if (message.id !== undefined && state.pending.has(message.id) && !message.method) {
          const pending = state.pending.get(message.id);
          state.pending.delete(message.id);
          window.clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(text(message.error.message, 'The host rejected the request.')));
          else pending.resolve(message.result);
          return;
        }
        if (message.method === 'ui/notifications/tool-result') {
          const params = message.params && typeof message.params === 'object' ? message.params : {};
          const toolError = params.isError === true || (params.error && typeof params.error === 'object');
          if (toolError) {
            const error = params.error && typeof params.error === 'object' ? params.error : {};
            setStatus(text(error.message, 'Buildmates could not load that view.'), 'error');
            return;
          }
          const output = params.structuredContent;
          if (output) {
            const metadata = params._meta;
            const snapshot = metadata && metadata.surfacePreview ? { ...output, surfacePreview: metadata.surfacePreview } : output;
            state.snapshot = snapshot;
            renderSnapshot(snapshot);
            setStatus('', '');
          }
        } else if (message.method === 'ui/notifications/tool-input') {
          // Tool input is intentionally not rendered. Only server-returned structuredContent is authoritative.
        } else if (message.method === 'ui/notifications/host-context-changed') {
          const theme = message.params && message.params.theme;
          if (theme === 'dark') {
            document.documentElement.dataset.theme = 'dark';
            document.documentElement.style.colorScheme = 'dark';
          } else if (theme === 'light') {
            document.documentElement.dataset.theme = 'light';
            document.documentElement.style.colorScheme = 'light';
          }
        }
      }, { passive: true });

      async function initialize() {
        try {
          await request('ui/initialize', {
            protocolVersion: UI_PROTOCOL_VERSION,
            appInfo: { name: RESOURCE_VERSION, version: '1.0.0' },
            appCapabilities: { availableDisplayModes: ['inline'] }
          });
          state.initialized = true;
          notify('ui/notifications/initialized', {});
        } catch (error) {
          setStatus('Open this result in a ChatGPT or Codex host to use Buildmates.', '');
        }
      }

      initialize();
    })();
  </script>
</body>
</html>`;
