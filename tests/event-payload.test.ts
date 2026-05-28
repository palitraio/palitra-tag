import { describe, it, expect } from "vitest"
import { splitEventPayload } from "../src/event-payload.ts"

describe("splitEventPayload", () => {
  it("returns empty fields for undefined props", () => {
    expect(splitEventPayload(undefined)).toEqual({ fields: {} })
  })

  it("lifts known event-level fields to fields bucket", () => {
    const result = splitEventPayload({
      value: 5900,
      currency: "RUB",
      transaction_id: "ord-1",
      coupon: "SAVE10",
      shipping: 300,
      tax: 590,
    })
    expect(result).toEqual({
      fields: {
        value: 5900,
        currency: "RUB",
        transaction_id: "ord-1",
        coupon: "SAVE10",
        shipping: 300,
        tax: 590,
      },
    })
  })

  it("lifts an items array to the items bucket", () => {
    const items = [{ item_id: "sku-1", price: 100, quantity: 2 }]
    const result = splitEventPayload({ value: 200, items })
    expect(result.items).toEqual(items)
    expect(result.fields).toEqual({ value: 200 })
  })

  it("keeps unknown keys in properties", () => {
    const result = splitEventPayload({ value: 1, level: "gold", sku_count: 3 })
    expect(result.fields).toEqual({ value: 1 })
    expect(result.properties).toEqual({ level: "gold", sku_count: 3 })
  })

  it("drops undefined values without creating buckets", () => {
    const result = splitEventPayload({ value: undefined, custom: undefined })
    expect(result).toEqual({ fields: {} })
  })

  it("routes a non-array items value into properties", () => {
    const result = splitEventPayload({ items: "not-an-array" })
    expect(result.items).toBeUndefined()
    expect(result.properties).toEqual({ items: "not-an-array" })
  })

  it("partitions a full GA4 purchase payload", () => {
    const result = splitEventPayload({
      value: 5900,
      currency: "RUB",
      transaction_id: "ord-7788",
      coupon: "SUMMER",
      shipping: 0,
      tax: 983,
      items: [
        { item_id: "sku-1", item_name: "Shoe", price: 5900, quantity: 1 },
      ],
      affiliate_network: "cj",
    })
    expect(result.fields).toEqual({
      value: 5900,
      currency: "RUB",
      transaction_id: "ord-7788",
      coupon: "SUMMER",
      shipping: 0,
      tax: 983,
    })
    expect(result.items).toEqual([
      { item_id: "sku-1", item_name: "Shoe", price: 5900, quantity: 1 },
    ])
    expect(result.properties).toEqual({ affiliate_network: "cj" })
  })
})
