import * as fs from "node:fs";
import * as path from "node:path";
import type { BlockObjectResponse, Client } from "@notionhq/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { type NotionBlock, NotionConverter } from "../src/index.js";
import { createMockNotionClient } from "./mocks.js";

const baseFixturesDir = path.join(__dirname, "fixtures", "NotionConverter");
const blocksDir = path.join(baseFixturesDir, "blocks");
const edgeCasesDir = path.join(baseFixturesDir, "edge-cases");

describe("NotionConverter", () => {
	const blockMap = new Map<string, BlockObjectResponse>();
	const blockChildrenIndex = new Map<string, string[]>();

	beforeAll(() => {
		const blockFiles = fs.readdirSync(blocksDir);
		for (const file of blockFiles) {
			const filePath = path.join(blocksDir, file);
			const block: BlockObjectResponse = JSON.parse(
				fs.readFileSync(filePath, "utf-8")
			);
			blockMap.set(block.id, block);
			let parentId: string | undefined;
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
				blockChildrenIndex.get(parentId)?.push(block.id);
			}
		}

		// Load edge case fixtures
		if (fs.existsSync(edgeCasesDir)) {
			const edgeCaseFiles = fs.readdirSync(edgeCasesDir);
			for (const file of edgeCaseFiles) {
				const filePath = path.join(edgeCasesDir, file);
				const block: BlockObjectResponse = JSON.parse(
					fs.readFileSync(filePath, "utf-8")
				);
				blockMap.set(block.id, block);
			}
		}
	});

	const mockClient = createMockNotionClient(blockMap, blockChildrenIndex);
	const converter = new NotionConverter(mockClient);

	it("converts blocks to HTML", async () => {
		const pageData = await converter.fetch(
			"1f6aa550-f576-802c-ab65-e3e8c49a8bcd"
		);
		// Extract the children blocks from the page data
		const blocks = pageData.children;
		const html = converter.blocksToHtml(blocks);

		expect(html).toMatchSnapshot();
	});

	describe("Error Handling", () => {
		it("should throw error for invalid block type during HTML conversion", () => {
			const invalidBlock = JSON.parse(
				fs.readFileSync(
					path.join(edgeCasesDir, "invalid-block-type.json"),
					"utf-8"
				)
			) as NotionBlock;

			expect(() => {
				converter.blocksToHtml([invalidBlock]);
			}).toThrow(
				/Failed to parse block: invalid-block-123 \(unsupported_block_type\)/
			);
		});

		it("should throw error for malformed block structure", () => {
			const malformedBlock = JSON.parse(
				fs.readFileSync(
					path.join(edgeCasesDir, "malformed-paragraph.json"),
					"utf-8"
				)
			) as NotionBlock;

			expect(() => {
				converter.blocksToHtml([malformedBlock]);
			}).toThrow(
				/Failed to parse block: malformed-paragraph-456 \(paragraph\)/
			);
		});

		it("should handle network errors during fetch", async () => {
			const mockFailingClient = {
				blocks: {
					retrieve: vi.fn().mockRejectedValue(new Error("Network timeout")),
					children: {
						list: vi.fn().mockRejectedValue(new Error("Network error"))
					}
				}
			} as unknown as Client;

			const failingConverter = new NotionConverter(mockFailingClient);

			await expect(
				failingConverter.fetch("nonexistent-block-id")
			).rejects.toThrow("Network timeout");
		});

		it("should handle missing block references", async () => {
			const mockClientWithMissingBlocks = {
				blocks: {
					retrieve: vi.fn().mockRejectedValue(new Error("Block not found")),
					children: {
						list: vi.fn().mockResolvedValue({ results: [] })
					}
				}
			} as unknown as Client;

			const converter = new NotionConverter(mockClientWithMissingBlocks);

			await expect(converter.fetch("missing-block-id")).rejects.toThrow(
				"Block not found"
			);
		});

		it("should handle empty blocks array gracefully", () => {
			const html = converter.blocksToHtml([]);
			expect(html).toBe("");
		});

		it("should handle corrupted children data during fetch", async () => {
			const mockClientWithCorruptedChildren = {
				blocks: {
					retrieve: vi.fn().mockResolvedValue({
						id: "test-block",
						type: "paragraph",
						has_children: true,
						paragraph: { rich_text: [] }
					}),
					children: {
						list: vi.fn().mockResolvedValue({
							results: [
								{
									id: "child-1",
									type: "paragraph",
									paragraph: { rich_text: [] }
								}
							]
						})
					}
				}
			} as unknown as Client;

			const converter = new NotionConverter(mockClientWithCorruptedChildren);

			// Mock the second retrieve call to fail
			vi.mocked(mockClientWithCorruptedChildren.blocks.retrieve)
				.mockResolvedValueOnce({
					id: "test-block",
					type: "paragraph",
					has_children: true,
					// @ts-expect-error: corrupted data
					paragraph: { rich_text: [] }
				})
				.mockRejectedValueOnce(new Error("Child block fetch failed"));

			await expect(converter.fetch("test-block")).rejects.toThrow(
				"Child block fetch failed"
			);
		});

		it("should handle toggle blocks with missing rich_text", () => {
			const brokenToggleBlock = {
				id: "broken-toggle",
				type: "toggle",
				toggle: {
					// Missing rich_text property
					color: "default"
				}
			} as NotionBlock;

			expect(() => {
				converter.blocksToHtml([brokenToggleBlock]);
			}).toThrow(/Failed to parse block: broken-toggle \(toggle\)/);
		});
	});
});
