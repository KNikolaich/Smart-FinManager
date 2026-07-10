import * as categoriesService from "../services/categories.service";
import { notifyUser } from "../socket";

export async function list(req: any, res: any) {
  try {
    const categories = await categoriesService.listCategories(req.user.userId);
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function create(req: any, res: any) {
  try {
    const category = await categoriesService.createCategory(req.user.userId, req.body);
    notifyUser(req.user.userId, "data:updated", { type: "categories" });
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function update(req: any, res: any) {
  try {
    const category = await categoriesService.updateCategory(req.user.userId, req.params.id, req.body);
    notifyUser(req.user.userId, "data:updated", { type: "categories" });
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function remove(req: any, res: any) {
  try {
    await categoriesService.deleteCategory(req.user.userId, req.params.id);
    notifyUser(req.user.userId, "data:updated", { type: "categories" });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
