import { describe, it, expect, beforeAll } from "vitest";
import { NotionConverter } from "../src"; // Assuming NotionBlock is exported from ../src
import { BlockObjectResponse } from "@notionhq/client";
import * as fs from "fs";
import * as path from "path";
import { createMockNotionClient } from "./mocks";

const baseFixturesDir = path.join(__dirname, "fixtures", "NotionConverter");
const blocksDir = path.join(baseFixturesDir, "blocks");

describe("NotionConverter", () => {
  const blockMap = new Map<string, BlockObjectResponse>();
  const blockChildrenIndex = new Map<string, string[]>();

  beforeAll(() => {
    const blockFiles = fs.readdirSync(blocksDir);
    blockFiles.forEach((file) => {
      const filePath = path.join(blocksDir, file);
      const block: BlockObjectResponse = JSON.parse(
        fs.readFileSync(filePath, "utf-8")
      );
      blockMap.set(block.id, block);
      let parentId;
      if (block.parent) {
        if (block.parent.type === "block_id" && block.parent.block_id) {
          parentId = block.parent.block_id;
        } else if (block.parent.type === "page_id" && block.parent.page_id) {
          parentId = block.parent.page_id;
        }
      }

      if (parentId) {
        if (!blockChildrenIndex.has(parentId)) {
          blockChildrenIndex.set(parentId, []);
        }
        blockChildrenIndex.get(parentId)!.push(block.id);
      }
    });
  });

  const mockNotionClient = createMockNotionClient(blockMap, blockChildrenIndex);
  const converter = new NotionConverter(mockNotionClient);

  it("converts a page to html", async () => {
    const page = await converter.fetch("1f6aa550-f576-802c-ab65-e3e8c49a8bcd");
    const html = converter.blocksToHtml(page.children);
    expect(html).toMatchSnapshot();
  });
});
