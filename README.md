# Katastr Nemovitostí MCP

MCP server for the **Czech Land Registry** (Katastr nemovitostí) — query parcels, buildings, ownership sheets, cadastral units, addresses, and property proceedings via the official ČÚZK API.

## Tools

| Tool | Description |
|------|-------------|
| `lookup_parcel` | Look up a parcel by cadastral area + number → ownership, area, land type, liens |
| `lookup_building` | Look up a building by cadastral area + building number → ownership, floor count |
| `search_cadastral_unit` | Search cadastral units by name → code, municipality, district |
| `lookup_ownership_sheet` | Look up an ownership sheet (LV) → all owners, parcels, buildings, liens |
| `lookup_address` | RUIAN address lookup → geo-coordinates, street, municipality |
| `company_property_lookup` | Look up company by IČO via ARES → useful for real estate cross-reference |
| `lookup_parcel_proceedings` | Active cadastral proceedings on a parcel → pending transfers, liens |

## Pricing

- **Free tier**: 10 calls/day — no signup required
- **Paid**: Unlimited API access via API key

## Quick Start

```json
{
  "mcpServers": {
    "katastr": {
      "url": "https://YOUR_RAILWAY_URL/mcp",
      "headers": {
        "x-api-key": "your_api_key_here"
      }
    }
  }
}
```

## Data Sources

- [ČÚZK API](https://api-kn.cuzk.gov.cz) — Official Czech Land Registry
- [RUIAN](https://vdp.cuzk.cz) — Czech Address Register
- [ARES](https://ares.gov.cz) — Business Registry (for company cross-reference)

## License

MIT
