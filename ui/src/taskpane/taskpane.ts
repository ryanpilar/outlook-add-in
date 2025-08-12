/* global console */

export async function sendText(text: string) {
  try {
    await fetch('http://localhost:4000/log-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    console.log("Error: " + error);
  }
}

