import type { z } from "zod/v4";

export function explainZodError<T>(error: z.ZodError, data: T) {
	const { issues } = error;

	let errorMsg = "";

	for (const [i, issue] of issues.entries()) {
		const obj = issue.path.slice(0, -1).reduce((acc, key) => {
			if (acc[key] === undefined) {
				acc[key] = {};
			}
			return acc[key];
		}, data);

		const finalKey = issue.path[issue.path.length - 1];

		errorMsg += `
${i + 1}: ${issue.message}

obj[${String(finalKey)}] = ${JSON.stringify(obj[finalKey])}
obj: ${JSON.stringify(obj, null, 2)}
`;
	}

	return errorMsg;
}
