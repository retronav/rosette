/**
 * Script to convert Notion pages and blocks to JSON files for testing. This
 * script fetches a Notion page and its blocks, and saves them as JSON files.
 *
 * The script saves pages and blocks of pages as separate JSON files
 * at test/fixtures/NotionConverter/blocks for NotionConverter.
 *
 * The script saves databases at test/fixtures/NotionDatabaseManager/databases
 * and blocks of pages at test/fixtures/NotionDatabaseManager/blocks for
 * NotionDatabaseManager.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "@notionhq/client";

const notion = new Client({
	auth: process.env.NOTION_API_KEY
});

async function ensureDir(dirPath: string) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

async function fetchNotionConverterFixture(pageId: string) {
	console.log(`Fetching NotionConverter fixture for page: ${pageId}`);

	const fixtureDir = path.join(
		process.cwd(),
		"test/fixtures/NotionConverter/blocks"
	);
	await ensureDir(fixtureDir);

	const page = await notion.pages.retrieve({ page_id: pageId });
	fs.writeFileSync(
		path.join(fixtureDir, `${page.id}.json`),
		JSON.stringify(page, null, 2)
	);

	const blocks = [];
	let cursor: string | undefined;

	do {
		const response = await notion.blocks.children.list({
			block_id: pageId,
			start_cursor: cursor
		});
		blocks.push(...response.results);
		cursor = response.next_cursor || undefined;
	} while (cursor);

	for (const block of blocks) {
		fs.writeFileSync(
			path.join(fixtureDir, `${block.id}.json`),
			JSON.stringify(block, null, 2)
		);
	}

	console.log(`Saved page and ${blocks.length} blocks to ${fixtureDir}`);
}

async function fetchNotionDatabaseManagerFixture(databaseId: string) {
	console.log(
		`Fetching NotionDatabaseManager fixture for database: ${databaseId}`
	);

	const databaseDir = path.join(
		process.cwd(),
		"test/fixtures/NotionDatabaseManager/databases"
	);
	const blocksDir = path.join(
		process.cwd(),
		"test/fixtures/NotionDatabaseManager/blocks"
	);

	await ensureDir(databaseDir);
	await ensureDir(blocksDir);

	const database = await notion.databases.query({ database_id: databaseId });
	fs.writeFileSync(
		path.join(databaseDir, `${databaseId}.json`),
		JSON.stringify(database, null, 2)
	);

	const pages = [];
	let cursor: string | undefined;

	do {
		const response = await notion.databases.query({
			database_id: databaseId,
			start_cursor: cursor
		});
		pages.push(...response.results);
		cursor = response.next_cursor || undefined;
	} while (cursor);

	console.log(`Found ${pages.length} pages in database`);

	for (const page of pages) {
		const pageId = page.id;

		fs.writeFileSync(
			path.join(blocksDir, `${pageId}.json`),
			JSON.stringify(page, null, 2)
		);

		const blocks = [];
		let blockCursor: string | undefined;

		do {
			const response = await notion.blocks.children.list({
				block_id: pageId,
				start_cursor: blockCursor
			});
			blocks.push(...response.results);
			blockCursor = response.next_cursor || undefined;
		} while (blockCursor);

		for (const block of blocks) {
			fs.writeFileSync(
				path.join(blocksDir, `${block.id}.json`),
				JSON.stringify(block, null, 2)
			);
		}
	}

	console.log(
		`Saved database, ${pages.length} pages, and their blocks to fixtures`
	);
}

async function main() {
	const args = process.argv.slice(2);

	if (args.length < 2) {
		console.log("Usage:");
		console.log("  npm run fetch-fixture notion-converter <page-id>");
		console.log(
			"  npm run fetch-fixture notion-database-manager <database-id>"
		);
		process.exit(1);
	}

	const command = args[0];
	const id = args[1];

	if (!process.env.NOTION_API_KEY) {
		console.error("NOTION_API_KEY environment variable is required");
		process.exit(1);
	}

	try {
		switch (command) {
			case "notion-converter":
				await fetchNotionConverterFixture(id);
				break;
			case "notion-database-manager":
				await fetchNotionDatabaseManagerFixture(id);
				break;
			default:
				console.error(`Unknown command: ${command}`);
				console.log(
					"Available commands: notion-converter, notion-database-manager"
				);
				process.exit(1);
		}
	} catch (error) {
		console.error("Error:", error);
		process.exit(1);
	}
}

main();
