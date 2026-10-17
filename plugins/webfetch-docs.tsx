import { Plugin } from "@opencode/plugin/tui"
import type { Context } from "@opencode/plugin/tui"

/**
 * WebFetch Docs commands (V2 port)
 *
 * V1 stubs all-plugins.js and webfetch-docs.js were byte-identical duplicates
 * registering the same three placeholder commands; they are merged here into
 * one plugin to avoid duplicate command registration. Behavior is preserved:
 * each command echoes its placeholder message as a toast.
 *
 * Migrated from the V1 plugin `commands` array to the V2 CLI keymap layer
 * (slash commands + context.ui.toast).
 */

export default Plugin.define({
  id: "webfetch-docs",
  setup(context: Context) {
    context.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: [
        {
          id: "webfetch-docs.search-ddg",
          title: "Search DuckDuckGo for Opencode documentation",
          group: "Docs",
          palette: true,
          slash: { name: "search-ddg-opencode", arguments: true },
          run: (input) => {
            context.ui.toast.show({
              message: `Searching DuckDuckGo for: Opencode ${input ?? ""} documentation`,
              variant: "info",
            })
          },
        },
        {
          id: "webfetch-docs.fetch",
          title: "Fetch Opencode documentation from URL",
          group: "Docs",
          palette: true,
          slash: { name: "webfetch-docs", arguments: true },
          run: (input) => {
            context.ui.toast.show({
              message: `Fetching documentation from: ${input ?? ""}`,
              variant: "info",
            })
          },
        },
        {
          id: "webfetch-docs.chain",
          title: "Fetch a page and its related links automatically",
          group: "Docs",
          palette: true,
          slash: { name: "chain-doc-fetch", arguments: true },
          run: (input) => {
            context.ui.toast.show({
              message: `Will fetch ${input ?? ""} and any linked sub-pages for complete documentation`,
              variant: "info",
            })
          },
        },
      ],
    }))
  },
})
