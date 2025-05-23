import * as fs from "node:fs";
import * as path from "node:path";
import type {
	BlockObjectResponse,
	Client,
	DatabaseObjectResponse
} from "@notionhq/client";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as z from "zod/v4";
import { NotionDatabaseManager, properties } from "../src/index.js";
import { createMockNotionClient } from "./mocks.js";

const baseFixturesDir = path.join(
	__dirname,
	"fixtures",
	"NotionDatabaseManager"
);
const blocksDir = path.join(baseFixturesDir, "blocks");
const databasesDir = path.join(baseFixturesDir, "databases");
const edgeCasesDir = path.join(baseFixturesDir, "edge-cases");

describe("NotionDatabaseManager", () => {
	const blockMap = new Map<string, BlockObjectResponse>();
	const blockChildrenIndex = new Map<string, string[]>();
	const databaseMap = new Map<string, DatabaseObjectResponse>();

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

		const databaseFiles = fs.readdirSync(databasesDir);
		for (const file of databaseFiles) {
			const filePath = path.join(databasesDir, file);
			const database: DatabaseObjectResponse = JSON.parse(
				fs.readFileSync(filePath, "utf-8")
			);
			databaseMap.set(path.basename(filePath, ".json"), database);
		}

		// Load edge case fixtures
		if (fs.existsSync(edgeCasesDir)) {
			const edgeCaseFiles = fs.readdirSync(edgeCasesDir);
			for (const file of edgeCaseFiles) {
				const filePath = path.join(edgeCasesDir, file);
				if (file.endsWith("-block.json")) {
					const block: BlockObjectResponse = JSON.parse(
						fs.readFileSync(filePath, "utf-8")
					);
					blockMap.set(block.id, block);
				}
			}
		}
	});

	const mockNotionClient = createMockNotionClient(
		blockMap,
		blockChildrenIndex,
		databaseMap
	);

	const schema = z.object({
		Name: properties.title,
		Summary: properties.text,
		"Created Date": properties.date,
		Tags: properties.multiSelect,
		Draft: properties.checkbox,
		Type: properties.select,
		Index: properties.number
	});

	const manager = new NotionDatabaseManager(
		mockNotionClient,
		schema,
		"1f7aa550f576807c9981e2376ba55ac6"
	);

	it("processes a database", async () => {
		const result = await manager.process({
			slugger(properties) {
				return properties.Name.toLowerCase().replace(/\s+/g, "-");
			}
		});

		expect(result).toMatchSnapshot();
	});

	describe("Error Handling", () => {
		it("should throw error for invalid schema validation", async () => {
			// Create a mock client that returns invalid database properties
			const invalidDatabaseResponse = JSON.parse(
				fs.readFileSync(
					path.join(edgeCasesDir, "invalid-properties-database.json"),
					"utf-8"
				)
			);

			const mockInvalidClient = {
				...mockNotionClient,
				databases: {
					query: vi.fn().mockResolvedValue(invalidDatabaseResponse)
				}
			} as unknown as Client;

			const invalidManager = new NotionDatabaseManager(
				mockInvalidClient,
				schema,
				"invalid-db-id"
			);

			await expect(
				invalidManager.process({
					slugger: (props) => "test-slug"
				})
			).rejects.toThrow(/Failed to parse schema for page ID/);
		});

		it("should handle content processing errors gracefully", async () => {
			// Create a mock client that throws during content fetch
			const mockFailingClient = {
				...mockNotionClient,
				databases: {
					query: vi.fn().mockResolvedValue({
						results: [
							{
								id: "test-page-id",
								object: "page",
								properties: {
									Name: {
										id: "title",
										type: "title",
										title: [{ plain_text: "Test Page" }]
									},
									Summary: {
										id: "summary",
										type: "rich_text",
										rich_text: [{ plain_text: "Test summary" }]
									},
									"Created Date": {
										id: "date",
										type: "date",
										date: { start: "2025-01-01" }
									},
									Index: {
										id: "index",
										type: "number",
										number: 1
									},
									Type: {
										id: "type",
										type: "select",
										select: { name: "Type" }
									},
									Tags: {
										id: "tags",
										type: "multi_select",
										multi_select: [{ name: "test" }]
									},
									Draft: {
										id: "draft",
										type: "checkbox",
										checkbox: false
									}
								}
							}
						]
					})
				},
				blocks: {
					retrieve: vi
						.fn()
						.mockRejectedValue(new Error("Network error during block fetch")),
					children: {
						list: vi.fn().mockRejectedValue(new Error("Children fetch failed"))
					}
				}
			} as unknown as Client;

			const failingManager = new NotionDatabaseManager(
				mockFailingClient,
				schema,
				"test-db-id"
			);

			await expect(
				failingManager.process({
					slugger: (props) => props.Name.toLowerCase().replace(/\s+/g, "-")
				})
			).rejects.toThrow(/Failed to process content for entry ID/);
		});

		it("should handle missing slugger function", async () => {
			await expect(
				manager.process({
					slugger: undefined
				})
			).rejects.toThrow();
		});

		it("should handle database query failures", async () => {
			const mockFailingDbClient = {
				...mockNotionClient,
				databases: {
					query: vi.fn().mockRejectedValue(new Error("Database not found"))
				}
			} as unknown as Client;

			const failingDbManager = new NotionDatabaseManager(
				mockFailingDbClient,
				schema,
				"nonexistent-db-id"
			);

			await expect(
				failingDbManager.process({
					slugger: (props) => "test"
				})
			).rejects.toThrow("Database not found");
		});

		it("should handle malformed filter parameters", async () => {
			// Create a mock that validates filter structure
			const mockClientWithFilterValidation = {
				...mockNotionClient,
				databases: {
					query: vi.fn().mockImplementation((params) => {
						// Simulate validation that would happen in the real Notion API
						if (params.filter && typeof params.filter.invalid === "string") {
							throw new Error("Invalid filter structure");
						}
						return Promise.resolve({ results: [] });
					})
				}
			} as unknown as Client;

			const filterTestManager = new NotionDatabaseManager(
				mockClientWithFilterValidation,
				schema,
				"test-db-id"
			);

			await expect(
				filterTestManager.process({
					// @ts-expect-error - testing invalid filter
					filter: { invalid: "filter structure" },
					slugger: (props) => "test"
				})
			).rejects.toThrow("Invalid filter structure");
		});
	});
});
