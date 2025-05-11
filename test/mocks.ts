import { vi } from "vitest";
import { Client } from "@notionhq/client";
import type {
  BlockObjectResponse,
  PageObjectResponse,
  ListBlockChildrenResponse,
  QueryDatabaseResponse,
  RichTextItemResponse,
  UserObjectResponse,
  PartialUserObjectResponse
} from "@notionhq/client/build/src/api-endpoints";

// Import fixture data from JSON files
import richTextFixturesData from "./fixtures/mockRichTextFixtures.json";
import iconFixturesData from "./fixtures/mockIconFixtures.json";
import paragraphBlockFixtureData from "./fixtures/paragraphBlockFixture.json";
import toggleBlockFixtureData from "./fixtures/toggleBlockFixture.json";
import childParagraphBlockFixtureData from "./fixtures/childParagraphBlockFixture.json";
import imageBlockFixtureData from "./fixtures/imageBlockFixture.json";
import tableRow1FixtureData from "./fixtures/tableRow1Fixture.json";
import tableRow2FixtureData from "./fixtures/tableRow2Fixture.json";
import tableBlockFixtureData from "./fixtures/tableBlockFixture.json";
import page1FixtureData from "./fixtures/page1Fixture.json";
import e2eHeading1BlockFixtureData from "./fixtures/e2eHeading1BlockFixture.json";
import e2eParagraphBlockFixtureData from "./fixtures/e2eParagraphBlockFixture.json";
import e2eBulletedListItemBlockFixtureData from "./fixtures/e2eBulletedListItemBlockFixture.json";
import e2ePage2FixtureData from "./fixtures/e2ePage2Fixture.json";
import e2eCodeBlockFixtureData from "./fixtures/e2eCodeBlockFixture.json";
import e2eQuoteBlockFixtureData from "./fixtures/e2eQuoteBlockFixture.json";
import e2ePage3FixtureData from "./fixtures/e2ePage3Fixture.json";

// Define the IconType based on PageObjectResponse['icon']
type IconType = Exclude<PageObjectResponse["icon"], null>;

// --- Exported Constants for IDs ---
export const page1Id = "page1_id";
export const paragraphBlockId = "paragraph_block_id_1";
export const toggleBlockId = "toggle_block_id_1";
export const childParagraphBlockId = "child_paragraph_block_id_1";
export const imageBlockId = "image_block_id_1";
export const tableBlockId = "table_block_id_1";
export const tableRow1Id = "table_row_1_id";
export const tableRow2Id = "table_row_2_id";

export const e2ePage2Id = "e2e_page_2_id";
export const e2eHeading1BlockId = "e2e_heading1_block_id";
export const e2eParagraphBlockId = "e2e_paragraph_block_id";
export const e2eBulletedListItemBlockId = "e2e_bulleted_list_item_block_id";

export const e2ePage3Id = "e2e_page_3_id";
export const e2eCodeBlockId = "e2e_code_block_id";
export const e2eQuoteBlockId = "e2e_quote_block_id";

// --- Cast and Export Fixtures ---

// Rich Text Fixtures
export const mockRichTextFixtures: Record<string, RichTextItemResponse[]> = {
  plain: richTextFixturesData.plain as RichTextItemResponse[],
  bold: richTextFixturesData.bold as RichTextItemResponse[],
  italic: richTextFixturesData.italic as RichTextItemResponse[],
  link: richTextFixturesData.link as RichTextItemResponse[],
  pageMention: richTextFixturesData.pageMention as RichTextItemResponse[],
  equation: richTextFixturesData.equation as RichTextItemResponse[]
};

// Icon Fixtures
export const mockIconFixtures: Record<string, IconType> = {
  emoji: iconFixturesData.emoji as IconType,
  external: iconFixturesData.external as IconType,
  file: iconFixturesData.file as IconType
};

// Block Fixtures
export const paragraphBlockFixture =
  paragraphBlockFixtureData as unknown as BlockObjectResponse;
export const toggleBlockFixture =
  toggleBlockFixtureData as unknown as BlockObjectResponse;
export const childParagraphBlockFixture =
  childParagraphBlockFixtureData as unknown as BlockObjectResponse;
export const imageBlockFixture =
  imageBlockFixtureData as unknown as BlockObjectResponse;
export const tableRow1Fixture =
  tableRow1FixtureData as unknown as BlockObjectResponse;
export const tableRow2Fixture =
  tableRow2FixtureData as unknown as BlockObjectResponse;
export const tableBlockFixture =
  tableBlockFixtureData as unknown as BlockObjectResponse;

// Page Fixtures
export const page1Fixture = page1FixtureData as unknown as PageObjectResponse;

// --- E2E Fixtures ---
export const e2eHeading1BlockFixture =
  e2eHeading1BlockFixtureData as unknown as BlockObjectResponse;
export const e2eParagraphBlockFixture =
  e2eParagraphBlockFixtureData as unknown as BlockObjectResponse;
export const e2eBulletedListItemBlockFixture =
  e2eBulletedListItemBlockFixtureData as unknown as BlockObjectResponse;
export const e2ePage2Fixture =
  e2ePage2FixtureData as unknown as PageObjectResponse;
export const e2eCodeBlockFixture =
  e2eCodeBlockFixtureData as unknown as BlockObjectResponse;
export const e2eQuoteBlockFixture =
  e2eQuoteBlockFixtureData as unknown as BlockObjectResponse;
export const e2ePage3Fixture =
  e2ePage3FixtureData as unknown as PageObjectResponse;

// --- Mock Notion Client Store ---

// Store for block children responses
export let mockBlockChildrenStore: Record<string, ListBlockChildrenResponse> =
  {};

// Store for database query responses
export let mockDatabaseQueryStore: Record<string, QueryDatabaseResponse> = {};

// Function to reset stores before each test
export const resetMocks = () => {
  mockBlockChildrenStore = {
    [page1Id]: {
      object: "list",
      results: [
        paragraphBlockFixture,
        toggleBlockFixture,
        imageBlockFixture,
        tableBlockFixture
      ],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [toggleBlockId]: {
      object: "list",
      results: [childParagraphBlockFixture],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [tableBlockId]: {
      object: "list",
      results: [tableRow1Fixture, tableRow2Fixture],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [e2ePage2Id]: {
      object: "list",
      results: [
        e2eHeading1BlockFixture,
        e2eParagraphBlockFixture,
        e2eBulletedListItemBlockFixture
      ],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [e2ePage3Id]: {
      object: "list",
      results: [e2eCodeBlockFixture, e2eQuoteBlockFixture],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    // Add empty results for blocks that are tested for having no children
    [paragraphBlockId]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [childParagraphBlockId]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [imageBlockId]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [tableRow1Id]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [tableRow2Id]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [e2eHeading1BlockId]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [e2eParagraphBlockId]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [e2eBulletedListItemBlockId]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [e2eCodeBlockId]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse,
    [e2eQuoteBlockId]: {
      object: "list",
      results: [],
      has_more: false,
      next_cursor: null,
      type: "block",
      block: {}
    } as ListBlockChildrenResponse
  };

  mockDatabaseQueryStore = {
    test_db_id: {
      // Default database ID used in tests
      object: "list",
      results: [page1Fixture, e2ePage2Fixture, e2ePage3Fixture],
      has_more: false,
      next_cursor: null,
      type: "page_or_database",
      page_or_database: {}
    } as QueryDatabaseResponse
  };
};

// Initialize stores
resetMocks();

// --- Mock Notion Client Implementation ---
export const mockNotionClient = {
  blocks: {
    children: {
      list: vi.fn().mockImplementation(async ({ block_id, start_cursor }) => {
        const response = mockBlockChildrenStore[block_id as string];
        if (!response) {
          return {
            object: "list",
            results: [],
            has_more: false,
            next_cursor: null,
            type: "block",
            block: {}
          };
        }
        // Simulate pagination if needed in future, for now, returns all if no cursor
        return response;
      })
    }
  },
  databases: {
    query: vi
      .fn()
      .mockImplementation(async ({ database_id, filter, start_cursor }) => {
        const response = mockDatabaseQueryStore[database_id as string];
        if (!response) {
          return {
            object: "list",
            results: [],
            has_more: false,
            next_cursor: null,
            type: "page_or_database",
            page_or_database: {}
          };
        }
        // Simulate filtering if needed in future, for now, returns all if no filter/cursor
        return response;
      })
  },
  users: {
    retrieve: vi.fn().mockImplementation(async ({ user_id }) => {
      return {
        object: "user",
        id: user_id,
        name: `Mock User ${user_id}`,
        type: "person",
        person: {}
      } as UserObjectResponse | PartialUserObjectResponse;
    })
  }
};

export const getMockClient = () => mockNotionClient as unknown as Client;
