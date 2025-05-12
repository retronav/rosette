# Rosette

Rosette is a library that transforms Notion pages into structured JSON and HTML, turning Notion into a lightweight, elegant CMS. Just like a @retronav/rosette, clean, beautiful, structured.

## Installation

```bash
npm install @retronav/rosette
```

## Usage

First, you'll need a Notion API key and a database ID. You can get your API key from [Notion's integrations page](https://www.notion.so/my-integrations).

```typescript
import { NotionDatabaseManager, properties } from "@retronav/rosette";
import { Client } from "@notionhq/client";
import { z } from "zod";

// 1. Initialize the Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 2. Define your database schema using Zod and Rosette's schema helpers
const mySchema = z.object({
  Title: properties.title, // For 'Title' property
  Description: properties.text, // For 'Text' or 'Rich Text' property
  Date: properties.date, // For 'Date' property
  Tags: properties.multiSelect, // For 'Multi-select' property
  Published: properties.checkbox // For 'Checkbox' property
  // Add more properties as needed, matching your Notion database structure
});

// 3. Create a NotionDatabaseManager instance
const databaseId = "your-notion-database-id";
const manager = new NotionDatabaseManager(notion, mySchema, databaseId);

// 4. Process the database entries
async function main() {
  try {
    const entries = await manager.process({
      // Optional: Add a filter if needed
      // filter: {
      //   property: 'Published',
      //   checkbox: {
      //     equals: true,
      //   },
      // },
      // Optional: Customize slug generation
      // slugger: (properties) => customSlugifyFunction(properties.Title),
    });

    entries.forEach((entry, id) => {
      console.log("Entry ID:", id);
      console.log("Properties:", entry.properties); // Parsed and typed according to your schema
      console.log("HTML Content:", entry.content); // HTML content of the Notion page
    });
  } catch (error) {
    console.error("Failed to process Notion database:", error);
  }
}

main();
```
