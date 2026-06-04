/**
 * Pure embed-snippet generator. Produces the copy-paste HTML an admin pastes on
 * any external site: a mount `<div>` + the async loader `<script>` referencing
 * this ATS's `/embed/widget.js` with the opaque widget id.
 *
 * No Subresource Integrity by design — the loader is a mutable, versioned
 * first-party script so config/runtime changes go live without re-pasting.
 */
export function generateSnippet(opts: { origin: string; widgetId: string }): string {
  const origin = opts.origin.replace(/\/$/, "");
  const id = opts.widgetId;
  return (
    `<div id="ats-widget-${id}"></div>\n` +
    `<script src="${origin}/embed/widget.js" data-widget="${id}" async></script>`
  );
}
