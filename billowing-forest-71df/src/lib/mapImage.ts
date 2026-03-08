export async function generateAndStoreMapImage(
  eventId: number,
  lat: number,
  lng: number,
  apiKey: string,
  bucket: R2Bucket
): Promise<void> {
  const url =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}&zoom=14&size=1200x560&scale=1` +
    `&markers=color:red%7C${lat},${lng}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return;
  const buf = await res.arrayBuffer();
  await bucket.put(`event-${eventId}.png`, buf, {
    httpMetadata: { contentType: "image/png" },
  });
}
