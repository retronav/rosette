import { Client } from "@notionhq/client";
import {
	BlockObjectResponse,
	ListBlockChildrenResponse,
	PartialBlockObjectResponse,
	RichTextItemResponse,
	EquationRichTextItemResponse,
	MentionRichTextItemResponse,
	TextRichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints";

type NotionBlock = BlockObjectResponse | PartialBlockObjectResponse;
type NotionRichText = RichTextItemResponse;
type NotionIcon =
	| { type: "emoji"; emoji: string }
	| { type: "external"; external: { url: string } }
	| { type: "file"; file: { url: string; expiry_time: string } };

// Define a type for blocks that can have children, including the children property
type BlockWithChildren = NotionBlock & { children?: BlockWithChildren[] };

/**
 * Converts Notion blocks and rich text into HTML format.
 */
export class NotionConverter {
	private notion: Client;

	/**
	 * Creates an instance of NotionConverter.
	 * @param notion - The Notion Client instance.
	 */
	constructor(notion: Client) {
		this.notion = notion;
	}

	/**
	 * Recursively fetches all blocks including nested children for a given block ID.
	 * @param blockId - The ID of the block to fetch children for.
	 * @returns A promise that resolves to an array of blocks, with their children nested under the `children` property if applicable.
	 */
	async fetchBlockChildren(blockId: string): Promise<BlockWithChildren[]> {
		const blocks: BlockWithChildren[] = [];
		let cursor: string | undefined;
		while (true) {
			const { results, has_more, next_cursor }: ListBlockChildrenResponse =
				await this.notion.blocks.children.list({
					block_id: blockId,
					start_cursor: cursor,
				});
			blocks.push(...(results as BlockWithChildren[]));
			if (!has_more) break;
			cursor = next_cursor ?? undefined;
		}

		for (const block of blocks) {
			if (
				"has_children" in block && // Type guard
				block.has_children &&
				block.type && // Ensure type property exists
				[
					"paragraph",
					"bulleted_list_item",
					"numbered_list_item",
					"toggle",
					"quote",
					"callout",
					"synced_block",
					"template",
					"column",
					"column_list",
					"table",
				].includes(block.type)
			) {
				block.children = await this.fetchBlockChildren(block.id);
			}
		}
		return blocks;
	}

	/**
	 * Extracts plain text content from an array of Notion rich text objects.
	 * @param richTextArray - Array of Notion rich text objects.
	 * @returns A string containing the concatenated plain text from the rich text objects.
	 */
	richTextToPlainText(richTextArray: NotionRichText[]): string {
		if (!richTextArray || richTextArray.length === 0) return "";
		return richTextArray.map((rt) => rt.plain_text).join("");
	}

	/**
	 * Converts a single Notion block object to its HTML representation.
	 * This method handles various block types and recursively converts child blocks.
	 * @param block - The Notion block object to convert. Can be undefined.
	 * @param pageIdToSlugMap - A map of Notion page IDs to their corresponding slugs, used for resolving internal links.
	 * @returns The HTML string representation of the block, or an empty string if the block is undefined or its type is not defined.
	 */
	blockToHtml(
		block: BlockWithChildren | undefined,
		pageIdToSlugMap: Map<string, string>
	): string {
		if (!block || !("type" in block)) return ""; // Ensure block and block.type are defined

		switch (block.type) {
			case "paragraph":
				return `<p>${this.richTextToHtml(
					(block as Extract<BlockWithChildren, { type: "paragraph" }>).paragraph
						.rich_text,
					pageIdToSlugMap
				)}</p>`;
			case "heading_1":
				return `<h1>${this.richTextToHtml(
					(block as Extract<BlockWithChildren, { type: "heading_1" }>).heading_1
						.rich_text,
					pageIdToSlugMap
				)}</h1>`;
			case "heading_2":
				return `<h2>${this.richTextToHtml(
					(block as Extract<BlockWithChildren, { type: "heading_2" }>).heading_2
						.rich_text,
					pageIdToSlugMap
				)}</h2>`;
			case "heading_3":
				return `<h3>${this.richTextToHtml(
					(block as Extract<BlockWithChildren, { type: "heading_3" }>).heading_3
						.rich_text,
					pageIdToSlugMap
				)}</h3>`;
			case "bulleted_list_item":
				const bulletedListItem = block as Extract<
					BlockWithChildren,
					{ type: "bulleted_list_item" }
				>;
				return `<li>${this.richTextToHtml(
					bulletedListItem.bulleted_list_item.rich_text,
					pageIdToSlugMap
				)}${
					bulletedListItem.children
						? `<ul>${this.blocksToHtml(
								bulletedListItem.children,
								pageIdToSlugMap
						  )}</ul>`
						: ""
				}</li>`;
			case "numbered_list_item":
				const numberedListItem = block as Extract<
					BlockWithChildren,
					{ type: "numbered_list_item" }
				>;
				return `<li>${this.richTextToHtml(
					numberedListItem.numbered_list_item.rich_text,
					pageIdToSlugMap
				)}${
					numberedListItem.children
						? `<ol>${this.blocksToHtml(
								numberedListItem.children,
								pageIdToSlugMap
						  )}</ol>`
						: ""
				}</li>`;
			case "to_do":
				const toDoItem = block as Extract<BlockWithChildren, { type: "to_do" }>;
				return `<div class="todo-item"><input type="checkbox"${
					toDoItem.to_do.checked ? " checked" : ""
				} disabled /> <span>${this.richTextToHtml(
					toDoItem.to_do.rich_text,
					pageIdToSlugMap
				)}</span></div>`;
			case "toggle":
				const toggleItem = block as Extract<
					BlockWithChildren,
					{ type: "toggle" }
				>;
				return `<details><summary>${this.richTextToHtml(
					toggleItem.toggle.rich_text,
					pageIdToSlugMap
				)}</summary>${
					toggleItem.children
						? this.blocksToHtml(toggleItem.children, pageIdToSlugMap)
						: ""
				}</details>`;
			case "code":
				const codeBlock = block as Extract<BlockWithChildren, { type: "code" }>;
				return `<pre><code class="language-${
					codeBlock.code.language
				}">${this.richTextToHtml(
					codeBlock.code.rich_text,
					pageIdToSlugMap
				)}</code></pre>`;
			case "quote":
				const quoteBlock = block as Extract<
					BlockWithChildren,
					{ type: "quote" }
				>;
				return `<blockquote>${this.richTextToHtml(
					quoteBlock.quote.rich_text,
					pageIdToSlugMap
				)}${
					quoteBlock.children
						? this.blocksToHtml(quoteBlock.children, pageIdToSlugMap)
						: ""
				}</blockquote>`;
			case "callout":
				const calloutBlock = block as Extract<
					BlockWithChildren,
					{ type: "callout" }
				>;
				return `<div class="callout">${
					calloutBlock.callout.icon
						? `<div class="callout-icon">${this.renderIcon(
								calloutBlock.callout.icon as NotionIcon
						  )}</div>`
						: ""
				}<div class="callout-content">${this.richTextToHtml(
					calloutBlock.callout.rich_text,
					pageIdToSlugMap
				)}${
					calloutBlock.children
						? this.blocksToHtml(calloutBlock.children, pageIdToSlugMap)
						: ""
				}</div></div>`;
			case "divider":
				return "<hr>";
			case "image":
				const imageBlock = block as Extract<
					BlockWithChildren,
					{ type: "image" }
				>;
				const imageUrl =
					imageBlock.image.type === "external"
						? imageBlock.image.external.url
						: imageBlock.image.file.url;
				const captionText = this.richTextToPlainText(imageBlock.image.caption);
				const figcaption =
					imageBlock.image.caption && imageBlock.image.caption.length > 0
						? `<figcaption>${this.richTextToHtml(
								imageBlock.image.caption,
								pageIdToSlugMap
						  )}</figcaption>`
						: "";
				return `<figure><img src="${imageUrl}" alt="${
					captionText || "image"
				}" />${figcaption}</figure>`;
			case "table":
				const tableBlock = block as Extract<
					BlockWithChildren,
					{ type: "table" }
				>;
				if (!tableBlock.children) return "";
				const rows = tableBlock.children
					.map((row) => {
						if (!("type" in row) || row.type !== "table_row") return "";
						const tableRow = row as Extract<
							BlockWithChildren,
							{ type: "table_row" }
						>;
						const cells = tableRow.table_row.cells
							.map((cellRichTextArray) => {
								// Ensure cellRichTextArray is an array of RichTextItemResponse
								const richTextArray =
									cellRichTextArray as RichTextItemResponse[];
								return `<td>${this.richTextToHtml(
									richTextArray,
									pageIdToSlugMap
								)}</td>`;
							})
							.join("");
						return `<tr>${cells}</tr>`;
					})
					.join("");
				return `<table><tbody>${rows}</tbody></table>`;
			case "column_list":
				const columnListBlock = block as Extract<
					BlockWithChildren,
					{ type: "column_list" }
				>;
				return columnListBlock.children
					? `<div class="column-list">${this.blocksToHtml(
							columnListBlock.children,
							pageIdToSlugMap
					  )}</div>`
					: "";
			case "column":
				const columnBlock = block as Extract<
					BlockWithChildren,
					{ type: "column" }
				>;
				return columnBlock.children
					? `<div class="column">${this.blocksToHtml(
							columnBlock.children,
							pageIdToSlugMap
					  )}</div>`
					: "";
			case "link_preview":
				const linkPreviewBlock = block as Extract<
					BlockWithChildren,
					{ type: "link_preview" }
				>;
				return `<a href="${linkPreviewBlock.link_preview.url}" class="link-preview" target="_blank">${linkPreviewBlock.link_preview.url}</a>`;
			case "bookmark":
				const bookmarkBlock = block as Extract<
					BlockWithChildren,
					{ type: "bookmark" }
				>;
				const bookmarkCaption =
					bookmarkBlock.bookmark.caption &&
					bookmarkBlock.bookmark.caption.length > 0
						? this.richTextToHtml(
								bookmarkBlock.bookmark.caption,
								pageIdToSlugMap
						  )
						: bookmarkBlock.bookmark.url;
				return `<a href="${bookmarkBlock.bookmark.url}" class="bookmark" target="_blank">${bookmarkCaption}</a>`;
			default:
				// After the '!("type" in block)' guard, block should have a 'type'.
				// Casting to BlockObjectResponse to satisfy the compiler for the 'type' property.
				return `<!-- Unsupported block type: ${
					(block as BlockObjectResponse).type
				} -->`;
		}
	}

	/**
	 * Converts an array of Notion rich text objects into an HTML string.
	 * It handles various annotations (bold, italic, etc.), mentions, equations, and links.
	 * @param richTextArray - The array of Notion rich text objects.
	 * @param pageIdToSlugMap - A map of Notion page IDs to their corresponding slugs for internal page mentions.
	 * @returns The HTML string representation of the rich text array.
	 */
	richTextToHtml(
		richTextArray: NotionRichText[],
		pageIdToSlugMap: Map<string, string>
	): string {
		if (!richTextArray || richTextArray.length === 0) return "";
		return richTextArray
			.map((richText) => {
				let content = richText.plain_text
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;")
					.replace(/"/g, "&quot;")
					.replace(/'/g, "&#039;");

				if (richText.type === "mention") {
					const mention = richText as MentionRichTextItemResponse;
					if (mention.mention.type === "page") {
						const mentionedPageId = mention.mention.page.id;
						const mentionedPageSlug = pageIdToSlugMap.get(mentionedPageId);
						if (mentionedPageSlug) {
							return `<a href="/posts/${mentionedPageSlug}/" class="page-mention">${content}</a>`;
						}
						return `<span class="page-mention-unresolved" data-page-id="${mentionedPageId}">${content} (Unresolved mention)</span>`;
					}
					if (mention.mention.type === "user") {
						return `<span class="user-mention">@User</span>`; // Simplified for now
					}
					if (mention.mention.type === "date") {
						// Accessing mention.mention.date directly as its structure is defined within MentionRichTextItemResponse
						const dateData = mention.mention.date; // This is { start: string; end: string | null; time_zone: string | null; }
						const { start, end, time_zone } = dateData;
						return `<time datetime="${start}${end ? `/${end}` : ""}">${start}${
							end ? ` to ${end}` : ""
						}${time_zone ? ` (${time_zone})` : ""}</time>`;
					}
					return content; // Fallback for other mention types
				}

				if (richText.type === "equation") {
					const equation = richText as EquationRichTextItemResponse;
					return `<span class="equation">${equation.equation.expression}</span>`;
				}

				const textRichText = richText as TextRichTextItemResponse; // Assuming other types are TextRichTextItemResponse
				if (textRichText.annotations) {
					if (textRichText.annotations.bold)
						content = `<strong>${content}</strong>`;
					if (textRichText.annotations.italic) content = `<em>${content}</em>`;
					if (textRichText.annotations.strikethrough)
						content = `<del>${content}</del>`;
					if (textRichText.annotations.underline) content = `<u>${content}</u>`;
					if (textRichText.annotations.code)
						content = `<code>${content}</code>`;
					if (
						textRichText.annotations.color &&
						textRichText.annotations.color !== "default"
					) {
						content = `<span class="color-${textRichText.annotations.color}">${content}</span>`;
					}
				}

				if (textRichText.href) {
					content = `<a href="${textRichText.href}" target="_blank">${content}</a>`;
				}
				return content;
			})
			.join("");
	}

	/**
	 * Converts an array of Notion blocks to their HTML representation.
	 * This method correctly handles nested lists (bulleted and numbered).
	 * @param blocks - Array of Notion block objects.
	 * @param pageIdToSlugMap - A map of Notion page IDs to their corresponding slugs, used for resolving internal links.
	 * @returns The HTML string representation of the blocks.
	 */
	blocksToHtml(
		blocks: BlockWithChildren[],
		pageIdToSlugMap: Map<string, string>
	): string {
		if (!blocks || blocks.length === 0) return "";
		let html = "";
		let listType: "ul" | "ol" | null = null;

		for (let i = 0; i < blocks.length; i++) {
			const block = blocks[i];
			const nextBlock = blocks[i + 1] || null;

			if (!("type" in block)) continue; // Skip if block has no type

			if (block.type === "bulleted_list_item") {
				if (listType !== "ul") {
					if (listType) html += `</${listType}>`;
					html += "<ul>";
					listType = "ul";
				}
			} else if (block.type === "numbered_list_item") {
				if (listType !== "ol") {
					if (listType) html += `</${listType}>`;
					html += "<ol>";
					listType = "ol";
				}
			} else if (listType) {
				html += `</${listType}>`;
				listType = null;
			}

			html += this.blockToHtml(block, pageIdToSlugMap);

			const currentBlockIsList =
				block.type === "bulleted_list_item" ||
				block.type === "numbered_list_item";
			const nextBlockIsSameList =
				nextBlock && "type" in nextBlock && nextBlock.type === block.type;

			if (listType && currentBlockIsList && !nextBlockIsSameList) {
				html += `</${listType}>`;
				listType = null;
			}
		}

		if (listType) {
			html += `</${listType}>`;
		}
		return html;
	}

	/**
	 * Renders a Notion icon object (emoji, external URL, or file URL) to an HTML string.
	 * @param icon - The Notion icon object. Can be null or undefined.
	 * @returns An HTML string representing the icon (emoji character or an <img> tag), or an empty string if the icon is null, undefined, or of an unknown type.
	 */
	renderIcon(icon: NotionIcon | null | undefined): string {
		if (!icon) return "";
		if (icon.type === "emoji") return icon.emoji;
		if (icon.type === "file")
			return `<img src="${icon.file.url}" class="icon" alt="Icon" />`;
		if (icon.type === "external")
			return `<img src="${icon.external.url}" class="icon" alt="Icon" />`;
		return "";
	}
}
