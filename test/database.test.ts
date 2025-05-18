import { describe, it, expect, beforeAll } from "vitest";
import { NotionDatabaseManager, properties } from "../src"; // Assuming NotionBlock is exported from ../src
import { BlockObjectResponse, DatabaseObjectResponse } from "@notionhq/client";
import * as fs from "fs";
import * as path from "path";
import { createMockNotionClient } from "./mocks";
import { z } from "zod";

const baseFixturesDir = path.join(
  __dirname,
  "fixtures",
  "NotionDatabaseManager"
);
const blocksDir = path.join(baseFixturesDir, "blocks");
const databasesDir = path.join(baseFixturesDir, "databases");

describe("NotionDatabaseManager", () => {
  const blockMap = new Map<string, BlockObjectResponse>();
  const blockChildrenIndex = new Map<string, string[]>();
  const databaseMap = new Map<string, DatabaseObjectResponse>();

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

    const databaseFiles = fs.readdirSync(databasesDir);
    databaseFiles.forEach((file) => {
      const filePath = path.join(databasesDir, file);
      const database: DatabaseObjectResponse = JSON.parse(
        fs.readFileSync(filePath, "utf-8")
      );
      databaseMap.set(path.basename(filePath, ".json"), database);
    });
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
    Draft: properties.checkbox
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

    const snapshot = fs.readFileSync(
      path.join(
        baseFixturesDir,
        "../..",
        "outputs",
        "NotionDatabaseManager",
        "output.json"
      ),
      "utf-8"
    );

  expect(result).toMatchSnapshot();
  });
});
