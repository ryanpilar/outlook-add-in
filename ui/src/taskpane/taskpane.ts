/* global console */

export async function sendText(text: string) {
  try {
    await fetch(`${process.env.API_BASE_URL}/log-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    console.log("Error: " + error);
  }
}

