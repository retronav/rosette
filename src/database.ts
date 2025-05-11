import { Client } from "@notionhq/client";
import {
	PageObjectResponse,
	QueryDatabaseParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { z, ZodType } from "zod";
import { slugifyWithCounter } from "@sindresorhus/slugify";
import { NotionConverter } from "./converter";

/**
 * Manages interactions with a Notion database, processing entries and converting them to a structured format.
 * @template T - A Zod schema type that defines the structure of the database properties.
 */
export class NotionDatabaseManager<T extends ZodType> {
	private converter: NotionConverter;
	private defaultSlugger = slugifyWithCounter();

	/**
	 * Creates an instance of NotionDatabaseManager.
	 * @param notion - The Notion Client instance.
	 * @param schema - The Zod schema for the database properties.
	 * @param databaseId - The ID of the Notion database.
	 */
	constructor(
		private notion: Client,
		private schema: T,
		private databaseId: string
	) {
		this.converter = new NotionConverter(notion);
	}

	/**
	 * A map storing the processed database entries, where the key is the entry ID.
	 * Each value contains the parsed properties and the HTML content of the entry.
	 */
	private entries = new Map<
		string,
		{ properties: z.infer<T>; content: string }
	>();

	/**
	 * A map storing the generated slugs for each database entry, where the key is the entry ID and the value is the slug.
	 */
	private slugs = new Map<string, string>();

	/**
	 * Processes the Notion database entries based on the provided schema and options.
	 * Fetches entries, parses their properties, generates slugs, and converts page content to HTML.
	 * @param options - Optional parameters for filtering and slug generation.
	 * @param options.filter - Optional filter to apply when querying the database.
	 * @param options.slugger - Optional function to generate a slug from entry properties. Defaults to a slug generated from the 'title' property.
	 * @returns A promise that resolves to the map of processed entries.
	 */
	async process(
		options: {
			filter?: QueryDatabaseParameters["filter"];
			slugger?: (properties: z.infer<T>) => string;
		} = { slugger: (p) => this.defaultSlugger(p.title) }
	) {
		const response = await this.notion.databases.query({
			filter: options.filter,
			database_id: this.databaseId,
		});

		for (const entry of response.results as PageObjectResponse[]) {
			const properties = this.schema.parse(entry.properties);
			const slug = options.slugger!({ ...properties });
			this.slugs.set(entry.id, slug);
			this.entries.set(entry.id, {
				properties,
				content: "",
			});
		}

		for (const entry of response.results as PageObjectResponse[]) {
			const blocks = await this.converter.fetchBlockChildren(entry.id);
			this.entries.set(entry.id, {
				properties: this.entries.get(entry.id)!.properties,
				content: this.converter.blocksToHtml(blocks, this.slugs),
			});
		}

		return this.entries;
	}
}
