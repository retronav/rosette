import type { Element } from "hast";
import { h } from "hastscript";
import * as z from "zod/v4";

export enum COLORS {
	BLUE = "blue",
	BLUE_BACKGROUND = "blue_background",
	BROWN = "brown",
	BROWN_BACKGROUND = "brown_background",
	DEFAULT = "default",
	GRAY = "gray",
	GRAY_BACKGROUND = "gray_background",
	GREEN = "green",
	GREEN_BACKGROUND = "green_background",
	ORANGE = "orange",
	ORANGE_BACKGROUND = "orange_background",
	PINK = "pink",
	PINK_BACKGROUND = "pink_background",
	PURPLE = "purple",
	PURPLE_BACKGROUND = "purple_background",
	RED = "red",
	RED_BACKGROUND = "red_background",
	YELLOW = "yellow",
	YELLOW_BACKGROUND = "yellow_background"
}

const colorClass = (color: COLORS) => {
	if (color === COLORS.DEFAULT) return "";
	return `notion-${color.replace("_", "-")}`;
};

const annotations = z.object({
	bold: z.boolean().optional(),
	italic: z.boolean().optional(),
	strikethrough: z.boolean().optional(),
	underline: z.boolean().optional(),
	code: z.boolean().optional(),
	color: z.nativeEnum(COLORS).optional()
});

function addAnnotations(
	originalNode: Element,
	data: z.infer<typeof annotations>
) {
	let node = originalNode;
	if (data.bold) node = h("strong", node);
	if (data.italic) node = h("em", node);
	if (data.strikethrough) node = h("del", node);
	if (data.underline) node = h("u", node);
	if (data.code) node = h("code", node);
	if (data.color && data.color !== COLORS.DEFAULT) {
		node = h("span", { class: colorClass(data.color) }, node);
	}
	return node;
}

export const richText = z
	.object({
		type: z.literal("text"),
		text: z.object({
			content: z.string(),
			link: z
				.object({
					url: z.string().optional()
				})
				.optional()
				.nullable()
		}),
		annotations
	})
	.loose()
	.transform((data) => {
		const { text } = data;

		// @ts-expect-error: using Root in place of Element is fine here
		let node = addAnnotations(h(null, text.content), data.annotations);

		if (text.link) {
			node = h("a", { href: text.link.url }, node);
		}
		return node;
	});

export const richEquation = z
	.object({
		type: z.literal("equation"),
		equation: z.object({
			expression: z.string()
		}),
		annotations
	})
	.loose()
	.transform((data) => {
		const { equation } = data;
		// rehype-katex classes
		const base = h("code", { class: "language-math" }, equation.expression);
		const node = addAnnotations(base, data.annotations);
		return node;
	});

export const richMentionPage = z
	.object({
		type: z.literal("mention"),
		mention: z.object({
			type: z.literal("page"),
			page: z.object({
				id: z.string()
			})
		}),
		annotations,
		plain_text: z.string(),
		href: z.string()
	})
	.loose()
	.transform((data) => {
		const { mention, plain_text } = data;
		const { page } = mention;
		const node = h("a", { "data-notion-page-mention": page.id }, plain_text);
		return addAnnotations(node, data.annotations);
	});

export const blockRichText = z.union([richText, richEquation, richMentionPage]);

export const heading1 = z
	.object({
		type: z.literal("heading_1"),
		heading_1: z.object({
			rich_text: z.array(blockRichText),
			is_toggleable: z.boolean().optional()
		})
	})
	.loose()
	.transform((data) => {
		const { heading_1 } = data;
		const node = h("h1", heading_1.rich_text);
		return node;
	});

export const heading2 = z
	.object({
		type: z.literal("heading_2"),
		heading_2: z.object({
			rich_text: z.array(blockRichText),
			is_toggleable: z.boolean().optional()
		})
	})
	.loose()
	.transform((data) => {
		const { heading_2 } = data;
		const node = h("h2", heading_2.rich_text);
		return node;
	});

export const heading3 = z
	.object({
		type: z.literal("heading_3"),
		heading_3: z.object({
			rich_text: z.array(blockRichText),
			is_toggleable: z.boolean().optional()
		})
	})
	.loose()
	.transform((data) => {
		const { heading_3 } = data;
		const node = h("h3", heading_3.rich_text);
		return node;
	});

export const paragraph = z
	.object({
		type: z.literal("paragraph"),
		paragraph: z.object({
			rich_text: z.array(blockRichText),
			color: z.nativeEnum(COLORS).optional()
		})
	})
	.loose()
	.transform((data) => {
		const { paragraph } = data;
		const node = h(
			"p",
			{ class: colorClass(paragraph.color) },
			paragraph.rich_text
		);
		return node;
	});

export const blockQuote = z
	.object({
		type: z.literal("quote"),
		quote: z.object({
			rich_text: z.array(blockRichText),
			color: z.nativeEnum(COLORS).optional()
		})
	})
	.loose()
	.transform((data) => {
		const { quote } = data;
		const node = h(
			"blockquote",
			{ class: colorClass(quote.color) },
			quote.rich_text
		);
		return node;
	});

export const code = z
	.object({
		type: z.literal("code"),
		code: z.object({
			rich_text: z.array(blockRichText),
			language: z.string()
		})
	})
	.loose()
	.transform((data) => {
		const { code } = data;
		const node = h(
			"pre",
			h("code", { class: `language-${code.language}` }, code.rich_text)
		);
		return node;
	});

export const image = z
	.object({
		type: z.literal("image"),
		image: z
			.object({
				type: z.literal("external"),
				external: z
					.object({
						url: z.string()
					})
					.optional(),
				caption: z.array(blockRichText).optional()
			})
			.or(
				z.object({
					type: z.literal("file"),
					file: z
						.object({
							url: z.string()
						})
						.optional(),
					caption: z.array(blockRichText).optional()
				})
			)
	})
	.loose()
	.transform((data) => {
		const { image } = data;
		const node = h(
			"figure",
			{},
			h("img", {
				src:
					"external" in image
						? image.external.url
						: "file" in image
							? image.file.url
							: ""
			}),
			image.caption ? h("figcaption", image.caption) : null
		);
		return node;
	});

export const video = z
	.object({
		type: z.literal("video"),
		video: z
			.object({
				type: z.literal("external"),
				external: z.object({
					url: z.string()
				}),
				caption: z.array(blockRichText).optional()
			})
			.or(
				z.object({
					type: z.literal("file"),
					file: z
						.object({
							url: z.string()
						})
						.optional(),
					caption: z.array(blockRichText).optional()
				})
			)
	})
	.loose()
	.transform((data) => {
		const { video } = data;
		const node = h(
			"figure",
			h("video", {
				src:
					"external" in video
						? video.external.url
						: "file" in video
							? video.file.url
							: "",
				controls: true
			}),
			video.caption ? h("figcaption", video.caption) : null
		);
		return node;
	});

const toggle = z
	.object({
		type: z.literal("toggle"),
		toggle: z.object({
			rich_text: z.array(blockRichText),
			color: z.nativeEnum(COLORS).optional(),
			children: z.array(z.lazy(() => element)).optional()
		})
	})
	.loose()
	.transform((data) => {
		const { toggle } = data;
		const node = h(
			"details",
			h("summary", { class: colorClass(toggle.color) }, toggle.rich_text),
			toggle.children ? h("div", toggle.children) : null
		);
		return node;
	});

export const tableRow = z
	.object({
		type: z.literal("table_row"),
		table_row: z.object({
			cells: z.array(z.array(blockRichText))
		})
	})
	.loose()
	.transform((data) => {
		const { table_row } = data;
		const node = h(
			"tr",
			table_row.cells.map((cell) => h("td", cell))
		);
		return node;
	});

export const table = z
	.object({
		type: z.literal("table"),
		table: z.object({
			table_width: z.number(),
			has_column_header: z.boolean(),
			has_row_header: z.boolean(),
			children: z.array(z.lazy(() => tableRow))
		})
	})
	.loose()
	.transform((data) => {
		const { table } = data;
		// split the children into rows
		const rows = [];
		for (let i = 0; i < table.children.length; i += table.table_width) {
			rows.push(table.children.slice(i, i + table.table_width));
		}
		const node = h("table", h("tbody", rows));
		return node;
	});

export const bulletedListItem = z
	.object({
		type: z.literal("bulleted_list_item"),
		bulleted_list_item: z.object({
			rich_text: z.array(blockRichText),
			color: z.nativeEnum(COLORS).optional(),
			children: z.array(z.lazy(() => element)).optional()
		})
	})
	.loose()
	.transform((data) => {
		const { bulleted_list_item } = data;
		const node = h(
			"ul",
			h(
				"li",
				{
					class: colorClass(bulleted_list_item.color)
				},
				bulleted_list_item.rich_text
			)
		);
		return node;
	});

export const numberedListItem = z
	.object({
		type: z.literal("numbered_list_item"),
		numbered_list_item: z.object({
			rich_text: z.array(blockRichText),
			color: z.nativeEnum(COLORS).optional(),
			children: z.array(z.lazy(() => element)).optional()
		})
	})
	.loose()
	.transform((data) => {
		const { numbered_list_item } = data;
		const node = h(
			"ol",
			h(
				"li",
				{
					class: colorClass(numbered_list_item.color)
				},
				numbered_list_item.rich_text
			)
		);
		return node;
	});

export const toDo = z
	.object({
		type: z.literal("to_do"),
		to_do: z.object({
			rich_text: z.array(blockRichText),
			checked: z.boolean(),
			color: z.enum(COLORS).optional(),
			children: z.array(z.lazy(() => element)).optional()
		})
	})
	.loose()
	.transform((data) => {
		const { to_do } = data;
		const node = h(
			"ul",
			h(
				"li",
				{
					class: colorClass(to_do.color)
				},
				h("input", { type: "checkbox", checked: to_do.checked }),
				to_do.rich_text
			)
		);
		return node;
	});

export const equation = richEquation.in
	.omit({ annotations: true })
	.transform((data) => {
		const { equation } = data;
		const node = h("code", { class: "language-math" }, equation.expression);
		return node;
	});

const blockTransformers = [
	heading1,
	heading2,
	heading3,
	paragraph,
	bulletedListItem,
	numberedListItem,
	toDo,
	blockQuote,
	code,
	image,
	video,
	table,
	toggle,
	equation
];

export const element = z.union(blockTransformers);

/** @internal */
export const _discriminatedElementUnion = z.discriminatedUnion(
	"type",
	blockTransformers.map((t: z.ZodPipe) => t.in)
);
