import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test("built server lists tools and handles a local tool call", { timeout: 10000 }, async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../dist/index.js", import.meta.url))],
  });
  const client = new Client({ name: "mcp-faa-test", version: "1.0.0" });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(
      tools.map(({ name }) => name).sort(),
      ["aircraft_registry", "airport_delays", "airport_status", "airspace_status", "notams", "pilot_medical_examiners"].sort(),
    );

    const result = await client.callTool({ name: "aircraft_registry", arguments: { n_number: "N12345" } });
    assert.equal(result.isError, undefined);
    assert.match(result.content[0].text, /nNumberLookup=12345/);
  } finally {
    await client.close();
  }
});
