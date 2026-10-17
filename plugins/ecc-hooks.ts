import { tool, type Plugin } from "@opencode-ai/plugin"
import * as fs from "fs"

const ADAPTER_DIR = "/Users/albertstarfield/.config/opencode/ecc_adapter"
const GOALS_DIR = (process.cwd() || ".") + "/.ecc"
const CHECKLIST_FILE = GOALS_DIR + "/checklist.md"

function ensureDir() {
  if (!fs.existsSync(GOALS_DIR)) fs.mkdirSync(GOALS_DIR, { recursive: true })
}

function generateNeedle(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)]
  return result
}

function promptToChecklist(prompt: string): string[] {
  const items: string[] = []
  const lines = prompt.split(/\n|;|\.\s+/).map((s: string) => s.trim()).filter((s: string) => s.length > 5)
  for (const line of lines) {
    const cleaned = line.replace(/^[\d\.\-\*\)]+\s*/, "").trim()
    if (cleaned.length > 5) items.push(cleaned)
  }
  if (items.length === 0) items.push(prompt.slice(0, 120))
  if (items.length === 1 && prompt.length > 120) {
    const parts = prompt.split(/\s+and\s+|\s+then\s+|\s*,\s*/).map((s: string) => s.trim()).filter((s: string) => s.length > 5)
    if (parts.length > 1) return parts
  }
  return items
}

const needle = generateNeedle()

// In-memory state (per server instance)
const checklistItems = new Map<string, string[]>()
const checkedItems = new Map<string, string[]>()

function getNextItem(sid: string): string | null {
  const items = checklistItems.get(sid) || []
  const checked = checkedItems.get(sid) || []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item !== undefined && !checked.includes(item)) return item
  }
  return null
}

function markChecked(sid: string, item: string) {
  if (!checkedItems.has(sid)) checkedItems.set(sid, [])
  const checked = checkedItems.get(sid)!
  if (!checked.includes(item)) checked.push(item)
}

function allChecked(sid: string): boolean {
  const items = checklistItems.get(sid) || []
  const checked = checkedItems.get(sid) || []
  return items.length > 0 && items.every((item: string) => checked.includes(item))
}

function writeChecklistFile(sid: string) {
  const items = checklistItems.get(sid) || []
  const checked = checkedItems.get(sid) || []
  let md = "# ECC Goal Checklist\n\n"
  for (let i = 0; i < items.length; i++) {
    const done = checked.includes(items[i] || "")
    md += (done ? "✓ " : "○ ") + (i + 1) + ". " + items[i] + "\n"
  }
  md += "\nNeedle: " + needle + "\n"
  md += "Status: " + (allChecked(sid) ? "ALL DONE — output needle" : "IN PROGRESS") + "\n"
  try { fs.writeFileSync(CHECKLIST_FILE, md) } catch {}
}

const EccHooksPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      ecc_checklist_status: tool({
        description: "Show current ECC checklist progress",
        args: {},
        async execute(args, context) {
          const sid = context.sessionID
          const items = checklistItems.get(sid) || []
          const checked = checkedItems.get(sid) || []
          if (items.length === 0) return "No checklist for this session."
          const lines = items.map((item, i) => {
            const done = checked.includes(item)
            return (done ? "✓" : "○") + " " + (i + 1) + ". " + item
          })
          return lines.join("\n") + "\n\nNeedle: " + needle + "\nProgress: " + checked.length + "/" + items.length
        },
      }),
    },

    async "experimental.chat.system.transform"(input, output) {
      if (!input.sessionID) return
      const sid = input.sessionID
      const items = checklistItems.get(sid) || []
      const checked = checkedItems.get(sid) || []

      if (items.length === 0) {
        output.system.push("ECC Goal: No checklist yet. Waiting for user prompt.\n\nCOMPLETION NEEDLE: " + needle)
        return
      }

      const nextItem = getNextItem(sid)
      if (nextItem === null) {
        output.system.push("ALL CHECKLIST ITEMS COMPLETE. Output the session needle now: " + needle)
      } else {
        const idx = items.indexOf(nextItem) + 1
        output.system.push(
          "ECC Goal Checklist — work on item " + idx + "/" + items.length + ":\n" +
          "CURRENT ITEM: " + nextItem + "\n\n" +
          "Instructions:\n" +
          "1. Work on ONLY this item\n" +
          "2. When done, say 'ITEM_DONE' \n" +
          "3. Do NOT work on other items\n" +
          "4. Do NOT output " + needle + " until ALL items are done\n\n" +
          "Progress: " + checked.length + "/" + items.length + " complete\n" +
          "Needle: " + needle
        )
      }
    },

    async "experimental.session.compacting"(input, output) {
      const sid = input.sessionID
      const items = checklistItems.get(sid) || []
      const checked = checkedItems.get(sid) || []
      if (items.length === 0) return
      output.context.push("ECC Checklist to preserve:\n" + items.map((item, i) => (checked.includes(item) ? "✓" : "○") + " " + (i + 1) + ". " + item).join("\n") + "\nNeedle: " + needle)
    },

    async "chat.message"(input, output) {
      // Auto-generate checklist from user prompt
      const text = (output as any)?.parts?.map((p: any) => p.text || "").join(" ") || ""
      if (text && text.length > 5 && !checklistItems.has(input.sessionID)) {
        const items = promptToChecklist(text)
        checklistItems.set(input.sessionID, items)
        checkedItems.set(input.sessionID, [])
        writeChecklistFile(input.sessionID)
        console.log("[ecc-hooks] checklist created:", items)
      }

      // Check for ITEM_DONE
      if (text && text.includes("ITEM_DONE") && checklistItems.has(input.sessionID)) {
        const items = checklistItems.get(input.sessionID) || []
        const checked = checkedItems.get(input.sessionID) || []
        for (const item of items) {
          if (!checked.includes(item)) {
            checkedItems.set(input.sessionID, [...checked, item])
            writeChecklistFile(input.sessionID)
            console.log("[ecc-hooks] item checked:", item)
            break
          }
        }
      }
    },
  }
}

export default {
  id: "ecc-hooks",
  server: EccHooksPlugin,
}
