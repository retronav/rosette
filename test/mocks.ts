import {
  BlockObjectResponse,
  Client,
  DatabaseObjectResponse
} from "@notionhq/client";
import { vi } from "vitest";
import { NotionBlock } from "../src";

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

export function createMockNotionClient(
  blockMap: Map<string, BlockObjectResponse>,
  blockChildrenIndex: Map<string, string[]>,
  databaseMap: Map<string, DatabaseObjectResponse> = new Map()
) {
  return {
    databases: {
      query: vi
        .fn()
        .mockImplementation(
          async ({ database_id }: { database_id: string }) => {
            if (databaseMap.has(database_id)) {
              // Return a shallow copy of the database data
              return {
                ...databaseMap.get(database_id)
              } as DatabaseObjectResponse;
            }
            throw new Error(
              `Mock Error: Database with id "${database_id}" not found.`
            );
          }
        )
    },
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
}
