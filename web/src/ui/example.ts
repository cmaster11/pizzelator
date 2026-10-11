/** The example image: a 3000 × 4000 photo of a city street. */
import cityUrl from '../../../assets/city.jpg?url';

export const EXAMPLE_NAME = 'city.jpg';

/** Fetches the example as a file, only when asked: it is not part of the page load. */
export async function fetchExample(): Promise<File> {
  const response = await fetch(cityUrl);
  if (!response.ok) {
    throw new Error(`the example did not download (HTTP ${String(response.status)})`);
  }
  return new File([await response.blob()], EXAMPLE_NAME, { type: 'image/jpeg' });
}
