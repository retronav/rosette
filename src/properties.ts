import type { EnumLike } from "zod";
import * as z from "zod/v4";

// Helper schema for Notion's DateResponse object
const dateResponseSchema = z.object({
	start: z.string(),
	end: z.string().nullable().optional(),
	time_zone: z.string().nullable().optional()
});

// Helper schema for Notion's User Object (Partial or Full)
const userObjectSchema = z
	.object({
		id: z.string(),
		name: z.string().nullable().optional(),
		object: z.literal("user")
		// Other fields like 'type', 'person', 'bot', 'avatar_url' are ignored in transform
		// but allowed by loose if present in the input data.
	})
	.loose();

export namespace properties {
	/**
	 * Schema for parsing and transforming a Notion 'title' property.
	 * Transforms an array of rich text objects into a single string.
	 */
	export const title = () =>
		z
			.object({
				title: z.array(z.object({ plain_text: z.string() }))
			})
			.transform((data) => data.title.map((item) => item.plain_text).join(""));

	/**
	 * Schema for parsing and transforming a Notion 'rich_text' property (generic text).
	 * Transforms an array of rich text objects into a single string.
	 */
	export const text = () =>
		z // Covers 'rich_text' property type
			.object({
				rich_text: z.array(z.object({ plain_text: z.string() }))
			})
			.transform((data) => {
				return data.rich_text.map((item) => item.plain_text).join(""); // Fixed: added return
			});

	/**
	 * Schema for parsing and transforming a Notion 'date' property.
	 * Transforms a Notion date object into a JavaScript Date object or null.
	 */
	export const date = () =>
		z
			.object({
				// The 'date' key here matches the 'date' field in the Notion API response for a date property
				date: dateResponseSchema.nullable()
			})
			.transform((data) => {
				if (data.date?.start) {
					return new Date(data.date.start);
				}
				return null;
			});

	/**
	 * Schema for parsing and transforming a Notion 'checkbox' property.
	 * Extracts the boolean value.
	 */
	export const checkbox = () =>
		z
			.object({
				checkbox: z.boolean()
			})
			.transform((data) => data.checkbox);

	/**
	 * Schema for parsing and transforming a Notion 'multi_select' property.
	 * Transforms an array of select options into an array of their names (strings).
	 */
	export const multiSelect = () =>
		z
			.object({
				multi_select: z.array(
					z
						.object({
							name: z.string()
							// id: z.string().optional(), // Other fields like id, color are ignored
							// color: z.string().optional(),
						})
						.loose()
				)
			})
			.transform((data) => {
				return data.multi_select.map((item) => item.name);
			});

	/**
	 * Schema for parsing and transforming a Notion 'select' property.
	 * Transforms a select option object into its name (string) or null if not selected.
	 */
	export const select = (options: { enum: readonly string[] }) =>
		z
			.object({
				select: z
					.object({
						name: z.enum(options.enum)
						// id: z.string().optional(), // Other fields like id, color are ignored
						// color: z.string().optional(),
					})
					.loose()
					.nullable()
			})
			.transform((data) => {
				return data.select ? data.select.name : null;
			});

	/**
	 * Schema for parsing and transforming a Notion 'created_time' property.
	 * Transforms the ISO date string into a JavaScript Date object.
	 */
	export const createdTime = () =>
		z
			.object({
				created_time: z.string()
			})
			.transform((data) => {
				return new Date(data.created_time);
			});

	/**
	 * Schema for parsing and transforming a Notion 'last_edited_time' property.
	 * Transforms the ISO date string into a JavaScript Date object.
	 */
	export const lastEditedTime = () =>
		z
			.object({
				last_edited_time: z.string()
			})
			.transform((data) => {
				return new Date(data.last_edited_time);
			});

	/**
	 * Schema for parsing and transforming a Notion 'number' property.
	 * Extracts the number value (can be null).
	 */
	export const number = () =>
		z
			.object({
				number: z.number().nullable() // Changed from optional() to nullable() to better match API (number | null)
			})
			.transform((data) => {
				return data.number; // Handles null directly
			});

	/**
	 * Schema for parsing and transforming a Notion 'url' property.
	 * Extracts the URL string (can be null).
	 */
	export const url = () =>
		z
			.object({
				url: z.string().url().nullable()
			})
			.transform((data) => data.url);

	/**
	 * Schema for parsing and transforming a Notion 'status' property.
	 * Extracts the status name (string) or null if not set.
	 */
	export const status = () =>
		z
			.object({
				status: z
					.object({
						name: z.string()
						// id: z.string().optional(),
						// color: z.string().optional(),
					})
					.loose()
					.nullable()
			})
			.transform((data) => (data.status ? data.status.name : null));

	/**
	 * Schema for parsing and transforming a Notion 'email' property.
	 * Extracts the email string (can be null).
	 */
	export const email = () =>
		z
			.object({
				email: z.string().email().nullable()
			})
			.transform((data) => data.email);

	/**
	 * Schema for parsing and transforming a Notion 'phone_number' property.
	 * Extracts the phone number string (can be null).
	 */
	export const phoneNumber = () =>
		z
			.object({
				phone_number: z.string().nullable()
			})
			.transform((data) => data.phone_number);

	/**
	 * Schema for parsing and transforming a Notion 'files' property.
	 * Transforms an array of file objects into an array of their names (strings).
	 */
	export const files = () =>
		z
			.object({
				files: z.array(
					z
						.object({ name: z.string() })
						.and(
							z
								.object({ external: z.object({ url: z.string() }) })
								.or(z.object({ file: z.object({ url: z.string() }) }))
						) // Changed to use 'and' for clarity
				)
			})
			.transform((data) =>
				data.files.map((file) => ({
					name: file.name,
					url:
						"external" in file
							? file.external.url
							: "file" in file
								? file.file.url
								: ""
				}))
			);

	/**
	 * Schema for parsing and transforming a Notion 'created_by' property.
	 * Extracts the name of the user who created the item, or their ID if the name is not available.
	 */
	export const createdBy = () =>
		z
			.object({
				created_by: userObjectSchema
			})
			.transform((data) => data.created_by.name || data.created_by.id);

	/**
	 * Schema for parsing and transforming a Notion 'last_edited_by' property.
	 * Extracts the name of the user who last edited the item, or their ID if the name is not available.
	 */
	export const lastEditedBy = () =>
		z
			.object({
				last_edited_by: userObjectSchema
			})
			.transform((data) => data.last_edited_by.name || data.last_edited_by.id);

	/**
	 * Schema for parsing and transforming a Notion 'people' property.
	 * Transforms an array of user objects into an array of their names, or their IDs if the name is not available.
	 */
	export const people = () =>
		z
			.object({
				people: z.array(userObjectSchema)
			})
			.transform((data) => data.people.map((p) => p.name || p.id));

	/**
	 * Schema for parsing and transforming a Notion 'formula' property.
	 * Extracts the result of the formula based on its type (string, number, boolean, or date).
	 * Returns null if the formula type is not directly supported or if a date formula has no start date.
	 */
	export const formula = () =>
		z
			.object({
				formula: z.union([
					z.object({
						type: z.literal("string"),
						string: z.string()
					}),
					z.object({
						type: z.literal("number"),
						number: z.number()
					}),
					z.object({
						type: z.literal("boolean"),
						boolean: z.boolean()
					}),
					z.object({
						type: z.literal("date"),
						date: dateResponseSchema
					})
				])
			})
			.transform((data) => {
				const f = data.formula;
				if (f.type === "string") return f.string;
				if (f.type === "number") return f.number;
				if (f.type === "boolean") return f.boolean;
				if (f.type === "date" && f.date.start) {
					return new Date(f.date.start);
				}
				return null;
			});

	/**
	 * Schema for parsing and transforming a Notion 'button' property.
	 * Buttons in Notion trigger actions and do not have a data state to extract, so this transforms to null.
	 */
	export const button = () =>
		z
			.object({
				button: z.record(z.string(), z.never()) // Or z.object({})
			})
			.transform(() => null); // Buttons typically trigger actions, their state isn't data

	/**
	 * Schema for parsing and transforming a Notion 'unique_id' property.
	 * Extracts the unique ID object containing a prefix and a number.
	 */
	export const uniqueId = () =>
		z
			.object({
				unique_id: z.object({
					prefix: z.string().nullable(),
					number: z.number().nullable()
				})
			})
			.transform((data) => data.unique_id);

	/**
	 * Schema for parsing and transforming a Notion 'verification' property.
	 * Extracts the verification data (structure can be varied, so parsed as unknown).
	 */
	export const verification = () =>
		z
			.object({
				verification: z.unknown().nullable()
			})
			.transform((data) => data.verification);

	/**
	 * Schema for parsing and transforming a Notion 'relation' property.
	 * Transforms an array of related page objects into an array of their IDs (strings).
	 */
	export const relation = () =>
		z
			.object({
				relation: z.array(z.object({ id: z.string() }))
			})
			.transform((data) => data.relation.map((item) => item.id));

	/**
	 * Schema for parsing and transforming a Notion 'rollup' property.
	 * Extracts the result of the rollup based on its type (number, date, or array).
	 * Returns null for unsupported or incomplete rollups, or if a date rollup has no start date.
	 */
	export const rollup = () =>
		z
			.object({
				rollup: z.union([
					z.object({
						type: z.literal("number"),
						number: z.number().nullable(),
						function: z.string().optional()
					}),
					z.object({
						type: z.literal("date"),
						date: dateResponseSchema.nullable(),
						function: z.string().optional()
					}),
					z.object({
						type: z.literal("array"),
						array: z.array(z.unknown()), // Rollup array items are complex and varied
						function: z.string().optional()
					}),
					z.object({
						type: z.literal("unsupported"),
						unsupported: z.object({}).loose(),
						function: z.string().optional()
					}),
					z.object({
						type: z.literal("incomplete"),
						incomplete: z.object({}).loose(),
						function: z.string().optional()
					})
				])
			})
			.transform((data) => {
				const r = data.rollup;
				if (r.type === "number") return r.number;
				if (r.type === "date" && r.date) {
					return new Date(r.date.start);
				}
				if (r.type === "array") return r.array;
				if (r.type === "unsupported" || r.type === "incomplete") return null; // Or r to return the object
				return null;
			});
}
