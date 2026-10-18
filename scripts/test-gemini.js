
require("dotenv").config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log("ERROR: GEMINI_API_KEY was not found in your .env file.");
    return;
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Reply with exactly: Gemini is working!"
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log("Gemini API error:", response.status);
      console.log(data.error?.message || "Unknown error");
      return;
    }

    console.log("SUCCESS: Gemini is connected!");
    console.log(
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Connected, but no text was returned."
    );
  } catch (error) {
    console.log("Connection error:", error.message);
  }
}

testGemini();
