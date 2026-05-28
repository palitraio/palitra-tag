import { EVENT_LEVEL_KEYS } from "./types.ts"
import type { EventItem, EventLevelFields } from "./types.ts"

export interface SplitPayload {
  fields: EventLevelFields
  items?: EventItem[]
  properties?: Record<string, unknown>
}

const EVENT_LEVEL_KEY_SET: ReadonlySet<string> = new Set(EVENT_LEVEL_KEYS)

export function splitEventPayload(
  props: Record<string, unknown> | undefined,
): SplitPayload {
  if (!props) return { fields: {} }

  const fields: Record<string, unknown> = {}
  let items: EventItem[] | undefined
  let properties: Record<string, unknown> | undefined

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue
    if (key === "items") {
      if (Array.isArray(value)) {
        items = (value as EventItem[])
      } else {
        ;(properties ??= {})[key] = value
      }
      continue
    }
    if (EVENT_LEVEL_KEY_SET.has(key)) {
      fields[key] = value
      continue
    }
    ;(properties ??= {})[key] = value
  }

  return {
    fields: fields as EventLevelFields,
    ...(items !== undefined ? { items } : {}),
    ...(properties !== undefined ? { properties } : {}),
  }
}
