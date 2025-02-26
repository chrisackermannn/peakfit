import { db } from "./db"; // Ensure this path is correct

export async function getMyImages() {
  try {
    const images = await db.image.findMany({
      select: {
        id: true,
        url: true,
        name: true,
        category: true, // Include category if applicable
      },
    });
    return images;
  } catch (error) {
    console.error("Error fetching images:", error);
    return [];
  }
}
