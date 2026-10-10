import * as noteImagesService from "../services/noteImages.service";

export async function put(req: any, res: any) {
  try {
    const result = await noteImagesService.saveNoteImage(req.user.userId, req.params.id, req.body.dataUrl);
    res.json(result);
  } catch (error: any) {
    if (error instanceof noteImagesService.NoteImageError) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
}

export async function get(req: any, res: any) {
  try {
    const image = await noteImagesService.getNoteImage(req.user.userId, req.params.id);
    if (!image) return res.status(404).json({ error: "Картинка не найдена" });
    res.set({
      "Content-Type": image.mime,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.send(Buffer.from(image.data));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
