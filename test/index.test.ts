import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  NotionConverter,
  NotionDatabaseManager,
  title,
  text,
  checkbox,
  multiSelect,
  date
} from "../src"; // Adjusted imports for schemas
import { Client } from "@notionhq/client";
import { z } from "zod";
import {
  mockNotionClient,
  mockRichTextFixtures,
  mockIconFixtures,
  paragraphBlockFixture,
  toggleBlockFixture,
  childParagraphBlockFixture,
  imageBlockFixture,
  tableBlockFixture,
  page1Id,
  page1Fixture,
  resetMocks,
  mockBlockChildrenStore,
  mockDatabaseQueryStore,
  e2ePage2Fixture,
  e2ePage3Fixture
} from "./mocks";

describe("NotionConverter", () => {
  let converter: NotionConverter;

  beforeEach(() => {
    resetMocks();
    converter = new NotionConverter(mockNotionClient as unknown as Client);
  });

  describe("fetchBlockChildren", () => {
    it("should fetch block children and their nested children", async () => {
      const blockId = page1Id;
      const blocks = await converter.fetchBlockChildren(blockId);

      expect(mockNotionClient.blocks.children.list).toHaveBeenCalledWith({
        block_id: blockId,
        start_cursor: undefined
      });
      expect(blocks.length).toBe(4);
      expect(blocks[0].id).toBe(paragraphBlockFixture.id);
      expect(blocks[1].id).toBe(toggleBlockFixture.id);
      expect((blocks[1] as any).children).toBeDefined();
      expect((blocks[1] as any).children.length).toBe(1);
      expect((blocks[1] as any).children[0].id).toBe(
        childParagraphBlockFixture.id
      );
      expect(mockNotionClient.blocks.children.list).toHaveBeenCalledWith({
        block_id: toggleBlockFixture.id,
        start_cursor: undefined
      });
    });

    it("should handle blocks with no children correctly", async () => {
      const blockId = paragraphBlockFixture.id; // This block has no children in mock store
      // Temporarily set up mock for this specific block if it's not page1Id
      mockBlockChildrenStore[blockId] = {
        object: "list",
        results: [], // No children
        has_more: false,
        next_cursor: null,
        type: "block",
        block: {}
      };
      const blocks = await converter.fetchBlockChildren(blockId);
      expect(mockNotionClient.blocks.children.list).toHaveBeenCalledWith({
        block_id: blockId,
        start_cursor: undefined
      });
      expect(blocks.length).toBe(0);
    });
  });

  describe("richTextToPlainText", () => {
    it("should convert rich text array to plain text", () => {
      const plainText = converter.richTextToPlainText(
        mockRichTextFixtures.plain
      );
      expect(plainText).toBe("Hello World");
    });

    it("should return empty string for empty rich text array", () => {
      const plainText = converter.richTextToPlainText([]);
      expect(plainText).toBe("");
    });
  });

  describe("blockToHtml", () => {
    const pageIdToSlugMap = new Map<string, string>([
      ["page_mention_id_1", "mentioned-page-slug"]
    ]);

    it("should convert a paragraph block to HTML", () => {
      const html = converter.blockToHtml(
        paragraphBlockFixture,
        pageIdToSlugMap
      );
      expect(html).toBe("<p>Hello World</p>");
    });

    it("should convert an image block to HTML", () => {
      const html = converter.blockToHtml(imageBlockFixture, pageIdToSlugMap);
      expect(html).toBe(
        '<figure><img src="https://example.com/image.png" alt="Hello World" /><figcaption>Hello World</figcaption></figure>'
      );
    });

    it("should convert a table block with rows to HTML", async () => {
      // fetchBlockChildren is called internally by blocksToHtml if a table has children
      // So we need to ensure the mock client is set up for the table's children (rows)
      // In this test, we directly call blockToHtml, so we manually construct the children
      const tableWithChildren = {
        ...tableBlockFixture,
        children: mockBlockChildrenStore[tableBlockFixture.id].results
      };
      const html = converter.blockToHtml(
        tableWithChildren as any,
        pageIdToSlugMap
      );
      expect(html).toContain("<table><tbody>");
      expect(html).toContain("<tr><td>R1C1</td><td>R1C2</td></tr>");
      expect(html).toContain("<tr><td>R2C1</td><td>R2C2</td></tr>");
      expect(html).toContain("</tbody></table>");
    });

    it("should return empty string for undefined block", () => {
      const html = converter.blockToHtml(undefined, pageIdToSlugMap);
      expect(html).toBe("");
    });

    it("should return comment for unsupported block type", () => {
      const unsupportedBlock = { type: "unsupported_type" } as any;
      const html = converter.blockToHtml(unsupportedBlock, pageIdToSlugMap);
      expect(html).toBe("<!-- Unsupported block type: unsupported_type -->");
    });
  });

  describe("richTextToHtml", () => {
    const pageIdToSlugMap = new Map<string, string>([
      ["page_mention_id_1", "mentioned-page-slug"]
    ]);

    it("should convert plain rich text to HTML", () => {
      const html = converter.richTextToHtml(
        mockRichTextFixtures.plain,
        pageIdToSlugMap
      );
      expect(html).toBe("Hello World");
    });

    it("should convert bold rich text to HTML", () => {
      const html = converter.richTextToHtml(
        mockRichTextFixtures.bold,
        pageIdToSlugMap
      );
      expect(html).toBe("<strong>Bold Text</strong>");
    });

    it("should convert italic rich text to HTML", () => {
      const html = converter.richTextToHtml(
        mockRichTextFixtures.italic,
        pageIdToSlugMap
      );
      expect(html).toBe("<em>Italic Text</em>");
    });

    it("should convert link rich text to HTML", () => {
      const html = converter.richTextToHtml(
        mockRichTextFixtures.link,
        pageIdToSlugMap
      );
      expect(html).toBe(
        '<a href="https://example.com" target="_blank">Link Text</a>'
      );
    });

    it("should convert page mention to link if slug exists", () => {
      const html = converter.richTextToHtml(
        mockRichTextFixtures.pageMention,
        pageIdToSlugMap
      );
      expect(html).toBe(
        '<a href="/posts/mentioned-page-slug/" class="page-mention">Mentioned Page</a>'
      );
    });

    it("should convert page mention to span if slug does not exist", () => {
      const html = converter.richTextToHtml(
        mockRichTextFixtures.pageMention,
        new Map()
      );
      expect(html).toBe(
        '<span class="page-mention-unresolved" data-page-id="page_mention_id_1">Mentioned Page (Unresolved mention)</span>'
      );
    });

    it("should convert equation rich text to HTML", () => {
      const html = converter.richTextToHtml(
        mockRichTextFixtures.equation,
        pageIdToSlugMap
      );
      expect(html).toBe('<span class="equation">e=mc^2</span>');
    });

    it("should return empty string for empty rich text array", () => {
      const html = converter.richTextToHtml([], pageIdToSlugMap);
      expect(html).toBe("");
    });
  });

  describe("blocksToHtml", () => {
    const pageIdToSlugMap = new Map<string, string>();

    it("should convert a list of blocks to HTML", () => {
      const blocks = [
        paragraphBlockFixture,
        {
          ...toggleBlockFixture,
          children: [childParagraphBlockFixture]
        } as any // Cast to any to add children for test purposes
      ];
      const html = converter.blocksToHtml(blocks, pageIdToSlugMap);
      expect(html).toContain("<p>Hello World</p>");
      expect(html).toContain(
        "<details><summary>Toggle Me</summary><p>Inside toggle</p></details>"
      );
    });

    it("should correctly handle nested bulleted lists", () => {
      const bullet1 = {
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: mockRichTextFixtures.plain },
        children: [
          {
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: mockRichTextFixtures.bold
            }
          } as any
        ]
      } as any;
      const html = converter.blocksToHtml([bullet1], pageIdToSlugMap);
      expect(html).toBe(
        "<ul><li>Hello World<ul><li><strong>Bold Text</strong></li></ul></li></ul>"
      );
    });

    it("should correctly handle nested numbered lists", () => {
      const numbered1 = {
        type: "numbered_list_item",
        numbered_list_item: { rich_text: mockRichTextFixtures.plain },
        children: [
          {
            type: "numbered_list_item",
            numbered_list_item: {
              rich_text: mockRichTextFixtures.italic
            }
          } as any
        ]
      } as any;
      const html = converter.blocksToHtml([numbered1], pageIdToSlugMap);
      expect(html).toBe(
        "<ol><li>Hello World<ol><li><em>Italic Text</em></li></ol></li></ol>"
      );
    });

    it("should return empty string for empty blocks array", () => {
      const html = converter.blocksToHtml([], pageIdToSlugMap);
      expect(html).toBe("");
    });
  });

  describe("renderIcon", () => {
    it("should render emoji icon", () => {
      const html = converter.renderIcon(mockIconFixtures.emoji as any);
      expect(html).toBe("🎉");
    });

    it("should render external icon as img tag", () => {
      const html = converter.renderIcon(mockIconFixtures.external as any);
      expect(html).toBe(
        '<img src="https://example.com/icon.png" class="icon" alt="Icon" />'
      );
    });

    it("should render file icon as img tag", () => {
      const html = converter.renderIcon(mockIconFixtures.file as any);
      expect(html).toBe(
        '<img src="https://example.com/file_icon.png" class="icon" alt="Icon" />'
      );
    });

    it("should return empty string for null or undefined icon", () => {
      expect(converter.renderIcon(null)).toBe("");
      expect(converter.renderIcon(undefined)).toBe("");
    });
  });
});

describe("NotionDatabaseManager", () => {
  let manager: NotionDatabaseManager<any>;
  const testSchema = z.object({
    Title: title,
    Description: text
  });
  const dbId = "test_db_id";

  beforeEach(() => {
    resetMocks(); // Resets the data stores
    mockNotionClient.databases.query.mockClear();
    mockNotionClient.blocks.children.list.mockClear();

    // Explicitly set mockDatabaseQueryStore for non-E2E 'process' tests
    mockDatabaseQueryStore[dbId] = {
      object: "list",
      results: [page1Fixture], // Only page1Fixture for these tests
      has_more: false,
      next_cursor: null,
      type: "page_or_database",
      page_or_database: {}
    };
    manager = new NotionDatabaseManager(
      mockNotionClient as unknown as Client,
      testSchema,
      dbId
    );
  });

  describe("process", () => {
    it("should process database entries, parse properties, generate slugs, and fetch content", async () => {
      const entries = await manager.process();

      expect(mockNotionClient.databases.query).toHaveBeenCalledWith({
        database_id: dbId,
        filter: undefined
      });
      expect(mockNotionClient.blocks.children.list).toHaveBeenCalledWith({
        block_id: page1Fixture.id,
        start_cursor: undefined
      });

      expect(entries.size).toBe(1);
      const entry = entries.get(page1Fixture.id);
      expect(entry).toBeDefined();
      expect(entry?.properties.Title).toBe("Page One Title");
      expect(entry?.properties.Description).toBe("Page one description.");
      expect(entry?.content).toContain("<p>Hello World</p>"); // Content from page1Id's blocks
    });

    it("should use custom slugger if provided", async () => {
      const customSlugger = vi.fn(
        (props: any) =>
          `custom-${props.Title.toLowerCase().replace(/\s+/g, "-")}`
      );
      await manager.process({ slugger: customSlugger });

      expect(customSlugger).toHaveBeenCalledWith({
        Title: "Page One Title",
        Description: "Page one description."
      });
      const entry = manager["entries"].get(page1Fixture.id);
      const slug = manager["slugs"].get(page1Fixture.id);
      expect(slug).toBe("custom-page-one-title");
    });

    it("should apply filter if provided", async () => {
      const filter = {
        property: "Published",
        checkbox: { equals: true }
      };
      await manager.process({ filter });
      expect(mockNotionClient.databases.query).toHaveBeenCalledWith({
        database_id: dbId,
        filter
      });
    });

    it("should handle empty database response", async () => {
      mockDatabaseQueryStore[dbId] = {
        // Override for this test
        object: "list",
        results: [],
        has_more: false,
        next_cursor: null,
        type: "page_or_database",
        page_or_database: {}
      };
      const entries = await manager.process();
      expect(entries.size).toBe(0);
      expect(mockNotionClient.blocks.children.list).not.toHaveBeenCalled();
    });
  });

  // --- E2E Test Scenarios ---
  describe("E2E Scenarios", () => {
    const e2eSchema = z.object({
      Title: title,
      Summary: text.optional(), // Optional for page 3
      Published: checkbox,
      Tags: multiSelect.optional(), // Optional for page 3
      ScheduledDate: date.optional() // Optional for page 2
    });

    beforeEach(() => {
      resetMocks();
      mockNotionClient.databases.query.mockClear();
      mockNotionClient.blocks.children.list.mockClear();

      const allE2EPages = [e2ePage2Fixture, e2ePage3Fixture];

      // Override the global mock for databases.query for E2E tests
      // to simulate filtering by the 'Published' property.
      mockNotionClient.databases.query.mockImplementation(
        async ({
          database_id,
          filter
        }: {
          database_id: string;
          filter?: any;
        }) => {
          let resultsToReturn = allE2EPages;
          if (
            filter &&
            filter.property === "Published" &&
            filter.checkbox &&
            typeof filter.checkbox.equals === "boolean"
          ) {
            resultsToReturn = allE2EPages.filter((page) => {
              const publishedProp = page.properties.Published as {
                type: "checkbox";
                checkbox: boolean;
              };
              return (
                publishedProp &&
                publishedProp.type === "checkbox" &&
                publishedProp.checkbox === filter.checkbox.equals
              );
            });
          }
          return Promise.resolve({
            object: "list",
            results: resultsToReturn,
            has_more: false,
            next_cursor: null,
            type: "page_or_database",
            page_or_database: {}
          } as any);
        }
      );

      // Ensure mockBlockChildrenStore is set up for E2E pages
      mockBlockChildrenStore[e2ePage2Fixture.id] = mockBlockChildrenStore[
        e2ePage2Fixture.id
      ] || {
        object: "list",
        results: [],
        has_more: false,
        next_cursor: null,
        type: "block",
        block: {}
      };
      mockBlockChildrenStore[e2ePage3Fixture.id] = mockBlockChildrenStore[
        e2ePage3Fixture.id
      ] || {
        object: "list",
        results: [],
        has_more: false,
        next_cursor: null,
        type: "block",
        block: {}
      };

      manager = new NotionDatabaseManager(
        mockNotionClient as unknown as Client,
        e2eSchema,
        dbId
      );
    });

    it("should correctly process a published blog post with various content types", async () => {
      const entries = await manager.process({
        filter: { property: "Published", checkbox: { equals: true } }
      });

      // Expecting only e2ePage2Fixture (published) due to the smarter mock query
      expect(entries.size).toBe(1);
      const blogPostEntry = entries.get(e2ePage2Fixture.id);
      expect(blogPostEntry).toBeDefined();

      // Check properties
      expect(blogPostEntry?.properties.Title).toBe("My First Blog Post");
      expect(blogPostEntry?.properties.Summary).toBe(
        "A short summary of the post."
      );
      expect(blogPostEntry?.properties.Published).toBe(true);
      expect(blogPostEntry?.properties.Tags).toEqual(["Tech", "Tutorial"]);

      // Check HTML content
      expect(blogPostEntry?.content).toContain("<h1>My First Blog Post</h1>");
      expect(blogPostEntry?.content).toContain(
        "<p>This is the introduction to my awesome blog post.</p>"
      );
      expect(blogPostEntry?.content).toContain("<ul><li>Point one</li></ul>");

      // Check slug generation (default)
      const slug = manager["slugs"].get(e2ePage2Fixture.id);
      expect(slug).toBe("my-first-blog-post");
    });

    it("should correctly process an unpublished draft with code and quote blocks", async () => {
      const entries = await manager.process({
        filter: { property: "Published", checkbox: { equals: false } }
      });

      // Expecting only e2ePage3Fixture (unpublished)
      expect(entries.size).toBe(1);
      const draftEntry = entries.get(e2ePage3Fixture.id);
      expect(draftEntry).toBeDefined();

      // Check properties
      expect(draftEntry?.properties.Title).toBe("Draft Post with Code");
      expect(draftEntry?.properties.Published).toBe(false);
      expect(draftEntry?.properties.ScheduledDate).toEqual(
        new Date("2024-06-01")
      );

      // Check HTML content
      expect(draftEntry?.content).toContain(
        '<pre><code class="language-javascript">console.log(&#039;Hello E2E&#039;);</code></pre>'
      );
      expect(draftEntry?.content).toContain(
        "<blockquote>This is a profound quote.</blockquote>"
      );

      // Check slug generation (default)
      const slug = manager["slugs"].get(e2ePage3Fixture.id);
      expect(slug).toBe("draft-post-with-code");
    });
  });
});
