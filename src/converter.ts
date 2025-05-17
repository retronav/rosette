import { Client } from "@notionhq/client";
import { BlockObjectResponse } from "@notionhq/client";
import { element } from "./html";
import { toHtml } from "hast-util-to-html";
import { Element } from "hast";
import { h } from "hastscript";

export type NotionBlock = BlockObjectResponse & {
  children?: NotionBlock[];
} & (
    | {
        type: "table";
        table: {
          children: NotionBlock[];
        };
      }
    | {
        type: "toggle";
        toggle: {
          children: NotionBlock[];
        };
      }
  );

export class NotionConverter {
  constructor(private notion: Client) {}

  blocksToHtml(blocks: NotionBlock[]): string {
    const tree = h();
    tree.children = blocks.map((b) => this.#blockToHastTree(b));

    const html = toHtml(tree);
    return html;
  }

  #blockToHastTree(block: NotionBlock): Element {
    const node = element.parse(block);
    if (block.children)
      node.children = block.children.map((b) => this.#blockToHastTree(b));
    return node;
  }

  async fetch(blockOrPageId: string): Promise<NotionBlock> {
    const block = (await this.notion.blocks.retrieve({
      block_id: blockOrPageId
    })) as NotionBlock;

    if (block.has_children) {
      const childrenResponse = await this.notion.blocks.children.list({
        block_id: blockOrPageId
      });
      block.children = await Promise.all(
        childrenResponse.results.map(async (child) => {
          return this.fetch((child as BlockObjectResponse).id);
        })
      );

      if (block.type === "table") {
        block.table.children = block.children;
        delete block.children;
      } else if (block.type === "toggle") {
        block.toggle.children = block.children;
        delete block.children;
      }
    }
    return block;
  }
}
