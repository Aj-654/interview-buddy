require('dotenv').config();
const OpenAI = require('openai').OpenAI;
const openai = new OpenAI(process.env.OPENAI_API_KEY);


// Function to be exposed globally
async function myapi(alltext) {
  const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
          {
            role: 'user',
            content: "Create a list of 8 interview questions from skills, experience and projects in this text: " + alltext  
          }
      ]
  });
  return response.choices[0].message.content;
}
module.exports = myapi;