import { Client } from "@notionhq/client";
import {
  PageObjectResponse,
  QueryDatabaseParameters
} from "@notionhq/client/build/src/api-endpoints";
import { z, ZodType } from "zod";
import { NotionConverter } from "./converter";

/**
 * Manages interactions with a Notion database, processing entries and converting them to a structured format.
 * @template T - A Zod schema type that defines the structure of the database properties.
 */
export class NotionDatabaseManager<T extends ZodType> {
  private converter: NotionConverter;

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
    { properties: z.infer<T>; slug: string; content: string }
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
  async process(options: {
    filter?: QueryDatabaseParameters["filter"];
    slugger: (properties: z.infer<T>) => string;
  }) {
    const response = await this.notion.databases.query({
      filter: options.filter,
      database_id: this.databaseId
    });

    for (const entry of response.results as PageObjectResponse[]) {
      try {
        const properties = this.schema.parse(entry.properties);
        const slug = options.slugger({ ...properties });
        this.slugs.set(entry.id, slug);
        this.entries.set(entry.id, {
          properties,
          slug: slug,
          content: ""
        });
      } catch (error) {
        let message = `Failed to parse schema for page ID ${entry.id}.`;
        if (error instanceof z.ZodError) {
          message += ` Validation issues: ${JSON.stringify(error.issues, null, 2)}`;
        } else if (error instanceof Error) {
          message += ` Original error: ${error.message}`;
        } else {
          message += ` Original error: ${String(error)}`;
        }
        const detailedError = new Error(message);
        if (error instanceof Error) {
          (detailedError as any).cause = error;
        }
        throw detailedError;
      }
    }

    const contentProcessingPromises = (
      response.results as PageObjectResponse[]
    ).map(async (entry) => {
      try {
        const blocks = await this.converter.fetchBlockChildren(entry.id);
        // this.slugs is populated in the previous loop and is read-only here
        const htmlContent = this.converter.blocksToHtml(blocks, this.slugs);
        return { entryId: entry.id, htmlContent };
      } catch (error) {
        let message = `Failed to process content for entry ID ${entry.id}.`;
        if (error instanceof Error) {
          message += ` Original error: ${error.message}`;
        } else {
          message += ` Original error: ${String(error)}`;
        }
        const detailedError = new Error(message);
        if (error instanceof Error) {
          // Attach original error as cause for better debugging
          (detailedError as any).cause = error;
        }
        throw detailedError;
      }
    });

    try {
      const processedContents = await Promise.all(contentProcessingPromises);

      for (const { entryId, htmlContent } of processedContents) {
        const existingEntry = this.entries.get(entryId);
        if (existingEntry) {
          this.entries.set(entryId, {
            ...existingEntry,
            content: htmlContent
          });
        } else {
          throw new Error(
            `[NotionDatabaseManager] Entry with ID ${entryId} was not found for content update. It should have been populated in the initial processing stage.`
          );
        }
      }
    } catch (error) {
      throw error;
    }

    return this.entries;
  }
}
