# Palitra Tag

Client-side script that collects browser events for the Palitra platform. Also known as Palitra Pixel — endpoint paths retain the historical `/pixel/` prefix for stability.

## What it does

- Sends browser events (`page_view`, `purchase`, etc.) to `POST /api/v1/pixel/collect`.
- Resolves traffic source on the client side before sending. Priority: `palitra` URL parameter → `plt||` prefix in `utm_content` → plain UTM parameters → `document.referrer` → direct.
- After capturing the `palitra=` parameter, strips it from the address bar via `history.replaceState`.
- Source fields are fixed at the session entry point and inherited by every subsequent event in the session.
- Fetches project configuration from `GET /api/v1/pixel/config` (cookie/localStorage keys from connected analytics connectors).
- Automatically reads user identifiers from cookies/localStorage and sends them as `linked_ids`.
- Supports manual identity linking via `palitra('link', idType, idValue)`.

## Install

Paste before `</head>` on every page you want to track. Replace `ptok_YOUR_PUBLIC_TOKEN` with the token from your project settings.

```html
<script>
  (function(w,d,s){
    w.PalitraObject=s;w[s]=w[s]||function(){(w[s].q=w[s].q||[]).push(arguments)};
    var e=d.createElement('script');e.async=1;e.src='https://cdn.palitra.io/palitra.js';
    d.head.appendChild(e);
  })(window,document,'palitra');
  palitra('init','ptok_YOUR_PUBLIC_TOKEN');
</script>
```

### API

```js
palitra('identify', 'user-id');               // link anonymous sessions to a real user
palitra('link', 'ga4_client_id', 'value');    // attach external analytics IDs
palitra('event', 'page_view');                // page_view is also sent automatically

// GA4-shaped ecommerce event: known fields and items[] are sent as
// structured top-level data; any other keys ride along in properties.
palitra('event', 'purchase', {
  value: 5900,
  currency: 'RUB',
  transaction_id: 'ord-7788',
  coupon: 'SUMMER',
  shipping: 0,
  tax: 983,
  items: [
    { item_id: 'sku-1', item_name: 'Sneakers', price: 5900, quantity: 1, item_brand: 'Acme' }
  ]
});
```

## Authentication

The public pixel token is passed via the `X-Palitra-Pixel-Token` header or the `?token=` query parameter. `project_id` is intentionally absent from the URL — the project is resolved from the token.

## Limits

- Payload ≤ 64 KB.
- Rate limits: 50 RPS per IP, 1,000 RPS per project.

## License

[MIT](./LICENSE) © Palitra
