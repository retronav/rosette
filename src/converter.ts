import type { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client";
import type { Element } from "hast";
import { toHtml } from "hast-util-to-html";
import { h } from "hastscript";
import { z } from "zod/v4";
import { _discriminatedElementUnion, element } from "./html.js";
import { explainZodError } from "./util.js";

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
		// discriminated union provides better error message
		// TODO: find a way to do this witout another zod pass
		const parsed = _discriminatedElementUnion.safeParse(block);
		if (!parsed.success) {
			throw new Error(
				`Failed to parse block: ${block.id} (${block.type})\n${explainZodError(parsed.error, block)}`
			);
		}
		const node = element.parse(block);
		if (block.children)
			node.children = block.children.map((b) => this.#blockToHastTree(b));
		return node;
	}

	async fetch(blockOrPageId: string): Promise<NotionBlock> {
		const block = (await this.notion.blocks.retrieve({
			block_id: blockOrPageId
		})) as NotionBlock;

		// @ts-expect-error
		if (block.has_children || block.object === "page") {
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
				block.children = undefined;
			} else if (block.type === "toggle") {
				block.toggle.children = block.children;
				block.children = undefined;
			}
		}
		return block;
	}
}
