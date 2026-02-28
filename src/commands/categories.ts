import { defineCommand } from "@crustjs/core";
import { spinner } from "@crustjs/prompts";
import type {
	CategoryAssignRequest,
	routes__v2__categories__CategoryCreate,
	routes__v2__categories__CategoryUpdate,
} from "nia-ai-ts";
import { V2ApiCategoriesService, V2ApiDataSourcesService } from "nia-ai-ts";
import { createSdk } from "../services/sdk.ts";
import { handleError } from "../utils/errors.ts";
import { createFormatter } from "../utils/formatter.ts";
import { parseGlobalFlags } from "../utils/global-flags.ts";

// --- Subcommands ---

const listCommand = defineCommand({
	meta: {
		name: "list",
		description: "List all categories",
	},
	args: [] as const,
	flags: {
		limit: {
			type: "number",
			description: "Number of categories to return",
		},
		offset: {
			type: "number",
			description: "Number of categories to skip",
		},
	},
	async run({ flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Loading categories...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiCategoriesService.listCategoriesV2CategoriesGet(
						flags.limit ?? undefined,
						flags.offset ?? undefined,
					);
				},
			});

			// In text mode, show as table
			if (global.output !== "json") {
				const data = result as Record<string, unknown>;
				const categories = (data.categories ?? data.items ?? []) as Array<
					Record<string, unknown>
				>;

				if (categories.length === 0) {
					console.log("No categories found.");
				} else {
					const rows = categories.map((c) => ({
						name: c.name ?? "",
						id: c.id ?? c.category_id ?? "",
						color: c.color ?? "",
						order: c.order ?? "",
					}));
					console.log(fmt.formatTable(rows, ["name", "id", "color", "order"]));

					if (data.total !== undefined) {
						console.log(`\nTotal: ${data.total} categories`);
					}
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			handleError(error, { domain: "Category" });
		}
	},
});

const createCommand = defineCommand({
	meta: {
		name: "create",
		description: "Create a new category",
	},
	args: [
		{
			name: "name",
			type: "string",
			description: "Category name",
			required: true,
		},
	] as const,
	flags: {
		color: {
			type: "string",
			description: "Hex color (e.g., #FF5733)",
		},
		order: {
			type: "number",
			description: "Display order",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Creating category...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					const payload: routes__v2__categories__CategoryCreate = {
						name: args.name,
					};

					if (flags.color) {
						payload.color = flags.color;
					}

					if (flags.order !== undefined) {
						payload.order = flags.order;
					}

					return await V2ApiCategoriesService.createCategoryV2CategoriesPost(
						payload,
					);
				},
			});

			// In text mode, show summary
			if (global.output !== "json") {
				const data = result as Record<string, unknown>;
				console.log("Category created successfully.");
				if (data.id ?? data.category_id) {
					console.log(`  ID: ${data.id ?? data.category_id}`);
				}
				if (data.name) {
					console.log(`  Name: ${data.name}`);
				}
				if (data.color) {
					console.log(`  Color: ${data.color}`);
				}
				if (data.order !== undefined) {
					console.log(`  Order: ${data.order}`);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			handleError(error, { domain: "Category" });
		}
	},
});

const updateCommand = defineCommand({
	meta: {
		name: "update",
		description: "Update an existing category",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Category ID",
			required: true,
		},
	] as const,
	flags: {
		name: {
			type: "string",
			description: "New category name",
		},
		color: {
			type: "string",
			description: "New hex color (e.g., #FF5733)",
		},
		order: {
			type: "number",
			description: "New display order",
		},
	},
	async run({ args, flags }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		// Require at least one update field
		if (!flags.name && !flags.color && flags.order === undefined) {
			fmt.error(
				"Provide at least one field to update: --name, --color, or --order",
			);
			process.exit(1);
		}

		try {
			const result = await spinner({
				message: "Updating category...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					const payload: routes__v2__categories__CategoryUpdate = {};

					if (flags.name) {
						payload.name = flags.name;
					}

					if (flags.color) {
						payload.color = flags.color;
					}

					if (flags.order !== undefined) {
						payload.order = flags.order;
					}

					return await V2ApiCategoriesService.updateCategoryV2CategoriesCategoryIdPatch(
						args.id,
						payload,
					);
				},
			});

			// In text mode, show summary
			if (global.output !== "json") {
				const data = result as Record<string, unknown>;
				console.log("Category updated successfully.");
				if (data.id ?? data.category_id) {
					console.log(`  ID: ${data.id ?? data.category_id}`);
				}
				if (data.name) {
					console.log(`  Name: ${data.name}`);
				}
				if (data.color) {
					console.log(`  Color: ${data.color}`);
				}
				if (data.order !== undefined) {
					console.log(`  Order: ${data.order}`);
				}
			} else {
				fmt.output(result);
			}
		} catch (error) {
			handleError(error, { domain: "Category" });
		}
	},
});

const deleteCommand = defineCommand({
	meta: {
		name: "delete",
		description: "Delete a category",
	},
	args: [
		{
			name: "id",
			type: "string",
			description: "Category ID",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		try {
			const result = await spinner({
				message: "Deleting category...",
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					return await V2ApiCategoriesService.deleteCategoryV2CategoriesCategoryIdDelete(
						args.id,
					);
				},
			});

			// In text mode, confirm deletion
			if (global.output !== "json") {
				console.log(`Category ${args.id} deleted successfully.`);
			} else {
				fmt.output(result ?? { success: true, id: args.id });
			}
		} catch (error) {
			handleError(error, { domain: "Category" });
		}
	},
});

const assignCommand = defineCommand({
	meta: {
		name: "assign",
		description: "Assign a category to a data source (pass 'null' to unassign)",
	},
	args: [
		{
			name: "source-id",
			type: "string",
			description: "Data source ID",
			required: true,
		},
		{
			name: "category-id",
			type: "string",
			description: "Category ID to assign, or 'null' to remove category",
			required: true,
		},
	] as const,
	flags: {},
	async run({ args }) {
		const global = parseGlobalFlags();
		const fmt = createFormatter({ output: global.output, color: global.color });

		const sourceId = args["source-id"];
		const categoryId = args["category-id"];
		const isUnassign = categoryId === "null";

		const message = isUnassign
			? "Removing category from source..."
			: "Assigning category...";

		try {
			const result = await spinner({
				message,
				task: async () => {
					await createSdk({ apiKey: global.apiKey });

					const payload: CategoryAssignRequest = {
						category_id: isUnassign ? null : categoryId,
					};

					return await V2ApiDataSourcesService.assignDataSourceCategoryV2DataSourcesSourceIdCategoryPatch(
						sourceId,
						payload,
					);
				},
			});

			// In text mode, confirm
			if (global.output !== "json") {
				if (isUnassign) {
					console.log(`Category removed from source ${sourceId}.`);
				} else {
					console.log(`Category ${categoryId} assigned to source ${sourceId}.`);
				}
			} else {
				fmt.output(
					result ?? {
						success: true,
						source_id: sourceId,
						category_id: categoryId,
					},
				);
			}
		} catch (error) {
			handleError(error, { domain: "Category" });
		}
	},
});

export const categoriesCommand = defineCommand({
	meta: {
		name: "categories",
		description: "Create and manage source categories",
	},
	subCommands: {
		list: listCommand,
		create: createCommand,
		update: updateCommand,
		delete: deleteCommand,
		assign: assignCommand,
	},
});
