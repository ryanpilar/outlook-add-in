/* global console */

export async function sendText(text: string) {
  try {

    await fetch(`https://outlook-add-in-kdr8.onrender.com/log-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    console.log("Error: " + error);
  }
}

