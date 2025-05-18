import { describe, it, expect, vi, Mock, beforeAll } from "vitest";
import { NotionConverter, NotionBlock } from "../src"; // Assuming NotionBlock is exported from ../src
import { BlockObjectResponse, Client } from "@notionhq/client";
import * as fs from "fs";
import * as path from "path";

const baseFixturesDir = path.join(__dirname, "fixtures", "NotionConverter");
const blocksDir = path.join(baseFixturesDir, "blocks");

// Helper function to recursively build a block with its children
function getFullBlockRecursiveHelper(
  blockId: string,
  allBlocksMap: Map<string, BlockObjectResponse>,
  childrenIdx: Map<string, string[]>
): NotionBlock | null {
  const baseBlockData = allBlocksMap.get(blockId);
  if (!baseBlockData) {
    return null;
  }

  // Create a mutable copy and assert as NotionBlock to add 'children'
  const blockWithChildren = { ...baseBlockData } as NotionBlock;

  if (baseBlockData.has_children) {
    const childIds = childrenIdx.get(blockId) || [];
    blockWithChildren.children = childIds
      .map((id) => getFullBlockRecursiveHelper(id, allBlocksMap, childrenIdx))
      .filter(Boolean) as NotionBlock[]; // Filter out nulls if any child not found
  } else {
    blockWithChildren.children = []; // Ensure children array exists and is empty
  }
  return blockWithChildren;
}

describe("NotionConverter", () => {
  const blockMap = new Map<string, BlockObjectResponse>();
  let blockChildrenIndex = new Map<string, string[]>();

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

  const mockNotionClient = {
    blocks: {
      retrieve: vi
        .fn()
        .mockImplementation(async ({ block_id }: { block_id: string }) => {
          if (blockMap.has(block_id)) {
            // Return a shallow copy of the block data
            return { ...blockMap.get(block_id) } as BlockObjectResponse;
          }
          throw new Error(`Mock Error: Block with id "${block_id}" not found.`);
        }),
      children: {
        list: vi
          .fn()
          .mockImplementation(async ({ block_id }: { block_id: string }) => {
            if (!blockMap.has(block_id)) {
              throw new Error(
                `Mock Error: Parent block with id "${block_id}" not found for children.list.`
              );
            }

            const directChildIds = blockChildrenIndex.get(block_id) || [];

            // Use the helper to get children that are already recursively populated
            const results = directChildIds
              .map((id) =>
                getFullBlockRecursiveHelper(id, blockMap, blockChildrenIndex)
              )
              .filter(Boolean); // Filter out any null results (e.g., if a child ID wasn't in blockMap)

            return {
              object: "list",
              results: results, // These results are NotionBlock-like, with .children populated
              next_cursor: null,
              has_more: false,
              type: "block",
              block: {}
            };
          })
      }
    }
  } as unknown as Client;

  const converter = new NotionConverter(mockNotionClient);

  it("does something", async () => {
    const page = await converter.fetch("1f6aa550-f576-802c-ab65-e3e8c49a8bcd");
    const html = converter.blocksToHtml(page.children);
    expect(html).toMatchFileSnapshot(
      "./test/fixtures/NotionConverter/outputs/NotionConverter/output.html"
    );
  });
});
