"use client";

import { useEffect, useMemo, useState } from "react";
import { renderTheme, renderWidget, type WidgetRole } from "@/lib/widget/runtime";
import { toRenderConfig, previewRoles, type WidgetConfig } from "@/lib/widget/config";

/**
 * Live, byte-faithful preview: renders the draft config with the SAME pure
 * functions the production widget.js uses, inside a sandboxed iframe + Shadow
 * DOM (so the `:host` reset + style isolation match production exactly).
 */
export function WidgetPreview({ config }: { config: WidgetConfig }) {
  const [roles, setRoles] = useState<WidgetRole[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/positions/public?start=0&stop=200", { credentials: "include" })
      .then((r) => r.json())
      .then((env) => {
        if (active) setRoles(Array.isArray(env?.data) ? env.data : []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const srcDoc = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const filtered = previewRoles(roles, config);
    const inner = "<style>" + renderTheme(config.theme) + "</style>" + renderWidget(toRenderConfig(config), filtered, { origin });
    return (
      "<!doctype html><html><head><meta charset='utf-8'>" +
      "<style>html,body{margin:0;padding:16px;background:transparent}</style></head>" +
      "<body><div id='host'></div><script>" +
      "document.getElementById('host').attachShadow({mode:'open'}).innerHTML=" +
      JSON.stringify(inner) +
      "<\\/script></body></html>"
    );
  }, [roles, config]);

  return (
    <iframe
      title="Widget preview"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
      className="h-full min-h-[420px] w-full rounded-lg border bg-[#0b0b0c]"
    />
  );
}
