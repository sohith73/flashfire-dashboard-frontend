import React, { useCallback, useContext, useEffect, useId, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { UserContext } from "../state_management/UserContext";
import { toastUtils } from "../utils/toast";

// Profile > Connect to Claude. The client makes a personal key here and pastes
// it into Claude; Claude can then do what the client can do on this portal
// (see the dashboard backend's src/mcp), on this account only.
//
// The full key comes back once, from the create call, and is held in memory
// until the client clicks Done. The list only ever shows the first characters.
// Operators never see this card (Profile hides it): a key is the client's own.

interface McpKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface CreatedKey extends McpKey {
  key: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return (body && typeof body.message === "string" && body.message) || fallback;
}

function CopyField({ label, value, mono = true, rows }: { label: string; value: string; mono?: boolean; rows?: number }) {
  const [copied, setCopied] = useState(false);
  const id = useId();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toastUtils.error("Could not copy. Select the text and copy it yourself.");
    }
  };
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-600 mb-1">
        {label}
      </label>
      <div className="flex items-stretch">
        {rows ? (
          <textarea
            id={id}
            readOnly
            rows={rows}
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            className={`min-w-0 flex-1 resize-none border border-gray-300 bg-gray-50 px-3 py-2 text-xs sm:text-sm text-gray-900 ${mono ? "font-mono" : ""}`}
          />
        ) : (
          <input
            id={id}
            readOnly
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            className={`min-w-0 flex-1 border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 ${mono ? "font-mono" : ""}`}
          />
        )}
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 self-stretch border border-l-0 border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}

function SetupSteps({ created }: { created: CreatedKey }) {
  const [tab, setTab] = useState<"app" | "code" | "json">("app");
  const connectorUrl = `${API_BASE}/mcp/u/${created.key}`;
  const cliCommand = `claude mcp add --transport http flashfire ${API_BASE}/mcp --header "Authorization: Bearer ${created.key}"`;
  // Standard MCP client config (Claude Code's .mcp.json and most other MCP
  // clients read this shape): a remote HTTP server with the key as a header.
  const jsonConfig = JSON.stringify(
    {
      mcpServers: {
        flashfire: {
          type: "http",
          url: `${API_BASE}/mcp`,
          headers: { Authorization: `Bearer ${created.key}` },
        },
      },
    },
    null,
    2
  );
  const tabClass = (active: boolean) =>
    `px-3 py-2 text-sm font-semibold border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
      active ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-800"
    }`;

  return (
    <div>
      <div role="tablist" aria-label="Where you use Claude" className="flex gap-2 border-b border-gray-200 mb-4">
        <button type="button" role="tab" aria-selected={tab === "app"} className={tabClass(tab === "app")} onClick={() => setTab("app")}>
          Claude app
        </button>
        <button type="button" role="tab" aria-selected={tab === "code"} className={tabClass(tab === "code")} onClick={() => setTab("code")}>
          Claude Code
        </button>
        <button type="button" role="tab" aria-selected={tab === "json"} className={tabClass(tab === "json")} onClick={() => setTab("json")}>
          JSON config
        </button>
      </div>

      {tab === "app" ? (
        <div role="tabpanel" className="space-y-3">
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
            <li>In the Claude app or on claude.ai, open Settings, then Connectors.</li>
            <li>Click Add custom connector.</li>
            <li>Name it FlashFire and paste the URL below. Leave the advanced settings empty.</li>
            <li>Start a chat and ask, for example, "What's on my FlashFire board this week?"</li>
          </ol>
          <CopyField label="Connector URL" value={connectorUrl} />
          <p className="text-xs text-gray-500">The URL contains your key. Treat it like a password.</p>
        </div>
      ) : tab === "code" ? (
        <div role="tabpanel" className="space-y-3">
          <p className="text-sm text-gray-700">Run this in a terminal, then start Claude Code and ask about your FlashFire board:</p>
          <CopyField label="Command" value={cliCommand} rows={3} />
        </div>
      ) : (
        <div role="tabpanel" className="space-y-3">
          <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
            <li>Open your MCP config file, for example .mcp.json in your project for Claude Code.</li>
            <li>Paste this in. If the file already has an "mcpServers" block, add only the "flashfire" entry inside it.</li>
            <li>Save and restart your client.</li>
          </ol>
          <CopyField label="MCP config (JSON)" value={jsonConfig} rows={11} />
          <p className="text-xs text-gray-500">This config contains your key. Do not commit it to a shared repository.</p>
        </div>
      )}
    </div>
  );
}

const ClaudeConnect: React.FC = () => {
  const token = useContext(UserContext)?.token ?? null;
  const [keys, setKeys] = useState<McpKey[]>([]);
  const [max, setMax] = useState(5);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const nameId = useId();

  const load = useCallback(async () => {
    if (!token || !API_BASE) return;
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/mcp-keys`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await readError(res, "Could not load your keys."));
      const body = await res.json();
      setKeys(body.keys || []);
      if (typeof body.max === "number") setMax(body.max);
    } catch (error) {
      console.error("Claude keys failed to load:", error);
      setLoadError(error instanceof Error ? error.message : "Could not load your keys.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/mcp-keys`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not create a key."));
      const body: CreatedKey = await res.json();
      setCreated(body);
      setName("");
      setKeys((prev) => [{ id: body.id, name: body.name, prefix: body.prefix, createdAt: body.createdAt, lastUsedAt: null }, ...prev]);
    } catch (error) {
      toastUtils.error(error instanceof Error ? error.message : "Could not create a key.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (key: McpKey) => {
    if (!token) return;
    const ok = window.confirm(`Revoke "${key.name}"? Claude stops reaching your FlashFire account with it right away.`);
    if (!ok) return;
    setRevoking(key.id);
    try {
      const res = await fetch(`${API_BASE}/mcp-keys/${encodeURIComponent(key.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      // 404 means it is already gone, which is what the client asked for.
      if (!res.ok && res.status !== 404) throw new Error(await readError(res, "Could not revoke the key."));
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      if (created?.id === key.id) setCreated(null);
      toastUtils.success("Key revoked.");
    } catch (error) {
      toastUtils.error(error instanceof Error ? error.message : "Could not revoke the key.");
    } finally {
      setRevoking(null);
    }
  };

  if (!token || !API_BASE) return null;

  const atLimit = keys.length >= max;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Connect Claude to your FlashFire account. Claude can then check your job board and plan, read job details and
        documents, add jobs, move cards, remove jobs with a reason, and update your job preferences. It only ever sees
        your account.
      </p>

      <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
        <li>Create a key below. You see it once, so copy it when it appears.</li>
        <li>Add it to Claude: the Claude app (Settings, then Connectors), Claude Code, or any MCP client with the JSON config.</li>
        <li>Ask Claude things like "Which jobs did FlashFire apply to this week?" or "Move the Acme job to interviewing".</li>
        <li>Revoke a key here any time. Claude loses access straight away.</li>
      </ol>

      {created ? (
        <div className="border border-orange-300 bg-orange-50 p-4 space-y-4" aria-live="polite">
          <div>
            <p className="text-sm font-semibold text-orange-900">Your new key "{created.name}"</p>
            <p className="text-sm text-orange-800">Copy it now. For your security it is not shown again.</p>
          </div>
          <CopyField label="Key" value={created.key} />
          <SetupSteps created={created} />
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="inline-flex items-center bg-orange-500 hover:bg-orange-600 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
          >
            Done, I saved it
          </button>
        </div>
      ) : (
        <form onSubmit={create} className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label htmlFor={nameId} className="block text-xs font-semibold text-gray-600 mb-1">
              Key name (optional)
            </label>
            <input
              id={nameId}
              type="text"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Claude on my laptop"
              disabled={atLimit}
              className="w-full border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
            />
          </div>
          <button
            type="submit"
            disabled={creating || atLimit || loading}
            className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {creating ? "Creating..." : "Create key"}
          </button>
        </form>
      )}
      {atLimit && !created && (
        <p className="text-xs text-gray-500">You have {max} keys, the most allowed. Revoke one to make another.</p>
      )}

      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Your keys</h4>
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="h-12 bg-gray-100 animate-pulse" />
            <div className="h-12 bg-gray-100 animate-pulse" />
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-red-600">{loadError}</span>
            <button type="button" onClick={load} className="text-orange-600 font-medium hover:underline">
              Try again
            </button>
          </div>
        ) : keys.length === 0 ? (
          <p className="text-sm text-gray-500">No keys yet. Create one above to connect Claude.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{key.name}</p>
                  <p className="text-xs text-gray-500">
                    <span className="font-mono">{key.prefix}</span>…
                    <span className="mx-1 text-gray-300">|</span>
                    Created {formatDate(key.createdAt)}
                    <span className="mx-1 text-gray-300">|</span>
                    {key.lastUsedAt ? `Last used ${formatDate(key.lastUsedAt)}` : "Not used yet"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(key)}
                  disabled={revoking === key.id}
                  className="inline-flex items-center gap-1 self-start sm:self-auto border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  aria-label={`Revoke key ${key.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {revoking === key.id ? "Revoking..." : "Revoke"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ClaudeConnect;
