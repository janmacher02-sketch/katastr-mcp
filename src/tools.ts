import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// ─── ČÚZK API helpers ─────────────────────────────────────────────────────────

const CUZK_API_BASE = "https://api-kn.cuzk.gov.cz";

interface CuzkResponse {
  status: number;
  data: unknown;
  error?: string;
}

async function cuzkFetch(path: string): Promise<CuzkResponse> {
  try {
    const res = await fetch(`${CUZK_API_BASE}${path}`, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "katastr-mcp/1.0.0",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return { status: res.status, data: null, error: `ČÚZK API error ${res.status}: ${text.slice(0, 500)}` };
    }
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: null, error: `Network error: ${String(err)}` };
  }
}

// ─── Fallback: ARES + RUIAN for ownership context ─────────────────────────────

async function aresLookup(ico: string): Promise<unknown> {
  try {
    const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`);
    if (!res.ok) return { error: `ARES error ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: String(err) };
  }
}

async function ruianLookup(addressCode: string): Promise<unknown> {
  try {
    const res = await fetch(`https://vdp.cuzk.cz/vdp/ruian/adresnimista/${addressCode}`, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return { error: `RUIAN error ${res.status}` };
    return await res.json();
  } catch (err) {
    return { error: String(err) };
  }
}

// ─── Tool Registration ───────────────────────────────────────────────────────

export function registerTools(server: McpServer) {

  // Tool 1: Lookup parcel by cadastral area + parcel number
  server.tool(
    "lookup_parcel",
    "Look up a parcel (parcela) in Czech Land Registry by cadastral area code and parcel number. Returns ownership, area, land type, liens, and easements.",
    {
      katastralniUzemiKod: z.number().describe("Cadastral area code (kód katastrálního území), e.g. 727164 for Praha-Vinohrady"),
      kmenCislo: z.number().describe("Parcel stem number (kmenové číslo parcely), e.g. 1234"),
      poddeleniCislo: z.number().optional().describe("Parcel sub-number (poddělení), if applicable"),
      druhParcely: z.enum(["ST", "PKN"]).optional().describe("Parcel type: ST = stavební (building), PKN = pozemková (land). Default: PKN"),
    },
    async ({ katastralniUzemiKod, kmenCislo, poddeleniCislo, druhParcely }) => {
      const dp = druhParcely ?? "PKN";
      const poddeleni = poddeleniCislo ? `/${poddeleniCislo}` : "";
      const path = `/parcely/${katastralniUzemiKod}/${dp}/${kmenCislo}${poddeleni}`;
      const result = await cuzkFetch(path);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    }
  );

  // Tool 2: Lookup building by cadastral area + building number
  server.tool(
    "lookup_building",
    "Look up a building (stavba) in Czech Land Registry by cadastral area code and building number. Returns ownership, address, floor count.",
    {
      katastralniUzemiKod: z.number().describe("Cadastral area code"),
      cisloDomovni: z.number().describe("Building number (číslo domovní/popisné)"),
      typCislaDomovniho: z.enum(["CP", "CE"]).optional().describe("Type: CP = číslo popisné (permanent), CE = číslo evidenční (temporary). Default: CP"),
    },
    async ({ katastralniUzemiKod, cisloDomovni, typCislaDomovniho }) => {
      const typ = typCislaDomovniho ?? "CP";
      const path = `/stavby/${katastralniUzemiKod}/${typ}/${cisloDomovni}`;
      const result = await cuzkFetch(path);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    }
  );

  // Tool 3: Lookup cadastral unit by name or code
  server.tool(
    "search_cadastral_unit",
    "Search for cadastral units (katastrální území) by name. Returns code, municipality, district info.",
    {
      query: z.string().describe("Name of the cadastral area to search, e.g. 'Vinohrady' or 'Brno-střed'"),
    },
    async ({ query }) => {
      const path = `/katastralniUzemi?nazev=${encodeURIComponent(query)}`;
      const result = await cuzkFetch(path);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    }
  );

  // Tool 4: Ownership sheet (list vlastnictví / LV)
  server.tool(
    "lookup_ownership_sheet",
    "Look up an ownership sheet (list vlastnictví / LV) in Czech Land Registry. Returns all owners, parcels, buildings, liens, and easements for a given LV number.",
    {
      katastralniUzemiKod: z.number().describe("Cadastral area code"),
      lvCislo: z.number().describe("Ownership sheet number (číslo listu vlastnictví)"),
    },
    async ({ katastralniUzemiKod, lvCislo }) => {
      const path = `/listyVlastnictvi/${katastralniUzemiKod}/${lvCislo}`;
      const result = await cuzkFetch(path);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    }
  );

  // Tool 5: RUIAN address lookup
  server.tool(
    "lookup_address",
    "Look up an address point in the RUIAN registry (Czech address register). Returns geo-coordinates, street, municipality, postal code.",
    {
      addressCode: z.string().describe("RUIAN address point code (kód adresního místa), e.g. '22325461'"),
    },
    async ({ addressCode }) => {
      const result = await ruianLookup(addressCode);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 6: Company real estate lookup (via ARES IČO → ownership cross-ref)
  server.tool(
    "company_property_lookup",
    "Look up a Czech company by IČO and retrieve its ARES profile. Useful for identifying company-owned real estate in combination with parcel/building lookups.",
    {
      ico: z.string().describe("Company IČO (identification number), e.g. '27074358'"),
    },
    async ({ ico }) => {
      const result = await aresLookup(ico);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Tool 7: Proceedings / řízení on a parcel
  server.tool(
    "lookup_parcel_proceedings",
    "Look up active cadastral proceedings (řízení) on a parcel — pending transfers, boundary changes, lien registrations, etc.",
    {
      katastralniUzemiKod: z.number().describe("Cadastral area code"),
      kmenCislo: z.number().describe("Parcel stem number"),
      druhParcely: z.enum(["ST", "PKN"]).optional().describe("Parcel type: ST or PKN. Default: PKN"),
    },
    async ({ katastralniUzemiKod, kmenCislo, druhParcely }) => {
      const dp = druhParcely ?? "PKN";
      const path = `/parcely/${katastralniUzemiKod}/${dp}/${kmenCislo}/rizeni`;
      const result = await cuzkFetch(path);
      if (result.error) {
        return { content: [{ type: "text", text: `Error: ${result.error}` }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(result.data, null, 2) }] };
    }
  );
}
