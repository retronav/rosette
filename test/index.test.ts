import { describe, it, expect, vi } from "vitest";
import { NotionBlock, NotionConverter } from "../src";
import { Client } from "@notionhq/client";
import * as fs from "fs";
import * as path from "path";

const fixturesDir = path.join(__dirname, "fixtures");

describe("NotionConverter", () => {
  const suiteFixturesDir = path.join(fixturesDir, "NotionConverter");

  const mockNotionClient = {
    blocks: {
      retrieve: vi.fn(),
      children: {
        list: vi.fn().mockResolvedValue({ results: [] })
      }
    }
  } as unknown as Client;

  const converter = new NotionConverter(mockNotionClient);

  const fixtureFiles = fs
    .readdirSync(suiteFixturesDir)
    .filter((file) => file.endsWith(".json"));

  fixtureFiles.forEach((fixtureFile) => {
    it(fixtureFile.replace(/\.json$/, "").replace("_", ""), async () => {
      const fixturePath = path.join(
        suiteFixturesDir,
        fixtureFile
      );
      const outputFileName = fixtureFile.replace(".json", ".html");

      const fixtureData: NotionBlock = JSON.parse(
        fs.readFileSync(fixturePath, "utf-8")
      );

      const html = converter.blocksToHtml(
        "children" in fixtureData ? fixtureData.children : [fixtureData]
      );

      await expect(html).toMatchFileSnapshot(
        "./test/outputs/" + outputFileName
      );
    });
  });
});
