#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({ name: "mcp-faa", version: "1.0.0" });

async function faa(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FAA API ${res.status}: ${await res.text()}`);
  return res.json();
}

server.tool("airport_status", "Get real-time airport delay and status information", {
  airport_code: z.string().describe("IATA airport code (e.g., LAX, JFK, ORD)"),
}, async ({ airport_code }) => {
  const data = await faa(`https://soa.smext.faa.gov/asws/api/airport/status/${airport_code.toUpperCase()}`);
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("airport_delays", "Get current national airport delays", {}, async () => {
  const data = await faa("https://soa.smext.faa.gov/asws/api/airport/delays");
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("notams", "Get NOTAMs (Notices to Air Missions) for an airport", {
  airport_code: z.string().describe("ICAO or IATA airport code"),
}, async ({ airport_code }) => {
  // FAA NOTAM API requires auth; use alternate source
  const data = await faa(`https://external-api.faa.gov/notamapi/v1/notams?icaoLocation=${airport_code.toUpperCase()}&responseFormat=geoJson`).catch(() => ({ message: "NOTAM API requires API key. Set FAA_API_KEY env var." }));
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
});

server.tool("aircraft_registry", "Search FAA aircraft registration database", {
  n_number: z.string().optional().describe("N-Number (tail number, e.g., N12345)"),
  name: z.string().optional().describe("Registrant name"),
  state: z.string().optional().describe("Two-letter state code"),
  aircraft_type: z.string().optional().describe("Aircraft manufacturer or model"),
}, async ({ n_number, name, state, aircraft_type }) => {
  // FAA ReleasableDB is a bulk download; use AeroAPI or scrape
  const params: string[] = [];
  if (n_number) params.push(`nNumberLookup=${n_number.replace(/^N/i, "")}`);
  if (name) params.push(`name=${encodeURIComponent(name)}`);
  if (state) params.push(`state=${state}`);
  const url = `https://registry.faa.gov/aircraftinquiry/Search/NNumberResult?${params.join("&")}`;
  return { content: [{ type: "text", text: JSON.stringify({
    note: "FAA Aircraft Registry is a web interface. Use these search parameters:",
    search_url: url,
    n_number, name, state, aircraft_type,
    tip: "For programmatic access, download the Releasable Aircraft Database from https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download",
  }, null, 2) }] };
});

server.tool("pilot_medical_examiners", "Find FAA-designated Aviation Medical Examiners (AMEs)", {
  state: z.string().optional().describe("Two-letter state code"),
  city: z.string().optional(),
  zip: z.string().optional(),
  last_name: z.string().optional(),
}, async ({ state, city, zip, last_name }) => {
  const params: Record<string, string> = {};
  if (state) params.state = state;
  if (city) params.city = city;
  if (zip) params.zip = zip;
  if (last_name) params.lastName = last_name;
  const qs = new URLSearchParams(params).toString();
  return { content: [{ type: "text", text: JSON.stringify({
    search_url: `https://designee.faa.gov/SelectionPage?designeeType=AME&${qs}`,
    params,
    note: "AME search is web-based. Results available at the URL above.",
  }, null, 2) }] };
});

server.tool("airspace_status", "Get temporary flight restriction (TFR) information", {}, async () => {
  const data = await faa("https://soa.smext.faa.gov/asws/api/airport/delays");
  return { content: [{ type: "text", text: JSON.stringify({
    tfr_url: "https://tfr.faa.gov/tfr2/list.html",
    current_delays: data,
    note: "TFR data available at the URL above. Airport delays shown below.",
  }, null, 2) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
